import fontkit from '@pdf-lib/fontkit';
import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import { Buffer } from 'buffer';

import { installBuffer } from '@/shared/installBuffer';

installBuffer();

import type { DocumentMetadata } from '@/domain/entities/DocumentMetadata';
import { emptyMetadata } from '@/domain/entities/DocumentMetadata';
import type { PdfDocument } from '@/domain/entities/PdfDocument';
import { findNode, getPage } from '@/domain/entities/PdfDocument';
import type { PdfImageNode } from '@/domain/entities/PdfImageNode';
import type { PdfNode } from '@/domain/entities/PdfNode';
import type { PdfPage as DomainPage } from '@/domain/entities/PdfPage';
import type { PdfTextNode } from '@/domain/entities/PdfTextNode';
import { PdfDomainError } from '@/domain/errors/PdfDomainError';
import type {
  AddImageCommand,
  AddTextCommand,
  PdfAstEngine,
  UpdateImageCommand,
  UpdateTextCommand,
} from '@/domain/services/PdfAstEngine';
import { IDENTITY } from '@/domain/valueObjects/Matrix';
import { createPdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import { parsePdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import { rect, type Rect } from '@/domain/valueObjects/Rect';
import { parseContentStream } from '@/infrastructure/pdf/contentStream/parser';
import type { ContentFragment } from '@/infrastructure/pdf/contentStream/parser';
import {
  joinFragments,
  removeTextFragment,
  rewriteImageFragment,
  rewriteTextFragment,
  writeImageOperators,
  writeTextOperators,
} from '@/infrastructure/pdf/contentStream/rewriter';
import { startsWithPdfHeader } from '@/infrastructure/pdf/bytes';
import type { FontMetrics } from '@/infrastructure/pdf/contentStream/parser';
import type { EncodedText } from '@/infrastructure/pdf/contentStream/rewriter';
import type { FontCodec } from '@/infrastructure/pdf/fonts/fontCodec';
import { UNICODE_FONT_BASE64 } from '@/infrastructure/pdf/fonts/unicodeFontData';
import {
  ensureFontResource,
  ensureImageResource,
  readFontCodecs,
  readFontMetrics,
  readImageResources,
  readVisibleBox,
  readPageContent,
  writePageContent,
} from '@/infrastructure/pdf/pdfLib/pageStreams';

type EngineSession = {
  pdf: PDFDocument;
  fragmentsByPage: Map<number, ContentFragment[]>;
  fonts: Map<string, Promise<PDFFont>>;
};

const HELVETICA_RESOURCE = 'FHelv';
const UNICODE_RESOURCE = 'FUni';

function bytesOf(font: PDFFont, text: string): string {
  const hex = font.encodeText(text).asBytes();
  let out = '';
  for (const byte of hex) {
    out += String.fromCharCode(byte);
  }
  return out;
}

function widthOfCodes(
  bytes: string,
  metrics: FontMetrics | undefined,
  fontSize: number,
): number | null {
  if (metrics === undefined) {
    return null;
  }
  let width = 0;
  const step = metrics.codeBytes;
  for (let i = 0; i + step <= bytes.length; i += step) {
    const code =
      step === 2
        ? (bytes.charCodeAt(i) << 8) | bytes.charCodeAt(i + 1)
        : bytes.charCodeAt(i);
    width += metrics.widths[code] ?? metrics.missingWidth;
  }
  return (width / 1000) * fontSize;
}

function isEncryptedError(error: unknown): boolean {
  return error instanceof Error && /encrypt|password/i.test(error.message);
}

export class PdfLibAstEngine implements PdfAstEngine {
  private readonly sessions = new Map<string, EngineSession>();
  private sequence = 0;

  async load(bytes: Uint8Array): Promise<PdfDocument> {
    if (bytes.length < 5) {
      throw new PdfDomainError(
        'INVALID_PDF',
        'Buffer is too short to be a PDF',
      );
    }
    if (!startsWithPdfHeader(bytes)) {
      throw new PdfDomainError('INVALID_PDF', 'Missing %PDF- header');
    }

    let pdf: PDFDocument;
    try {
      pdf = await PDFDocument.load(bytes, {
        updateMetadata: false,
        ignoreEncryption: false,
      });
    } catch (error) {
      if (isEncryptedError(error)) {
        throw new PdfDomainError(
          'ENCRYPTED_PDF',
          'Encrypted PDFs are not opened without a password',
        );
      }
      throw new PdfDomainError(
        'INVALID_PDF',
        error instanceof Error ? error.message : 'Unable to parse PDF',
      );
    }

    let pages: PDFPage[];
    try {
      pages = pdf.getPages();
    } catch (error) {
      throw new PdfDomainError(
        'INVALID_PDF',
        error instanceof Error ? error.message : 'PDF catalog is unreadable',
      );
    }
    if (pages.length === 0) {
      throw new PdfDomainError('INVALID_PDF', 'PDF catalog contains no pages');
    }

    const id = `doc-${this.sequence}`;
    this.sequence += 1;
    const fragmentsByPage = new Map<number, ContentFragment[]>();
    pages.forEach((page, index) => {
      fragmentsByPage.set(index, this.parsePage(page, index));
    });
    pdf.registerFontkit(fontkit);
    this.sessions.set(id, { pdf, fragmentsByPage, fonts: new Map() });
    return this.toDomain(id, pdf, fragmentsByPage);
  }

  async addText(
    document: PdfDocument,
    command: AddTextCommand,
  ): Promise<PdfTextNode> {
    if (command.content.trim().length === 0) {
      throw new PdfDomainError('EMPTY_TEXT', 'Text content must not be empty');
    }
    if (command.fontSize <= 0) {
      throw new PdfDomainError(
        'INVALID_FONT_SIZE',
        'Font size must be positive',
      );
    }
    getPage(document, command.pageIndex);
    const session = this.requireSession(document.id);
    const page = this.requireNativePage(session, command.pageIndex);
    const { encoded, width } = await this.encodeWithEditorFont(
      session,
      page,
      command.content,
      command.fontSize,
    );
    const fontName = encoded.fontName;

    const fragments = this.pageFragments(session, command.pageIndex);
    const ordinal = fragments.filter(
      (fragment) => fragment.kind === 'text',
    ).length;
    const node: PdfTextNode = {
      id: createPdfObjectId(command.pageIndex, 'text', ordinal),
      type: 'text',
      pageIndex: command.pageIndex,
      bounds: rect(
        command.bounds.x,
        command.bounds.y,
        Math.max(command.bounds.width, width),
        command.bounds.height,
      ),
      content: command.content,
      fontName,
      fontSize: command.fontSize,
      color: command.color,
    };
    fragments.push({
      kind: 'text',
      node,
      raw: writeTextOperators(node, encoded),
      placement: null,
      encoded,
    });
    this.commitPage(session, page, command.pageIndex);
    return node;
  }

  async updateText(
    document: PdfDocument,
    command: UpdateTextCommand,
  ): Promise<PdfTextNode> {
    const existing = this.resolveNode(document, command.nodeId);
    if (existing.type !== 'text') {
      throw new PdfDomainError(
        'NODE_NOT_FOUND',
        `Node ${command.nodeId} is not a text object`,
      );
    }
    if (command.content !== undefined && command.content.trim().length === 0) {
      throw new PdfDomainError('EMPTY_TEXT', 'Text content must not be empty');
    }
    if (command.fontSize !== undefined && command.fontSize <= 0) {
      throw new PdfDomainError(
        'INVALID_FONT_SIZE',
        'Font size must be positive',
      );
    }
    const session = this.requireSession(document.id);
    const location = parsePdfObjectId(command.nodeId);
    const page = this.requireNativePage(session, location.pageIndex);
    const fragments = this.pageFragments(session, location.pageIndex);
    const index = fragments.findIndex(
      (fragment) =>
        fragment.kind === 'text' && fragment.node.id === command.nodeId,
    );
    const current = fragments[index];
    if (current === undefined || current.kind !== 'text') {
      throw new PdfDomainError(
        'NODE_NOT_FOUND',
        `Text stream node ${command.nodeId} is missing`,
      );
    }
    const content = command.content ?? current.node.content;
    const fontSize = command.fontSize ?? current.node.fontSize;
    const { encoded, width } = await this.encodeForRun(
      session,
      page,
      current,
      content,
      fontSize,
    );
    const next = rewriteTextFragment(
      current,
      {
        ...(command.content !== undefined ? { content: command.content } : {}),
        ...(command.fontSize !== undefined
          ? { fontSize: command.fontSize }
          : {}),
        ...(command.color !== undefined ? { color: command.color } : {}),
        bounds: rect(
          current.node.bounds.x,
          current.node.bounds.y,
          width ?? current.node.bounds.width,
          current.node.bounds.height,
        ),
      },
      encoded,
    );
    fragments[index] = next;
    this.commitPage(session, page, location.pageIndex);
    return next.node;
  }

  async addImage(
    document: PdfDocument,
    command: AddImageCommand,
  ): Promise<PdfImageNode> {
    getPage(document, command.pageIndex);
    const session = this.requireSession(document.id);
    const page = this.requireNativePage(session, command.pageIndex);
    const embedded = await this.embedImage(
      session.pdf,
      command.imageBytes,
      command.mimeType,
    );
    const fragments = this.pageFragments(session, command.pageIndex);
    const ordinal = fragments.filter(
      (fragment) => fragment.kind === 'image',
    ).length;
    const resourceName = `ImAdd${ordinal}`;
    ensureImageResource(page, session.pdf, resourceName, embedded.ref);
    const body = writeImageOperators(resourceName, command.bounds);
    const node: PdfImageNode = {
      id: createPdfObjectId(command.pageIndex, 'image', ordinal),
      type: 'image',
      pageIndex: command.pageIndex,
      bounds: command.bounds,
      resourceName,
      pixelWidth: embedded.width,
      pixelHeight: embedded.height,
    };
    fragments.push({
      kind: 'image',
      node,
      raw: body,
      placement: { ctm: IDENTITY, transform: IDENTITY, body },
    });
    this.commitPage(session, page, command.pageIndex);
    return node;
  }

  async updateImage(
    document: PdfDocument,
    command: UpdateImageCommand,
  ): Promise<PdfImageNode> {
    const existing = this.resolveNode(document, command.nodeId);
    if (existing.type !== 'image') {
      throw new PdfDomainError(
        'NODE_NOT_FOUND',
        `Node ${command.nodeId} is not an image XObject`,
      );
    }
    const { resourceName } = existing;
    if (resourceName === null) {
      throw new PdfDomainError(
        'UNSUPPORTED_IMAGE',
        `Node ${command.nodeId} is an inline image; its pixels cannot be replaced`,
      );
    }
    const session = this.requireSession(document.id);
    const location = parsePdfObjectId(command.nodeId);
    const page = this.requireNativePage(session, location.pageIndex);
    const embedded = await this.embedImage(
      session.pdf,
      command.imageBytes,
      command.mimeType,
    );
    ensureImageResource(page, session.pdf, resourceName, embedded.ref);
    const fragments = this.pageFragments(session, location.pageIndex);
    const index = fragments.findIndex(
      (fragment) =>
        fragment.kind === 'image' && fragment.node.id === command.nodeId,
    );
    const current = fragments[index];
    if (current === undefined || current.kind !== 'image') {
      throw new PdfDomainError(
        'NODE_NOT_FOUND',
        `Image stream node ${command.nodeId} is missing`,
      );
    }
    const node: PdfImageNode = {
      ...current.node,
      pixelWidth: embedded.width,
      pixelHeight: embedded.height,
    };
    fragments[index] = { ...current, node };
    this.commitPage(session, page, location.pageIndex);
    return node;
  }

  async deleteNode(
    document: PdfDocument,
    nodeId: PdfTextNode['id'],
  ): Promise<void> {
    this.resolveNode(document, nodeId);
    const session = this.requireSession(document.id);
    const location = parsePdfObjectId(nodeId);
    const page = this.requireNativePage(session, location.pageIndex);
    const fragments = this.pageFragments(session, location.pageIndex);
    const index = fragments.findIndex(
      (fragment) =>
        fragment.kind !== 'passthrough' && fragment.node.id === nodeId,
    );
    const current = fragments[index];
    if (current === undefined || current.kind === 'passthrough') {
      throw new PdfDomainError(
        'NODE_NOT_FOUND',
        `Content stream does not contain ${nodeId}`,
      );
    }
    const remainder =
      current.kind === 'text' ? removeTextFragment(current) : null;
    const next = [
      ...fragments.slice(0, index),
      ...(remainder === null ? [] : [remainder]),
      ...fragments.slice(index + 1),
    ];
    session.fragmentsByPage.set(location.pageIndex, next);
    this.commitPage(session, page, location.pageIndex);
  }

  async moveNode(
    document: PdfDocument,
    nodeId: PdfTextNode['id'],
    bounds: Rect,
  ): Promise<void> {
    this.resolveNode(document, nodeId);
    const session = this.requireSession(document.id);
    const location = parsePdfObjectId(nodeId);
    const page = this.requireNativePage(session, location.pageIndex);
    const fragments = this.pageFragments(session, location.pageIndex);
    const index = fragments.findIndex((fragment) => {
      if (fragment.kind === 'passthrough') {
        return false;
      }
      return fragment.node.id === nodeId;
    });
    const current = fragments[index];
    if (current === undefined || current.kind === 'passthrough') {
      throw new PdfDomainError(
        'NODE_NOT_FOUND',
        `Content stream does not contain ${nodeId}`,
      );
    }
    fragments[index] =
      current.kind === 'text'
        ? rewriteTextFragment(current, { bounds })
        : rewriteImageFragment(current, bounds);
    this.commitPage(session, page, location.pageIndex);
  }

  async serialize(document: PdfDocument): Promise<Uint8Array> {
    const session = this.requireSession(document.id);
    try {
      this.restoreMetadata(session.pdf, document.metadata);
      const bytes = await session.pdf.save({ updateFieldAppearances: false });
      return bytes;
    } catch (error) {
      throw new PdfDomainError(
        'SERIALIZATION_FAILED',
        error instanceof Error ? error.message : 'Unable to serialize PDF',
      );
    }
  }

  async snapshot(document: PdfDocument): Promise<PdfDocument> {
    const session = this.requireSession(document.id);
    return this.toDomain(document.id, session.pdf, session.fragmentsByPage);
  }

  dispose(documentId: string): void {
    this.sessions.delete(documentId);
  }

  disposeAll(): void {
    this.sessions.clear();
  }

  private parsePage(page: PDFPage, pageIndex: number): ContentFragment[] {
    return parseContentStream({
      source: readPageContent(page),
      pageIndex,
      imageResources: readImageResources(page),
      fonts: readFontMetrics(page),
      codecs: readFontCodecs(page),
    });
  }

  private embedded(
    session: EngineSession,
    key: string,
    load: () => Promise<PDFFont>,
  ): Promise<PDFFont> {
    const cached = session.fonts.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const pending = load();
    session.fonts.set(key, pending);
    return pending;
  }

  /**
   * Encodes text in Helvetica when WinAnsi can show it, otherwise in the
   * bundled Unicode font (Romanian, Greek, Cyrillic, symbols…).
   */
  private async encodeWithEditorFont(
    session: EngineSession,
    page: PDFPage,
    content: string,
    fontSize: number,
  ): Promise<{ encoded: EncodedText; width: number }> {
    const helvetica = await this.embedded(session, HELVETICA_RESOURCE, () =>
      session.pdf.embedFont(StandardFonts.Helvetica),
    );
    try {
      const bytes = bytesOf(helvetica, content);
      ensureFontResource(page, session.pdf, HELVETICA_RESOURCE, helvetica.ref);
      return {
        encoded: { fontName: HELVETICA_RESOURCE, bytes },
        width: helvetica.widthOfTextAtSize(content, fontSize),
      };
    } catch {
      const unicode = await this.embedded(session, UNICODE_RESOURCE, () =>
        session.pdf.embedFont(Buffer.from(UNICODE_FONT_BASE64, 'base64'), {
          subset: false,
        }),
      );
      ensureFontResource(page, session.pdf, UNICODE_RESOURCE, unicode.ref);
      return {
        encoded: {
          fontName: UNICODE_RESOURCE,
          bytes: bytesOf(unicode, content),
        },
        width: unicode.widthOfTextAtSize(content, fontSize),
      };
    }
  }

  /**
   * Re-encodes edited text in the run's own font when that font has every
   * glyph, so the edit keeps the document's typeface; otherwise switches the
   * run to an editor font.
   */
  private async encodeForRun(
    session: EngineSession,
    page: PDFPage,
    fragment: Extract<ContentFragment, { kind: 'text' }>,
    content: string,
    fontSize: number,
  ): Promise<{ encoded: EncodedText; width: number | null }> {
    const original = fragment.placement?.fontName;
    if (original !== undefined) {
      const codec: FontCodec | undefined = readFontCodecs(page)[original];
      const bytes = codec?.encode(content) ?? null;
      if (bytes !== null) {
        return {
          encoded: { fontName: original, bytes },
          width: widthOfCodes(bytes, readFontMetrics(page)[original], fontSize),
        };
      }
    }
    return this.encodeWithEditorFont(session, page, content, fontSize);
  }

  private commitPage(
    session: EngineSession,
    page: PDFPage,
    pageIndex: number,
  ): void {
    const fragments = this.pageFragments(session, pageIndex);
    writePageContent(page, joinFragments(fragments));
  }

  private pageFragments(
    session: EngineSession,
    pageIndex: number,
  ): ContentFragment[] {
    const existing = session.fragmentsByPage.get(pageIndex);
    if (existing === undefined) {
      const parsed = this.parsePage(
        this.requireNativePage(session, pageIndex),
        pageIndex,
      );
      session.fragmentsByPage.set(pageIndex, parsed);
      return parsed;
    }
    return existing;
  }

  private resolveNode(
    document: PdfDocument,
    nodeId: PdfTextNode['id'],
  ): PdfNode {
    const session = this.sessions.get(document.id);
    if (session !== undefined) {
      const location = parsePdfObjectId(nodeId);
      const fragment = this.pageFragments(session, location.pageIndex).find(
        (candidate) =>
          candidate.kind !== 'passthrough' && candidate.node.id === nodeId,
      );
      if (fragment !== undefined && fragment.kind !== 'passthrough') {
        return fragment.node;
      }
    }
    return findNode(document, nodeId);
  }

  private requireSession(documentId: string): EngineSession {
    const session = this.sessions.get(documentId);
    if (session === undefined) {
      throw new PdfDomainError(
        'ENGINE_SESSION_MISSING',
        `No live AST session for ${documentId}`,
      );
    }
    return session;
  }

  private requireNativePage(
    session: EngineSession,
    pageIndex: number,
  ): PDFPage {
    const page = session.pdf.getPages()[pageIndex];
    if (page === undefined) {
      throw new PdfDomainError(
        'PAGE_OUT_OF_RANGE',
        `Native page ${pageIndex} is missing`,
      );
    }
    return page;
  }

  private async embedImage(
    pdf: PDFDocument,
    bytes: Uint8Array,
    mimeType: AddImageCommand['mimeType'],
  ): Promise<PDFImage> {
    try {
      if (mimeType === 'image/png') {
        return await pdf.embedPng(bytes);
      }
      return await pdf.embedJpg(bytes);
    } catch (error) {
      throw new PdfDomainError(
        'UNSUPPORTED_IMAGE',
        error instanceof Error ? error.message : 'Image could not be embedded',
      );
    }
  }

  private restoreMetadata(pdf: PDFDocument, metadata: DocumentMetadata): void {
    if (metadata.title !== null) {
      pdf.setTitle(metadata.title);
    }
    if (metadata.author !== null) {
      pdf.setAuthor(metadata.author);
    }
    if (metadata.subject !== null) {
      pdf.setSubject(metadata.subject);
    }
    if (metadata.keywords !== null) {
      pdf.setKeywords(metadata.keywords.split(',').map((part) => part.trim()));
    }
    if (metadata.creator !== null) {
      pdf.setCreator(metadata.creator);
    }
    if (metadata.producer !== null) {
      pdf.setProducer(metadata.producer);
    }
  }

  private toDomain(
    id: string,
    pdf: PDFDocument,
    fragmentsByPage: Map<number, ContentFragment[]>,
  ): PdfDocument {
    const pages: DomainPage[] = pdf.getPages().map((page, index) => {
      const box = readVisibleBox(page);
      const fragments = fragmentsByPage.get(index) ?? [];
      const nodes: PdfNode[] = fragments.flatMap((fragment) =>
        fragment.kind === 'passthrough' ? [] : [fragment.node],
      );
      return {
        index,
        mediaBox: rect(box.x, box.y, box.width, box.height),
        nodes,
      };
    });
    return {
      id,
      pageCount: pages.length,
      pages,
      metadata: this.readMetadata(pdf),
    };
  }

  private readMetadata(pdf: PDFDocument): DocumentMetadata {
    return {
      ...emptyMetadata(),
      title: pdf.getTitle() ?? null,
      author: pdf.getAuthor() ?? null,
      subject: pdf.getSubject() ?? null,
      keywords: pdf.getKeywords() ?? null,
      creator: pdf.getCreator() ?? null,
      producer: pdf.getProducer() ?? null,
      creationDate: pdf.getCreationDate() ?? null,
      modificationDate: pdf.getModificationDate() ?? null,
    };
  }
}

export function createBlankPdfDocument(): Promise<Uint8Array> {
  return (async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([612, 792]);
    pdf.setTitle('Untitled');
    pdf.setAuthor('Alghisi Alessandro Paolo');
    pdf.setCreator('PDF Editor');
    pdf.setProducer('PDF Editor');
    return pdf.save();
  })();
}

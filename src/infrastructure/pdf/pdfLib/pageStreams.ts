import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFStream,
  decodePDFRawStream,
  type PDFDocument,
  type PDFPage,
} from 'pdf-lib';

import { decodePdfBytes } from '@/infrastructure/pdf/bytes';
import type { ImageResource } from '@/infrastructure/pdf/contentStream/parser';

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function decodeStream(stream: PDFStream): Uint8Array {
  if (stream instanceof PDFRawStream) {
    return decodePDFRawStream(stream).decode();
  }
  return stream.getContents();
}

export function readPageContent(page: PDFPage): string {
  const contents = page.node.Contents();
  if (contents === undefined) {
    return '';
  }
  if (contents instanceof PDFArray) {
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < contents.size(); i += 1) {
      const item = contents.lookup(i);
      if (item instanceof PDFStream) {
        chunks.push(decodeStream(item));
      }
    }
    return decodePdfBytes(concatBytes(chunks));
  }
  if (contents instanceof PDFStream) {
    return decodePdfBytes(decodeStream(contents));
  }
  return '';
}

export function writePageContent(page: PDFPage, source: string): void {
  const bytes = new TextEncoder().encode(source);
  const stream = page.doc.context.stream(bytes);
  page.node.set(PDFName.of('Contents'), stream);
}

export function readImageResources(
  page: PDFPage,
): Record<string, ImageResource> {
  const resources = page.node.Resources();
  if (!(resources instanceof PDFDict)) {
    return {};
  }
  const xobject = resources.lookup(PDFName.of('XObject'));
  if (!(xobject instanceof PDFDict)) {
    return {};
  }
  const result: Record<string, ImageResource> = {};
  for (const [key, ref] of xobject.entries()) {
    const stream = page.doc.context.lookup(ref);
    if (!(stream instanceof PDFStream)) {
      continue;
    }
    const subtype = stream.dict.get(PDFName.of('Subtype'));
    if (subtype !== PDFName.of('Image')) {
      continue;
    }
    const width = stream.dict.get(PDFName.of('Width'));
    const height = stream.dict.get(PDFName.of('Height'));
    if (!(width instanceof PDFNumber) || !(height instanceof PDFNumber)) {
      continue;
    }
    const name = key.asString().startsWith('/')
      ? key.asString().slice(1)
      : key.asString();
    result[name] = {
      width: width.asNumber(),
      height: height.asNumber(),
    };
  }
  return result;
}

export function readMediaBox(page: PDFPage): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const box = page.node.MediaBox();
  if (box instanceof PDFArray && box.size() >= 4) {
    const x0 = box.lookup(0);
    const y0 = box.lookup(1);
    const x1 = box.lookup(2);
    const y1 = box.lookup(3);
    if (
      x0 instanceof PDFNumber &&
      y0 instanceof PDFNumber &&
      x1 instanceof PDFNumber &&
      y1 instanceof PDFNumber
    ) {
      const x = x0.asNumber();
      const y = y0.asNumber();
      return {
        x,
        y,
        width: x1.asNumber() - x,
        height: y1.asNumber() - y,
      };
    }
  }
  const size = page.getSize();
  return { x: 0, y: 0, width: size.width, height: size.height };
}

export function ensureFontResource(
  page: PDFPage,
  pdf: PDFDocument,
  resourceName: string,
  fontRef: PDFRef,
): void {
  const resources = page.node.Resources() ?? pdf.context.obj({});
  const existingFont = resources.lookup(PDFName.of('Font'));
  const fontDict =
    existingFont instanceof PDFDict ? existingFont : pdf.context.obj({});
  if (!(existingFont instanceof PDFDict)) {
    resources.set(PDFName.of('Font'), fontDict);
  }
  fontDict.set(PDFName.of(resourceName), fontRef);
  page.node.set(PDFName.of('Resources'), resources);
}

export function ensureImageResource(
  page: PDFPage,
  pdf: PDFDocument,
  resourceName: string,
  imageRef: PDFRef,
): void {
  const resources = page.node.Resources() ?? pdf.context.obj({});
  const existing = resources.lookup(PDFName.of('XObject'));
  const xobject = existing instanceof PDFDict ? existing : pdf.context.obj({});
  if (!(existing instanceof PDFDict)) {
    resources.set(PDFName.of('XObject'), xobject);
  }
  xobject.set(PDFName.of(resourceName), imageRef);
  page.node.set(PDFName.of('Resources'), resources);
}

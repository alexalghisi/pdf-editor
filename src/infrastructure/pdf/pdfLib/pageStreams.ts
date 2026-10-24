import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFStream,
  StandardFontEmbedder,
  StandardFonts,
  decodePDFRawStream,
  type PDFDocument,
  type PDFPage,
} from 'pdf-lib';

import { decodePdfBytes, encodePdfBytes } from '@/infrastructure/pdf/bytes';
import type {
  FontMetrics,
  ImageResource,
} from '@/infrastructure/pdf/contentStream/parser';

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
    const chunks: string[] = [];
    for (let i = 0; i < contents.size(); i += 1) {
      const item = contents.lookup(i);
      if (item instanceof PDFStream) {
        chunks.push(decodePdfBytes(decodeStream(item)));
      }
    }
    return chunks.join('\n');
  }
  if (contents instanceof PDFStream) {
    return decodePdfBytes(decodeStream(contents));
  }
  return '';
}

export function writePageContent(page: PDFPage, source: string): void {
  const { context } = page.doc;
  const stream = context.flateStream(encodePdfBytes(source));
  const current = page.node.get(PDFName.of('Contents'));
  if (current instanceof PDFRef) {
    context.assign(current, stream);
    return;
  }
  page.node.set(PDFName.of('Contents'), context.register(stream));
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

/**
 * The part of the page a viewer shows: the CropBox clipped to the MediaBox
 * (ISO 32000-1, 14.11.2). pdf.js, PDFKit and Poppler all render this box,
 * so overlays have to be laid out against it rather than the MediaBox.
 */
export function readVisibleBox(page: PDFPage): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const media = readMediaBox(page);
  if (page.node.CropBox() === undefined) {
    return media;
  }
  const crop = page.getCropBox();
  const left = Math.max(media.x, Math.min(crop.x, crop.x + crop.width));
  const bottom = Math.max(media.y, Math.min(crop.y, crop.y + crop.height));
  const right = Math.min(
    media.x + media.width,
    Math.max(crop.x, crop.x + crop.width),
  );
  const top = Math.min(
    media.y + media.height,
    Math.max(crop.y, crop.y + crop.height),
  );
  if (right <= left || top <= bottom) {
    return media;
  }
  return { x: left, y: bottom, width: right - left, height: top - bottom };
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

const STANDARD_FONTS = new Set<string>(Object.values(StandardFonts));

function numberAt(array: PDFArray, index: number): number | null {
  const value = array.lookup(index);
  return value instanceof PDFNumber ? value.asNumber() : null;
}

function standardFontMetrics(baseFont: string): FontMetrics | null {
  if (!STANDARD_FONTS.has(baseFont)) {
    return null;
  }
  const embedder = StandardFontEmbedder.for(
    baseFont as Parameters<typeof StandardFontEmbedder.for>[0],
  );
  const widths: Record<number, number> = {};
  for (const codePoint of embedder.encoding.supportedCodePoints) {
    const glyph = embedder.encoding.encodeUnicodeCodePoint(codePoint);
    const width = embedder.font.getWidthOfGlyph(glyph.name);
    if (typeof width === 'number') {
      widths[glyph.code] = width;
    }
  }
  return { codeBytes: 1, widths, missingWidth: 0 };
}

function simpleFontMetrics(font: PDFDict): FontMetrics | null {
  const firstChar = font.lookup(PDFName.of('FirstChar'));
  const array = font.lookup(PDFName.of('Widths'));
  if (firstChar instanceof PDFNumber && array instanceof PDFArray) {
    const widths: Record<number, number> = {};
    for (let i = 0; i < array.size(); i += 1) {
      const width = numberAt(array, i);
      if (width !== null) {
        widths[firstChar.asNumber() + i] = width;
      }
    }
    const descriptor = font.lookup(PDFName.of('FontDescriptor'));
    const missing =
      descriptor instanceof PDFDict
        ? descriptor.lookup(PDFName.of('MissingWidth'))
        : undefined;
    return {
      codeBytes: 1,
      widths,
      missingWidth: missing instanceof PDFNumber ? missing.asNumber() : 0,
    };
  }
  const baseFont = font.lookup(PDFName.of('BaseFont'));
  return baseFont instanceof PDFName
    ? standardFontMetrics(baseFont.decodeText())
    : null;
}

function compositeFontMetrics(font: PDFDict): FontMetrics | null {
  const encoding = font.lookup(PDFName.of('Encoding'));
  if (
    encoding !== PDFName.of('Identity-H') &&
    encoding !== PDFName.of('Identity-V')
  ) {
    return null;
  }
  const descendants = font.lookup(PDFName.of('DescendantFonts'));
  const descendant =
    descendants instanceof PDFArray ? descendants.lookup(0) : undefined;
  if (!(descendant instanceof PDFDict)) {
    return null;
  }
  const dw = descendant.lookup(PDFName.of('DW'));
  const widths: Record<number, number> = {};
  const w = descendant.lookup(PDFName.of('W'));
  if (w instanceof PDFArray) {
    let i = 0;
    while (i < w.size()) {
      const first = numberAt(w, i);
      const next = w.lookup(i + 1);
      if (first === null) {
        break;
      }
      if (next instanceof PDFArray) {
        for (let j = 0; j < next.size(); j += 1) {
          const width = numberAt(next, j);
          if (width !== null) {
            widths[first + j] = width;
          }
        }
        i += 2;
        continue;
      }
      const last = numberAt(w, i + 1);
      const width = numberAt(w, i + 2);
      if (last === null || width === null) {
        break;
      }
      for (let code = first; code <= last; code += 1) {
        widths[code] = width;
      }
      i += 3;
    }
  }
  return {
    codeBytes: 2,
    widths,
    missingWidth: dw instanceof PDFNumber ? dw.asNumber() : 1000,
  };
}

/**
 * Glyph widths of the page's fonts, so the parser can advance the text
 * matrix the way a renderer does. Fonts it cannot measure (Type 3, CMaps
 * other than Identity) are left out and fall back to an estimate.
 */
export function readFontMetrics(page: PDFPage): Record<string, FontMetrics> {
  const resources = page.node.Resources();
  const fonts =
    resources instanceof PDFDict
      ? resources.lookup(PDFName.of('Font'))
      : undefined;
  if (!(fonts instanceof PDFDict)) {
    return {};
  }
  const result: Record<string, FontMetrics> = {};
  for (const [key, ref] of fonts.entries()) {
    const font = page.doc.context.lookup(ref);
    if (!(font instanceof PDFDict)) {
      continue;
    }
    const subtype = font.lookup(PDFName.of('Subtype'));
    const metrics =
      subtype === PDFName.of('Type0')
        ? compositeFontMetrics(font)
        : subtype === PDFName.of('Type3')
          ? null
          : simpleFontMetrics(font);
    if (metrics !== null) {
      result[key.decodeText()] = metrics;
    }
  }
  return result;
}

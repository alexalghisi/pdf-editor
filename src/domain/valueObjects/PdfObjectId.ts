import { PdfDomainError } from '@/domain/errors/PdfDomainError';

export type PdfObjectId = string & { readonly __brand: 'PdfObjectId' };

const OBJECT_ID_PATTERN =
  /^page:\d+:(text|image|passthrough):\d+$/;

export function pdfObjectId(value: string): PdfObjectId {
  if (!OBJECT_ID_PATTERN.test(value)) {
    throw new PdfDomainError(
      'INVALID_OBJECT_ID',
      `Invalid PDF object id: ${value}`,
    );
  }
  return value as PdfObjectId;
}

export function createPdfObjectId(
  pageIndex: number,
  kind: 'text' | 'image' | 'passthrough',
  ordinal: number,
): PdfObjectId {
  return pdfObjectId(`page:${pageIndex}:${kind}:${ordinal}`);
}

export function parsePdfObjectId(id: PdfObjectId): {
  pageIndex: number;
  kind: 'text' | 'image' | 'passthrough';
  ordinal: number;
} {
  const parts = id.split(':');
  const pageToken = parts[1];
  const kindToken = parts[2];
  const ordinalToken = parts[3];
  if (
    pageToken === undefined ||
    kindToken === undefined ||
    ordinalToken === undefined
  ) {
    throw new PdfDomainError('INVALID_OBJECT_ID', `Unparseable id: ${id}`);
  }
  return {
    pageIndex: Number(pageToken),
    kind: kindToken as 'text' | 'image' | 'passthrough',
    ordinal: Number(ordinalToken),
  };
}

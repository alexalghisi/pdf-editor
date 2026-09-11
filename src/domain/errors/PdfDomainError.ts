export const PDF_ERROR_CODES = [
  'INVALID_PDF',
  'ENCRYPTED_PDF',
  'PAGE_OUT_OF_RANGE',
  'NODE_NOT_FOUND',
  'INVALID_OBJECT_ID',
  'INVALID_BOUNDS',
  'INVALID_COLOR',
  'INVALID_FONT_SIZE',
  'SERIALIZATION_FAILED',
  'UNSUPPORTED_IMAGE',
  'EMPTY_TEXT',
  'ENGINE_SESSION_MISSING',
] as const;

export type PdfErrorCode = (typeof PDF_ERROR_CODES)[number];

export class PdfDomainError extends Error {
  readonly code: PdfErrorCode;

  constructor(code: PdfErrorCode, message: string) {
    super(message);
    this.name = 'PdfDomainError';
    this.code = code;
  }
}

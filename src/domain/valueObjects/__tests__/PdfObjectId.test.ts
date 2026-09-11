import { PdfDomainError } from '@/domain/errors/PdfDomainError';
import {
  createPdfObjectId,
  parsePdfObjectId,
  pdfObjectId,
} from '@/domain/valueObjects/PdfObjectId';

describe('PdfObjectId', () => {
  it('accepts the page:kind:ordinal grammar', () => {
    const id = createPdfObjectId(2, 'text', 4);
    expect(id).toBe('page:2:text:4');
    expect(parsePdfObjectId(id)).toEqual({
      pageIndex: 2,
      kind: 'text',
      ordinal: 4,
    });
  });

  it('rejects free-form strings', () => {
    expect(() => pdfObjectId('obj-1')).toThrow(PdfDomainError);
  });
});

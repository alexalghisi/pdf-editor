import {
  createPdfObjectUrl,
  revokePdfObjectUrl,
} from '@/infrastructure/preview/pdfObjectUrl';

describe('pdfObjectUrl', () => {
  const originalUrl = globalThis.URL;
  const originalBlob = globalThis.Blob;

  afterEach(() => {
    globalThis.URL = originalUrl;
    globalThis.Blob = originalBlob;
  });

  it('returns null when the browser object-URL API is missing', () => {
    Object.defineProperty(globalThis, 'URL', {
      configurable: true,
      value: undefined,
    });

    expect(createPdfObjectUrl(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('builds a PDF object URL from a copy of the bytes', () => {
    const createObjectURL = jest.fn(() => 'blob:pdf-1');
    const BlobCtor = jest.fn();
    Object.defineProperty(globalThis, 'URL', {
      configurable: true,
      value: { createObjectURL, revokeObjectURL: jest.fn() },
    });
    Object.defineProperty(globalThis, 'Blob', {
      configurable: true,
      value: BlobCtor,
    });
    const bytes = new Uint8Array([37, 80, 68, 70]);

    expect(createPdfObjectUrl(bytes)).toBe('blob:pdf-1');
    expect(BlobCtor).toHaveBeenCalledTimes(1);
    const payload = BlobCtor.mock.calls[0]?.[0]?.[0] as ArrayBuffer;
    expect(new Uint8Array(payload)).toEqual(bytes);
    expect(BlobCtor.mock.calls[0]?.[1]).toEqual({ type: 'application/pdf' });
  });

  it('revokes a previous object URL', () => {
    const revokeObjectURL = jest.fn();
    Object.defineProperty(globalThis, 'URL', {
      configurable: true,
      value: { createObjectURL: jest.fn(), revokeObjectURL },
    });

    revokePdfObjectUrl('blob:pdf-1');
    revokePdfObjectUrl('');

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pdf-1');
  });
});

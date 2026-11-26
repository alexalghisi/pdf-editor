import { pickPdfFile } from '@/presentation/hooks/pickPdfFile';

const file = (name: string, type: string) => ({ name, type });

describe('pickPdfFile', () => {
  it('returns the first file with the PDF mime type', () => {
    const files = [
      file('notes.txt', 'text/plain'),
      file('a', 'application/pdf'),
    ];

    expect(pickPdfFile(files)).toBe(files[1]);
  });

  it('accepts a .pdf extension when the browser reports no type', () => {
    const files = [file('Contract.PDF', '')];

    expect(pickPdfFile(files)).toBe(files[0]);
  });

  it('returns null when nothing dropped is a PDF', () => {
    expect(pickPdfFile([file('photo.png', 'image/png')])).toBeNull();
    expect(pickPdfFile([])).toBeNull();
  });
});

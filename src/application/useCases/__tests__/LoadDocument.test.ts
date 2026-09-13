import { LoadDocument } from '@/application/useCases/LoadDocument';
import type { FileSystemPort } from '@/application/ports/FileSystemPort';
import type { PdfAstEngine } from '@/domain/services/PdfAstEngine';
import { PdfDomainError } from '@/domain/errors/PdfDomainError';
import { emptyMetadata } from '@/domain/entities/DocumentMetadata';
import { buildFixturePdf } from '@/infrastructure/pdf/testing/buildFixturePdf';

function fakeDocument() {
  return {
    id: 'doc-0',
    pageCount: 1,
    pages: [],
    metadata: emptyMetadata(),
  };
}

describe('LoadDocument', () => {
  it('reads bytes through the filesystem port and parses via the engine', async () => {
    const bytes = buildFixturePdf();
    const engine: Pick<PdfAstEngine, 'load'> = {
      load: jest.fn().mockResolvedValue(fakeDocument()),
    };
    const fileSystem: FileSystemPort = {
      readBinary: jest.fn().mockResolvedValue(bytes),
      writeBinary: jest.fn(),
      cachePath: (name) => `file://${name}`,
    };
    const useCase = new LoadDocument(engine as PdfAstEngine, fileSystem);

    const result = await useCase.execute('file://report.pdf');

    expect(fileSystem.readBinary).toHaveBeenCalledWith('file://report.pdf');
    expect(engine.load).toHaveBeenCalledWith(bytes);
    expect(result.ok).toBe(true);
  });

  it('maps unexpected I/O failures to a domain error', async () => {
    const engine: Pick<PdfAstEngine, 'load'> = {
      load: jest.fn(),
    };
    const fileSystem: FileSystemPort = {
      readBinary: jest.fn().mockRejectedValue(new Error('ENOENT')),
      writeBinary: jest.fn(),
      cachePath: (name) => name,
    };
    const useCase = new LoadDocument(engine as PdfAstEngine, fileSystem);

    const result = await useCase.execute('missing.pdf');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PdfDomainError);
      expect(result.error.code).toBe('INVALID_PDF');
    }
  });
});

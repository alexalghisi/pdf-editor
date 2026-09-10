import type { PdfDocument } from '@/domain/entities/PdfDocument';
import { PdfDomainError } from '@/domain/errors/PdfDomainError';
import type { PdfAstEngine } from '@/domain/services/PdfAstEngine';
import type { FileSystemPort } from '@/application/ports/FileSystemPort';
import { err, ok, type Result } from '@/shared/result';

export class LoadDocument {
  constructor(
    private readonly engine: PdfAstEngine,
    private readonly fileSystem: FileSystemPort,
  ) {}

  async execute(uri: string): Promise<Result<PdfDocument>> {
    try {
      const bytes = await this.fileSystem.readBinary(uri);
      const document = await this.engine.load(bytes);
      return ok(document);
    } catch (error) {
      if (error instanceof PdfDomainError) {
        return err(error);
      }
      return err(
        new PdfDomainError(
          'INVALID_PDF',
          error instanceof Error ? error.message : 'Failed to load PDF',
        ),
      );
    }
  }
}

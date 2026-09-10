import type { PdfDocument } from '@/domain/entities/PdfDocument';
import { PdfDomainError } from '@/domain/errors/PdfDomainError';
import type { PdfAstEngine } from '@/domain/services/PdfAstEngine';
import type { FileSystemPort } from '@/application/ports/FileSystemPort';
import { err, ok, type Result } from '@/shared/result';

export class SaveDocument {
  constructor(
    private readonly engine: PdfAstEngine,
    private readonly fileSystem: FileSystemPort,
  ) {}

  async execute(
    document: PdfDocument,
    destinationUri: string,
  ): Promise<Result<string>> {
    try {
      const bytes = await this.engine.serialize(document);
      await this.fileSystem.writeBinary(destinationUri, bytes);
      return ok(destinationUri);
    } catch (error) {
      if (error instanceof PdfDomainError) {
        return err(error);
      }
      return err(
        new PdfDomainError(
          'SERIALIZATION_FAILED',
          error instanceof Error ? error.message : 'Failed to save PDF',
        ),
      );
    }
  }
}

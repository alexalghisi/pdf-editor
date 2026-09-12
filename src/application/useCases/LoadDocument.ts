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
      return await this.executeFromBytes(bytes);
    } catch (error) {
      return err(this.toDomainError(error));
    }
  }

  /**
   * Parse an in-memory document without touching the file system. Used for a
   * freshly created blank page, which must not round-trip through storage -
   * on web that would trigger a download and a failed fetch of the URI.
   */
  async executeFromBytes(bytes: Uint8Array): Promise<Result<PdfDocument>> {
    try {
      const document = await this.engine.load(bytes);
      return ok(document);
    } catch (error) {
      return err(this.toDomainError(error));
    }
  }

  private toDomainError(error: unknown): PdfDomainError {
    if (error instanceof PdfDomainError) {
      return error;
    }
    return new PdfDomainError(
      'INVALID_PDF',
      error instanceof Error ? error.message : 'Failed to load PDF',
    );
  }
}

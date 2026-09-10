import type { PdfDocument } from '@/domain/entities/PdfDocument';
import { PdfDomainError } from '@/domain/errors/PdfDomainError';
import type {
  AddImageCommand,
  AddTextCommand,
  PdfAstEngine,
  UpdateImageCommand,
  UpdateTextCommand,
} from '@/domain/services/PdfAstEngine';
import type { PdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import type { Rect } from '@/domain/valueObjects/Rect';
import { err, ok, type Result } from '@/shared/result';

export class MutateDocument {
  constructor(private readonly engine: PdfAstEngine) {}

  async addText(
    document: PdfDocument,
    command: AddTextCommand,
  ): Promise<Result<PdfDocument>> {
    return this.run(document, () => this.engine.addText(document, command));
  }

  async updateText(
    document: PdfDocument,
    command: UpdateTextCommand,
  ): Promise<Result<PdfDocument>> {
    return this.run(document, () => this.engine.updateText(document, command));
  }

  async addImage(
    document: PdfDocument,
    command: AddImageCommand,
  ): Promise<Result<PdfDocument>> {
    return this.run(document, () => this.engine.addImage(document, command));
  }

  async updateImage(
    document: PdfDocument,
    command: UpdateImageCommand,
  ): Promise<Result<PdfDocument>> {
    return this.run(document, () => this.engine.updateImage(document, command));
  }

  async deleteNode(
    document: PdfDocument,
    nodeId: PdfObjectId,
  ): Promise<Result<PdfDocument>> {
    return this.run(document, () => this.engine.deleteNode(document, nodeId));
  }

  async moveNode(
    document: PdfDocument,
    nodeId: PdfObjectId,
    bounds: Rect,
  ): Promise<Result<PdfDocument>> {
    return this.run(document, () =>
      this.engine.moveNode(document, nodeId, bounds),
    );
  }

  private async run(
    document: PdfDocument,
    mutate: () => Promise<unknown>,
  ): Promise<Result<PdfDocument>> {
    try {
      await mutate();
      return ok(await this.engine.snapshot(document));
    } catch (error) {
      if (error instanceof PdfDomainError) {
        return err(error);
      }
      return err(
        new PdfDomainError(
          'SERIALIZATION_FAILED',
          error instanceof Error ? error.message : 'Mutation failed',
        ),
      );
    }
  }
}

import type {
  PageRendererPort,
  PageRenderResult,
} from '@/application/ports/PageRendererPort';
import type { PdfDocument } from '@/domain/entities/PdfDocument';
import { getPage } from '@/domain/entities/PdfDocument';
import { PdfDomainError } from '@/domain/errors/PdfDomainError';
import type { PdfAstEngine } from '@/domain/services/PdfAstEngine';
import { err, ok, type Result } from '@/shared/result';

export class RenderPage {
  constructor(
    private readonly engine: PdfAstEngine,
    private readonly renderer: PageRendererPort,
  ) {}

  async execute(
    document: PdfDocument,
    pageIndex: number,
    scale: number,
  ): Promise<Result<PageRenderResult>> {
    try {
      getPage(document, pageIndex);
      const bytes = await this.engine.serialize(document);
      return ok(await this.renderer.renderPage(bytes, pageIndex, scale));
    } catch (error) {
      if (error instanceof PdfDomainError) {
        return err(error);
      }
      return err(
        new PdfDomainError(
          'SERIALIZATION_FAILED',
          error instanceof Error ? error.message : 'Failed to render page',
        ),
      );
    }
  }
}

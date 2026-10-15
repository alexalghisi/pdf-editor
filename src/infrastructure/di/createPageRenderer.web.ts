import type { PageRendererPort } from '@/application/ports/PageRendererPort';
import { PdfJsPageRenderer } from '@/infrastructure/web/PdfJsPageRenderer';

export function createPageRenderer(): PageRendererPort {
  return new PdfJsPageRenderer();
}

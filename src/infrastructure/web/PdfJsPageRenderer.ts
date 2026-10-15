import {
  GlobalWorkerOptions,
  getDocument,
} from 'pdfjs-dist/legacy/build/pdf.mjs';

import type {
  PageRendererPort,
  PageRenderResult,
} from '@/application/ports/PageRendererPort';

const WORKER_PATH = `${process.env.EXPO_BASE_URL ?? ''}/pdf.worker.min.mjs`;

function ensureWorker(): void {
  if (GlobalWorkerOptions.workerPort === null) {
    GlobalWorkerOptions.workerPort = new Worker(WORKER_PATH, {
      type: 'module',
    });
  }
}

export class PdfJsPageRenderer implements PageRendererPort {
  async renderPage(
    pdfBytes: Uint8Array,
    pageIndex: number,
    scale: number,
  ): Promise<PageRenderResult> {
    ensureWorker();
    const pdf = await getDocument({ data: pdfBytes.slice() }).promise;
    try {
      const page = await pdf.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (context === null) {
        throw new Error('Canvas 2D context is unavailable');
      }
      await page.render({ canvasContext: context, viewport }).promise;
      return {
        uri: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
      };
    } finally {
      await pdf.destroy();
    }
  }
}

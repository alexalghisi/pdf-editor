export type PageRenderResult = {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
};

/**
 * Rasterizer contract. Implementations receive the serialized document so the
 * preview always reflects the latest content-stream edits, and must never hold
 * decoded bitmaps after returning.
 */
export interface PageRendererPort {
  renderPage(
    pdfBytes: Uint8Array,
    pageIndex: number,
    scale: number,
  ): Promise<PageRenderResult>;
}

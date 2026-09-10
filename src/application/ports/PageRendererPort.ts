export type PageRenderResult = {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
};

/**
 * Native rasterizer contract (JSI/TurboModule). Implementations must
 * decode off the JS thread and never hold decoded bitmaps after return.
 */
export interface PageRendererPort {
  renderPage(
    filePath: string,
    pageIndex: number,
    scale: number,
  ): Promise<PageRenderResult>;
}

/**
 * JSI / TurboModule contract for off-JS-thread page rasterization.
 * The Expo Module implements this spec; a paper fallback is used in Expo Go.
 */
export type NativePageSize = {
  readonly width: number;
  readonly height: number;
};

export type NativeRenderResult = {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
};

export type NativePdfEngineSpec = {
  getPageCount(path: string): Promise<number>;
  getPageSize(path: string, pageIndex: number): Promise<NativePageSize>;
  renderPage(
    path: string,
    pageIndex: number,
    scale: number,
  ): Promise<NativeRenderResult>;
};

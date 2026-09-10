import type {
  PageRendererPort,
  PageRenderResult,
} from '@/application/ports/PageRendererPort';
import type { NativePdfEngineSpec } from '@/infrastructure/native/NativePdfEngine';

function loadNativeEngine(): NativePdfEngineSpec | null {
  try {
    const core = require('expo-modules-core') as {
      requireNativeModule?: (name: string) => NativePdfEngineSpec;
    };
    if (core.requireNativeModule === undefined) {
      return null;
    }
    return core.requireNativeModule('PdfNativeEngine');
  } catch {
    return null;
  }
}

export class NativePageRenderer implements PageRendererPort {
  private readonly native: NativePdfEngineSpec | null;

  constructor(native: NativePdfEngineSpec | null = loadNativeEngine()) {
    this.native = native;
  }

  async renderPage(
    filePath: string,
    pageIndex: number,
    scale: number,
  ): Promise<PageRenderResult> {
    if (this.native === null) {
      return {
        uri: '',
        width: Math.round(612 * scale),
        height: Math.round(792 * scale),
      };
    }
    return this.native.renderPage(filePath, pageIndex, scale);
  }
}

import type { FileSystemPort } from '@/application/ports/FileSystemPort';
import type {
  PageRendererPort,
  PageRenderResult,
} from '@/application/ports/PageRendererPort';
import type { NativePdfEngineSpec } from '@/infrastructure/native/NativePdfEngine';

const RENDER_SOURCE = 'pdf-editor-render.pdf';

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
  constructor(
    private readonly fileSystem: FileSystemPort,
    private readonly native: NativePdfEngineSpec | null = loadNativeEngine(),
  ) {}

  async renderPage(
    pdfBytes: Uint8Array,
    pageIndex: number,
    scale: number,
  ): Promise<PageRenderResult> {
    if (this.native === null) {
      return { uri: '', width: 0, height: 0 };
    }
    const path = this.fileSystem.cachePath(RENDER_SOURCE);
    await this.fileSystem.writeBinary(path, pdfBytes);
    return this.native.renderPage(path, pageIndex, scale);
  }
}

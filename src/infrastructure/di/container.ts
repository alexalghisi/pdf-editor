import { LoadDocument } from '@/application/useCases/LoadDocument';
import { MutateDocument } from '@/application/useCases/MutateDocument';
import { SaveDocument } from '@/application/useCases/SaveDocument';
import { ExpoFileSystemAdapter } from '@/infrastructure/fs/ExpoFileSystemAdapter';
import { NativePageRenderer } from '@/infrastructure/native/NativePageRenderer';
import { PdfLibAstEngine } from '@/infrastructure/pdf/PdfLibAstEngine';

export type AppContainer = {
  readonly engine: PdfLibAstEngine;
  readonly fileSystem: ExpoFileSystemAdapter;
  readonly renderer: NativePageRenderer;
  readonly loadDocument: LoadDocument;
  readonly saveDocument: SaveDocument;
  readonly mutateDocument: MutateDocument;
};

export function createAppContainer(): AppContainer {
  const engine = new PdfLibAstEngine();
  const fileSystem = new ExpoFileSystemAdapter();
  const renderer = new NativePageRenderer();
  return {
    engine,
    fileSystem,
    renderer,
    loadDocument: new LoadDocument(engine, fileSystem),
    saveDocument: new SaveDocument(engine, fileSystem),
    mutateDocument: new MutateDocument(engine),
  };
}

let singleton: AppContainer | null = null;

export function getAppContainer(): AppContainer {
  if (singleton === null) {
    singleton = createAppContainer();
  }
  return singleton;
}

export function resetAppContainer(): void {
  singleton?.engine.disposeAll();
  singleton = null;
}

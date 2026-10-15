import { Platform } from 'react-native';

import type { FileSystemPort } from '@/application/ports/FileSystemPort';
import type { PageRendererPort } from '@/application/ports/PageRendererPort';
import { LoadDocument } from '@/application/useCases/LoadDocument';
import { MutateDocument } from '@/application/useCases/MutateDocument';
import { RenderPage } from '@/application/useCases/RenderPage';
import { SaveDocument } from '@/application/useCases/SaveDocument';
import { ExpoFileSystemAdapter } from '@/infrastructure/fs/ExpoFileSystemAdapter';
import { WebFileSystemAdapter } from '@/infrastructure/fs/WebFileSystemAdapter';
import { createPageRenderer } from '@/infrastructure/di/createPageRenderer';
import { PdfLibAstEngine } from '@/infrastructure/pdf/PdfLibAstEngine';

export type AppContainer = {
  readonly engine: PdfLibAstEngine;
  readonly fileSystem: FileSystemPort;
  readonly renderer: PageRendererPort;
  readonly loadDocument: LoadDocument;
  readonly saveDocument: SaveDocument;
  readonly mutateDocument: MutateDocument;
  readonly renderPage: RenderPage;
};

function createFileSystem(): FileSystemPort {
  return Platform.OS === 'web'
    ? new WebFileSystemAdapter()
    : new ExpoFileSystemAdapter();
}

export function createAppContainer(): AppContainer {
  const engine = new PdfLibAstEngine();
  const fileSystem = createFileSystem();
  const renderer = createPageRenderer(fileSystem);
  return {
    engine,
    fileSystem,
    renderer,
    loadDocument: new LoadDocument(engine, fileSystem),
    saveDocument: new SaveDocument(engine, fileSystem),
    mutateDocument: new MutateDocument(engine),
    renderPage: new RenderPage(engine, renderer),
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

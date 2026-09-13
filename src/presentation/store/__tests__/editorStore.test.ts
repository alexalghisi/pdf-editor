import { emptyMetadata } from '@/domain/entities/DocumentMetadata';
import type { PdfDocument } from '@/domain/entities/PdfDocument';
import { ok } from '@/shared/result';
import { resetAppContainer } from '@/infrastructure/di/container';

const mockLoadExecute = jest.fn();
const mockMutateAddText = jest.fn();

jest.mock('@/infrastructure/di/container', () => {
  const actual = jest.requireActual<
    typeof import('@/infrastructure/di/container')
  >('@/infrastructure/di/container');
  return {
    ...actual,
    getAppContainer: () => ({
      engine: { disposeAll: jest.fn() },
      fileSystem: {
        cachePath: (name: string) => `file://${name}`,
        writeBinary: jest.fn(),
        readBinary: jest.fn(),
      },
      renderer: { renderPage: jest.fn() },
      loadDocument: { execute: mockLoadExecute },
      saveDocument: { execute: jest.fn() },
      mutateDocument: { addText: mockMutateAddText },
    }),
  };
});

import { useEditorStore } from '@/presentation/store/editorStore';

function documentStub(): PdfDocument {
  return {
    id: 'doc-1',
    pageCount: 1,
    pages: [
      {
        index: 0,
        mediaBox: { x: 0, y: 0, width: 612, height: 792 },
        nodes: [],
      },
    ],
    metadata: emptyMetadata(),
  };
}

describe('useEditorStore', () => {
  beforeEach(() => {
    useEditorStore.setState({
      document: null,
      fileUri: null,
      fileName: 'Untitled.pdf',
      selectedNodeId: null,
      currentPageIndex: 0,
      zoom: 1,
      status: 'idle',
      errorMessage: null,
      rasterUri: '',
    });
    mockLoadExecute.mockReset();
    mockMutateAddText.mockReset();
    resetAppContainer();
  });

  it('loads a document from a URI into atomic state', async () => {
    const document = documentStub();
    mockLoadExecute.mockResolvedValue(ok(document));

    await useEditorStore
      .getState()
      .openFromUri('file://report.pdf', 'report.pdf');

    expect(useEditorStore.getState().document?.id).toBe('doc-1');
    expect(useEditorStore.getState().fileName).toBe('report.pdf');
    expect(useEditorStore.getState().status).toBe('idle');
  });

  it('rejects zoom outside the safe interaction range', () => {
    useEditorStore.getState().setZoom(12);
    expect(useEditorStore.getState().zoom).toBe(4);
    useEditorStore.getState().setZoom(0.1);
    expect(useEditorStore.getState().zoom).toBe(0.4);
  });
});

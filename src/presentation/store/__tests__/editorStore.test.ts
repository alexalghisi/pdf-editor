import { emptyMetadata } from '@/domain/entities/DocumentMetadata';
import type { PdfDocument } from '@/domain/entities/PdfDocument';
import type { PdfTextNode } from '@/domain/entities/PdfTextNode';
import { PdfDomainError } from '@/domain/errors/PdfDomainError';
import { createPdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import { rect } from '@/domain/valueObjects/Rect';
import { BLACK } from '@/domain/valueObjects/RgbColor';
import { err, ok } from '@/shared/result';
import { resetAppContainer } from '@/infrastructure/di/container';

const mockLoadExecute = jest.fn();
const mockLoadExecuteFromBytes = jest.fn();
const mockSaveExecute = jest.fn();
const mockCachePath = jest.fn((name: string) => `file://cache/${name}`);
const mockMutateAddText = jest.fn();
const mockMutateUpdateText = jest.fn();
const mockMutateAddImage = jest.fn();
const mockMutateDeleteNode = jest.fn();
const mockMutateMoveNode = jest.fn();
const mockCreateBlank = jest.fn();

jest.mock('@/infrastructure/di/container', () => {
  const actual = jest.requireActual<
    typeof import('@/infrastructure/di/container')
  >('@/infrastructure/di/container');
  return {
    ...actual,
    getAppContainer: () => ({
      engine: { disposeAll: jest.fn() },
      fileSystem: {
        cachePath: mockCachePath,
        writeBinary: jest.fn(),
        readBinary: jest.fn(),
      },
      renderer: { renderPage: jest.fn() },
      loadDocument: {
        execute: mockLoadExecute,
        executeFromBytes: mockLoadExecuteFromBytes,
      },
      saveDocument: { execute: mockSaveExecute },
      mutateDocument: {
        addText: mockMutateAddText,
        updateText: mockMutateUpdateText,
        addImage: mockMutateAddImage,
        deleteNode: mockMutateDeleteNode,
        moveNode: mockMutateMoveNode,
      },
    }),
  };
});

// The real factory drives pdf-lib to build a one-page file. The store only
// forwards those bytes to the loader, so a stub keeps this suite about the
// store rather than about pdf-lib.
jest.mock('@/infrastructure/pdf/PdfLibAstEngine', () => ({
  createBlankPdfDocument: () => mockCreateBlank(),
}));

import { useEditorStore } from '@/presentation/store/editorStore';

/** Ids are branded and format-checked, so tests must mint them properly. */
function nodeId(ordinal: number) {
  return createPdfObjectId(0, 'text', ordinal);
}

function textNode(ordinal: number): PdfTextNode {
  return {
    id: nodeId(ordinal),
    pageIndex: 0,
    type: 'text',
    bounds: rect(10, 10, 100, 12),
    content: 'Hello',
    fontSize: 12,
    fontName: 'Helvetica',
    color: BLACK,
  };
}

function documentStub(nodes: PdfTextNode[] = []): PdfDocument {
  return {
    id: 'doc-1',
    pageCount: 1,
    pages: [
      {
        index: 0,
        mediaBox: { x: 0, y: 0, width: 612, height: 792 },
        nodes,
      },
    ],
    metadata: emptyMetadata(),
  };
}

/** Puts a loaded document in state without going through the loader. */
function withDocument(document: PdfDocument): void {
  useEditorStore.setState({ document, fileUri: null });
}

const failure = new PdfDomainError('NODE_NOT_FOUND', 'no such node');

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
    jest.clearAllMocks();
    resetAppContainer();
  });

  describe('openFromUri', () => {
    it('loads a document from a URI into atomic state', async () => {
      const document = documentStub();
      mockLoadExecute.mockResolvedValue(ok(document));

      await useEditorStore
        .getState()
        .openFromUri('file://report.pdf', 'report.pdf');

      const state = useEditorStore.getState();
      expect(state.document?.id).toBe('doc-1');
      expect(state.fileUri).toBe('file://report.pdf');
      expect(state.fileName).toBe('report.pdf');
      expect(state.status).toBe('idle');
    });

    it('surfaces the loader error and keeps the previous document', async () => {
      mockLoadExecute.mockResolvedValue(
        err(new PdfDomainError('INVALID_PDF', 'not a pdf')),
      );

      await useEditorStore.getState().openFromUri('file://broken.pdf', 'b.pdf');

      const state = useEditorStore.getState();
      expect(state.status).toBe('error');
      expect(state.errorMessage).toBe('not a pdf');
      expect(state.document).toBeNull();
    });

    it('clears the page and selection carried over from the last file', async () => {
      useEditorStore.setState({
        currentPageIndex: 3,
        selectedNodeId: nodeId(9),
      });
      mockLoadExecute.mockResolvedValue(ok(documentStub()));

      await useEditorStore.getState().openFromUri('file://a.pdf', 'a.pdf');

      expect(useEditorStore.getState().currentPageIndex).toBe(0);
      expect(useEditorStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe('createBlank', () => {
    it('loads the generated bytes and forgets any previous file URI', async () => {
      useEditorStore.setState({ fileUri: 'file://old.pdf', fileName: 'o.pdf' });
      mockCreateBlank.mockResolvedValue(new Uint8Array([1, 2, 3]));
      mockLoadExecuteFromBytes.mockResolvedValue(ok(documentStub()));

      await useEditorStore.getState().createBlank();

      const state = useEditorStore.getState();
      expect(state.document?.id).toBe('doc-1');
      expect(state.fileUri).toBeNull();
      expect(state.fileName).toBe('Untitled.pdf');
      expect(state.status).toBe('idle');
    });

    it('reports a loader failure', async () => {
      mockCreateBlank.mockResolvedValue(new Uint8Array());
      mockLoadExecuteFromBytes.mockResolvedValue(
        err(new PdfDomainError('INVALID_PDF', 'cannot parse')),
      );

      await useEditorStore.getState().createBlank();

      expect(useEditorStore.getState().status).toBe('error');
      expect(useEditorStore.getState().errorMessage).toBe('cannot parse');
    });
  });

  describe('save', () => {
    it('does nothing without a document', async () => {
      await expect(useEditorStore.getState().save()).resolves.toBeNull();
      expect(mockSaveExecute).not.toHaveBeenCalled();
    });

    it('writes an unsaved document to a cache path and remembers it', async () => {
      withDocument(documentStub());
      useEditorStore.setState({ fileName: 'report.pdf' });
      mockSaveExecute.mockResolvedValue(ok(undefined));

      const destination = await useEditorStore.getState().save();

      expect(mockCachePath).toHaveBeenCalledWith('report.pdf');
      expect(destination).toBe('file://cache/report.pdf');
      expect(useEditorStore.getState().fileUri).toBe('file://cache/report.pdf');
      expect(useEditorStore.getState().status).toBe('idle');
    });

    it('writes back over the URI a document was opened from', async () => {
      withDocument(documentStub());
      useEditorStore.setState({ fileUri: 'file://report.pdf' });
      mockSaveExecute.mockResolvedValue(ok(undefined));

      await useEditorStore.getState().save();

      expect(mockCachePath).not.toHaveBeenCalled();
      expect(mockSaveExecute).toHaveBeenCalledWith(
        expect.anything(),
        'file://report.pdf',
      );
    });

    it('reports a write failure and returns no destination', async () => {
      withDocument(documentStub());
      mockSaveExecute.mockResolvedValue(
        err(new PdfDomainError('SERIALIZATION_FAILED', 'disk full')),
      );

      await expect(useEditorStore.getState().save()).resolves.toBeNull();
      expect(useEditorStore.getState().status).toBe('error');
      expect(useEditorStore.getState().errorMessage).toBe('disk full');
    });
  });

  describe('addText', () => {
    it('does nothing without a document', async () => {
      await useEditorStore.getState().addText('hi');
      expect(mockMutateAddText).not.toHaveBeenCalled();
    });

    it('places text near the top of the current page by default', async () => {
      withDocument(documentStub());
      mockMutateAddText.mockResolvedValue(ok(documentStub()));

      await useEditorStore.getState().addText('Hello');

      expect(mockMutateAddText).toHaveBeenCalledWith(expect.anything(), {
        pageIndex: 0,
        content: 'Hello',
        bounds: rect(72, 792 - 120, 200, 16),
        fontSize: 16,
        color: BLACK,
      });
    });

    it('honours explicit bounds, size and colour', async () => {
      withDocument(documentStub());
      mockMutateAddText.mockResolvedValue(ok(documentStub()));
      const red = { r: 1, g: 0, b: 0 };

      await useEditorStore.getState().addText('Hi', rect(1, 2, 3, 4), 24, red);

      expect(mockMutateAddText).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          bounds: rect(1, 2, 3, 4),
          fontSize: 24,
          color: red,
        }),
      );
    });

    it('turns a rejected mutation into an error message', async () => {
      withDocument(documentStub());
      mockMutateAddText.mockResolvedValue(err(failure));

      await useEditorStore.getState().addText('Hello');

      expect(useEditorStore.getState().status).toBe('error');
      expect(useEditorStore.getState().errorMessage).toBe('no such node');
    });
  });

  describe('updateText', () => {
    it('does nothing without a document', async () => {
      await useEditorStore.getState().updateText(nodeId(1), 'x');
      expect(mockMutateUpdateText).not.toHaveBeenCalled();
    });

    it('replaces the document with the mutated one', async () => {
      withDocument(documentStub());
      const updated = { ...documentStub([textNode(1)]), id: 'doc-2' };
      mockMutateUpdateText.mockResolvedValue(ok(updated));

      await useEditorStore.getState().updateText(nodeId(1), 'Goodbye');

      expect(mockMutateUpdateText).toHaveBeenCalledWith(expect.anything(), {
        nodeId: nodeId(1),
        content: 'Goodbye',
      });
      expect(useEditorStore.getState().document?.id).toBe('doc-2');
    });

    it('reports a rejected mutation', async () => {
      withDocument(documentStub());
      mockMutateUpdateText.mockResolvedValue(err(failure));

      await useEditorStore.getState().updateText(nodeId(1), 'Goodbye');

      expect(useEditorStore.getState().status).toBe('error');
    });
  });

  describe('addImage', () => {
    it('does nothing without a document', async () => {
      await useEditorStore.getState().addImage(new Uint8Array(), 'image/png');
      expect(mockMutateAddImage).not.toHaveBeenCalled();
    });

    it('centres the image on the page by default', async () => {
      withDocument(documentStub());
      mockMutateAddImage.mockResolvedValue(ok(documentStub()));
      const bytes = new Uint8Array([137, 80]);

      await useEditorStore.getState().addImage(bytes, 'image/png');

      expect(mockMutateAddImage).toHaveBeenCalledWith(expect.anything(), {
        pageIndex: 0,
        imageBytes: bytes,
        mimeType: 'image/png',
        bounds: rect(72, 792 / 2 - 80, 160, 160),
      });
    });

    it('reports a rejected mutation', async () => {
      withDocument(documentStub());
      mockMutateAddImage.mockResolvedValue(err(failure));

      await useEditorStore.getState().addImage(new Uint8Array(), 'image/jpeg');

      expect(useEditorStore.getState().status).toBe('error');
    });
  });

  describe('deleteSelected', () => {
    it('does nothing when no node is selected', async () => {
      withDocument(documentStub([textNode(1)]));

      await useEditorStore.getState().deleteSelected();

      expect(mockMutateDeleteNode).not.toHaveBeenCalled();
    });

    it('deletes the selection and clears it', async () => {
      withDocument(documentStub([textNode(1)]));
      useEditorStore.setState({ selectedNodeId: nodeId(1) });
      mockMutateDeleteNode.mockResolvedValue(ok(documentStub()));

      await useEditorStore.getState().deleteSelected();

      expect(mockMutateDeleteNode).toHaveBeenCalledWith(
        expect.anything(),
        nodeId(1),
      );
      expect(useEditorStore.getState().selectedNodeId).toBeNull();
    });

    it('reports a rejected deletion', async () => {
      withDocument(documentStub([textNode(1)]));
      useEditorStore.setState({ selectedNodeId: nodeId(1) });
      mockMutateDeleteNode.mockResolvedValue(err(failure));

      await useEditorStore.getState().deleteSelected();

      expect(useEditorStore.getState().status).toBe('error');
    });
  });

  describe('moveNode', () => {
    it('does nothing without a document', async () => {
      await useEditorStore.getState().moveNode(nodeId(1), rect(0, 0, 1, 1));
      expect(mockMutateMoveNode).not.toHaveBeenCalled();
    });

    it('forwards the new bounds and keeps the mutated document', async () => {
      withDocument(documentStub([textNode(1)]));
      const moved = { ...documentStub(), id: 'doc-moved' };
      mockMutateMoveNode.mockResolvedValue(ok(moved));

      await useEditorStore.getState().moveNode(nodeId(1), rect(5, 6, 7, 8));

      expect(mockMutateMoveNode).toHaveBeenCalledWith(
        expect.anything(),
        nodeId(1),
        rect(5, 6, 7, 8),
      );
      expect(useEditorStore.getState().document?.id).toBe('doc-moved');
    });
  });

  describe('selection, paging and zoom', () => {
    it('selects and deselects a node', () => {
      useEditorStore.getState().selectNode(nodeId(1));
      expect(useEditorStore.getState().selectedNodeId).toBe(nodeId(1));

      useEditorStore.getState().selectNode(null);
      expect(useEditorStore.getState().selectedNodeId).toBeNull();
    });

    it('ignores paging with no document open', () => {
      useEditorStore.getState().setPage(1);
      expect(useEditorStore.getState().currentPageIndex).toBe(0);
    });

    it('ignores a page index outside the document', () => {
      withDocument({ ...documentStub(), pageCount: 2 });
      useEditorStore.setState({ currentPageIndex: 1 });

      useEditorStore.getState().setPage(2);
      expect(useEditorStore.getState().currentPageIndex).toBe(1);

      useEditorStore.getState().setPage(-1);
      expect(useEditorStore.getState().currentPageIndex).toBe(1);
    });

    it('turns the page and drops a selection from the page left behind', () => {
      withDocument({ ...documentStub(), pageCount: 2 });
      useEditorStore.setState({ selectedNodeId: nodeId(1) });

      useEditorStore.getState().setPage(1);

      expect(useEditorStore.getState().currentPageIndex).toBe(1);
      expect(useEditorStore.getState().selectedNodeId).toBeNull();
    });

    it('rejects zoom outside the safe interaction range', () => {
      useEditorStore.getState().setZoom(12);
      expect(useEditorStore.getState().zoom).toBe(4);
      useEditorStore.getState().setZoom(0.1);
      expect(useEditorStore.getState().zoom).toBe(0.4);
    });

    it('keeps a zoom level inside the range', () => {
      useEditorStore.getState().setZoom(2.5);
      expect(useEditorStore.getState().zoom).toBe(2.5);
    });
  });

  describe('currentPageNodes', () => {
    it('is empty with no document open', () => {
      expect(useEditorStore.getState().currentPageNodes()).toEqual([]);
    });

    it('returns the nodes of the current page', () => {
      withDocument(documentStub([textNode(1), textNode(2)]));

      const nodes = useEditorStore.getState().currentPageNodes();

      expect(nodes.map((node) => node.id)).toEqual([nodeId(1), nodeId(2)]);
    });
  });
});

import { create } from 'zustand';

import type { PdfDocument } from '@/domain/entities/PdfDocument';
import { getPage } from '@/domain/entities/PdfDocument';
import type { PdfNode } from '@/domain/entities/PdfNode';
import { PdfDomainError } from '@/domain/errors/PdfDomainError';
import type { AddImageCommand, AddTextCommand } from '@/domain/services/PdfAstEngine';
import type { PdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import { rect, type Rect } from '@/domain/valueObjects/Rect';
import { BLACK, type RgbColor } from '@/domain/valueObjects/RgbColor';
import { getAppContainer } from '@/infrastructure/di/container';
import { createBlankPdfDocument } from '@/infrastructure/pdf/PdfLibAstEngine';

export type EditorStatus = 'idle' | 'loading' | 'saving' | 'error';

export type EditorState = {
  readonly document: PdfDocument | null;
  readonly fileUri: string | null;
  readonly fileName: string;
  readonly selectedNodeId: PdfObjectId | null;
  readonly currentPageIndex: number;
  readonly zoom: number;
  readonly status: EditorStatus;
  readonly errorMessage: string | null;
  readonly rasterUri: string;
  openFromUri: (uri: string, fileName: string) => Promise<void>;
  createBlank: () => Promise<void>;
  save: () => Promise<string | null>;
  addText: (content: string, bounds?: Rect, fontSize?: number, color?: RgbColor) => Promise<void>;
  updateText: (nodeId: PdfObjectId, content: string) => Promise<void>;
  addImage: (imageBytes: Uint8Array, mimeType: AddImageCommand['mimeType'], bounds?: Rect) => Promise<void>;
  deleteSelected: () => Promise<void>;
  moveNode: (nodeId: PdfObjectId, bounds: Rect) => Promise<void>;
  selectNode: (nodeId: PdfObjectId | null) => void;
  setPage: (index: number) => void;
  setZoom: (zoom: number) => void;
  currentPageNodes: () => readonly PdfNode[];
};

function defaultTextBounds(document: PdfDocument, pageIndex: number): Rect {
  const page = getPage(document, pageIndex);
  return rect(72, page.mediaBox.height - 120, 200, 16);
}

function defaultImageBounds(document: PdfDocument, pageIndex: number): Rect {
  const page = getPage(document, pageIndex);
  return rect(72, page.mediaBox.height / 2 - 80, 160, 160);
}

async function applyResult(
  set: (partial: Partial<EditorState>) => void,
  work: () => Promise<PdfDocument>,
): Promise<void> {
  try {
    const document = await work();
    set({ document, status: 'idle', errorMessage: null });
  } catch (error) {
    set({
      status: 'error',
      errorMessage:
        error instanceof PdfDomainError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unexpected editor error',
    });
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: null,
  fileUri: null,
  fileName: 'Untitled.pdf',
  selectedNodeId: null,
  currentPageIndex: 0,
  zoom: 1,
  status: 'idle',
  errorMessage: null,
  rasterUri: '',

  async openFromUri(uri, fileName) {
    const { loadDocument } = getAppContainer();
    set({ status: 'loading', errorMessage: null });
    const result = await loadDocument.execute(uri);
    if (!result.ok) {
      set({ status: 'error', errorMessage: result.error.message });
      return;
    }
    set({
      document: result.value,
      fileUri: uri,
      fileName,
      currentPageIndex: 0,
      selectedNodeId: null,
      status: 'idle',
    });
  },

  async createBlank() {
    const { fileSystem, loadDocument } = getAppContainer();
    set({ status: 'loading', errorMessage: null });
    const bytes = await createBlankPdfDocument();
    const uri = fileSystem.cachePath(`untitled-${Date.now()}.pdf`);
    await fileSystem.writeBinary(uri, bytes);
    const result = await loadDocument.execute(uri);
    if (!result.ok) {
      set({ status: 'error', errorMessage: result.error.message });
      return;
    }
    set({
      document: result.value,
      fileUri: uri,
      fileName: 'Untitled.pdf',
      currentPageIndex: 0,
      selectedNodeId: null,
      status: 'idle',
    });
  },

  async save() {
    const { document, fileUri, fileName } = get();
    if (document === null) {
      return null;
    }
    const { saveDocument, fileSystem } = getAppContainer();
    const destination = fileUri ?? fileSystem.cachePath(fileName);
    set({ status: 'saving' });
    const result = await saveDocument.execute(document, destination);
    if (!result.ok) {
      set({ status: 'error', errorMessage: result.error.message });
      return null;
    }
    set({ status: 'idle', fileUri: destination, errorMessage: null });
    return destination;
  },

  async addText(content, bounds, fontSize = 16, color = BLACK) {
    const { document, currentPageIndex } = get();
    if (document === null) {
      return;
    }
    const command: AddTextCommand = {
      pageIndex: currentPageIndex,
      content,
      bounds: bounds ?? defaultTextBounds(document, currentPageIndex),
      fontSize,
      color,
    };
    await applyResult(set, async () => {
      const result = await getAppContainer().mutateDocument.addText(
        document,
        command,
      );
      if (!result.ok) {
        throw result.error;
      }
      return result.value;
    });
  },

  async updateText(nodeId, content) {
    const { document } = get();
    if (document === null) {
      return;
    }
    await applyResult(set, async () => {
      const result = await getAppContainer().mutateDocument.updateText(
        document,
        { nodeId, content },
      );
      if (!result.ok) {
        throw result.error;
      }
      return result.value;
    });
  },

  async addImage(imageBytes, mimeType, bounds) {
    const { document, currentPageIndex } = get();
    if (document === null) {
      return;
    }
    await applyResult(set, async () => {
      const result = await getAppContainer().mutateDocument.addImage(document, {
        pageIndex: currentPageIndex,
        imageBytes,
        mimeType,
        bounds: bounds ?? defaultImageBounds(document, currentPageIndex),
      });
      if (!result.ok) {
        throw result.error;
      }
      return result.value;
    });
  },

  async deleteSelected() {
    const { document, selectedNodeId } = get();
    if (document === null || selectedNodeId === null) {
      return;
    }
    await applyResult(set, async () => {
      const result = await getAppContainer().mutateDocument.deleteNode(
        document,
        selectedNodeId,
      );
      if (!result.ok) {
        throw result.error;
      }
      return result.value;
    });
    set({ selectedNodeId: null });
  },

  async moveNode(nodeId, bounds) {
    const { document } = get();
    if (document === null) {
      return;
    }
    await applyResult(set, async () => {
      const result = await getAppContainer().mutateDocument.moveNode(
        document,
        nodeId,
        bounds,
      );
      if (!result.ok) {
        throw result.error;
      }
      return result.value;
    });
  },

  selectNode(nodeId) {
    set({ selectedNodeId: nodeId });
  },

  setPage(index) {
    const { document } = get();
    if (document === null) {
      return;
    }
    if (index < 0 || index >= document.pageCount) {
      return;
    }
    set({ currentPageIndex: index, selectedNodeId: null });
  },

  setZoom(zoom) {
    set({ zoom: Math.min(4, Math.max(0.4, zoom)) });
  },

  currentPageNodes() {
    const { document, currentPageIndex } = get();
    if (document === null) {
      return [];
    }
    return getPage(document, currentPageIndex).nodes;
  },
}));

import type { PdfDocument } from '@/domain/entities/PdfDocument';
import type { PdfImageNode } from '@/domain/entities/PdfImageNode';
import type { PdfTextNode } from '@/domain/entities/PdfTextNode';
import type { PdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import type { Rect } from '@/domain/valueObjects/Rect';
import type { RgbColor } from '@/domain/valueObjects/RgbColor';

export type AddTextCommand = {
  readonly pageIndex: number;
  readonly content: string;
  readonly bounds: Rect;
  readonly fontSize: number;
  readonly color: RgbColor;
};

export type UpdateTextCommand = {
  readonly nodeId: PdfObjectId;
  readonly content?: string;
  readonly fontSize?: number;
  readonly color?: RgbColor;
};

export type AddImageCommand = {
  readonly pageIndex: number;
  readonly imageBytes: Uint8Array;
  readonly mimeType: 'image/png' | 'image/jpeg';
  readonly bounds: Rect;
};

export type UpdateImageCommand = {
  readonly nodeId: PdfObjectId;
  readonly imageBytes: Uint8Array;
  readonly mimeType: 'image/png' | 'image/jpeg';
};

/**
 * Port for structural PDF mutation. Implementations must rewrite the
 * page content stream and XObject resources — never flatten annotations.
 */
export interface PdfAstEngine {
  load(bytes: Uint8Array): Promise<PdfDocument>;
  addText(document: PdfDocument, command: AddTextCommand): Promise<PdfTextNode>;
  updateText(
    document: PdfDocument,
    command: UpdateTextCommand,
  ): Promise<PdfTextNode>;
  addImage(
    document: PdfDocument,
    command: AddImageCommand,
  ): Promise<PdfImageNode>;
  updateImage(
    document: PdfDocument,
    command: UpdateImageCommand,
  ): Promise<PdfImageNode>;
  deleteNode(document: PdfDocument, nodeId: PdfObjectId): Promise<void>;
  moveNode(
    document: PdfDocument,
    nodeId: PdfObjectId,
    bounds: Rect,
  ): Promise<void>;
  serialize(document: PdfDocument): Promise<Uint8Array>;
  snapshot(document: PdfDocument): Promise<PdfDocument>;
  dispose(documentId: string): void;
}

import type { PdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import type { Rect } from '@/domain/valueObjects/Rect';

export type PdfImageNode = {
  readonly id: PdfObjectId;
  readonly type: 'image';
  readonly pageIndex: number;
  readonly bounds: Rect;
  readonly resourceName: string;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
};

export function isPdfImageNode(node: { type: string }): node is PdfImageNode {
  return node.type === 'image';
}

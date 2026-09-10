import type { PdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import type { Rect } from '@/domain/valueObjects/Rect';
import type { RgbColor } from '@/domain/valueObjects/RgbColor';

export type PdfTextNode = {
  readonly id: PdfObjectId;
  readonly type: 'text';
  readonly pageIndex: number;
  readonly bounds: Rect;
  readonly content: string;
  readonly fontName: string;
  readonly fontSize: number;
  readonly color: RgbColor;
};

export function isPdfTextNode(node: { type: string }): node is PdfTextNode {
  return node.type === 'text';
}

import type { PdfNode } from '@/domain/entities/PdfNode';
import type { Rect } from '@/domain/valueObjects/Rect';

export type PdfPage = {
  readonly index: number;
  /** The visible page area: the CropBox clipped to the MediaBox. */
  readonly mediaBox: Rect;
  readonly nodes: readonly PdfNode[];
};

export function pageNodesOfType<T extends PdfNode['type']>(
  page: PdfPage,
  type: T,
): readonly Extract<PdfNode, { type: T }>[] {
  return page.nodes.filter(
    (node): node is Extract<PdfNode, { type: T }> => node.type === type,
  );
}

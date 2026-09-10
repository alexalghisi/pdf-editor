import type { PdfImageNode } from '@/domain/entities/PdfImageNode';
import type { PdfTextNode } from '@/domain/entities/PdfTextNode';

export type PdfNode = PdfTextNode | PdfImageNode;

export function isEditableNode(node: PdfNode): boolean {
  return node.type === 'text' || node.type === 'image';
}

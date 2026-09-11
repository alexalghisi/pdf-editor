import type { PdfTextNode } from '@/domain/entities/PdfTextNode';
import type { Rect } from '@/domain/valueObjects/Rect';
import type { RgbColor } from '@/domain/valueObjects/RgbColor';
import { escapePdfLiteral } from '@/infrastructure/pdf/contentStream/serialize';
import type { ContentFragment } from '@/infrastructure/pdf/contentStream/parser';

export function writeTextOperators(input: {
  readonly content: string;
  readonly fontName: string;
  readonly fontSize: number;
  readonly color: RgbColor;
  readonly bounds: Rect;
}): string {
  return [
    'BT',
    `/${input.fontName} ${input.fontSize} Tf`,
    `${input.color.r} ${input.color.g} ${input.color.b} rg`,
    `${input.bounds.x} ${input.bounds.y} Td`,
    `(${escapePdfLiteral(input.content)}) Tj`,
    'ET',
  ].join('\n');
}

export function writeImageOperators(
  resourceName: string,
  bounds: Rect,
): string {
  return [
    'q',
    `${bounds.width} 0 0 ${bounds.height} ${bounds.x} ${bounds.y} cm`,
    `/${resourceName} Do`,
    'Q',
  ].join('\n');
}

export function rewriteTextFragment(
  fragment: Extract<ContentFragment, { kind: 'text' }>,
  patch: Partial<
    Pick<PdfTextNode, 'content' | 'fontSize' | 'color' | 'bounds'>
  >,
): Extract<ContentFragment, { kind: 'text' }> {
  const node: PdfTextNode = {
    ...fragment.node,
    ...patch,
    bounds: patch.bounds ?? fragment.node.bounds,
    color: patch.color ?? fragment.node.color,
  };
  return {
    kind: 'text',
    node,
    raw: writeTextOperators(node),
  };
}

export function rewriteImageFragment(
  fragment: Extract<ContentFragment, { kind: 'image' }>,
  bounds: Rect,
): Extract<ContentFragment, { kind: 'image' }> {
  const node = { ...fragment.node, bounds };
  return {
    kind: 'image',
    node,
    raw: writeImageOperators(node.resourceName, bounds),
  };
}

export function joinFragments(fragments: readonly ContentFragment[]): string {
  return fragments.map((fragment) => fragment.raw).join('\n');
}

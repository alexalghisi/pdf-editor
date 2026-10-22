import type { PdfTextNode } from '@/domain/entities/PdfTextNode';
import { shiftInPageSpace, type Matrix } from '@/domain/valueObjects/Matrix';
import type { Rect } from '@/domain/valueObjects/Rect';
import type { RgbColor } from '@/domain/valueObjects/RgbColor';
import {
  escapePdfLiteral,
  formatPdfNumber,
  serializeToken,
} from '@/infrastructure/pdf/contentStream/serialize';
import type {
  ContentFragment,
  TextPlacement,
} from '@/infrastructure/pdf/contentStream/parser';

type TextFragment = Extract<ContentFragment, { kind: 'text' }>;
type ImageFragment = Extract<ContentFragment, { kind: 'image' }>;

function numbers(values: readonly number[]): string {
  return values.map(formatPdfNumber).join(' ');
}

function fillColor(color: RgbColor): string {
  return `${numbers([color.r, color.g, color.b])} rg`;
}

function sameColor(left: RgbColor, right: RgbColor): boolean {
  return left.r === right.r && left.g === right.g && left.b === right.b;
}

export function writeTextOperators(input: {
  readonly content: string;
  readonly fontName: string;
  readonly fontSize: number;
  readonly color: RgbColor;
  readonly bounds: Rect;
}): string {
  return [
    'BT',
    `/${input.fontName} ${formatPdfNumber(input.fontSize)} Tf`,
    fillColor(input.color),
    `${numbers([input.bounds.x, input.bounds.y])} Td`,
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
    `${numbers([bounds.width, 0, 0, bounds.height, bounds.x, bounds.y])} cm`,
    `/${resourceName} Do`,
    'Q',
  ].join('\n');
}

function inlineShow(node: PdfTextNode, placement: TextPlacement): string {
  const font = serializeToken({ kind: 'name', value: node.fontName });
  const localSize = node.fontSize * placement.fontScale;
  const resized = Math.abs(localSize - placement.fontSize) > 1e-6;
  const recolored = !sameColor(node.color, placement.color);
  return [
    recolored ? fillColor(node.color) : '',
    resized ? `${font} ${formatPdfNumber(localSize)} Tf` : '',
    `${serializeToken({ kind: 'string', value: node.content })} Tj`,
    resized ? `${font} ${formatPdfNumber(placement.fontSize)} Tf` : '',
    recolored ? fillColor(placement.color) : '',
  ]
    .filter((part) => part.length > 0)
    .join(' ');
}

function positionedRun(textMatrix: Matrix, placement: TextPlacement): string {
  return [
    `${numbers(textMatrix)} Tm`,
    placement.body,
    `${numbers(placement.lineMatrix)} Tm`,
  ].join(' ');
}

export function rewriteTextFragment(
  fragment: TextFragment,
  patch: Partial<
    Pick<PdfTextNode, 'content' | 'fontSize' | 'color' | 'bounds'>
  >,
): TextFragment {
  const node: PdfTextNode = { ...fragment.node, ...patch };
  const { placement } = fragment;
  if (placement === null) {
    return { kind: 'text', node, raw: writeTextOperators(node), placement };
  }
  const restyled =
    patch.content !== undefined ||
    patch.fontSize !== undefined ||
    patch.color !== undefined;
  const next: TextPlacement = {
    ...placement,
    textMatrix: shiftInPageSpace(
      placement.textMatrix,
      placement.ctm,
      node.bounds.x - fragment.node.bounds.x,
      node.bounds.y - fragment.node.bounds.y,
    ),
    body: restyled ? inlineShow(node, placement) : placement.body,
  };
  return {
    kind: 'text',
    node,
    raw: positionedRun(next.textMatrix, next),
    placement: next,
  };
}

export function rewriteImageFragment(
  fragment: ImageFragment,
  bounds: Rect,
): ImageFragment {
  const node = { ...fragment.node, bounds };
  const { placement } = fragment;
  if (placement === null) {
    return {
      kind: 'image',
      node,
      raw: writeImageOperators(node.resourceName, bounds),
      placement,
    };
  }
  const transform = shiftInPageSpace(
    placement.transform,
    placement.ctm,
    bounds.x - fragment.node.bounds.x,
    bounds.y - fragment.node.bounds.y,
  );
  return {
    kind: 'image',
    node,
    raw: `q ${numbers(transform)} cm ${placement.body} Q`,
    placement: { ...placement, transform },
  };
}

function isAppended(fragment: ContentFragment): boolean {
  return fragment.kind !== 'passthrough' && fragment.placement === null;
}

export function joinFragments(fragments: readonly ContentFragment[]): string {
  const original = fragments.filter((fragment) => !isAppended(fragment));
  const appended = fragments.filter(isAppended);
  const isolated =
    original.length > 0
      ? ['q', ...original.map((fragment) => fragment.raw), 'Q']
      : [];
  return [...isolated, ...appended.map((fragment) => fragment.raw)].join('\n');
}

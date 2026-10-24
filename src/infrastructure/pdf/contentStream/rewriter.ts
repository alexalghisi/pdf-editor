import type { PdfTextNode } from '@/domain/entities/PdfTextNode';
import {
  invert,
  multiply,
  shiftInPageSpace,
  type Matrix,
} from '@/domain/valueObjects/Matrix';
import type { Rect } from '@/domain/valueObjects/Rect';
import type { RgbColor } from '@/domain/valueObjects/RgbColor';
import {
  escapePdfLiteral,
  formatPdfNumber,
  serializeToken,
  serializeTokens,
} from '@/infrastructure/pdf/contentStream/serialize';
import { tokenizeContentStream } from '@/infrastructure/pdf/contentStream/tokenizer';
import type { PdfToken } from '@/infrastructure/pdf/contentStream/tokens';
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

const DROPPED_FROM_STATE = new Set(['Tj', 'TJ', "'", '"', 'Td', 'T*', 'Tm']);

/**
 * The operators of a run's body that set state for what follows it
 * (spacing, scaling, leading, rise, font, colour), without its glyphs or
 * its moves. A rewritten or deleted run keeps them so later text is unchanged.
 */
export function textStateOperators(body: string): string {
  const kept: PdfToken[] = [];
  let operands: PdfToken[] = [];
  for (const token of tokenizeContentStream(body)) {
    if (token.kind !== 'operator') {
      operands.push(token);
      continue;
    }
    if (token.value === 'TD') {
      const ty = operands[1];
      if (ty?.kind === 'number') {
        kept.push(
          { kind: 'number', value: -ty.value },
          { kind: 'operator', value: 'TL' },
        );
      }
    } else if (!DROPPED_FROM_STATE.has(token.value)) {
      kept.push(...operands, token);
    }
    operands = [];
  }
  return serializeTokens(kept);
}

/**
 * Restores the line matrix and moves the text matrix to where the original
 * run ended, so a run shown after it without positioning of its own stays
 * where it was.
 */
function restoreTextPosition(placement: TextPlacement): string {
  const reset = `${numbers(placement.lineMatrix)} Tm`;
  const [a, b, c, d] = placement.lineMatrix;
  const scale = placement.endFontSize * placement.endHorizScale;
  if (a * d - b * c === 0 || scale === 0) {
    return reset;
  }
  const offset = multiply(invert(placement.lineMatrix), placement.endMatrix);
  const dx = offset[4];
  if (Math.abs(offset[5]) > 1e-6 || Math.abs(dx) < 1e-9) {
    return reset;
  }
  return `${reset} [${formatPdfNumber((-dx * 1000) / scale)}] TJ`;
}

function positionedRun(textMatrix: Matrix, placement: TextPlacement): string {
  return [
    `${numbers(textMatrix)} Tm`,
    placement.body,
    placement.state ?? '',
    restoreTextPosition(placement),
  ]
    .filter((part) => part.length > 0)
    .join(' ');
}

/**
 * What a deleted run leaves in the stream: no glyphs, but the state and text
 * position it handed to the rest of its text object.
 */
export function removeTextFragment(
  fragment: TextFragment,
): ContentFragment | null {
  const { placement } = fragment;
  if (placement === null) {
    return null;
  }
  const raw = [
    placement.state ?? textStateOperators(placement.body),
    restoreTextPosition(placement),
  ]
    .filter((part) => part.length > 0)
    .join(' ');
  return { kind: 'passthrough', raw };
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
    state:
      restyled && placement.state === null
        ? textStateOperators(placement.body)
        : placement.state,
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

export function joinFragments(fragments: readonly ContentFragment[]): string {
  return fragments.map((fragment) => fragment.raw).join('\n');
}

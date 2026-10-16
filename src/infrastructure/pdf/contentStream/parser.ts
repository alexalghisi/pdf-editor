import type { PdfImageNode } from '@/domain/entities/PdfImageNode';
import type { PdfTextNode } from '@/domain/entities/PdfTextNode';
import { createPdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import {
  IDENTITY,
  multiply,
  applyToPoint,
  type Matrix,
} from '@/domain/valueObjects/Matrix';
import { rect } from '@/domain/valueObjects/Rect';
import { BLACK, rgbColor, type RgbColor } from '@/domain/valueObjects/RgbColor';
import { serializeTokens } from '@/infrastructure/pdf/contentStream/serialize';
import { tokenizeContentStream } from '@/infrastructure/pdf/contentStream/tokenizer';
import type { PdfToken } from '@/infrastructure/pdf/contentStream/tokens';

export type ImageResource = {
  readonly width: number;
  readonly height: number;
};

export type ContentFragment =
  | { readonly kind: 'text'; readonly node: PdfTextNode; readonly raw: string }
  | {
      readonly kind: 'image';
      readonly node: PdfImageNode;
      readonly raw: string;
    }
  | { readonly kind: 'passthrough'; readonly raw: string };

export type ParseContentStreamInput = {
  readonly source: string;
  readonly pageIndex: number;
  readonly imageResources: Readonly<Record<string, ImageResource>>;
};

type GraphicsState = {
  ctm: Matrix;
  fill: RgbColor;
};

type TextState = {
  fontName: string;
  fontSize: number;
  textMatrix: Matrix;
  textLineMatrix: Matrix;
  leading: number;
  horizScale: number;
  rise: number;
};

const HELVETICA_AVG_WIDTH = 0.55;

function stripTrailingImageTransform(buffer: PdfToken[]): boolean {
  const last = buffer[buffer.length - 1];
  if (last?.kind === 'operator' && last.value === 'cm') {
    buffer.pop();
    let consumed = 0;
    while (
      buffer.length > 0 &&
      buffer[buffer.length - 1]?.kind === 'number' &&
      consumed < 6
    ) {
      buffer.pop();
      consumed += 1;
    }
  }
  const maybeSave = buffer[buffer.length - 1];
  if (maybeSave?.kind === 'operator' && maybeSave.value === 'q') {
    buffer.pop();
    return true;
  }
  return false;
}

function asNumber(token: PdfToken | undefined): number | null {
  return token?.kind === 'number' ? token.value : null;
}

function asName(token: PdfToken | undefined): string | null {
  return token?.kind === 'name' ? token.value : null;
}

function asString(token: PdfToken | undefined): string | null {
  return token?.kind === 'string' ? token.value : null;
}

function decodeShownText(content: string): string {
  if (content.indexOf('\u0000') === -1) {
    return content;
  }
  return content.replace(/\u0000/g, '');
}

function estimateTextWidth(content: string, fontSize: number): number {
  return Math.max(content.length * fontSize * HELVETICA_AVG_WIDTH, 0);
}

function matrixScaleY(matrix: Matrix): number {
  return Math.hypot(matrix[2], matrix[3]);
}

function sameColor(left: RgbColor, right: RgbColor): boolean {
  return left.r === right.r && left.g === right.g && left.b === right.b;
}

function withLineShift(state: TextState, tx: number, ty: number): TextState {
  const next = multiply(state.textLineMatrix, [1, 0, 0, 1, tx, ty]);
  return {
    ...state,
    textMatrix: next,
    textLineMatrix: next,
  };
}

function withTmAdvance(state: TextState, tx: number, ty: number): TextState {
  return {
    ...state,
    textMatrix: multiply(state.textMatrix, [1, 0, 0, 1, tx, ty]),
  };
}

function nextLine(state: TextState): TextState {
  return withLineShift(state, 0, -state.leading);
}

function paintedSize(ctm: Matrix, state: TextState): number {
  const user = multiply(ctm, state.textMatrix);
  const size = matrixScaleY(user) * state.fontSize;
  if (!Number.isFinite(size) || size <= 0) {
    return Math.max(state.fontSize, 1);
  }
  return size;
}

function textOperatorTokens(
  state: TextState,
  fill: RgbColor,
  content: string,
): PdfToken[] {
  const origin = applyToPoint(state.textMatrix, 0, 0);
  return [
    { kind: 'operator', value: 'BT' },
    { kind: 'name', value: state.fontName },
    { kind: 'number', value: state.fontSize },
    { kind: 'operator', value: 'Tf' },
    { kind: 'number', value: fill.r },
    { kind: 'number', value: fill.g },
    { kind: 'number', value: fill.b },
    { kind: 'operator', value: 'rg' },
    { kind: 'number', value: origin.x },
    { kind: 'number', value: origin.y },
    { kind: 'operator', value: 'Td' },
    { kind: 'string', value: content },
    { kind: 'operator', value: 'Tj' },
    { kind: 'operator', value: 'ET' },
  ];
}

function canJoinText(previous: PdfTextNode, next: PdfTextNode): boolean {
  if (previous.fontName !== next.fontName) {
    return false;
  }
  if (!sameColor(previous.color, next.color)) {
    return false;
  }
  if (Math.abs(previous.fontSize - next.fontSize) > 0.6) {
    return false;
  }
  if (Math.abs(previous.bounds.y - next.bounds.y) > previous.fontSize * 0.35) {
    return false;
  }
  const gap = next.bounds.x - (previous.bounds.x + previous.bounds.width);
  return gap >= -previous.fontSize * 0.35 && gap <= previous.fontSize * 0.7;
}

function joinGap(previous: PdfTextNode, next: PdfTextNode): string {
  const gap = next.bounds.x - (previous.bounds.x + previous.bounds.width);
  return gap > previous.fontSize * 0.22 ? ' ' : '';
}

function mergeTextFragments(
  fragments: ContentFragment[],
  pageIndex: number,
): ContentFragment[] {
  const merged: ContentFragment[] = [];
  for (const fragment of fragments) {
    const previous = merged[merged.length - 1];
    if (
      fragment.kind !== 'text' ||
      previous === undefined ||
      previous.kind !== 'text' ||
      !canJoinText(previous.node, fragment.node)
    ) {
      merged.push(fragment);
      continue;
    }
    const content =
      previous.node.content +
      joinGap(previous.node, fragment.node) +
      fragment.node.content;
    const right = fragment.node.bounds.x + fragment.node.bounds.width;
    const width = Math.max(
      previous.node.bounds.width,
      right - previous.node.bounds.x,
    );
    merged[merged.length - 1] = {
      kind: 'text',
      raw: `${previous.raw}\n${fragment.raw}`,
      node: {
        ...previous.node,
        content,
        bounds: rect(
          previous.node.bounds.x,
          previous.node.bounds.y,
          width,
          Math.max(previous.node.bounds.height, fragment.node.bounds.height),
        ),
      },
    };
  }

  let ordinal = 0;
  return merged.map((fragment) => {
    if (fragment.kind !== 'text') {
      return fragment;
    }
    const node: PdfTextNode = {
      ...fragment.node,
      id: createPdfObjectId(pageIndex, 'text', ordinal),
    };
    ordinal += 1;
    return { ...fragment, node };
  });
}

function tjAdvance(
  token: PdfToken | undefined,
  fontSize: number,
  horizScale: number,
): { content: string; advance: number } {
  if (token?.kind !== 'array') {
    return { content: '', advance: 0 };
  }
  let content = '';
  let advance = 0;
  for (const item of token.value) {
    if (item.kind === 'string') {
      const shown = decodeShownText(item.value);
      content += shown;
      advance += estimateTextWidth(shown, fontSize) * horizScale;
      continue;
    }
    if (item.kind === 'number') {
      advance += (-item.value / 1000) * fontSize * horizScale;
    }
  }
  return { content, advance };
}

export function parseContentStream(
  input: ParseContentStreamInput,
): ContentFragment[] {
  const tokens = tokenizeContentStream(input.source);
  const fragments: ContentFragment[] = [];
  const operands: PdfToken[] = [];
  const stack: GraphicsState[] = [];
  let graphics: GraphicsState = { ctm: IDENTITY, fill: BLACK };
  const textRef: { value: TextState | null } = { value: null };
  let imageOrdinal = 0;
  let absorbNextRestore = false;
  let passthrough: PdfToken[] = [];

  const flushPassthrough = (): void => {
    if (passthrough.length === 0) {
      return;
    }
    fragments.push({
      kind: 'passthrough',
      raw: serializeTokens(passthrough),
    });
    passthrough = [];
  };

  const beginText = (): void => {
    textRef.value = {
      fontName: 'F1',
      fontSize: 12,
      textMatrix: IDENTITY,
      textLineMatrix: IDENTITY,
      leading: 0,
      horizScale: 1,
      rise: 0,
    };
  };

  const emitText = (content: string, advance: number): void => {
    const text = textRef.value;
    const shown = decodeShownText(content);
    if (text === null || shown.length === 0) {
      if (text !== null && advance !== 0) {
        textRef.value = withTmAdvance(text, advance, 0);
      }
      return;
    }
    flushPassthrough();
    const size = paintedSize(graphics.ctm, text);
    const pagePoint = applyToPoint(
      multiply(graphics.ctm, text.textMatrix),
      0,
      text.rise,
    );
    const width = Math.max(estimateTextWidth(shown, size), 1);
    const node: PdfTextNode = {
      id: createPdfObjectId(input.pageIndex, 'text', fragments.length),
      type: 'text',
      pageIndex: input.pageIndex,
      bounds: rect(pagePoint.x, pagePoint.y, width, size),
      content: shown,
      fontName: text.fontName,
      fontSize: size,
      color: graphics.fill,
    };
    fragments.push({
      kind: 'text',
      node,
      raw: serializeTokens(textOperatorTokens(text, graphics.fill, shown)),
    });
    textRef.value = withTmAdvance(text, advance, 0);
  };

  const showString = (content: string): void => {
    const text = textRef.value;
    if (text === null) {
      return;
    }
    const shown = decodeShownText(content);
    const advance = estimateTextWidth(shown, text.fontSize) * text.horizScale;
    emitText(content, advance);
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === undefined) {
      continue;
    }
    if (token.kind !== 'operator') {
      operands.push(token);
      continue;
    }

    const op = token.value;
    if (op === 'q') {
      stack.push({ ...graphics, fill: { ...graphics.fill } });
      passthrough.push(...operands, token);
      operands.length = 0;
      continue;
    }
    if (op === 'Q') {
      const restored = stack.pop();
      graphics = restored ?? { ctm: IDENTITY, fill: BLACK };
      if (absorbNextRestore) {
        absorbNextRestore = false;
        operands.length = 0;
        continue;
      }
      passthrough.push(...operands, token);
      operands.length = 0;
      continue;
    }
    if (op === 'cm') {
      const a = asNumber(operands[0]);
      const b = asNumber(operands[1]);
      const c = asNumber(operands[2]);
      const d = asNumber(operands[3]);
      const e = asNumber(operands[4]);
      const f = asNumber(operands[5]);
      if (
        a !== null &&
        b !== null &&
        c !== null &&
        d !== null &&
        e !== null &&
        f !== null
      ) {
        graphics = {
          ...graphics,
          ctm: multiply(graphics.ctm, [a, b, c, d, e, f]),
        };
      }
      passthrough.push(...operands, token);
      operands.length = 0;
      continue;
    }
    if (op === 'rg') {
      const r = asNumber(operands[0]);
      const g = asNumber(operands[1]);
      const b = asNumber(operands[2]);
      if (r !== null && g !== null && b !== null) {
        graphics = { ...graphics, fill: rgbColor(r, g, b) };
      }
      if (textRef.value !== null) {
        operands.length = 0;
        continue;
      }
      passthrough.push(...operands, token);
      operands.length = 0;
      continue;
    }
    if (op === 'g') {
      const gray = asNumber(operands[0]);
      if (gray !== null) {
        graphics = { ...graphics, fill: rgbColor(gray, gray, gray) };
      }
      if (textRef.value !== null) {
        operands.length = 0;
        continue;
      }
      passthrough.push(...operands, token);
      operands.length = 0;
      continue;
    }
    if (op === 'BT') {
      beginText();
      operands.length = 0;
      continue;
    }
    if (op === 'ET') {
      textRef.value = null;
      operands.length = 0;
      continue;
    }
    if (op === 'Tf') {
      const current = textRef.value;
      const fontName = asName(operands[0]);
      const fontSize = asNumber(operands[1]);
      if (current !== null && fontName !== null && fontSize !== null) {
        textRef.value = {
          ...current,
          fontName,
          fontSize,
        };
      }
      operands.length = 0;
      continue;
    }
    if (op === 'TL' && textRef.value !== null) {
      const leading = asNumber(operands[0]);
      if (leading !== null) {
        textRef.value = { ...textRef.value, leading };
      }
      operands.length = 0;
      continue;
    }
    if (op === 'Tz' && textRef.value !== null) {
      const percent = asNumber(operands[0]);
      if (percent !== null) {
        textRef.value = { ...textRef.value, horizScale: percent / 100 };
      }
      operands.length = 0;
      continue;
    }
    if (op === 'Ts' && textRef.value !== null) {
      const rise = asNumber(operands[0]);
      if (rise !== null) {
        textRef.value = { ...textRef.value, rise };
      }
      operands.length = 0;
      continue;
    }
    if (op === 'Td' && textRef.value !== null) {
      const tx = asNumber(operands[0]);
      const ty = asNumber(operands[1]);
      if (tx !== null && ty !== null) {
        textRef.value = withLineShift(textRef.value, tx, ty);
      }
      operands.length = 0;
      continue;
    }
    if (op === 'TD' && textRef.value !== null) {
      const tx = asNumber(operands[0]);
      const ty = asNumber(operands[1]);
      if (tx !== null && ty !== null) {
        textRef.value = withLineShift(
          { ...textRef.value, leading: -ty },
          tx,
          ty,
        );
      }
      operands.length = 0;
      continue;
    }
    if (op === 'T*' && textRef.value !== null) {
      textRef.value = nextLine(textRef.value);
      operands.length = 0;
      continue;
    }
    if (op === 'Tm' && textRef.value !== null) {
      const a = asNumber(operands[0]);
      const b = asNumber(operands[1]);
      const c = asNumber(operands[2]);
      const d = asNumber(operands[3]);
      const e = asNumber(operands[4]);
      const f = asNumber(operands[5]);
      if (
        a !== null &&
        b !== null &&
        c !== null &&
        d !== null &&
        e !== null &&
        f !== null
      ) {
        const matrix: Matrix = [a, b, c, d, e, f];
        textRef.value = {
          ...textRef.value,
          textMatrix: matrix,
          textLineMatrix: matrix,
        };
      }
      operands.length = 0;
      continue;
    }
    if ((op === 'Tj' || op === "'") && textRef.value !== null) {
      if (op === "'") {
        textRef.value = nextLine(textRef.value);
      }
      showString(asString(operands[0]) ?? '');
      operands.length = 0;
      continue;
    }
    if (op === 'TJ' && textRef.value !== null) {
      const shown = tjAdvance(
        operands[0],
        textRef.value.fontSize,
        textRef.value.horizScale,
      );
      emitText(shown.content, shown.advance);
      operands.length = 0;
      continue;
    }
    if (op === 'Do') {
      const resourceName = asName(operands[0]);
      const image =
        resourceName !== null ? input.imageResources[resourceName] : undefined;
      if (resourceName !== null && image !== undefined) {
        const wrappedInSave = stripTrailingImageTransform(passthrough);
        flushPassthrough();
        const origin = applyToPoint(graphics.ctm, 0, 0);
        const xAxis = applyToPoint(graphics.ctm, 1, 0);
        const yAxis = applyToPoint(graphics.ctm, 0, 1);
        const node: PdfImageNode = {
          id: createPdfObjectId(input.pageIndex, 'image', imageOrdinal),
          type: 'image',
          pageIndex: input.pageIndex,
          bounds: rect(
            origin.x,
            origin.y,
            Math.abs(xAxis.x - origin.x),
            Math.abs(yAxis.y - origin.y),
          ),
          resourceName,
          pixelWidth: image.width,
          pixelHeight: image.height,
        };
        imageOrdinal += 1;
        absorbNextRestore = wrappedInSave;
        fragments.push({
          kind: 'image',
          node,
          raw: serializeTokens([
            { kind: 'operator', value: 'q' },
            { kind: 'number', value: node.bounds.width },
            { kind: 'number', value: 0 },
            { kind: 'number', value: 0 },
            { kind: 'number', value: node.bounds.height },
            { kind: 'number', value: node.bounds.x },
            { kind: 'number', value: node.bounds.y },
            { kind: 'operator', value: 'cm' },
            { kind: 'name', value: resourceName },
            { kind: 'operator', value: 'Do' },
            { kind: 'operator', value: 'Q' },
          ]),
        });
        operands.length = 0;
        continue;
      }
    }

    passthrough.push(...operands, token);
    operands.length = 0;
  }

  flushPassthrough();
  return mergeTextFragments(fragments, input.pageIndex);
}

import type { PdfImageNode } from '@/domain/entities/PdfImageNode';
import type { PdfTextNode } from '@/domain/entities/PdfTextNode';
import { createPdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import {
  IDENTITY,
  multiply,
  applyToPoint,
  type Matrix,
} from '@/domain/valueObjects/Matrix';
import { rect, type Rect } from '@/domain/valueObjects/Rect';
import { BLACK, rgbColor, type RgbColor } from '@/domain/valueObjects/RgbColor';
import { serializeTokens } from '@/infrastructure/pdf/contentStream/serialize';
import { tokenizeContentStream } from '@/infrastructure/pdf/contentStream/tokenizer';
import type { PdfToken } from '@/infrastructure/pdf/contentStream/tokens';

export type ImageResource = {
  readonly width: number;
  readonly height: number;
};

/** Glyph widths of a font resource, in thousandths of text space. */
export type FontMetrics = {
  readonly codeBytes: 1 | 2;
  readonly widths: Readonly<Record<number, number>>;
  readonly missingWidth: number;
};

export type TextPlacement = {
  readonly ctm: Matrix;
  readonly textMatrix: Matrix;
  readonly lineMatrix: Matrix;
  /** Text matrix the original run left behind. */
  readonly endMatrix: Matrix;
  readonly endFontSize: number;
  readonly endHorizScale: number;
  readonly fontSize: number;
  readonly fontScale: number;
  readonly color: RgbColor;
  readonly body: string;
  /** State operators of the original body, kept when the body is rewritten. */
  readonly state: string | null;
};

export type ImagePlacement = {
  readonly ctm: Matrix;
  readonly transform: Matrix;
  readonly body: string;
};

export type ContentFragment =
  | {
      readonly kind: 'text';
      readonly node: PdfTextNode;
      readonly raw: string;
      readonly placement: TextPlacement | null;
    }
  | {
      readonly kind: 'image';
      readonly node: PdfImageNode;
      readonly raw: string;
      readonly placement: ImagePlacement;
    }
  | { readonly kind: 'passthrough'; readonly raw: string };

export type ParseContentStreamInput = {
  readonly source: string;
  readonly pageIndex: number;
  readonly imageResources: Readonly<Record<string, ImageResource>>;
  readonly fonts?: Readonly<Record<string, FontMetrics>>;
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
  charSpacing: number;
  wordSpacing: number;
};

const HELVETICA_AVG_WIDTH = 0.55;

const RUN_OPERATORS = new Set(['Td', 'TD', 'T*', 'Tc', 'Tw', 'Tz', 'TL', 'Ts']);

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

function measureString(
  raw: string,
  state: TextState,
  metrics: FontMetrics | undefined,
): number {
  if (metrics === undefined) {
    return (
      estimateTextWidth(decodeShownText(raw), state.fontSize) * state.horizScale
    );
  }
  let advance = 0;
  const step = metrics.codeBytes;
  for (let i = 0; i + step <= raw.length; i += step) {
    const code =
      step === 2
        ? (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1)
        : raw.charCodeAt(i);
    const width = metrics.widths[code] ?? metrics.missingWidth;
    const space = step === 1 && code === 32 ? state.wordSpacing : 0;
    advance += (width / 1000) * state.fontSize + state.charSpacing + space;
  }
  return advance * state.horizScale;
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

function joinRuns(previous: PdfTextNode, next: PdfTextNode): PdfTextNode {
  const right = next.bounds.x + next.bounds.width;
  return {
    ...previous,
    content: previous.content + joinGap(previous, next) + next.content,
    bounds: rect(
      previous.bounds.x,
      previous.bounds.y,
      Math.max(previous.bounds.width, right - previous.bounds.x),
      Math.max(previous.bounds.height, next.bounds.height),
    ),
  };
}

function paintedBounds(ctm: Matrix): Rect {
  const corners = [
    applyToPoint(ctm, 0, 0),
    applyToPoint(ctm, 1, 0),
    applyToPoint(ctm, 0, 1),
    applyToPoint(ctm, 1, 1),
  ];
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return rect(x, y, Math.max(...xs) - x, Math.max(...ys) - y);
}

function numberTextNodes(
  fragments: readonly ContentFragment[],
  pageIndex: number,
): ContentFragment[] {
  let ordinal = 0;
  return fragments.map((fragment) => {
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

function asMatrix(operands: readonly PdfToken[]): Matrix | null {
  const values = operands.slice(0, 6).map(asNumber);
  const [a, b, c, d, e, f] = values;
  if (
    values.length !== 6 ||
    a == null ||
    b == null ||
    c == null ||
    d == null ||
    e == null ||
    f == null
  ) {
    return null;
  }
  return [a, b, c, d, e, f];
}

function applyTextOperator(
  state: TextState,
  op: string,
  operands: readonly PdfToken[],
): TextState {
  const first = asNumber(operands[0]);
  const second = asNumber(operands[1]);
  switch (op) {
    case 'Tf': {
      const fontName = asName(operands[0]);
      return fontName !== null && second !== null
        ? { ...state, fontName, fontSize: second }
        : state;
    }
    case 'TL':
      return first !== null ? { ...state, leading: first } : state;
    case 'Tz':
      return first !== null ? { ...state, horizScale: first / 100 } : state;
    case 'Ts':
      return first !== null ? { ...state, rise: first } : state;
    case 'Tc':
      return first !== null ? { ...state, charSpacing: first } : state;
    case 'Tw':
      return first !== null ? { ...state, wordSpacing: first } : state;
    case 'Td':
      return first !== null && second !== null
        ? withLineShift(state, first, second)
        : state;
    case 'TD':
      return first !== null && second !== null
        ? withLineShift({ ...state, leading: -second }, first, second)
        : state;
    case 'T*':
      return nextLine(state);
    case 'Tm': {
      const matrix = asMatrix(operands);
      return matrix !== null
        ? { ...state, textMatrix: matrix, textLineMatrix: matrix }
        : state;
    }
    default:
      return state;
  }
}

function entryNumber(
  entries: readonly PdfToken[],
  keys: readonly string[],
): number | null {
  const index = entries.findIndex(
    (entry) => entry.kind === 'name' && keys.includes(entry.value),
  );
  return index === -1 ? null : asNumber(entries[index + 1]);
}

function inlineImageSize(entries: readonly PdfToken[]): ImageResource | null {
  const width = entryNumber(entries, ['W', 'Width']);
  const height = entryNumber(entries, ['H', 'Height']);
  return width === null || height === null ? null : { width, height };
}

function tjAdvance(
  token: PdfToken | undefined,
  state: TextState,
  metrics: FontMetrics | undefined,
): { content: string; advance: number } {
  if (token?.kind !== 'array') {
    return { content: '', advance: 0 };
  }
  let content = '';
  let advance = 0;
  for (const item of token.value) {
    if (item.kind === 'string') {
      content += decodeShownText(item.value);
      advance += measureString(item.value, state, metrics);
      continue;
    }
    if (item.kind === 'number') {
      advance += (-item.value / 1000) * state.fontSize * state.horizScale;
    }
  }
  return { content, advance };
}

const SAVE_STATE: ContentFragment = { kind: 'passthrough', raw: 'q' };
const RESTORE_STATE: ContentFragment = { kind: 'passthrough', raw: 'Q' };

function isolate(fragments: ContentFragment[]): ContentFragment[] {
  return fragments.length === 0
    ? fragments
    : [SAVE_STATE, ...fragments, RESTORE_STATE];
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
  let passthrough: PdfToken[] = [];
  let openRun: number | null = null;

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

  const keep = (operator: PdfToken): void => {
    passthrough.push(...operands, operator);
    if (operator.kind === 'operator' && !RUN_OPERATORS.has(operator.value)) {
      openRun = null;
    }
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
      charSpacing: 0,
      wordSpacing: 0,
    };
  };

  const fontOf = (text: TextState): FontMetrics | undefined =>
    input.fonts?.[text.fontName];

  const emitText = (
    showTokens: readonly PdfToken[],
    content: string,
    advance: number,
  ): void => {
    const text = textRef.value;
    const shown = decodeShownText(content);
    if (text === null || shown.length === 0) {
      passthrough.push(...showTokens);
      if (text !== null && advance !== 0) {
        textRef.value = withTmAdvance(text, advance, 0);
      }
      return;
    }
    const after = withTmAdvance(text, advance, 0);
    const end = {
      endMatrix: after.textMatrix,
      endFontSize: text.fontSize,
      endHorizScale: text.horizScale,
    };
    const size = paintedSize(graphics.ctm, text);
    const pagePoint = applyToPoint(
      multiply(graphics.ctm, text.textMatrix),
      0,
      text.rise,
    );
    const node: PdfTextNode = {
      id: createPdfObjectId(input.pageIndex, 'text', fragments.length),
      type: 'text',
      pageIndex: input.pageIndex,
      bounds: rect(
        pagePoint.x,
        pagePoint.y,
        Math.max(estimateTextWidth(shown, size), 1),
        size,
      ),
      content: shown,
      fontName: text.fontName,
      fontSize: size,
      color: graphics.fill,
    };
    const show = serializeTokens(showTokens);
    const previous = openRun === null ? undefined : fragments[openRun];
    if (
      openRun !== null &&
      previous?.kind === 'text' &&
      previous.placement !== null &&
      canJoinText(previous.node, node)
    ) {
      const body = [previous.placement.body, serializeTokens(passthrough), show]
        .filter((part) => part.length > 0)
        .join(' ');
      passthrough = [];
      fragments[openRun] = {
        kind: 'text',
        node: joinRuns(previous.node, node),
        raw: body,
        placement: {
          ...previous.placement,
          ...end,
          lineMatrix: text.textLineMatrix,
          body,
        },
      };
    } else {
      flushPassthrough();
      fragments.push({
        kind: 'text',
        node,
        raw: show,
        placement: {
          ctm: graphics.ctm,
          textMatrix: text.textMatrix,
          lineMatrix: text.textLineMatrix,
          ...end,
          fontSize: text.fontSize,
          fontScale: text.fontSize / size,
          color: graphics.fill,
          body: show,
          state: null,
        },
      });
      openRun = fragments.length - 1;
    }
    textRef.value = after;
  };

  const showString = (
    showTokens: readonly PdfToken[],
    content: string,
  ): void => {
    const text = textRef.value;
    const advance =
      text === null ? 0 : measureString(content, text, fontOf(text));
    emitText(showTokens, content, advance);
  };

  const emitImage = (
    resourceName: string | null,
    size: ImageResource,
    body: string,
  ): void => {
    flushPassthrough();
    openRun = null;
    fragments.push({
      kind: 'image',
      node: {
        id: createPdfObjectId(input.pageIndex, 'image', imageOrdinal),
        type: 'image',
        pageIndex: input.pageIndex,
        bounds: paintedBounds(graphics.ctm),
        resourceName,
        pixelWidth: size.width,
        pixelHeight: size.height,
      },
      raw: body,
      placement: { ctm: graphics.ctm, transform: IDENTITY, body },
    });
    imageOrdinal += 1;
  };

  for (const token of tokens) {
    if (token.kind === 'inlineImage') {
      const size = inlineImageSize(token.entries);
      if (size === null) {
        passthrough.push(token);
        openRun = null;
      } else {
        emitImage(null, size, token.value);
      }
      continue;
    }
    if (token.kind !== 'operator') {
      operands.push(token);
      continue;
    }

    const op = token.value;
    const text = textRef.value;
    if (op === 'q') {
      stack.push({ ...graphics, fill: { ...graphics.fill } });
    } else if (op === 'Q') {
      graphics = stack.pop() ?? { ctm: IDENTITY, fill: BLACK };
    } else if (op === 'cm') {
      const matrix = asMatrix(operands);
      if (matrix !== null) {
        graphics = { ...graphics, ctm: multiply(graphics.ctm, matrix) };
      }
    } else if (op === 'rg') {
      const r = asNumber(operands[0]);
      const g = asNumber(operands[1]);
      const b = asNumber(operands[2]);
      if (r !== null && g !== null && b !== null) {
        graphics = { ...graphics, fill: rgbColor(r, g, b) };
      }
    } else if (op === 'g') {
      const gray = asNumber(operands[0]);
      if (gray !== null) {
        graphics = { ...graphics, fill: rgbColor(gray, gray, gray) };
      }
    } else if (op === 'BT') {
      beginText();
    } else if (op === 'ET') {
      textRef.value = null;
    } else if (text !== null) {
      if (op === 'Tj') {
        showString([...operands, token], asString(operands[0]) ?? '');
        operands.length = 0;
        continue;
      }
      if (
        (op === "'" && operands.length === 1) ||
        (op === '"' && operands.length === 3)
      ) {
        // ' and " move to the next line before they show. The move is kept
        // as its own T* (and " as Tw/Tc), so the run starts at its own text
        // matrix and can be moved or rewritten without dropping a line.
        let state = text;
        if (op === '"') {
          state = applyTextOperator(state, 'Tw', operands.slice(0, 1));
          state = applyTextOperator(state, 'Tc', operands.slice(1, 2));
          passthrough.push(
            ...operands.slice(0, 1),
            { kind: 'operator', value: 'Tw' },
            ...operands.slice(1, 2),
            { kind: 'operator', value: 'Tc' },
          );
        }
        passthrough.push({ kind: 'operator', value: 'T*' });
        textRef.value = nextLine(state);
        const shown = operands[operands.length - 1];
        showString(
          [
            ...(shown === undefined ? [] : [shown]),
            { kind: 'operator', value: 'Tj' },
          ],
          asString(shown) ?? '',
        );
        operands.length = 0;
        continue;
      }
      if (op === 'TJ') {
        const shown = tjAdvance(operands[0], text, fontOf(text));
        emitText([...operands, token], shown.content, shown.advance);
        operands.length = 0;
        continue;
      }
      textRef.value = applyTextOperator(text, op, operands);
    } else if (op === 'Do') {
      const resourceName = asName(operands[0]);
      const image =
        resourceName === null ? undefined : input.imageResources[resourceName];
      if (resourceName !== null && image !== undefined) {
        emitImage(resourceName, image, serializeTokens([...operands, token]));
        operands.length = 0;
        continue;
      }
    }

    keep(token);
    operands.length = 0;
  }

  flushPassthrough();
  return isolate(numberTextNodes(fragments, input.pageIndex));
}

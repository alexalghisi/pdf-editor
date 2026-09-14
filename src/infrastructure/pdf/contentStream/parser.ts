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

function tjArrayText(token: PdfToken | undefined): string {
  if (token?.kind !== 'array') {
    return '';
  }
  return token.value
    .filter(
      (item): item is { kind: 'string'; value: string } =>
        item.kind === 'string',
    )
    .map((item) => item.value)
    .join('');
}

function estimateTextWidth(content: string, fontSize: number): number {
  return Math.max(content.length * fontSize * HELVETICA_AVG_WIDTH, 1);
}

function shiftedText(state: TextState, tx: number, ty: number): TextState {
  const next = multiply(state.textLineMatrix, [1, 0, 0, 1, tx, ty]);
  return {
    fontName: state.fontName,
    fontSize: state.fontSize,
    textMatrix: next,
    textLineMatrix: next,
  };
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
  let textOrdinal = 0;
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
    };
  };

  const emitText = (content: string, rawTokens: readonly PdfToken[]): void => {
    const text = textRef.value;
    if (text === null || content.length === 0) {
      return;
    }
    flushPassthrough();
    const pagePoint = applyToPoint(
      multiply(graphics.ctm, text.textMatrix),
      0,
      0,
    );
    const node: PdfTextNode = {
      id: createPdfObjectId(input.pageIndex, 'text', textOrdinal),
      type: 'text',
      pageIndex: input.pageIndex,
      bounds: rect(
        pagePoint.x,
        pagePoint.y,
        estimateTextWidth(content, text.fontSize),
        text.fontSize,
      ),
      content,
      fontName: text.fontName,
      fontSize: text.fontSize,
      color: graphics.fill,
    };
    textOrdinal += 1;
    fragments.push({
      kind: 'text',
      node,
      raw: serializeTokens(rawTokens),
    });
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
          fontName,
          fontSize,
          textMatrix: current.textMatrix,
          textLineMatrix: current.textLineMatrix,
        };
      }
      operands.length = 0;
      continue;
    }
    if (op === 'Td' && textRef.value !== null) {
      const tx = asNumber(operands[0]);
      const ty = asNumber(operands[1]);
      if (textRef.value !== null && tx !== null && ty !== null) {
        textRef.value = shiftedText(textRef.value, tx, ty);
      }
      operands.length = 0;
      continue;
    }
    if (op === 'TD' && textRef.value !== null) {
      const tx = asNumber(operands[0]);
      const ty = asNumber(operands[1]);
      if (textRef.value !== null && tx !== null && ty !== null) {
        textRef.value = shiftedText(textRef.value, tx, ty);
      }
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
        const current = textRef.value;
        const matrix: Matrix = [a, b, c, d, e, f];
        if (current !== null) {
          textRef.value = {
            fontName: current.fontName,
            fontSize: current.fontSize,
            textMatrix: matrix,
            textLineMatrix: matrix,
          };
        }
      }
      operands.length = 0;
      continue;
    }
    if ((op === 'Tj' || op === "'") && textRef.value !== null) {
      if (op === "'" && textRef.value !== null) {
        textRef.value = shiftedText(textRef.value, 0, -textRef.value.fontSize);
      }
      const content = asString(operands[0]) ?? '';
      const text = textRef.value;
      if (text === null) {
        operands.length = 0;
        continue;
      }
      emitText(content, [
        { kind: 'operator', value: 'BT' },
        { kind: 'name', value: text.fontName },
        { kind: 'number', value: text.fontSize },
        { kind: 'operator', value: 'Tf' },
        { kind: 'number', value: graphics.fill.r },
        { kind: 'number', value: graphics.fill.g },
        { kind: 'number', value: graphics.fill.b },
        { kind: 'operator', value: 'rg' },
        { kind: 'number', value: applyToPoint(text.textMatrix, 0, 0).x },
        { kind: 'number', value: applyToPoint(text.textMatrix, 0, 0).y },
        { kind: 'operator', value: 'Td' },
        { kind: 'string', value: content },
        { kind: 'operator', value: 'Tj' },
        { kind: 'operator', value: 'ET' },
      ]);
      operands.length = 0;
      continue;
    }
    if (op === 'TJ' && textRef.value !== null) {
      const content = tjArrayText(operands[0]);
      const text = textRef.value;
      emitText(content, [
        { kind: 'operator', value: 'BT' },
        { kind: 'name', value: text.fontName },
        { kind: 'number', value: text.fontSize },
        { kind: 'operator', value: 'Tf' },
        { kind: 'number', value: applyToPoint(text.textMatrix, 0, 0).x },
        { kind: 'number', value: applyToPoint(text.textMatrix, 0, 0).y },
        { kind: 'operator', value: 'Td' },
        { kind: 'string', value: content },
        { kind: 'operator', value: 'Tj' },
        { kind: 'operator', value: 'ET' },
      ]);
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
  return fragments;
}

import {
  isOperator,
  type PdfToken,
} from '@/infrastructure/pdf/contentStream/tokens';

const WHITESPACE = new Set(['\u0000', '\t', '\n', '\f', '\r', ' ']);
const DELIMITERS = new Set(['(', ')', '<', '>', '[', ']', '{', '}', '/', '%']);
const INLINE_IMAGE_END = /[\0\t\n\f\r ]EI(?=[\0\t\n\f\r ()<>[\]{}/%]|$)/g;
const INLINE_IMAGE_TAIL = /[\0\t\n\f\r ]*EI(?=[\0\t\n\f\r ()<>[\]{}/%]|$)/y;
const COLOR_COMPONENTS: Readonly<Record<string, number>> = {
  G: 1,
  DeviceGray: 1,
  CalGray: 1,
  RGB: 3,
  DeviceRGB: 3,
  CalRGB: 3,
  CMYK: 4,
  DeviceCMYK: 4,
};

function entryValue(
  entries: readonly PdfToken[],
  keys: readonly string[],
): PdfToken | undefined {
  for (let i = 0; i + 1 < entries.length; i += 2) {
    const key = entries[i];
    if (key?.kind === 'name' && keys.includes(key.value)) {
      return entries[i + 1];
    }
  }
  return undefined;
}

/**
 * Byte length of inline image data that is stored unfiltered, worked out
 * from its dictionary (ISO 32000-1, 8.9.7), or /L where PDF 2.0 gives it.
 * Returns null when the length cannot be known, e.g. for filtered data or a
 * named colour space, and the caller scans for EI instead.
 */
function inlineImageLength(entries: readonly PdfToken[]): number | null {
  const declared = entryValue(entries, ['L', 'Length']);
  if (declared?.kind === 'number' && declared.value >= 0) {
    return declared.value;
  }
  if (entryValue(entries, ['F', 'Filter']) !== undefined) {
    return null;
  }
  const width = entryValue(entries, ['W', 'Width']);
  const height = entryValue(entries, ['H', 'Height']);
  if (width?.kind !== 'number' || height?.kind !== 'number') {
    return null;
  }
  const mask = entryValue(entries, ['IM', 'ImageMask']);
  const isMask = mask?.kind === 'operator' && mask.value === 'true';
  const bpcToken = entryValue(entries, ['BPC', 'BitsPerComponent']);
  const bpc = isMask ? 1 : bpcToken?.kind === 'number' ? bpcToken.value : null;
  let components: number | null = isMask ? 1 : null;
  if (!isMask) {
    const space = entryValue(entries, ['CS', 'ColorSpace']);
    if (space?.kind === 'name') {
      components = COLOR_COMPONENTS[space.value] ?? null;
    } else if (
      space?.kind === 'array' &&
      space.value[0]?.kind === 'name' &&
      ['I', 'Indexed'].includes(space.value[0].value)
    ) {
      components = 1;
    }
  }
  if (bpc === null || components === null) {
    return null;
  }
  return Math.ceil((width.value * components * bpc) / 8) * height.value;
}

function isWhitespace(char: string): boolean {
  return WHITESPACE.has(char);
}

function isRegular(char: string): boolean {
  return !isWhitespace(char) && !DELIMITERS.has(char);
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.replace(/\s+/g, '');
  const padded = normalized.length % 2 === 0 ? normalized : `${normalized}0`;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    const pair = padded.slice(i * 2, i * 2 + 2);
    bytes[i] = Number.parseInt(pair, 16);
  }
  return bytes;
}

function decodePdfHexString(hex: string): string {
  return Array.from(hexToBytes(hex), (byte) => String.fromCharCode(byte)).join(
    '',
  );
}

function decodeName(raw: string): string {
  return raw.replace(/#([0-9A-Fa-f]{2})/g, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

function unescapeLiteral(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    if (char !== '\\') {
      out += char ?? '';
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) {
      break;
    }
    if (next >= '0' && next <= '7') {
      let octal = next;
      let consumed = 1;
      const second = raw[i + 2];
      const third = raw[i + 3];
      if (second !== undefined && second >= '0' && second <= '7') {
        octal += second;
        consumed += 1;
        if (third !== undefined && third >= '0' && third <= '7') {
          octal += third;
          consumed += 1;
        }
      }
      out += String.fromCharCode(Number.parseInt(octal, 8));
      i += consumed;
      continue;
    }
    const escaped: Record<string, string> = {
      n: '\n',
      r: '\r',
      t: '\t',
      b: '\b',
      f: '\f',
      '(': '(',
      ')': ')',
      '\\': '\\',
    };
    out += escaped[next] ?? next;
    i += 1;
  }
  return out;
}

export function tokenizeContentStream(source: string): PdfToken[] {
  const tokens: PdfToken[] = [];
  let index = 0;

  const peek = (offset = 0): string | undefined => source[index + offset];

  const skipWhitespaceAndComments = (): void => {
    while (index < source.length) {
      const char = peek();
      if (char !== undefined && isWhitespace(char)) {
        index += 1;
        continue;
      }
      if (char === '%') {
        while (index < source.length && peek() !== '\n' && peek() !== '\r') {
          index += 1;
        }
        continue;
      }
      break;
    }
  };

  const readLiteralString = (): string => {
    index += 1;
    let depth = 1;
    let raw = '';
    while (index < source.length && depth > 0) {
      const char = peek();
      if (char === undefined) {
        break;
      }
      if (char === '\\') {
        raw += char;
        index += 1;
        const escaped = peek();
        if (escaped !== undefined) {
          raw += escaped;
          index += 1;
        }
        continue;
      }
      if (char === '(') {
        depth += 1;
        raw += char;
        index += 1;
        continue;
      }
      if (char === ')') {
        depth -= 1;
        if (depth === 0) {
          index += 1;
          break;
        }
        raw += char;
        index += 1;
        continue;
      }
      raw += char;
      index += 1;
    }
    return unescapeLiteral(raw);
  };

  const readHexOrDict = (): PdfToken => {
    if (peek(1) === '<') {
      let depth = 0;
      let raw = '';
      while (index < source.length) {
        const char = peek();
        if (char === undefined) {
          break;
        }
        raw += char;
        index += 1;
        if (char === '<') {
          depth += 1;
        }
        if (char === '>') {
          depth -= 1;
          if (depth === 0) {
            break;
          }
        }
      }
      return { kind: 'operator', value: raw };
    }
    index += 1;
    let hex = '';
    while (index < source.length && peek() !== '>') {
      hex += peek() ?? '';
      index += 1;
    }
    if (peek() === '>') {
      index += 1;
    }
    return { kind: 'string', value: decodePdfHexString(hex) };
  };

  const readArray = (): PdfToken => {
    index += 1;
    const value: PdfToken[] = [];
    while (index < source.length) {
      skipWhitespaceAndComments();
      if (peek() === ']') {
        index += 1;
        break;
      }
      const inner = readToken();
      if (inner !== undefined) {
        value.push(inner);
      } else {
        break;
      }
    }
    return { kind: 'array', value };
  };

  const readInlineImage = (start: number): PdfToken => {
    const entries: PdfToken[] = [];
    while (index < source.length) {
      const entry = readToken();
      if (entry === undefined || isOperator(entry, 'ID')) {
        break;
      }
      entries.push(entry);
    }
    const dataStart = index + 1;
    const length = inlineImageLength(entries);
    if (length !== null) {
      INLINE_IMAGE_TAIL.lastIndex = dataStart + length;
      const tail = INLINE_IMAGE_TAIL.exec(source);
      if (tail !== null) {
        index = tail.index + tail[0].length;
        return {
          kind: 'inlineImage',
          value: source.slice(start, index),
          entries,
        };
      }
    }
    INLINE_IMAGE_END.lastIndex = index;
    const end = INLINE_IMAGE_END.exec(source);
    index = end === null ? source.length : end.index + end[0].length;
    return { kind: 'inlineImage', value: source.slice(start, index), entries };
  };

  const readToken = (): PdfToken | undefined => {
    skipWhitespaceAndComments();
    const start = index;
    const char = peek();
    if (char === undefined) {
      return undefined;
    }
    if (char === '(') {
      return { kind: 'string', value: readLiteralString() };
    }
    if (char === '<') {
      return readHexOrDict();
    }
    if (char === '[') {
      return readArray();
    }
    if (char === '/') {
      index += 1;
      let name = '';
      while (index < source.length) {
        const next = peek();
        if (next === undefined || !isRegular(next)) {
          break;
        }
        name += next;
        index += 1;
      }
      return { kind: 'name', value: decodeName(name) };
    }
    if (char === '{' || char === '}' || char === ']') {
      index += 1;
      return { kind: 'operator', value: char };
    }

    let raw = '';
    while (index < source.length) {
      const next = peek();
      if (next === undefined || !isRegular(next)) {
        break;
      }
      raw += next;
      index += 1;
    }
    if (raw.length === 0) {
      index += 1;
      return undefined;
    }
    if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(raw)) {
      return { kind: 'number', value: Number(raw) };
    }
    if (raw === 'BI') {
      return readInlineImage(start);
    }
    return { kind: 'operator', value: raw };
  };

  while (index < source.length) {
    const token = readToken();
    if (token !== undefined) {
      tokens.push(token);
    }
  }
  return tokens;
}

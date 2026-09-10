import type { PdfToken } from '@/infrastructure/pdf/contentStream/tokens';

const WHITESPACE = new Set(['\u0000', '\t', '\n', '\f', '\r', ' ']);
const DELIMITERS = new Set(['(', ')', '<', '>', '[', ']', '{', '}', '/', '%']);

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
  const bytes = hexToBytes(hex);
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const chars: string[] = [];
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      const hi = bytes[i];
      const lo = bytes[i + 1];
      if (hi === undefined || lo === undefined) {
        break;
      }
      chars.push(String.fromCharCode((hi << 8) | lo));
    }
    return chars.join('');
  }
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
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

  const readToken = (): PdfToken | undefined => {
    skipWhitespaceAndComments();
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

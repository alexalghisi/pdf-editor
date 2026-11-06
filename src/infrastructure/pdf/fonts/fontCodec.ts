import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFStream,
  StandardFonts,
  decodePDFRawStream,
} from 'pdf-lib';
import { Encodings } from '@pdf-lib/standard-fonts';

import { decodePdfBytes } from '@/infrastructure/pdf/bytes';

/**
 * Translates between the byte codes a font shows and Unicode text
 * (ISO 32000-1, 9.10). `decode` is what the user reads and edits;
 * `encode` turns edited text back into codes of the same font, or
 * returns null when the font has no glyph for some character (the
 * usual case for subset fonts), so the caller can switch fonts.
 */
export type FontCodec = {
  readonly codeBytes: 1 | 2;
  /** True when the codes map to real text, not bare glyph ids. */
  readonly readable: boolean;
  decode(raw: string): string;
  encode(text: string): string | null;
};

type CodeMap = Map<number, string>;

function hexToCode(hex: string): number {
  return hex.length === 0 ? 0 : parseInt(hex, 16);
}

function hexToUnicode(hex: string): string {
  let out = '';
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  }
  if (hex.length % 4 === 2) {
    out += String.fromCharCode(parseInt(hex.slice(-2), 16));
  }
  return out;
}

function incrementUnicode(base: string, offset: number): string {
  if (base.length === 0) {
    return base;
  }
  const last = base.charCodeAt(base.length - 1) + offset;
  return base.slice(0, -1) + String.fromCharCode(last);
}

const HEX = /<([0-9A-Fa-f\s]*)>/g;

function hexTokens(section: string): string[] {
  return Array.from(section.matchAll(HEX), (match) =>
    (match[1] ?? '').replace(/\s+/g, ''),
  );
}

export type ParsedCMap = {
  readonly codeBytes: 1 | 2;
  readonly map: CodeMap;
};

/** Parses the bfchar / bfrange sections of a ToUnicode CMap. */
export function parseToUnicodeCMap(source: string): ParsedCMap {
  const map: CodeMap = new Map();
  let codeBytes: 1 | 2 = 1;

  for (const block of source.matchAll(
    /begincodespacerange([\s\S]*?)endcodespacerange/g,
  )) {
    const first = hexTokens(block[1] ?? '')[0];
    if (first !== undefined && first.length >= 4) {
      codeBytes = 2;
    }
  }

  for (const block of source.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    const tokens = hexTokens(block[1] ?? '');
    for (let i = 0; i + 1 < tokens.length; i += 2) {
      const src = tokens[i] ?? '';
      if (src.length >= 4) {
        codeBytes = 2;
      }
      map.set(hexToCode(src), hexToUnicode(tokens[i + 1] ?? ''));
    }
  }

  for (const block of source.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const body = block[1] ?? '';
    const entry =
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]*)>|\[([^\]]*)\])/g;
    for (const match of body.matchAll(entry)) {
      const lowHex = match[1] ?? '';
      if (lowHex.length >= 4) {
        codeBytes = 2;
      }
      const low = hexToCode(lowHex);
      const high = hexToCode(match[2] ?? '');
      if (high < low || high - low > 0xffff) {
        continue;
      }
      if (match[4] !== undefined) {
        const targets = hexTokens(match[4]);
        targets.forEach((target, offset) => {
          if (low + offset <= high) {
            map.set(low + offset, hexToUnicode(target));
          }
        });
        continue;
      }
      const base = hexToUnicode(match[3] ?? '');
      for (let code = low; code <= high; code += 1) {
        map.set(code, incrementUnicode(base, code - low));
      }
    }
  }

  return { codeBytes, map };
}

function winAnsiTable(): CodeMap {
  const table: CodeMap = new Map();
  const encoding = Encodings.WinAnsi;
  for (const codePoint of encoding.supportedCodePoints) {
    const { code } = encoding.encodeUnicodeCodePoint(codePoint);
    if (!table.has(code)) {
      table.set(code, String.fromCodePoint(codePoint));
    }
  }
  return table;
}

let cachedWinAnsi: CodeMap | null = null;
let cachedGlyphNames: Map<string, string> | null = null;

function winAnsi(): CodeMap {
  if (cachedWinAnsi === null) {
    cachedWinAnsi = winAnsiTable();
  }
  return cachedWinAnsi;
}

function glyphNames(): Map<string, string> {
  if (cachedGlyphNames === null) {
    const names = new Map<string, string>();
    for (const encoding of [Encodings.WinAnsi, Encodings.Symbol]) {
      for (const codePoint of encoding.supportedCodePoints) {
        const { name } = encoding.encodeUnicodeCodePoint(codePoint);
        if (!names.has(name)) {
          names.set(name, String.fromCodePoint(codePoint));
        }
      }
    }
    const extra: Record<string, string> = {
      fi: 'ﬁ',
      fl: 'ﬂ',
      ff: 'ﬀ',
      ffi: 'ﬃ',
      ffl: 'ﬄ',
      Scommaaccent: 'Ș',
      scommaaccent: 'ș',
      Tcommaaccent: 'Ț',
      tcommaaccent: 'ț',
      Abreve: 'Ă',
      abreve: 'ă',
      minus: '−',
      nbspace: ' ',
    };
    for (const [name, value] of Object.entries(extra)) {
      names.set(name, value);
    }
    cachedGlyphNames = names;
  }
  return cachedGlyphNames;
}

/** Unicode value of an Adobe glyph name (uniXXXX, uXXXX[XX], AGL names). */
export function glyphNameToUnicode(name: string): string | null {
  const known = glyphNames().get(name);
  if (known !== undefined) {
    return known;
  }
  const uni = /^uni([0-9A-Fa-f]{4})+$/.exec(name);
  if (uni !== null) {
    return hexToUnicode(name.slice(3));
  }
  const u = /^u([0-9A-Fa-f]{4,6})$/.exec(name);
  if (u?.[1] !== undefined) {
    return String.fromCodePoint(parseInt(u[1], 16));
  }
  const base = name.split('.')[0];
  if (base !== undefined && base !== name && base.length > 0) {
    return glyphNameToUnicode(base);
  }
  return null;
}

function decodeStream(stream: PDFStream): Uint8Array {
  if (stream instanceof PDFRawStream) {
    return decodePDFRawStream(stream).decode();
  }
  return stream.getContents();
}

function readToUnicode(font: PDFDict): ParsedCMap | null {
  const stream = font.lookup(PDFName.of('ToUnicode'));
  if (!(stream instanceof PDFStream)) {
    return null;
  }
  try {
    const parsed = parseToUnicodeCMap(decodePdfBytes(decodeStream(stream)));
    return parsed.map.size > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function applyDifferences(table: CodeMap, encoding: PDFDict): void {
  const differences = encoding.lookup(PDFName.of('Differences'));
  if (!(differences instanceof PDFArray)) {
    return;
  }
  let code = 0;
  for (let i = 0; i < differences.size(); i += 1) {
    const item = differences.lookup(i);
    if (item instanceof PDFNumber) {
      code = item.asNumber();
      continue;
    }
    if (item instanceof PDFName) {
      const value = glyphNameToUnicode(item.decodeText());
      if (value !== null) {
        table.set(code, value);
      } else {
        table.delete(code);
      }
      code += 1;
    }
  }
}

function simpleEncodingTable(font: PDFDict): CodeMap {
  const table = new Map(winAnsi());
  for (let code = 0x20; code < 0x7f; code += 1) {
    if (!table.has(code)) {
      table.set(code, String.fromCharCode(code));
    }
  }
  const encoding = font.lookup(PDFName.of('Encoding'));
  if (encoding instanceof PDFDict) {
    applyDifferences(table, encoding);
  }
  return table;
}

function availableCodes(font: PDFDict): Set<number> | null {
  const first = font.lookup(PDFName.of('FirstChar'));
  const widths = font.lookup(PDFName.of('Widths'));
  if (!(first instanceof PDFNumber) || !(widths instanceof PDFArray)) {
    return null;
  }
  const codes = new Set<number>();
  for (let i = 0; i < widths.size(); i += 1) {
    const width = widths.lookup(i);
    if (width instanceof PDFNumber && width.asNumber() > 0) {
      codes.add(first.asNumber() + i);
    }
  }
  return codes;
}

function isEmbedded(font: PDFDict): boolean {
  const descriptor = font.lookup(PDFName.of('FontDescriptor'));
  if (!(descriptor instanceof PDFDict)) {
    return false;
  }
  return ['FontFile', 'FontFile2', 'FontFile3'].some(
    (key) => descriptor.lookup(PDFName.of(key)) !== undefined,
  );
}

function isSubset(font: PDFDict): boolean {
  const base = font.lookup(PDFName.of('BaseFont'));
  return base instanceof PDFName && /^[A-Z]{6}\+/.test(base.decodeText());
}

function isStandard(font: PDFDict): boolean {
  const base = font.lookup(PDFName.of('BaseFont'));
  return (
    base instanceof PDFName &&
    (Object.values(StandardFonts) as string[]).includes(base.decodeText())
  );
}

function codesOf(raw: string, codeBytes: 1 | 2): number[] {
  const codes: number[] = [];
  for (let i = 0; i + codeBytes <= raw.length; i += codeBytes) {
    codes.push(
      codeBytes === 2
        ? (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1)
        : raw.charCodeAt(i),
    );
  }
  return codes;
}

function writeCode(code: number, codeBytes: 1 | 2): string {
  return codeBytes === 2
    ? String.fromCharCode((code >> 8) & 0xff, code & 0xff)
    : String.fromCharCode(code & 0xff);
}

/**
 * Builds the reverse lookup and encodes greedily, longest Unicode
 * sequence first, so ligature glyphs ("fi") are reused when present.
 */
function codecFromMap(
  map: CodeMap,
  codeBytes: 1 | 2,
  allowed: Set<number> | null,
): FontCodec {
  const reverse = new Map<string, number>();
  let longest = 1;
  for (const [code, value] of map) {
    if (value.length === 0 || (allowed !== null && !allowed.has(code))) {
      continue;
    }
    if (!reverse.has(value)) {
      reverse.set(value, code);
      longest = Math.max(longest, value.length);
    }
  }
  return {
    codeBytes,
    readable: true,
    decode(raw) {
      return codesOf(raw, codeBytes)
        .map((code) => map.get(code) ?? '')
        .join('');
    },
    encode(text) {
      let out = '';
      let i = 0;
      while (i < text.length) {
        let matched = false;
        for (
          let size = Math.min(longest, text.length - i);
          size > 0;
          size -= 1
        ) {
          const code = reverse.get(text.slice(i, i + size));
          if (code !== undefined) {
            out += writeCode(code, codeBytes);
            i += size;
            matched = true;
            break;
          }
        }
        if (!matched) {
          return null;
        }
      }
      return out;
    },
  };
}

function unreadableCodec(codeBytes: 1 | 2): FontCodec {
  return {
    codeBytes,
    readable: false,
    decode(raw) {
      return codeBytes === 1 ? raw : raw.replace(/\u0000/g, '');
    },
    encode() {
      return null;
    },
  };
}

/** The codec of one font resource dictionary. */
export function fontCodecOf(font: PDFDict): FontCodec {
  const subtype = font.lookup(PDFName.of('Subtype'));
  const toUnicode = readToUnicode(font);

  if (subtype === PDFName.of('Type0')) {
    if (toUnicode === null) {
      return unreadableCodec(2);
    }
    return codecFromMap(toUnicode.map, 2, null);
  }

  const table = simpleEncodingTable(font);
  if (toUnicode !== null) {
    for (const [code, value] of toUnicode.map) {
      table.set(code, value);
    }
  }
  const embedded = isEmbedded(font);
  // A subset or Type 3 font only has the glyphs it already shows; a full
  // embedded or standard font can show anything its encoding names.
  const restricted =
    subtype === PDFName.of('Type3') || (embedded && isSubset(font));
  const allowed = restricted
    ? toUnicode !== null
      ? new Set(toUnicode.map.keys())
      : availableCodes(font)
    : embedded || !isStandard(font)
      ? availableCodes(font)
      : null;
  return codecFromMap(table, 1, allowed);
}

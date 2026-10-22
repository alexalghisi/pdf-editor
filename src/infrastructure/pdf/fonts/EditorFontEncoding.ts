import { PdfDomainError } from '@/domain/errors/PdfDomainError';
import { WIN_ANSI_ENCODING } from '@/infrastructure/pdf/fonts/baseEncodings';
import { GLYPH_CODE_POINTS } from '@/infrastructure/pdf/fonts/glyphList';
import { HELVETICA_GLYPHS } from '@/infrastructure/pdf/fonts/helveticaGlyphs';

export type EncodingDifference = {
  readonly code: number;
  readonly glyph: string;
};

function firstCodeOfEachGlyph(): ReadonlyMap<string, number> {
  const codes = new Map<string, number>();
  WIN_ANSI_ENCODING.forEach((glyph, code) => {
    if (glyph.length > 0 && !codes.has(glyph)) {
      codes.set(glyph, code);
    }
  });
  return codes;
}

function helveticaGlyphByCharacter(
  winAnsiCodes: ReadonlyMap<string, number>,
): ReadonlyMap<string, string> {
  const glyphs = new Map<string, string>();
  const preferWinAnsi = [...HELVETICA_GLYPHS].sort(
    (left, right) =>
      Number(winAnsiCodes.has(right)) - Number(winAnsiCodes.has(left)),
  );
  for (const glyph of preferWinAnsi) {
    const codePoint = GLYPH_CODE_POINTS[glyph];
    if (codePoint === undefined) {
      continue;
    }
    const char = String.fromCodePoint(codePoint);
    if (!glyphs.has(char)) {
      glyphs.set(char, glyph);
    }
  }
  return glyphs;
}

// The Glyph List maps tcommaaccent to U+0163, but the core-font glyph draws
// the comma below that Romanian spells as U+021A / U+021B.
const COMMA_BELOW_T: ReadonlyArray<readonly [string, string]> = [
  ['\u021a', 'Tcommaaccent'],
  ['\u021b', 'tcommaaccent'],
];

const WIN_ANSI_CODES = firstCodeOfEachGlyph();
const GLYPH_BY_CHARACTER: ReadonlyMap<string, string> = new Map([
  ...helveticaGlyphByCharacter(WIN_ANSI_CODES),
  ...COMMA_BELOW_T,
]);

function unsupported(char: string, reason: string): PdfDomainError {
  return new PdfDomainError(
    'UNSUPPORTED_CHARACTER',
    `"${char}" cannot be written with the editor font: ${reason}`,
  );
}

export class EditorFontEncoding {
  static readonly FREE_CODES: readonly number[] = [
    ...Array.from({ length: 31 }, (_, index) => index + 1),
    0x7f,
    0x81,
    0x8d,
    0x8f,
    0x90,
    0x9d,
  ];

  private assigned: ReadonlyMap<string, number> = new Map();

  encode(text: string): string {
    const assigned = new Map(this.assigned);
    const shown = Array.from(text, (char) =>
      String.fromCharCode(this.codeFor(char, assigned)),
    ).join('');
    this.assigned = assigned;
    return shown;
  }

  differences(): readonly EncodingDifference[] {
    return [...this.assigned]
      .map(([glyph, code]) => ({ code, glyph }))
      .sort((left, right) => left.code - right.code);
  }

  private codeFor(char: string, assigned: Map<string, number>): number {
    const glyph = GLYPH_BY_CHARACTER.get(char);
    if (glyph === undefined) {
      throw unsupported(char, 'Helvetica has no glyph for it');
    }
    const known = WIN_ANSI_CODES.get(glyph) ?? assigned.get(glyph);
    if (known !== undefined) {
      return known;
    }
    const free = EditorFontEncoding.FREE_CODES[assigned.size];
    if (free === undefined) {
      throw unsupported(char, 'every free code in the font is already in use');
    }
    assigned.set(glyph, free);
    return free;
  }
}

import { serializeTokens } from '@/infrastructure/pdf/contentStream/serialize';
import { tokenizeContentStream } from '@/infrastructure/pdf/contentStream/tokenizer';

function roundTrip(source: string): string {
  return serializeTokens(tokenizeContentStream(source));
}

describe('serializeTokens', () => {
  it('writes printable strings as literals', () => {
    expect(roundTrip('(Hello \\(PDF\\)) Tj')).toBe('(Hello \\(PDF\\)) Tj');
  });

  it('keeps two-byte glyph codes as hex instead of dropping the high byte', () => {
    expect(roundTrip('<002c0051> Tj')).toBe('<002C0051> Tj');
  });

  it('keeps Latin-1 bytes as single bytes', () => {
    expect(roundTrip('<E9> Tj')).toBe('<E9> Tj');
  });

  it('keeps a leading FE FF pair as shown bytes', () => {
    expect(roundTrip('<FEFF00480069> Tj')).toBe('<FEFF00480069> Tj');
  });

  it('never writes exponent notation, which PDF does not allow', () => {
    expect(roundTrip('0.0000001 1e3 -2.5 Td')).toBe('0.0000001 1000 -2.5 Td');
  });

  it('keeps the full precision of the source numbers', () => {
    expect(roundTrip('.23999999 0 0 -.23999999 0 792 cm')).toBe(
      '0.23999999 0 0 -0.23999999 0 792 cm',
    );
  });

  it('escapes name characters outside the regular set', () => {
    expect(roundTrip('/A#20B gs')).toBe('/A#20B gs');
  });
});

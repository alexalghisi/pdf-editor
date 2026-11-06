import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';

import {
  fontCodecOf,
  glyphNameToUnicode,
  parseToUnicodeCMap,
} from '@/infrastructure/pdf/fonts/fontCodec';

const CMAP = `
/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
2 beginbfchar
<0003> <0020>
<0011> <0219>
endbfchar
2 beginbfrange
<0024> <0026> <0041>
<0030> <0031> [<0066006C> <0078>]
endbfrange
endcmap
`;

describe('parseToUnicodeCMap', () => {
  it('reads bfchar, incrementing bfrange and array bfrange entries', () => {
    const parsed = parseToUnicodeCMap(CMAP);

    expect(parsed.codeBytes).toBe(2);
    expect(parsed.map.get(0x03)).toBe(' ');
    expect(parsed.map.get(0x11)).toBe('ș');
    expect(parsed.map.get(0x24)).toBe('A');
    expect(parsed.map.get(0x26)).toBe('C');
    expect(parsed.map.get(0x30)).toBe('fl');
    expect(parsed.map.get(0x31)).toBe('x');
  });

  it('treats one-byte codespaces as simple codes', () => {
    const parsed = parseToUnicodeCMap(
      '1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfchar <41> <0042> endbfchar',
    );

    expect(parsed.codeBytes).toBe(1);
    expect(parsed.map.get(0x41)).toBe('B');
  });
});

describe('glyphNameToUnicode', () => {
  it('resolves AGL, uniXXXX and suffixed names', () => {
    expect(glyphNameToUnicode('eacute')).toBe('é');
    expect(glyphNameToUnicode('uni0219')).toBe('ș');
    expect(glyphNameToUnicode('u1F600')).toBe('😀');
    expect(glyphNameToUnicode('a.sc')).toBe('a');
    expect(glyphNameToUnicode('nonsense-glyph')).toBeNull();
  });
});

describe('fontCodecOf', () => {
  it('decodes and re-encodes a ToUnicode-mapped composite font', async () => {
    const pdf = await PDFDocument.create();
    const font = pdf.context.obj({
      Type: 'Font',
      Subtype: 'Type0',
      Encoding: 'Identity-H',
      ToUnicode: pdf.context.register(pdf.context.stream(CMAP)),
    });

    const codec = fontCodecOf(font);
    const raw = '\u0000$\u0000\u0003\u0000\u0011';

    expect(codec.readable).toBe(true);
    expect(codec.decode(raw)).toBe('A ș');
    expect(codec.encode('A ș')).toBe(raw);
    expect(codec.encode('flA')).toBe('\u00000\u0000$');
    expect(codec.encode('Z')).toBeNull();
  });

  it('marks composite fonts without ToUnicode as unreadable', async () => {
    const pdf = await PDFDocument.create();
    const font = pdf.context.obj({
      Type: 'Font',
      Subtype: 'Type0',
      Encoding: 'Identity-H',
    });

    const codec = fontCodecOf(font);

    expect(codec.readable).toBe(false);
    expect(codec.encode('A')).toBeNull();
  });

  it('maps a standard font through WinAnsi and Differences', async () => {
    const pdf = await PDFDocument.create();
    const font = pdf.context.obj({
      Type: 'Font',
      Subtype: 'Type1',
      BaseFont: StandardFonts.Helvetica,
      Encoding: pdf.context.obj({
        Type: 'Encoding',
        Differences: [65, PDFName.of('scommaaccent')],
      }),
    });

    const codec = fontCodecOf(font);

    expect(codec.decode('A\u0080b')).toBe('ș€b');
    expect(codec.encode('ș€b')).toBe('A\u0080b');
    expect(codec.encode('漢')).toBeNull();
  });
});

import { PDFDocument, PDFName } from 'pdf-lib';

import {
  readFontMetrics,
  readPageContent,
  writePageContent,
} from '@/infrastructure/pdf/pdfLib/pageStreams';

async function blankPage() {
  const pdf = await PDFDocument.create();
  return pdf.addPage([200, 200]);
}

describe('pageStreams', () => {
  it('keeps the boundary between streams of a /Contents array', async () => {
    const page = await blankPage();
    const { context } = page.doc;
    const first = context.register(context.stream('q'));
    const second = context.register(context.stream('Q'));
    page.node.set(PDFName.of('Contents'), context.obj([first, second]));

    expect(readPageContent(page).split(/\s+/)).toEqual(['q', 'Q']);
  });

  it('writes the content as Latin-1 bytes, not UTF-8', async () => {
    const page = await blankPage();

    writePageContent(page, 'BT (café) Tj ET');

    expect(readPageContent(page)).toBe('BT (café) Tj ET');
  });

  it('reads glyph widths of simple, standard and Identity-H fonts', async () => {
    const page = await blankPage();
    const { context } = page.doc;
    const simple = context.obj({
      Type: 'Font',
      Subtype: 'TrueType',
      FirstChar: 65,
      Widths: [600, 700],
      FontDescriptor: context.obj({ MissingWidth: 250 }),
    });
    const standard = context.obj({
      Type: 'Font',
      Subtype: 'Type1',
      BaseFont: 'Helvetica',
    });
    const composite = context.obj({
      Type: 'Font',
      Subtype: 'Type0',
      Encoding: 'Identity-H',
      DescendantFonts: [
        context.obj({ DW: 500, W: [3, [400, 450], 10, 12, 900] }),
      ],
    });
    const type3 = context.obj({ Type: 'Font', Subtype: 'Type3' });
    page.node.set(
      PDFName.of('Resources'),
      context.obj({
        Font: {
          F1: context.register(simple),
          F2: context.register(standard),
          F3: context.register(composite),
          F4: context.register(type3),
        },
      }),
    );

    const fonts = readFontMetrics(page);

    expect(fonts.F1).toEqual({
      codeBytes: 1,
      widths: { 65: 600, 66: 700 },
      missingWidth: 250,
    });
    expect(fonts.F2?.widths[65]).toBe(667);
    expect(fonts.F2?.widths[32]).toBe(278);
    expect(fonts.F3).toEqual({
      codeBytes: 2,
      widths: { 3: 400, 4: 450, 10: 900, 11: 900, 12: 900 },
      missingWidth: 500,
    });
    expect(fonts.F4).toBeUndefined();
  });

  it('reads no fonts from a page without font resources', async () => {
    expect(readFontMetrics(await blankPage())).toEqual({});
  });
});

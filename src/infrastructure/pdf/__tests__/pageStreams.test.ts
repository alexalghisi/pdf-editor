import { PDFDocument, PDFName } from 'pdf-lib';

import {
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
});

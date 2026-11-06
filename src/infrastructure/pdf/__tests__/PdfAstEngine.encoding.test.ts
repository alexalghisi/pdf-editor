import fontkit from '@pdf-lib/fontkit';
import { Buffer } from 'buffer';
import { PDFDocument } from 'pdf-lib';

import { getPage } from '@/domain/entities/PdfDocument';
import { pageNodesOfType } from '@/domain/entities/PdfPage';
import { BLACK } from '@/domain/valueObjects/RgbColor';
import { rect } from '@/domain/valueObjects/Rect';
import { UNICODE_FONT_BASE64 } from '@/infrastructure/pdf/fonts/unicodeFontData';
import { PdfLibAstEngine } from '@/infrastructure/pdf/PdfLibAstEngine';
import { buildFixturePdf } from '@/infrastructure/pdf/testing/buildFixturePdf';

/** A page written the way browsers and office suites write text: Identity-H + ToUnicode. */
async function identityFontPdf(text: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(Buffer.from(UNICODE_FONT_BASE64, 'base64'), {
    subset: false,
  });
  const page = pdf.addPage([612, 792]);
  page.drawText(text, { x: 72, y: 700, size: 14, font });
  return pdf.save();
}

async function texts(engine: PdfLibAstEngine, bytes: Uint8Array) {
  const document = await engine.load(bytes);
  return { document, nodes: pageNodesOfType(getPage(document, 0), 'text') };
}

describe('PdfAstEngine text encoding', () => {
  let engine: PdfLibAstEngine;

  beforeEach(() => {
    engine = new PdfLibAstEngine();
  });

  afterEach(() => {
    engine.disposeAll();
  });

  it('reads two-byte Identity-H text as real characters', async () => {
    const { nodes } = await texts(
      engine,
      await identityFontPdf('Factură Ștefan'),
    );

    expect(nodes.map((node) => node.content).join('')).toBe('Factură Ștefan');
  });

  it('edits Identity-H text in its own font and keeps it readable after save', async () => {
    const { document, nodes } = await texts(
      engine,
      await identityFontPdf('Factură proformă'),
    );
    const first = nodes[0];
    if (first === undefined) {
      throw new Error('expected text');
    }

    const updated = await engine.updateText(document, {
      nodeId: first.id,
      content: 'Factură finală',
    });
    const saved = await engine.serialize(await engine.snapshot(document));
    const reopened = await texts(new PdfLibAstEngine(), saved);

    expect(updated.fontName).toBe(first.fontName);
    expect(reopened.nodes.map((node) => node.content).join('')).toBe(
      'Factură finală',
    );
  });

  it('switches to the Unicode font when the run font lacks a character', async () => {
    const { document, nodes } = await texts(
      engine,
      buildFixturePdf({ text: 'Hello PDF' }),
    );
    const first = nodes[0];
    if (first === undefined) {
      throw new Error('expected text');
    }

    const updated = await engine.updateText(document, {
      nodeId: first.id,
      content: 'Țară ș Привет',
    });
    const saved = await engine.serialize(await engine.snapshot(document));
    const reopened = await texts(new PdfLibAstEngine(), saved);

    expect(updated.fontName).toBe('FUni');
    expect(reopened.nodes.map((node) => node.content).join('')).toBe(
      'Țară ș Привет',
    );
  });

  it('writes WinAnsi text in Helvetica and other text in the Unicode font', async () => {
    const document = await engine.load(buildFixturePdf());
    const plain = await engine.addText(document, {
      pageIndex: 0,
      content: 'Café — 10 €',
      bounds: rect(72, 600, 100, 14),
      fontSize: 14,
      color: BLACK,
    });
    const romanian = await engine.addText(document, {
      pageIndex: 0,
      content: 'Semnătură',
      bounds: rect(72, 560, 100, 14),
      fontSize: 14,
      color: BLACK,
    });
    const saved = await engine.serialize(await engine.snapshot(document));
    const reopened = await texts(new PdfLibAstEngine(), saved);
    const contents = reopened.nodes.map((node) => node.content);

    expect(plain.fontName).toBe('FHelv');
    expect(romanian.fontName).toBe('FUni');
    expect(contents).toEqual(
      expect.arrayContaining(['Café — 10 €', 'Semnătură']),
    );
  });

  it('keeps encoded text when an added run is moved', async () => {
    const document = await engine.load(buildFixturePdf());
    const added = await engine.addText(document, {
      pageIndex: 0,
      content: 'Mută-mă',
      bounds: rect(72, 600, 100, 14),
      fontSize: 14,
      color: BLACK,
    });

    await engine.moveNode(document, added.id, rect(200, 300, 100, 14));
    const saved = await engine.serialize(await engine.snapshot(document));
    const reopened = await texts(new PdfLibAstEngine(), saved);
    const moved = reopened.nodes.find((node) => node.content === 'Mută-mă');

    expect(moved?.bounds.x).toBeCloseTo(200);
    expect(moved?.bounds.y).toBeCloseTo(300);
  });

  it('turns wide TJ gaps into spaces between words', async () => {
    const document = await engine.load(
      buildFixturePdf({
        content: 'BT /F1 12 Tf 72 700 Td [(Hello) -300 (World)] TJ ET',
      }),
    );

    const nodes = pageNodesOfType(getPage(document, 0), 'text');

    expect(nodes.map((node) => node.content)).toEqual(['Hello World']);
  });
});

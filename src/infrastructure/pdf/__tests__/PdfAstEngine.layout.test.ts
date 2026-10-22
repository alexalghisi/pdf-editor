import { PDFDocument } from 'pdf-lib';

import { getPage, type PdfDocument } from '@/domain/entities/PdfDocument';
import { pageNodesOfType } from '@/domain/entities/PdfPage';
import type { PdfImageNode } from '@/domain/entities/PdfImageNode';
import type { PdfTextNode } from '@/domain/entities/PdfTextNode';
import { BLACK } from '@/domain/valueObjects/RgbColor';
import { rect } from '@/domain/valueObjects/Rect';
import { PdfLibAstEngine } from '@/infrastructure/pdf/PdfLibAstEngine';
import { readPageContent } from '@/infrastructure/pdf/pdfLib/pageStreams';
import { buildFixturePdf } from '@/infrastructure/pdf/testing/buildFixturePdf';
import { TINY_PNG } from '@/infrastructure/pdf/testing/tinyPng';

const BROWSER_STYLE_PAGE = [
  '.24 0 0 -.24 0 792 cm',
  'q',
  '3.125 0 0 3.125 0 0 cm',
  'BT',
  '/F1 16 Tf',
  '1 0 0 -1 8 80 Tm',
  '(Hello world) Tj',
  '150 0 Td',
  '(again) Tj',
  'ET',
  'Q',
].join('\n');

const FLIPPED_IMAGE_PAGE = [
  '.5 0 0 -.5 0 792 cm',
  'q',
  '200 0 0 100 40 400 cm',
  '/Im1 Do',
  'Q',
].join('\n');

function textNode(document: PdfDocument, content: string): PdfTextNode {
  const node = pageNodesOfType(getPage(document, 0), 'text').find(
    (candidate) => candidate.content === content,
  );
  if (node === undefined) {
    throw new Error(`expected a text node reading "${content}"`);
  }
  return node;
}

function onlyImage(document: PdfDocument): PdfImageNode {
  const node = pageNodesOfType(getPage(document, 0), 'image')[0];
  if (node === undefined) {
    throw new Error('expected an image node');
  }
  return node;
}

describe('PdfAstEngine layout under a transformed page', () => {
  let engine: PdfLibAstEngine;

  const reload = async (document: PdfDocument): Promise<PdfDocument> =>
    engine.load(await engine.serialize(document));

  beforeEach(() => {
    engine = new PdfLibAstEngine();
  });

  afterEach(() => {
    engine.disposeAll();
  });

  it('places text drawn under a flipped CTM in page space', async () => {
    const document = await engine.load(
      buildFixturePdf({ content: BROWSER_STYLE_PAGE }),
    );

    const hello = textNode(document, 'Hello world');

    expect(hello.bounds.x).toBeCloseTo(6, 3);
    expect(hello.bounds.y).toBeCloseTo(732, 3);
    expect(hello.fontSize).toBeCloseTo(12, 3);
  });

  it('moves a run to the requested page position and keeps its size', async () => {
    const document = await engine.load(
      buildFixturePdf({ content: BROWSER_STYLE_PAGE }),
    );
    const hello = textNode(document, 'Hello world');

    await engine.moveNode(
      document,
      hello.id,
      rect(100, 500, hello.bounds.width, hello.bounds.height),
    );
    const moved = textNode(await reload(document), 'Hello world');

    expect(moved.bounds.x).toBeCloseTo(100, 3);
    expect(moved.bounds.y).toBeCloseTo(500, 3);
    expect(moved.fontSize).toBeCloseTo(12, 3);
  });

  it('keeps the next run of the same text object where it was', async () => {
    const document = await engine.load(
      buildFixturePdf({ content: BROWSER_STYLE_PAGE }),
    );
    const hello = textNode(document, 'Hello world');
    const again = textNode(document, 'again');

    await engine.moveNode(
      document,
      hello.id,
      rect(100, 500, hello.bounds.width, hello.bounds.height),
    );
    const after = textNode(await reload(document), 'again');

    expect(after.bounds.x).toBeCloseTo(again.bounds.x, 3);
    expect(after.bounds.y).toBeCloseTo(again.bounds.y, 3);
  });

  it('edits a run in place without flipping or rescaling it', async () => {
    const document = await engine.load(
      buildFixturePdf({ content: BROWSER_STYLE_PAGE }),
    );
    const hello = textNode(document, 'Hello world');

    await engine.updateText(document, { nodeId: hello.id, content: 'Edited' });
    const edited = textNode(await reload(document), 'Edited');

    expect(edited.bounds.x).toBeCloseTo(hello.bounds.x, 3);
    expect(edited.bounds.y).toBeCloseTo(hello.bounds.y, 3);
    expect(edited.fontSize).toBeCloseTo(hello.fontSize, 3);
  });

  it('draws added text in page space when the page leaves a CTM applied', async () => {
    const document = await engine.load(
      buildFixturePdf({ content: BROWSER_STYLE_PAGE }),
    );

    await engine.addText(document, {
      pageIndex: 0,
      content: 'Inserted',
      bounds: rect(72, 600, 80, 16),
      fontSize: 16,
      color: BLACK,
    });
    const inserted = textNode(await reload(document), 'Inserted');

    expect(inserted.bounds.x).toBeCloseTo(72, 3);
    expect(inserted.bounds.y).toBeCloseTo(600, 3);
    expect(inserted.fontSize).toBeCloseTo(16, 3);
  });

  it('bounds a flipped image by its painted corners', async () => {
    const document = await engine.load(
      buildFixturePdf({ content: FLIPPED_IMAGE_PAGE, includeImage: true }),
    );

    expect(onlyImage(document).bounds).toEqual(rect(20, 542, 100, 50));
  });

  it('moves a flipped image to the requested page position', async () => {
    const document = await engine.load(
      buildFixturePdf({ content: FLIPPED_IMAGE_PAGE, includeImage: true }),
    );
    const image = onlyImage(document);

    await engine.moveNode(document, image.id, rect(300, 100, 100, 50));
    const moved = onlyImage(await reload(document));

    expect(moved.bounds.x).toBeCloseTo(300, 3);
    expect(moved.bounds.y).toBeCloseTo(100, 3);
    expect(moved.bounds.width).toBeCloseTo(100, 3);
    expect(moved.bounds.height).toBeCloseTo(50, 3);
  });

  describe('inline images', () => {
    const inlineImage =
      'BI /W 2 /H 2 /CS /G /BPC 8 ID \u0001\u0002\u0003\u0004 EI';
    const page = `q 80 0 0 40 100 200 cm ${inlineImage} Q`;

    it('moves an inline image and keeps its data intact', async () => {
      const document = await engine.load(buildFixturePdf({ content: page }));
      const image = onlyImage(document);

      await engine.moveNode(document, image.id, rect(300, 500, 80, 40));
      const saved = await engine.serialize(document);
      const moved = onlyImage(await engine.load(saved));
      const pdf = await PDFDocument.load(saved);

      expect(moved.bounds.x).toBeCloseTo(300, 3);
      expect(moved.bounds.y).toBeCloseTo(500, 3);
      expect(readPageContent(pdf.getPage(0))).toContain(inlineImage);
    });

    it('refuses to replace the pixels of an inline image', async () => {
      const document = await engine.load(buildFixturePdf({ content: page }));

      await expect(
        engine.updateImage(document, {
          nodeId: onlyImage(document).id,
          imageBytes: TINY_PNG,
          mimeType: 'image/png',
        }),
      ).rejects.toMatchObject({ code: 'UNSUPPORTED_IMAGE' });
    });
  });
});

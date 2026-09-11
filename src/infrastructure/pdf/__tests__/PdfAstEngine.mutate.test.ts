import { BLACK, rgbColor } from '@/domain/valueObjects/RgbColor';
import { getPage } from '@/domain/entities/PdfDocument';
import { pageNodesOfType } from '@/domain/entities/PdfPage';
import { rect } from '@/domain/valueObjects/Rect';
import { PdfLibAstEngine } from '@/infrastructure/pdf/PdfLibAstEngine';
import { buildFixturePdf } from '@/infrastructure/pdf/testing/buildFixturePdf';
import { TINY_PNG } from '@/infrastructure/pdf/testing/tinyPng';

describe('PdfAstEngine.mutate', () => {
  let engine: PdfLibAstEngine;

  beforeEach(() => {
    engine = new PdfLibAstEngine();
  });

  afterEach(() => {
    engine.disposeAll();
  });

  it('adds a text object to the page content stream', async () => {
    const document = await engine.load(buildFixturePdf());

    const added = await engine.addText(document, {
      pageIndex: 0,
      content: 'Inserted',
      bounds: rect(90, 640, 80, 14),
      fontSize: 14,
      color: rgbColor(0.1, 0.2, 0.3),
    });
    const snapshot = await engine.snapshot(document);
    const texts = pageNodesOfType(getPage(snapshot, 0), 'text').map(
      (node) => node.content,
    );

    expect(added.content).toBe('Inserted');
    expect(texts).toEqual(expect.arrayContaining(['Hello PDF', 'Inserted']));
  });

  it('updates text by rewriting the Tj operand, not an annotation', async () => {
    const document = await engine.load(buildFixturePdf({ text: 'Hello PDF' }));
    const original = pageNodesOfType(getPage(document, 0), 'text')[0];
    if (original === undefined) {
      throw new Error('expected original text');
    }

    await engine.updateText(document, {
      nodeId: original.id,
      content: 'Edited PDF',
    });
    const snapshot = await engine.snapshot(document);
    const updated = pageNodesOfType(getPage(snapshot, 0), 'text')[0];

    expect(updated?.content).toBe('Edited PDF');
    expect(updated?.id).toBe(original.id);
  });

  it('deletes a text node from the content stream', async () => {
    const document = await engine.load(buildFixturePdf());
    const original = pageNodesOfType(getPage(document, 0), 'text')[0];
    if (original === undefined) {
      throw new Error('expected original text');
    }

    await engine.deleteNode(document, original.id);
    const snapshot = await engine.snapshot(document);

    expect(pageNodesOfType(getPage(snapshot, 0), 'text')).toHaveLength(0);
  });

  it('moves a text node by rewriting its text matrix translation', async () => {
    const document = await engine.load(buildFixturePdf());
    const original = pageNodesOfType(getPage(document, 0), 'text')[0];
    if (original === undefined) {
      throw new Error('expected original text');
    }

    await engine.moveNode(
      document,
      original.id,
      rect(120, 500, original.bounds.width, original.bounds.height),
    );
    const snapshot = await engine.snapshot(document);
    const moved = pageNodesOfType(getPage(snapshot, 0), 'text')[0];

    expect(moved?.bounds.x).toBeCloseTo(120, 1);
    expect(moved?.bounds.y).toBeCloseTo(500, 1);
  });

  it('adds and relocates an image XObject', async () => {
    const document = await engine.load(buildFixturePdf());

    const image = await engine.addImage(document, {
      pageIndex: 0,
      imageBytes: TINY_PNG,
      mimeType: 'image/png',
      bounds: rect(40, 40, 64, 64),
    });
    await engine.moveNode(document, image.id, rect(80, 90, 64, 64));
    const snapshot = await engine.snapshot(document);
    const moved = pageNodesOfType(getPage(snapshot, 0), 'image').find(
      (node) => node.id === image.id,
    );

    expect(moved?.bounds.x).toBeCloseTo(80, 1);
    expect(moved?.bounds.y).toBeCloseTo(90, 1);
  });

  it('serializes mutations and reloads them from bytes', async () => {
    const document = await engine.load(
      buildFixturePdf({
        title: 'Quarterly Report',
        author: 'Alghisi Alessandro Paolo',
      }),
    );
    const original = pageNodesOfType(getPage(document, 0), 'text')[0];
    if (original === undefined) {
      throw new Error('expected original text');
    }
    await engine.updateText(document, {
      nodeId: original.id,
      content: 'Persisted',
    });

    const bytes = await engine.serialize(document);
    const reloaded = await engine.load(bytes);

    expect(reloaded.metadata.title).toBe('Quarterly Report');
    expect(reloaded.metadata.author).toBe('Alghisi Alessandro Paolo');
    expect(pageNodesOfType(getPage(reloaded, 0), 'text')[0]?.content).toBe(
      'Persisted',
    );
  });

  it('preserves untouched text when another node is edited', async () => {
    const document = await engine.load(buildFixturePdf({ text: 'Keep me' }));
    await engine.addText(document, {
      pageIndex: 0,
      content: 'Temp',
      bounds: rect(10, 10, 40, 12),
      fontSize: 12,
      color: BLACK,
    });
    const snapshot = await engine.snapshot(document);
    const temp = pageNodesOfType(getPage(snapshot, 0), 'text').find(
      (node) => node.content === 'Temp',
    );
    if (temp === undefined) {
      throw new Error('expected inserted text');
    }
    await engine.deleteNode(snapshot, temp.id);
    const finalDoc = await engine.snapshot(snapshot);

    expect(
      pageNodesOfType(getPage(finalDoc, 0), 'text').map((node) => node.content),
    ).toEqual(['Keep me']);
  });
});

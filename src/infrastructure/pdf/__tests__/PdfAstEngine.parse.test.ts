import { PdfLibAstEngine } from '@/infrastructure/pdf/PdfLibAstEngine';
import { buildFixturePdf } from '@/infrastructure/pdf/testing/buildFixturePdf';
import { PdfDomainError } from '@/domain/errors/PdfDomainError';
import { getPage } from '@/domain/entities/PdfDocument';
import { pageNodesOfType } from '@/domain/entities/PdfPage';

describe('PdfAstEngine.parse', () => {
  let engine: PdfLibAstEngine;

  beforeEach(() => {
    engine = new PdfLibAstEngine();
  });

  afterEach(() => {
    engine.disposeAll();
  });

  it('loads a catalog and reports a single letter-size page', async () => {
    const bytes = buildFixturePdf({ text: 'Hello PDF' });

    const document = await engine.load(bytes);

    expect(document.pageCount).toBe(1);
    const page = getPage(document, 0);
    expect(page.mediaBox).toEqual({
      x: 0,
      y: 0,
      width: 612,
      height: 792,
    });
  });

  it('extracts text nodes from the page content stream with page-space bounds', async () => {
    const bytes = buildFixturePdf({
      text: 'Hello PDF',
      textX: 72,
      textY: 720,
      fontSize: 12,
    });

    const document = await engine.load(bytes);
    const texts = pageNodesOfType(getPage(document, 0), 'text');

    expect(texts).toHaveLength(1);
    const node = texts[0];
    expect(node).toBeDefined();
    if (node === undefined) {
      throw new Error('expected a text node');
    }
    expect(node.content).toBe('Hello PDF');
    expect(node.fontName).toBe('F1');
    expect(node.fontSize).toBe(12);
    expect(node.bounds.x).toBeCloseTo(72, 1);
    expect(node.bounds.y).toBeCloseTo(720, 1);
    expect(node.bounds.width).toBeGreaterThan(0);
    expect(node.bounds.height).toBeCloseTo(12, 1);
    expect(node.id).toMatch(/^page:0:text:0$/);
  });

  it('extracts image XObjects with the concatenated transformation matrix', async () => {
    const bytes = buildFixturePdf({ includeImage: true });

    const document = await engine.load(bytes);
    const images = pageNodesOfType(getPage(document, 0), 'image');

    expect(images).toHaveLength(1);
    const image = images[0];
    expect(image).toBeDefined();
    if (image === undefined) {
      throw new Error('expected an image node');
    }
    expect(image.resourceName).toBe('Im1');
    expect(image.pixelWidth).toBe(1);
    expect(image.pixelHeight).toBe(1);
    expect(image.bounds.x).toBeCloseTo(200, 1);
    expect(image.bounds.y).toBeCloseTo(400, 1);
    expect(image.bounds.width).toBeCloseTo(80, 1);
    expect(image.bounds.height).toBeCloseTo(80, 1);
  });

  it('preserves the document information dictionary', async () => {
    const bytes = buildFixturePdf({
      title: 'Quarterly Report',
      author: 'Alghisi Alessandro Paolo',
      creator: 'Editorial Desk',
      producer: 'FixtureWriter/1.0',
    });

    const document = await engine.load(bytes);

    expect(document.metadata.title).toBe('Quarterly Report');
    expect(document.metadata.author).toBe('Alghisi Alessandro Paolo');
    expect(document.metadata.creator).toBe('Editorial Desk');
    expect(document.metadata.producer).toBe('FixtureWriter/1.0');
  });

  it('rejects bytes that are not a PDF', async () => {
    const bytes = new TextEncoder().encode('not a pdf');

    await expect(engine.load(bytes)).rejects.toBeInstanceOf(PdfDomainError);
    await expect(engine.load(bytes)).rejects.toMatchObject({
      code: 'INVALID_PDF',
    });
  });

  it('rejects a truncated xref table', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<< >>\nendobj\n');

    await expect(engine.load(bytes)).rejects.toMatchObject({
      code: 'INVALID_PDF',
    });
  });
});

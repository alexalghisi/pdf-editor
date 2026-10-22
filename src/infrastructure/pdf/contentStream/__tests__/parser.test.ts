import {
  parseContentStream,
  type ContentFragment,
} from '@/infrastructure/pdf/contentStream/parser';
import { rect } from '@/domain/valueObjects/Rect';
import { joinFragments } from '@/infrastructure/pdf/contentStream/rewriter';
import { tokenizeContentStream } from '@/infrastructure/pdf/contentStream/tokenizer';

function nodeFragments(fragments: readonly ContentFragment[]) {
  return fragments.filter((fragment) => fragment.kind !== 'passthrough');
}

describe('parseContentStream', () => {
  it('emits a text fragment in page user space', () => {
    const fragments = parseContentStream({
      source: 'BT /F1 18 Tf 0 0 0 rg 100 200 Td (Title) Tj ET',
      pageIndex: 0,
      imageResources: {},
    });

    const nodes = nodeFragments(fragments);
    expect(nodes).toHaveLength(1);
    const fragment = nodes[0];
    expect(fragment?.kind).toBe('text');
    if (fragment?.kind !== 'text') {
      throw new Error('expected text fragment');
    }
    expect(fragment.node.content).toBe('Title');
    expect(fragment.node.fontSize).toBe(18);
    expect(fragment.node.bounds.x).toBeCloseTo(100);
    expect(fragment.node.bounds.y).toBeCloseTo(200);
  });

  it('applies cm before an image Do', () => {
    const fragments = parseContentStream({
      source: 'q 40 0 0 20 10 30 cm /Im1 Do Q',
      pageIndex: 0,
      imageResources: {
        Im1: { width: 8, height: 4 },
      },
    });

    const nodes = nodeFragments(fragments);
    expect(nodes).toHaveLength(1);
    const fragment = nodes[0];
    expect(fragment?.kind).toBe('image');
    if (fragment?.kind !== 'image') {
      throw new Error('expected image fragment');
    }
    expect(fragment.node.resourceName).toBe('Im1');
    expect(fragment.node.bounds).toEqual({
      x: 10,
      y: 30,
      width: 40,
      height: 20,
    });
  });

  it('keeps path construction as passthrough so vector art is not dropped', () => {
    const fragments = parseContentStream({
      source: '0 0 m 100 0 l S',
      pageIndex: 0,
      imageResources: {},
    });

    expect(nodeFragments(fragments)).toHaveLength(0);
    expect(joinFragments(fragments)).toContain('0 0 m 100 0 l S');
  });

  it('advances the text matrix after each Tj so glyphs are not stacked', () => {
    const fragments = parseContentStream({
      source: 'BT /F1 12 Tf 72 720 Td (H) Tj (e) Tj (l) Tj (l) Tj (o) Tj ET',
      pageIndex: 0,
      imageResources: {},
    });

    const nodes = nodeFragments(fragments);
    expect(nodes).toHaveLength(1);
    const fragment = nodes[0];
    expect(fragment?.kind).toBe('text');
    if (fragment?.kind !== 'text') {
      throw new Error('expected merged text');
    }
    expect(fragment.node.content).toBe('Hello');
    expect(fragment.node.bounds.x).toBeCloseTo(72);
    expect(fragment.node.bounds.y).toBeCloseTo(720);
    expect(fragment.node.bounds.width).toBeGreaterThan(20);
    expect(fragment.node.fontSize).toBeCloseTo(12);
  });

  it('reads painted size from Tm when Tf is 1', () => {
    const fragments = parseContentStream({
      source: 'BT /F1 1 Tf 18 0 0 18 90 640 Tm (Title) Tj ET',
      pageIndex: 0,
      imageResources: {},
    });

    const fragment = nodeFragments(fragments)[0];
    expect(fragment?.kind).toBe('text');
    if (fragment?.kind !== 'text') {
      throw new Error('expected text fragment');
    }
    expect(fragment.node.content).toBe('Title');
    expect(fragment.node.fontSize).toBeCloseTo(18);
    expect(fragment.node.bounds.x).toBeCloseTo(90);
    expect(fragment.node.bounds.y).toBeCloseTo(640);
    expect(fragment.node.bounds.height).toBeCloseTo(18);
  });

  it('joins TJ parts and applies kerning to the run width', () => {
    const fragments = parseContentStream({
      source: 'BT /F1 10 Tf 50 400 Td [(Hel) 0 (lo)] TJ ET',
      pageIndex: 0,
      imageResources: {},
    });

    const fragment = nodeFragments(fragments)[0];
    expect(fragment?.kind).toBe('text');
    if (fragment?.kind !== 'text') {
      throw new Error('expected text fragment');
    }
    expect(fragment.node.content).toBe('Hello');
    expect(fragment.node.bounds.x).toBeCloseTo(50);
    expect(fragment.node.bounds.y).toBeCloseTo(400);
  });

  it('strips NUL bytes from UTF-16BE hex strings without a BOM', () => {
    const fragments = parseContentStream({
      source: 'BT /F1 12 Tf 10 20 Td <00480069> Tj ET',
      pageIndex: 0,
      imageResources: {},
    });

    const fragment = nodeFragments(fragments)[0];
    expect(fragment?.kind).toBe('text');
    if (fragment?.kind !== 'text') {
      throw new Error('expected text fragment');
    }
    expect(fragment.node.content).toBe('Hi');
  });

  it('moves to the next line with T* after TL', () => {
    const fragments = parseContentStream({
      source: 'BT /F1 12 Tf 12 TL 100 200 Td (One) Tj T* (Two) Tj ET',
      pageIndex: 0,
      imageResources: {},
    });

    const texts = fragments.filter((fragment) => fragment.kind === 'text');
    expect(texts).toHaveLength(2);
    if (texts[0]?.kind !== 'text' || texts[1]?.kind !== 'text') {
      throw new Error('expected two text runs');
    }
    expect(texts[0].node.content).toBe('One');
    expect(texts[1].node.content).toBe('Two');
    expect(texts[1].node.bounds.y).toBeCloseTo(188);
    expect(texts[1].node.bounds.x).toBeCloseTo(100);
  });

  it('leaves an empty stream empty instead of isolating nothing', () => {
    expect(
      parseContentStream({ source: '', pageIndex: 0, imageResources: {} }),
    ).toEqual([]);
  });

  it('writes an untouched stream back operator for operator', () => {
    const source = [
      '.24 0 0 -.24 0 792 cm',
      'q 3.125 0 0 3.125 0 0 cm 0 0 0 rg',
      'BT /F1 16 Tf 1 0 0 -1 8 80 Tm <002B0048> Tj 210.5 0 Td [(a) -20 (b)] TJ ET',
      'q 40 0 0 20 10 30 cm /Im1 Do Q',
      'Q',
    ].join('\n');

    const fragments = parseContentStream({
      source,
      pageIndex: 0,
      imageResources: { Im1: { width: 8, height: 4 } },
    });

    expect(tokenizeContentStream(joinFragments(fragments))).toEqual(
      tokenizeContentStream(`q ${source} Q`),
    );
  });

  describe('inline images', () => {
    const source =
      'q 40 0 0 20 10 30 cm BI /W 4 /H 2 /CS /G /BPC 8 ID \u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007 EI Q';

    it('exposes an inline image as an image node painted by the CTM', () => {
      const image = nodeFragments(
        parseContentStream({ source, pageIndex: 0, imageResources: {} }),
      )[0];

      expect(image?.kind).toBe('image');
      if (image?.kind !== 'image') {
        throw new Error('expected an image fragment');
      }
      expect(image.node.resourceName).toBeNull();
      expect(image.node.bounds).toEqual(rect(10, 30, 40, 20));
      expect(image.node.pixelWidth).toBe(4);
      expect(image.node.pixelHeight).toBe(2);
    });

    it('reads the full key names an inline dictionary may use', () => {
      const image = nodeFragments(
        parseContentStream({
          source: 'BI /Width 3 /Height 5 ID \u0000 EI',
          pageIndex: 0,
          imageResources: {},
        }),
      )[0];

      expect(image).toMatchObject({
        node: { pixelWidth: 3, pixelHeight: 5 },
      });
    });

    it('writes the image data back byte for byte', () => {
      const fragments = parseContentStream({
        source,
        pageIndex: 0,
        imageResources: {},
      });

      expect(joinFragments(fragments)).toContain(
        source.slice(source.indexOf('BI'), source.lastIndexOf(' Q')),
      );
    });
  });
});

import { parseContentStream } from '@/infrastructure/pdf/contentStream/parser';

describe('parseContentStream', () => {
  it('emits a text fragment in page user space', () => {
    const fragments = parseContentStream({
      source: 'BT /F1 18 Tf 0 0 0 rg 100 200 Td (Title) Tj ET',
      pageIndex: 0,
      imageResources: {},
    });

    expect(fragments).toHaveLength(1);
    const fragment = fragments[0];
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

    expect(fragments).toHaveLength(1);
    const fragment = fragments[0];
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

    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.kind).toBe('passthrough');
  });
});

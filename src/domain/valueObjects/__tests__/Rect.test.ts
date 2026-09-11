import { PdfDomainError } from '@/domain/errors/PdfDomainError';
import { moveRect, rect, rectsIntersect } from '@/domain/valueObjects/Rect';

describe('Rect', () => {
  it('creates a finite rectangle in PDF user space', () => {
    expect(rect(10, 20, 30, 40)).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });
  });

  it('rejects negative extents', () => {
    expect(() => rect(0, 0, -1, 10)).toThrow(PdfDomainError);
  });

  it('moves without mutating the source', () => {
    const source = rect(1, 2, 3, 4);
    expect(moveRect(source, 8, 9)).toEqual({
      x: 8,
      y: 9,
      width: 3,
      height: 4,
    });
    expect(source.x).toBe(1);
  });

  it('detects intersection', () => {
    expect(rectsIntersect(rect(0, 0, 10, 10), rect(5, 5, 10, 10))).toBe(true);
    expect(rectsIntersect(rect(0, 0, 10, 10), rect(20, 20, 1, 1))).toBe(false);
  });
});

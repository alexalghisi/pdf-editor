import { formatZoom, isCompact } from '@/presentation/theme/responsive';

describe('isCompact', () => {
  it('treats phone widths as compact', () => {
    expect(isCompact(320)).toBe(true);
    expect(isCompact(599)).toBe(true);
  });

  it('treats tablet and desktop widths as regular', () => {
    expect(isCompact(600)).toBe(false);
    expect(isCompact(1440)).toBe(false);
  });
});

describe('formatZoom', () => {
  it('rounds floating point zoom steps to a whole percentage', () => {
    expect(formatZoom(1)).toBe('100%');
    expect(formatZoom(1.2000000000000002)).toBe('120%');
    expect(formatZoom(0.4)).toBe('40%');
  });
});

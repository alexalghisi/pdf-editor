import {
  IDENTITY,
  applyToPoint,
  invert,
  multiply,
  shiftInPageSpace,
} from '@/domain/valueObjects/Matrix';

const FLIPPED_PAGE = [0.24, 0, 0, -0.24, 0, 792] as const;

describe('Matrix', () => {
  it('inverts an affine transform', () => {
    const product = multiply(FLIPPED_PAGE, invert(FLIPPED_PAGE));

    product.forEach((value, index) => {
      expect(value).toBeCloseTo(IDENTITY[index] ?? Number.NaN, 9);
    });
  });

  it('moves a local transform by a page-space offset', () => {
    const local = [1, 0, 0, -1, 8, 80] as const;

    const shifted = shiftInPageSpace(local, FLIPPED_PAGE, 30, -50);
    const before = applyToPoint(multiply(FLIPPED_PAGE, local), 0, 0);
    const after = applyToPoint(multiply(FLIPPED_PAGE, shifted), 0, 0);

    expect(after.x - before.x).toBeCloseTo(30, 9);
    expect(after.y - before.y).toBeCloseTo(-50, 9);
  });

  it('leaves the transform alone when the CTM cannot be inverted', () => {
    const local = [1, 0, 0, 1, 5, 5] as const;

    expect(shiftInPageSpace(local, [0, 0, 0, 0, 0, 0], 10, 10)).toBe(local);
  });
});

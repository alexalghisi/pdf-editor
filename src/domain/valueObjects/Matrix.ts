export type Matrix = readonly [
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(left: Matrix, right: Matrix): Matrix {
  const [a, b, c, d, e, f] = left;
  const [a2, b2, c2, d2, e2, f2] = right;
  return [
    a * a2 + c * b2,
    b * a2 + d * b2,
    a * c2 + c * d2,
    b * c2 + d * d2,
    a * e2 + c * f2 + e,
    b * e2 + d * f2 + f,
  ];
}

export function applyToPoint(
  matrix: Matrix,
  x: number,
  y: number,
): { x: number; y: number } {
  const [a, b, c, d, e, f] = matrix;
  return {
    x: a * x + c * y + e,
    y: b * x + d * y + f,
  };
}

export function translation(x: number, y: number): Matrix {
  return [1, 0, 0, 1, x, y];
}

export function scale(sx: number, sy: number): Matrix {
  return [sx, 0, 0, sy, 0, 0];
}

export function invert(matrix: Matrix): Matrix {
  const [a, b, c, d, e, f] = matrix;
  const determinant = a * d - b * c;
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ];
}

export function shiftInPageSpace(
  local: Matrix,
  ctm: Matrix,
  dx: number,
  dy: number,
): Matrix {
  const [a, b, c, d] = ctm;
  if (a * d - b * c === 0) {
    return local;
  }
  return multiply(
    invert(ctm),
    multiply(translation(dx, dy), multiply(ctm, local)),
  );
}

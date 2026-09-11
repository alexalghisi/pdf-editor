import { PdfDomainError } from '@/domain/errors/PdfDomainError';

export type Rect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export function rect(
  x: number,
  y: number,
  width: number,
  height: number,
): Rect {
  if (![x, y, width, height].every((value) => Number.isFinite(value))) {
    throw new PdfDomainError(
      'INVALID_BOUNDS',
      'Rectangle values must be finite numbers',
    );
  }
  if (width < 0 || height < 0) {
    throw new PdfDomainError(
      'INVALID_BOUNDS',
      'Rectangle width and height must be non-negative',
    );
  }
  return { x, y, width, height };
}

export function moveRect(source: Rect, x: number, y: number): Rect {
  return rect(x, y, source.width, source.height);
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

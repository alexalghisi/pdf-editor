import { PdfDomainError } from '@/domain/errors/PdfDomainError';

export type RgbColor = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

export function rgbColor(r: number, g: number, b: number): RgbColor {
  const channels = [r, g, b];
  if (
    !channels.every(
      (channel) => Number.isFinite(channel) && channel >= 0 && channel <= 1,
    )
  ) {
    throw new PdfDomainError(
      'INVALID_COLOR',
      'RGB channels must be in the inclusive range [0, 1]',
    );
  }
  return { r, g, b };
}

export const BLACK = rgbColor(0, 0, 0);
export const WHITE = rgbColor(1, 1, 1);

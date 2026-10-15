import { moveRect, rect, type Rect } from '@/domain/valueObjects/Rect';

/**
 * PDF user space is origin-bottom-left. The canvas is origin-top-left.
 */
export function pdfToScreen(bounds: Rect, mediaBox: Rect, scale: number): Rect {
  return rect(
    bounds.x * scale,
    (mediaBox.height - bounds.y - bounds.height) * scale,
    bounds.width * scale,
    bounds.height * scale,
  );
}

export function screenToPdf(bounds: Rect, mediaBox: Rect, scale: number): Rect {
  const width = bounds.width / scale;
  const height = bounds.height / scale;
  return rect(
    bounds.x / scale,
    mediaBox.height - bounds.y / scale - height,
    width,
    height,
  );
}

export type ScreenOffset = {
  readonly dx: number;
  readonly dy: number;
};

export function offsetByScreenDelta(
  bounds: Rect,
  offset: ScreenOffset,
  scale: number,
): Rect {
  return moveRect(
    bounds,
    bounds.x + offset.dx / scale,
    bounds.y - offset.dy / scale,
  );
}

export function fitScale(
  page: Rect,
  available: { readonly width: number; readonly height: number },
  padding: number,
): number {
  const width = available.width - padding * 2;
  const height = available.height - padding * 2;
  if (width <= 0 || height <= 0) {
    return 0;
  }
  return Math.min(width / page.width, height / page.height);
}

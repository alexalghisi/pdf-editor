import { rect, type Rect } from '@/domain/valueObjects/Rect';

/**
 * PDF user space is origin-bottom-left. The canvas is origin-top-left.
 */
export function pdfToScreen(
  bounds: Rect,
  mediaBox: Rect,
  scale: number,
): Rect {
  return rect(
    bounds.x * scale,
    (mediaBox.height - bounds.y - bounds.height) * scale,
    bounds.width * scale,
    bounds.height * scale,
  );
}

export function screenToPdf(
  bounds: Rect,
  mediaBox: Rect,
  scale: number,
): Rect {
  const width = bounds.width / scale;
  const height = bounds.height / scale;
  return rect(
    bounds.x / scale,
    mediaBox.height - bounds.y / scale - height,
    width,
    height,
  );
}

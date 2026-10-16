import { rect, type Rect } from '@/domain/valueObjects/Rect';

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

export function fitPageScale(
  windowWidth: number,
  windowHeight: number,
  pageWidth: number,
  pageHeight: number,
): number {
  const widthScale = (windowWidth - 32) / pageWidth;
  const heightScale = Math.max(windowHeight - 180, 240) / pageHeight;
  return Math.min(widthScale, heightScale);
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

import { rect } from '@/domain/valueObjects/Rect';
import { pdfToScreen, screenToPdf } from '@/presentation/canvas/coordinates';

const media = rect(0, 0, 612, 792);

describe('canvas coordinates', () => {
  it('maps a PDF baseline box onto a top-left canvas', () => {
    const screen = pdfToScreen(rect(72, 720, 100, 12), media, 1);
    expect(screen.x).toBeCloseTo(72);
    expect(screen.y).toBeCloseTo(60);
    expect(screen.height).toBeCloseTo(12);
  });

  it('round-trips through screen space at 2× zoom', () => {
    const original = rect(40, 80, 50, 20);
    const screen = pdfToScreen(original, media, 2);
    const back = screenToPdf(screen, media, 2);
    expect(back.x).toBeCloseTo(original.x);
    expect(back.y).toBeCloseTo(original.y);
    expect(back.width).toBeCloseTo(original.width);
    expect(back.height).toBeCloseTo(original.height);
  });
});

import { rect } from '@/domain/valueObjects/Rect';
import {
  fitScale,
  offsetByScreenDelta,
  pdfToScreen,
  screenToPdf,
} from '@/presentation/canvas/coordinates';

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

  it('moves a box by a screen drag, flipping the vertical axis', () => {
    const moved = offsetByScreenDelta(
      rect(72, 700, 100, 12),
      { dx: 20, dy: 40 },
      2,
    );
    expect(moved).toEqual(rect(82, 680, 100, 12));
  });

  it('fits a portrait page inside a landscape stage by its height', () => {
    expect(fitScale(media, { width: 1024, height: 632 }, 16)).toBeCloseTo(
      600 / 792,
    );
  });

  it('fits a portrait page inside a phone stage by its width', () => {
    expect(fitScale(media, { width: 390, height: 700 }, 16)).toBeCloseTo(
      358 / 612,
    );
  });

  it('cannot fit a page before the stage has been measured', () => {
    expect(fitScale(media, { width: 0, height: 0 }, 16)).toBe(0);
  });
});

import type { PdfDocument } from '@/domain/entities/PdfDocument';
import type { PdfTextNode } from '@/domain/entities/PdfTextNode';

/** One run of words on a line, separated from the next cell by a wide gap. */
export type LayoutCell = {
  readonly text: string;
  readonly x: number;
};

export type LayoutLine = {
  readonly cells: readonly LayoutCell[];
  readonly x: number;
  /** Baseline, in PDF user space (origin bottom-left). */
  readonly y: number;
  readonly fontSize: number;
  readonly bold: boolean;
};

export type LayoutPage = {
  readonly index: number;
  readonly width: number;
  readonly height: number;
  readonly originX: number;
  readonly originY: number;
  readonly lines: readonly LayoutLine[];
};

/** Gap, in ems, wider than a space: separate runs this far apart are table cells. */
const CELL_GAP = 0.35;
/** Gap, in ems, that needs a space between two runs of one cell. */
const WORD_GAP = 0.15;

function sameLine(a: PdfTextNode, b: PdfTextNode): boolean {
  const size = Math.min(a.fontSize, b.fontSize);
  return Math.abs(a.bounds.y - b.bounds.y) <= size * 0.4;
}

function isBoldFont(name: string): boolean {
  return /bold|black|heavy|semibold/i.test(name);
}

function buildLine(runs: readonly PdfTextNode[]): LayoutLine {
  const sorted = [...runs].sort((a, b) => a.bounds.x - b.bounds.x);
  const cells: { text: string; x: number }[] = [];
  let previous: PdfTextNode | null = null;
  for (const run of sorted) {
    const text = run.content;
    if (previous === null) {
      cells.push({ text, x: run.bounds.x });
    } else {
      const gap = run.bounds.x - (previous.bounds.x + previous.bounds.width);
      const em = Math.max(previous.fontSize, 1);
      const current = cells[cells.length - 1];
      if (current === undefined || gap > em * CELL_GAP) {
        cells.push({ text, x: run.bounds.x });
      } else {
        const joiner =
          gap > em * WORD_GAP && !/\s$/.test(current.text) && !/^\s/.test(text)
            ? ' '
            : '';
        current.text += joiner + text;
      }
    }
    previous = run;
  }
  const first = sorted[0];
  return {
    cells: cells
      .map((cell) => ({ ...cell, text: cell.text.trim() }))
      .filter((cell) => cell.text.length > 0),
    x: first?.bounds.x ?? 0,
    y: first?.bounds.y ?? 0,
    fontSize: Math.max(...sorted.map((run) => run.fontSize)),
    bold: sorted.some((run) => isBoldFont(run.fontName)),
  };
}

/**
 * Groups a document's text runs into reading-order lines and cells, the
 * shared input of every non-PDF export.
 */
export function layoutDocument(document: PdfDocument): LayoutPage[] {
  return document.pages.map((page) => {
    const runs = page.nodes
      .filter((node): node is PdfTextNode => node.type === 'text')
      .filter((node) => node.content.trim().length > 0)
      .sort((a, b) => b.bounds.y - a.bounds.y || a.bounds.x - b.bounds.x);
    const groups: PdfTextNode[][] = [];
    for (const run of runs) {
      const group = groups.find((candidate) =>
        candidate.some((member) => sameLine(member, run)),
      );
      if (group === undefined) {
        groups.push([run]);
      } else {
        group.push(run);
      }
    }
    const lines = groups
      .map(buildLine)
      .filter((line) => line.cells.length > 0)
      .sort((a, b) => b.y - a.y || a.x - b.x);
    return {
      index: page.index,
      width: page.mediaBox.width,
      height: page.mediaBox.height,
      originX: page.mediaBox.x,
      originY: page.mediaBox.y,
      lines,
    };
  });
}

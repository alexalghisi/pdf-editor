import { MutateDocument } from '@/application/useCases/MutateDocument';
import { emptyMetadata } from '@/domain/entities/DocumentMetadata';
import type { PdfDocument } from '@/domain/entities/PdfDocument';
import { PdfDomainError } from '@/domain/errors/PdfDomainError';
import type { PdfAstEngine } from '@/domain/services/PdfAstEngine';
import { pdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import { BLACK } from '@/domain/valueObjects/RgbColor';
import { rect } from '@/domain/valueObjects/Rect';

function documentFixture(): PdfDocument {
  return {
    id: 'doc-1',
    pageCount: 1,
    pages: [
      {
        index: 0,
        mediaBox: rect(0, 0, 612, 792),
        nodes: [],
      },
    ],
    metadata: emptyMetadata(),
  };
}

describe('MutateDocument', () => {
  it('snapshots the engine after a successful structural edit', async () => {
    const loaded = documentFixture();
    const next = { ...loaded, id: 'doc-1' };
    const engine: Pick<PdfAstEngine, 'addText' | 'snapshot'> = {
      addText: jest.fn().mockResolvedValue({
        id: pdfObjectId('page:0:text:0'),
        type: 'text',
        pageIndex: 0,
        bounds: rect(0, 0, 10, 10),
        content: 'Hi',
        fontName: 'FHelv',
        fontSize: 12,
        color: BLACK,
      }),
      snapshot: jest.fn().mockResolvedValue(next),
    };
    const useCase = new MutateDocument(engine as PdfAstEngine);

    const result = await useCase.addText(loaded, {
      pageIndex: 0,
      content: 'Hi',
      bounds: rect(0, 0, 10, 10),
      fontSize: 12,
      color: BLACK,
    });

    expect(result.ok).toBe(true);
    expect(engine.snapshot).toHaveBeenCalledWith(loaded);
  });

  it('forwards domain errors without wrapping them', async () => {
    const loaded = documentFixture();
    const engine: Pick<PdfAstEngine, 'deleteNode'> = {
      deleteNode: jest
        .fn()
        .mockRejectedValue(
          new PdfDomainError('NODE_NOT_FOUND', 'missing'),
        ),
    };
    const useCase = new MutateDocument(engine as PdfAstEngine);

    const result = await useCase.deleteNode(
      loaded,
      pdfObjectId('page:0:text:0'),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NODE_NOT_FOUND');
    }
  });
});

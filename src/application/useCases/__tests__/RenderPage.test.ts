import type { PageRendererPort } from '@/application/ports/PageRendererPort';
import { RenderPage } from '@/application/useCases/RenderPage';
import { emptyMetadata } from '@/domain/entities/DocumentMetadata';
import type { PdfDocument } from '@/domain/entities/PdfDocument';
import { PdfDomainError } from '@/domain/errors/PdfDomainError';
import type { PdfAstEngine } from '@/domain/services/PdfAstEngine';

const document: PdfDocument = {
  id: 'doc-0',
  pageCount: 1,
  pages: [
    { index: 0, mediaBox: { x: 0, y: 0, width: 612, height: 792 }, nodes: [] },
  ],
  metadata: emptyMetadata(),
};

const bytes = new Uint8Array([37, 80, 68, 70]);

function setup(
  renderPage: PageRendererPort['renderPage'] = jest
    .fn()
    .mockResolvedValue({ uri: 'data:image/png', width: 1224, height: 1584 }),
) {
  const engine: Pick<PdfAstEngine, 'serialize'> = {
    serialize: jest.fn().mockResolvedValue(bytes),
  };
  const renderer: PageRendererPort = { renderPage };
  return {
    engine,
    renderer,
    useCase: new RenderPage(engine as PdfAstEngine, renderer),
  };
}

describe('RenderPage', () => {
  it('rasterizes the freshly serialized document', async () => {
    const { engine, renderer, useCase } = setup();

    const result = await useCase.execute(document, 0, 2);

    expect(engine.serialize).toHaveBeenCalledWith(document);
    expect(renderer.renderPage).toHaveBeenCalledWith(bytes, 0, 2);
    expect(result).toEqual({
      ok: true,
      value: { uri: 'data:image/png', width: 1224, height: 1584 },
    });
  });

  it('rejects a page outside the document without rendering', async () => {
    const { engine, renderer, useCase } = setup();

    const result = await useCase.execute(document, 3, 2);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('PAGE_OUT_OF_RANGE');
    expect(engine.serialize).not.toHaveBeenCalled();
    expect(renderer.renderPage).not.toHaveBeenCalled();
  });

  it('maps renderer failures to a domain error', async () => {
    const { useCase } = setup(
      jest.fn().mockRejectedValue(new Error('canvas lost')),
    );

    const result = await useCase.execute(document, 0, 2);

    expect(!result.ok && result.error).toBeInstanceOf(PdfDomainError);
    expect(!result.ok && result.error.message).toBe('canvas lost');
  });
});

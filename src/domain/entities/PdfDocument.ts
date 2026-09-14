import type { DocumentMetadata } from '@/domain/entities/DocumentMetadata';
import type { PdfPage } from '@/domain/entities/PdfPage';
import { PdfDomainError } from '@/domain/errors/PdfDomainError';
import type { PdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import type { PdfNode } from '@/domain/entities/PdfNode';

export type PdfDocument = {
  readonly id: string;
  readonly pageCount: number;
  readonly pages: readonly PdfPage[];
  readonly metadata: DocumentMetadata;
};

export function getPage(document: PdfDocument, index: number): PdfPage {
  const page = document.pages[index];
  if (page === undefined) {
    throw new PdfDomainError(
      'PAGE_OUT_OF_RANGE',
      `Page ${index} is outside 0..${document.pageCount - 1}`,
    );
  }
  return page;
}

export function findNode(document: PdfDocument, nodeId: PdfObjectId): PdfNode {
  for (const page of document.pages) {
    const match = page.nodes.find((node) => node.id === nodeId);
    if (match !== undefined) {
      return match;
    }
  }
  throw new PdfDomainError(
    'NODE_NOT_FOUND',
    `No content node exists for id ${nodeId}`,
  );
}

export function replacePage(document: PdfDocument, page: PdfPage): PdfDocument {
  return {
    ...document,
    pages: document.pages.map((candidate) =>
      candidate.index === page.index ? page : candidate,
    ),
  };
}

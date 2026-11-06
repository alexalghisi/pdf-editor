import { strFromU8, unzipSync } from 'fflate';

import { emptyMetadata } from '@/domain/entities/DocumentMetadata';
import type { PdfDocument } from '@/domain/entities/PdfDocument';
import type { PdfTextNode } from '@/domain/entities/PdfTextNode';
import { createPdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import { rect } from '@/domain/valueObjects/Rect';
import { BLACK } from '@/domain/valueObjects/RgbColor';
import { layoutDocument } from '@/application/export/documentLayout';
import {
  exportDocument,
  toCsv,
  toDocx,
  toHtml,
  toPlainText,
  withExtension,
} from '@/application/export/exporters';

let ordinal = 0;

function run(
  content: string,
  x: number,
  y: number,
  width: number,
  fontName = 'F1',
  fontSize = 12,
): PdfTextNode {
  ordinal += 1;
  return {
    id: createPdfObjectId(0, 'text', ordinal),
    type: 'text',
    pageIndex: 0,
    bounds: rect(x, y, width, fontSize),
    content,
    fontName,
    fontSize,
    color: BLACK,
  };
}

/** An invoice-like page: a bold title, a sentence split in runs, a table. */
function invoice(): PdfDocument {
  return {
    id: 'doc',
    pageCount: 1,
    metadata: { ...emptyMetadata(), author: 'Alessandro' },
    pages: [
      {
        index: 0,
        mediaBox: rect(0, 0, 612, 792),
        nodes: [
          run('Etichete', 72, 650, 45),
          run('Factură', 72, 720, 80, 'Arial-BoldMT', 20),
          run('Client: Ștefan', 72, 690, 80),
          run('Țărănescu', 155, 690, 60),
          run('Produs', 72, 670, 40),
          run('Preț, "net"', 300, 670, 50),
          run('100', 300, 650.5, 20),
        ],
      },
    ],
  };
}

describe('layoutDocument', () => {
  it('orders lines top to bottom and splits wide gaps into cells', () => {
    const [page] = layoutDocument(invoice());

    expect(
      page?.lines.map((line) => line.cells.map((cell) => cell.text)),
    ).toEqual([
      ['Factură'],
      ['Client: Ștefan Țărănescu'],
      ['Produs', 'Preț, "net"'],
      ['Etichete', '100'],
    ]);
    expect(page?.lines[0]?.bold).toBe(true);
  });
});

describe('exporters', () => {
  it('writes plain text with tabs between cells', () => {
    expect(toPlainText(invoice())).toBe(
      'Factură\nClient: Ștefan Țărănescu\nProdus\tPreț, "net"\nEtichete\t100',
    );
  });

  it('writes CSV with quoting and a UTF-8 BOM', () => {
    expect(toCsv(invoice())).toBe(
      '﻿Factură\r\nClient: Ștefan Țărănescu\r\nProdus,"Preț, ""net"""\r\nEtichete,100\r\n',
    );
  });

  it('writes HTML that places each line where the PDF has it', () => {
    const html = toHtml(invoice(), 'Invoice <1>');

    expect(html).toContain('<title>Invoice &lt;1&gt;</title>');
    expect(html).toContain('width:612pt;height:792pt');
    expect(html).toContain(
      '<span style="left:72pt;top:52pt;font-size:20pt;font-weight:bold;">Factură</span>',
    );
    expect(html).toContain('Preț, &quot;net&quot;');
  });

  it('writes a Word package with paragraphs, tabs and sizes', () => {
    const files = unzipSync(toDocx(invoice(), 'Invoice'));
    const body = strFromU8(files['word/document.xml'] ?? new Uint8Array());

    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        '_rels/.rels',
        'word/document.xml',
        'word/styles.xml',
      ]),
    );
    expect(body).toContain('<w:b/><w:sz w:val="40"/>');
    expect(body).toContain('<w:t xml:space="preserve">Factură</w:t>');
    expect(body).toContain('<w:tab/>');
    expect(strFromU8(files['docProps/core.xml'] ?? new Uint8Array())).toContain(
      '<dc:creator>Alessandro</dc:creator>',
    );
  });

  it('encodes every text format as UTF-8 bytes', () => {
    const bytes = exportDocument(invoice(), 'txt', 'x');

    expect(new TextDecoder().decode(bytes)).toContain('Țărănescu');
  });

  it('swaps the file extension', () => {
    expect(withExtension('report.pdf', 'docx')).toBe('report.docx');
    expect(withExtension('archive.tar', 'csv')).toBe('archive.csv');
    expect(withExtension('.pdf', 'txt')).toBe('document.txt');
  });
});

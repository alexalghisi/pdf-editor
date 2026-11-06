import { strToU8, zipSync } from 'fflate';

import type { PdfDocument } from '@/domain/entities/PdfDocument';
import {
  layoutDocument,
  type LayoutLine,
  type LayoutPage,
} from '@/application/export/documentLayout';

export type ExportFormat = 'pdf' | 'docx' | 'html' | 'csv' | 'txt';

export type ExportFormatInfo = {
  readonly format: ExportFormat;
  readonly label: string;
  readonly extension: string;
  readonly mimeType: string;
  /** Apple Uniform Type Identifier, for the iOS share sheet. */
  readonly uti: string;
};

export const EXPORT_FORMATS: readonly ExportFormatInfo[] = [
  {
    format: 'pdf',
    label: 'PDF document (.pdf)',
    extension: 'pdf',
    mimeType: 'application/pdf',
    uti: 'com.adobe.pdf',
  },
  {
    format: 'docx',
    label: 'Word document (.docx)',
    extension: 'docx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    uti: 'org.openxmlformats.wordprocessingml.document',
  },
  {
    format: 'html',
    label: 'Web page (.html)',
    extension: 'html',
    mimeType: 'text/html',
    uti: 'public.html',
  },
  {
    format: 'csv',
    label: 'Spreadsheet (.csv)',
    extension: 'csv',
    mimeType: 'text/csv',
    uti: 'public.comma-separated-values-text',
  },
  {
    format: 'txt',
    label: 'Plain text (.txt)',
    extension: 'txt',
    mimeType: 'text/plain',
    uti: 'public.plain-text',
  },
];

export function formatInfo(format: ExportFormat): ExportFormatInfo {
  const info = EXPORT_FORMATS.find((entry) => entry.format === format);
  if (info === undefined) {
    throw new Error(`Unknown export format ${format}`);
  }
  return info;
}

export function withExtension(fileName: string, extension: string): string {
  const base = fileName.replace(/\.[A-Za-z0-9]{1,5}$/, '');
  return `${base.length > 0 ? base : 'document'}.${extension}`;
}

function lineText(line: LayoutLine, separator: string): string {
  return line.cells.map((cell) => cell.text).join(separator);
}

export function toPlainText(document: PdfDocument): string {
  return layoutDocument(document)
    .map((page) => page.lines.map((line) => lineText(line, '\t')).join('\n'))
    .join('\n\f\n');
}

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** One row per line, one column per cell; UTF-8 BOM so Excel reads ș ț. */
export function toCsv(document: PdfDocument): string {
  const rows: string[] = [];
  for (const page of layoutDocument(document)) {
    for (const line of page.lines) {
      rows.push(line.cells.map((cell) => csvField(cell.text)).join(','));
    }
  }
  return `﻿${rows.join('\r\n')}\r\n`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function htmlPage(page: LayoutPage): string {
  const spans = page.lines.flatMap((line) =>
    line.cells.map((cell) => {
      const left = round(cell.x - page.originX);
      const top = round(page.height - (line.y - page.originY) - line.fontSize);
      const weight = line.bold ? 'font-weight:bold;' : '';
      return `<span style="left:${left}pt;top:${top}pt;font-size:${round(line.fontSize)}pt;${weight}">${escapeXml(cell.text)}</span>`;
    }),
  );
  return `<section class="page" style="width:${round(page.width)}pt;height:${round(page.height)}pt">\n${spans.join('\n')}\n</section>`;
}

/** Each page as a sheet with every line at its PDF position. */
export function toHtml(document: PdfDocument, title: string): string {
  const pages = layoutDocument(document).map(htmlPage).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeXml(title)}</title>
<style>
body{margin:0;padding:24px;background:#e5e5e5;font-family:Arial,Helvetica,sans-serif}
.page{position:relative;margin:0 auto 24px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.2);overflow:hidden}
.page span{position:absolute;white-space:pre;line-height:1.15}
@media print{body{padding:0;background:none}.page{box-shadow:none;margin:0;page-break-after:always}}
</style>
</head>
<body>
${pages}
</body>
</html>
`;
}

function docxRun(text: string, line: LayoutLine): string {
  const halfPoints = Math.max(2, Math.round(line.fontSize * 2));
  return `<w:r><w:rPr>${line.bold ? '<w:b/>' : ''}<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function docxParagraph(line: LayoutLine, page: LayoutPage): string {
  const indent = Math.max(0, Math.round((line.x - page.originX - 72) * 20));
  const runs = line.cells
    .map((cell, index) =>
      index === 0
        ? docxRun(cell.text, line)
        : `<w:r><w:tab/></w:r>${docxRun(cell.text, line)}`,
    )
    .join('');
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="60"/>${indent > 0 ? `<w:ind w:left="${indent}"/>` : ''}</w:pPr>${runs}</w:p>`;
}

/** A real Office Open XML document: one paragraph per line, tabs between cells. */
export function toDocx(document: PdfDocument, title: string): Uint8Array {
  const pages = layoutDocument(document);
  const first = pages[0];
  const width = Math.round((first?.width ?? 612) * 20);
  const height = Math.round((first?.height ?? 792) * 20);
  const body = pages
    .map((page, index) => {
      const paragraphs = page.lines.map((line) => docxParagraph(line, page));
      if (index < pages.length - 1) {
        paragraphs.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      }
      return paragraphs.join('');
    })
    .join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="${width}" w:h="${height}"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:lang w:val="ro-RO"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(title)}</dc:title><dc:creator>${escapeXml(document.metadata.author ?? 'PDF Editor')}</dc:creator></cp:coreProperties>`;
  return zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRels),
    'docProps/core.xml': strToU8(core),
    'word/document.xml': strToU8(documentXml),
    'word/styles.xml': strToU8(styles),
    'word/_rels/document.xml.rels': strToU8(documentRels),
  });
}

/** Non-PDF exports, as the bytes to write. */
export function exportDocument(
  document: PdfDocument,
  format: Exclude<ExportFormat, 'pdf'>,
  title: string,
): Uint8Array {
  switch (format) {
    case 'docx':
      return toDocx(document, title);
    case 'html':
      return strToU8(toHtml(document, title));
    case 'csv':
      return strToU8(toCsv(document));
    case 'txt':
      return strToU8(toPlainText(document));
  }
}

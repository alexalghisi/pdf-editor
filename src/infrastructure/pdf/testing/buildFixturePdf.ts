/**
 * Hand-rolled ISO 32000 fixture writer.
 * Used only by tests so the parser is exercised against real PDF bytes,
 * not objects that pdf-lib already understands.
 */

export type FixturePdfOptions = {
  readonly text?: string;
  readonly title?: string;
  readonly author?: string;
  readonly creator?: string;
  readonly producer?: string;
  readonly includeImage?: boolean;
  readonly textX?: number;
  readonly textY?: number;
  readonly fontSize?: number;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

function escapePdfLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encoder(): TextEncoder {
  return new TextEncoder();
}

export function buildFixturePdf(options: FixturePdfOptions = {}): Uint8Array {
  const text = options.text ?? 'Hello PDF';
  const title = options.title ?? 'Fixture Document';
  const author = options.author ?? 'Alghisi Alessandro Paolo';
  const creator = options.creator ?? 'PDF Editor Test Suite';
  const producer = options.producer ?? 'FixtureWriter/1.0';
  const includeImage = options.includeImage ?? false;
  const textX = options.textX ?? 72;
  const textY = options.textY ?? 720;
  const fontSize = options.fontSize ?? 12;

  const contentOps = [
    'BT',
    `/F1 ${fontSize} Tf`,
    `${textX} ${textY} Td`,
    `(${escapePdfLiteral(text)}) Tj`,
    'ET',
  ];

  if (includeImage) {
    contentOps.push('q', '80 0 0 80 200 400 cm', '/Im1 Do', 'Q');
  }

  const content = contentOps.join('\n');
  const contentBytes = encoder().encode(content);

  const imageStream = new Uint8Array([0xff]);
  const objects: string[] = [];

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  const resources = includeImage
    ? '<< /Font << /F1 5 0 R >> /XObject << /Im1 6 0 R >> >>'
    : '<< /Font << /F1 5 0 R >> >>';

  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents 4 0 R /Resources ${resources} >>\nendobj\n`,
  );

  const header = encoder().encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const bodyParts: Uint8Array[] = [];
  const offsets: number[] = [0];
  let cursor = header.length;

  const pushObject = (bytes: Uint8Array): void => {
    offsets.push(cursor);
    bodyParts.push(bytes);
    cursor += bytes.length;
  };

  pushObject(encoder().encode(objects[0] ?? ''));
  pushObject(encoder().encode(objects[1] ?? ''));
  pushObject(encoder().encode(objects[2] ?? ''));

  const contentObject = concat([
    encoder().encode(`4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`),
    contentBytes,
    encoder().encode('\nendstream\nendobj\n'),
  ]);
  pushObject(contentObject);

  pushObject(
    encoder().encode(
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    ),
  );

  if (includeImage) {
    const imageObject = concat([
      encoder().encode(
        `6 0 obj\n<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${imageStream.length} >>\nstream\n`,
      ),
      imageStream,
      encoder().encode('\nendstream\nendobj\n'),
    ]);
    pushObject(imageObject);
  }

  const infoId = includeImage ? 7 : 6;
  pushObject(
    encoder().encode(
      `${infoId} 0 obj\n<< /Title (${escapePdfLiteral(title)}) /Author (${escapePdfLiteral(author)}) /Creator (${escapePdfLiteral(creator)}) /Producer (${escapePdfLiteral(producer)}) >>\nendobj\n`,
    ),
  );

  const size = offsets.length;
  const xrefOffset = cursor;
  const xrefLines = ['xref', `0 ${size}`, '0000000000 65535 f '];
  for (let i = 1; i < offsets.length; i += 1) {
    const offset = offsets[i] ?? 0;
    xrefLines.push(`${offset.toString().padStart(10, '0')} 00000 n `);
  }

  const trailer = [
    'trailer',
    `<< /Size ${size} /Root 1 0 R /Info ${infoId} 0 R >>`,
    'startxref',
    `${xrefOffset}`,
    '%%EOF',
    '',
  ].join('\n');

  return concat([
    header,
    ...bodyParts,
    encoder().encode(`${xrefLines.join('\n')}\n`),
    encoder().encode(trailer),
  ]);
}

export const FIXTURE_PAGE_SIZE = {
  width: PAGE_WIDTH,
  height: PAGE_HEIGHT,
} as const;

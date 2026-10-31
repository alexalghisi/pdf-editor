import type { PdfToken } from '@/infrastructure/pdf/contentStream/tokens';

const PRINTABLE = /^[\x20-\x7e]*$/;
const NAME_ESCAPE = /[^\x21-\x7e]|[#()<>[\]{}/%]/g;

function escapeLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function toHex(code: number, width: number): string {
  return code.toString(16).toUpperCase().padStart(width, '0');
}

function serializeString(value: string): string {
  if (PRINTABLE.test(value)) {
    return `(${escapeLiteral(value)})`;
  }
  const hex = Array.from(value, (char) => toHex(char.charCodeAt(0), 2));
  return `<${hex.join('')}>`;
}

function serializeName(value: string): string {
  return `/${value.replace(NAME_ESCAPE, (char) => `#${toHex(char.charCodeAt(0), 2)}`)}`;
}

export function formatPdfNumber(value: number): string {
  const text = value.toString();
  return text.includes('e') ? value.toFixed(10).replace(/\.?0+$/, '') : text;
}

export function serializeToken(token: PdfToken): string {
  switch (token.kind) {
    case 'number':
      return formatPdfNumber(token.value);
    case 'name':
      return serializeName(token.value);
    case 'string':
      return serializeString(token.value);
    case 'operator':
    case 'inlineImage':
      return token.value;
    case 'array':
      return `[${token.value.map(serializeToken).join(' ')}]`;
  }
}

export function serializeTokens(tokens: readonly PdfToken[]): string {
  return tokens.map(serializeToken).join(' ');
}

export function escapePdfLiteral(value: string): string {
  return escapeLiteral(value);
}

import type { PdfToken } from '@/infrastructure/pdf/contentStream/tokens';

function escapeLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function serializeToken(token: PdfToken): string {
  switch (token.kind) {
    case 'number':
      return Number.isInteger(token.value)
        ? token.value.toString()
        : token.value.toString();
    case 'name':
      return `/${token.value}`;
    case 'string':
      return `(${escapeLiteral(token.value)})`;
    case 'operator':
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

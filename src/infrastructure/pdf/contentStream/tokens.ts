export type PdfPrimitiveToken =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'name'; readonly value: string }
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'operator'; readonly value: string };

export type PdfArrayToken = {
  readonly kind: 'array';
  readonly value: readonly PdfToken[];
};

export type PdfToken = PdfPrimitiveToken | PdfArrayToken;

export function isOperator(token: PdfToken, name: string): boolean {
  return token.kind === 'operator' && token.value === name;
}

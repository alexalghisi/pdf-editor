export function createPdfObjectUrl(bytes: Uint8Array): string | null {
  const urlApi = globalThis.URL;
  const BlobCtor = globalThis.Blob;
  if (
    urlApi === undefined ||
    BlobCtor === undefined ||
    typeof urlApi.createObjectURL !== 'function'
  ) {
    return null;
  }
  const view = new Uint8Array(bytes.byteLength);
  view.set(bytes);
  return urlApi.createObjectURL(
    new BlobCtor([view.buffer], { type: 'application/pdf' }),
  );
}

export function revokePdfObjectUrl(uri: string): void {
  if (uri.length === 0) {
    return;
  }
  const urlApi = globalThis.URL;
  if (urlApi === undefined || typeof urlApi.revokeObjectURL !== 'function') {
    return;
  }
  urlApi.revokeObjectURL(uri);
}

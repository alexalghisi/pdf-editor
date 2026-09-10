/**
 * PDF byte strings are defined as ISO Latin-1. Expo's winter TextDecoder
 * only accepts UTF-8 labels, so we decode without it.
 */
export function decodePdfBytes(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    if (byte !== undefined) {
      out += String.fromCharCode(byte);
    }
  }
  return out;
}

export function startsWithPdfHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

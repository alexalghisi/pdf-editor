import { Buffer } from 'buffer';
import {
  cacheDirectory,
  EncodingType,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

import type { FileSystemPort } from '@/application/ports/FileSystemPort';
import { PdfDomainError } from '@/domain/errors/PdfDomainError';

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

export class ExpoFileSystemAdapter implements FileSystemPort {
  async readBinary(uri: string): Promise<Uint8Array> {
    try {
      const encoded = await readAsStringAsync(uri, {
        encoding: EncodingType.Base64,
      });
      return fromBase64(encoded);
    } catch (error) {
      throw new PdfDomainError(
        'INVALID_PDF',
        error instanceof Error ? error.message : 'Unable to read file',
      );
    }
  }

  async writeBinary(uri: string, bytes: Uint8Array): Promise<void> {
    await writeAsStringAsync(uri, toBase64(bytes), {
      encoding: EncodingType.Base64,
    });
  }

  cachePath(fileName: string): string {
    const root = cacheDirectory ?? 'file:///tmp/pdf-editor/';
    return `${root}${fileName}`;
  }
}

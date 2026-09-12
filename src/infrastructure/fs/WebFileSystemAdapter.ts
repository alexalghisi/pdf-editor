import type { FileSystemPort } from '@/application/ports/FileSystemPort';
import { PdfDomainError } from '@/domain/errors/PdfDomainError';

/**
 * Browser file access. Document/image pickers hand back blob: or data: URIs,
 * which fetch() can read directly; writes are surfaced as a download so the
 * edited PDF lands in the user's Downloads folder.
 */
export class WebFileSystemAdapter implements FileSystemPort {
  async readBinary(uri: string): Promise<Uint8Array> {
    try {
      const response = await fetch(uri);
      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (error) {
      throw new PdfDomainError(
        'INVALID_PDF',
        error instanceof Error ? error.message : 'Unable to read file',
      );
    }
  }

  async writeBinary(uri: string, bytes: Uint8Array): Promise<void> {
    const view = new Uint8Array(bytes.byteLength);
    view.set(bytes);
    const blob = new Blob([view.buffer], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = uri.split('/').pop() ?? 'document.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  cachePath(fileName: string): string {
    return fileName;
  }
}

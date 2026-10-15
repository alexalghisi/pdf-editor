import type { FileSystemPort } from '@/application/ports/FileSystemPort';
import type { PageRendererPort } from '@/application/ports/PageRendererPort';
import { NativePageRenderer } from '@/infrastructure/native/NativePageRenderer';

export function createPageRenderer(
  fileSystem: FileSystemPort,
): PageRendererPort {
  return new NativePageRenderer(fileSystem);
}

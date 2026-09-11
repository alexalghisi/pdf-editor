export interface FileSystemPort {
  readBinary(uri: string): Promise<Uint8Array>;
  writeBinary(uri: string, bytes: Uint8Array): Promise<void>;
  cachePath(fileName: string): string;
}

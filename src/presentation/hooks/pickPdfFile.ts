type FileLike = {
  readonly name: string;
  readonly type: string;
};

export function pickPdfFile<T extends FileLike>(files: ArrayLike<T>): T | null {
  for (const file of Array.from(files)) {
    if (
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf')
    ) {
      return file;
    }
  }
  return null;
}

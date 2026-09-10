export type DocumentMetadata = {
  readonly title: string | null;
  readonly author: string | null;
  readonly subject: string | null;
  readonly keywords: string | null;
  readonly creator: string | null;
  readonly producer: string | null;
  readonly creationDate: Date | null;
  readonly modificationDate: Date | null;
};

export function emptyMetadata(): DocumentMetadata {
  return {
    title: null,
    author: null,
    subject: null,
    keywords: null,
    creator: null,
    producer: null,
    creationDate: null,
    modificationDate: null,
  };
}

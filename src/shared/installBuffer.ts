import { Buffer } from 'buffer';

type GlobalWithBuffer = typeof globalThis & {
  Buffer?: typeof Buffer;
};

export function installBuffer(): void {
  const target = globalThis as GlobalWithBuffer;
  if (target.Buffer === undefined) {
    target.Buffer = Buffer;
  }
}

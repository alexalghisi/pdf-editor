import { NativeModulesProxy, requireNativeModule } from 'expo-modules-core';

import type { NativePdfEngineSpec } from '../../src/infrastructure/native/NativePdfEngine';

function load(): NativePdfEngineSpec | null {
  try {
    return requireNativeModule<NativePdfEngineSpec>('PdfNativeEngine');
  } catch {
    const proxy = NativeModulesProxy as Record<string, NativePdfEngineSpec | undefined>;
    return proxy.PdfNativeEngine ?? null;
  }
}

export const PdfNativeEngine = load();

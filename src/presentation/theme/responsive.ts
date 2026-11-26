import { useWindowDimensions } from 'react-native';

import { layout } from '@/presentation/theme';

export function isCompact(width: number): boolean {
  return width < layout.compactWidth;
}

export function useCompact(): boolean {
  return isCompact(useWindowDimensions().width);
}

export function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

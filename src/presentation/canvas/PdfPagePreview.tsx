import { createElement } from 'react';
import { Platform } from 'react-native';

type Props = {
  readonly uri: string;
  readonly pageIndex: number;
  readonly width: number;
  readonly height: number;
};

export function PdfPagePreview({ uri, pageIndex, width, height }: Props) {
  if (Platform.OS !== 'web' || uri.length === 0) {
    return null;
  }
  return createElement('iframe', {
    src: `${uri}#page=${pageIndex + 1}&toolbar=0&navpanes=0&scrollbar=0&view=Fit`,
    title: 'PDF page',
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      width,
      height,
      border: 'none',
      pointerEvents: 'none',
    },
  });
}

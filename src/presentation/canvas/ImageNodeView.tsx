import { Pressable, StyleSheet, View } from 'react-native';

import type { PdfImageNode } from '@/domain/entities/PdfImageNode';
import type { Rect } from '@/domain/valueObjects/Rect';
import {
  offsetByScreenDelta,
  pdfToScreen,
} from '@/presentation/canvas/coordinates';
import { useNodeDrag } from '@/presentation/canvas/useNodeDrag';
import { colors } from '@/presentation/theme';

type Props = {
  readonly node: PdfImageNode;
  readonly mediaBox: Rect;
  readonly scale: number;
  readonly showContent: boolean;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onMove: (bounds: Rect) => Promise<void>;
};

export function ImageNodeView({
  node,
  mediaBox,
  scale,
  showContent,
  selected,
  onSelect,
  onMove,
}: Props) {
  const screen = pdfToScreen(node.bounds, mediaBox, scale);
  const { panHandlers, offset, dragging } = useNodeDrag(selected, (drop) =>
    onMove(offsetByScreenDelta(node.bounds, drop, scale)),
  );

  return (
    <View
      {...panHandlers}
      style={[
        styles.node,
        {
          left: screen.x + offset.dx,
          top: screen.y + offset.dy,
          width: screen.width,
          height: screen.height,
        },
        selected && styles.selected,
      ]}
    >
      <Pressable onPress={onSelect} style={styles.fill}>
        {showContent || dragging ? <View style={styles.placeholder} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  node: {
    position: 'absolute',
  },
  fill: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    backgroundColor: 'rgba(201, 162, 39, 0.18)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  selected: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
});

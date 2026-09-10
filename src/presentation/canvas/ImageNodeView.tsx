import { useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import type { PdfImageNode } from '@/domain/entities/PdfImageNode';
import type { Rect } from '@/domain/valueObjects/Rect';
import { pdfToScreen, screenToPdf } from '@/presentation/canvas/coordinates';
import { colors } from '@/presentation/theme';

type Props = {
  readonly node: PdfImageNode;
  readonly mediaBox: Rect;
  readonly scale: number;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onMove: (bounds: Rect) => void;
};

export function ImageNodeView({
  node,
  mediaBox,
  scale,
  selected,
  onSelect,
  onMove,
}: Props) {
  const screen = pdfToScreen(node.bounds, mediaBox, scale);
  const origin = useRef(node.bounds);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => selected,
      onMoveShouldSetPanResponder: () => selected,
      onPanResponderGrant: () => {
        origin.current = node.bounds;
      },
      onPanResponderMove: (_event, gesture) => {
        const base = pdfToScreen(origin.current, mediaBox, scale);
        onMove(
          screenToPdf(
            { ...base, x: base.x + gesture.dx, y: base.y + gesture.dy },
            mediaBox,
            scale,
          ),
        );
      },
    }),
  ).current;

  return (
    <View
      {...pan.panHandlers}
      style={[
        styles.node,
        {
          left: screen.x,
          top: screen.y,
          width: screen.width,
          height: screen.height,
        },
        selected && styles.selected,
      ]}
    >
      <Pressable onPress={onSelect} style={styles.fill}>
        <View style={styles.placeholder} />
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

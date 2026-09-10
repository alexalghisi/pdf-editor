import { useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { PdfTextNode } from '@/domain/entities/PdfTextNode';
import type { Rect } from '@/domain/valueObjects/Rect';
import { pdfToScreen, screenToPdf } from '@/presentation/canvas/coordinates';
import { colors } from '@/presentation/theme';

type Props = {
  readonly node: PdfTextNode;
  readonly mediaBox: Rect;
  readonly scale: number;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onMove: (bounds: Rect) => void;
  readonly onCommitText: (content: string) => void;
};

export function TextNodeView({
  node,
  mediaBox,
  scale,
  selected,
  onSelect,
  onMove,
  onCommitText,
}: Props) {
  const screen = pdfToScreen(node.bounds, mediaBox, scale);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.content);
  const origin = useRef(node.bounds);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => selected && !editing,
      onMoveShouldSetPanResponder: () => selected && !editing,
      onPanResponderGrant: () => {
        origin.current = node.bounds;
      },
      onPanResponderMove: (_event, gesture) => {
        const nextScreen = {
          ...pdfToScreen(origin.current, mediaBox, scale),
          x: pdfToScreen(origin.current, mediaBox, scale).x + gesture.dx,
          y: pdfToScreen(origin.current, mediaBox, scale).y + gesture.dy,
        };
        onMove(screenToPdf(nextScreen, mediaBox, scale));
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
          minWidth: screen.width,
          minHeight: screen.height,
        },
        selected && styles.selected,
      ]}
    >
      {editing ? (
        <TextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onBlur={() => {
            setEditing(false);
            if (draft.trim().length > 0 && draft !== node.content) {
              onCommitText(draft);
            }
          }}
          style={[styles.input, { fontSize: node.fontSize * scale }]}
        />
      ) : (
        <Pressable
          onPress={onSelect}
          onLongPress={() => {
            onSelect();
            setDraft(node.content);
            setEditing(true);
          }}
        >
          <Text
            style={{
              color: `rgb(${Math.round(node.color.r * 255)}, ${Math.round(node.color.g * 255)}, ${Math.round(node.color.b * 255)})`,
              fontSize: node.fontSize * scale,
            }}
          >
            {node.content}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  node: {
    position: 'absolute',
    paddingHorizontal: 2,
  },
  selected: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'rgba(201, 162, 39, 0.08)',
  },
  input: {
    color: colors.textInverse,
    padding: 0,
    margin: 0,
  },
});

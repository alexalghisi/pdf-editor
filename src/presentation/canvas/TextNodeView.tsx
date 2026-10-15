import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { PdfTextNode } from '@/domain/entities/PdfTextNode';
import type { Rect } from '@/domain/valueObjects/Rect';
import {
  offsetByScreenDelta,
  pdfToScreen,
} from '@/presentation/canvas/coordinates';
import { useNodeDrag } from '@/presentation/canvas/useNodeDrag';
import { colors } from '@/presentation/theme';

type Props = {
  readonly node: PdfTextNode;
  readonly mediaBox: Rect;
  readonly scale: number;
  readonly showContent: boolean;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onMove: (bounds: Rect) => Promise<void>;
  readonly onCommitText: (content: string) => void;
};

export function TextNodeView({
  node,
  mediaBox,
  scale,
  showContent,
  selected,
  onSelect,
  onMove,
  onCommitText,
}: Props) {
  const screen = pdfToScreen(node.bounds, mediaBox, scale);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.content);
  const { panHandlers, offset, dragging, resetDrop, wasDropped } = useNodeDrag(
    selected && !editing,
    (drop) => onMove(offsetByScreenDelta(node.bounds, drop, scale)),
  );

  const startEditing = (): void => {
    onSelect();
    setDraft(node.content);
    setEditing(true);
  };

  return (
    <View
      {...panHandlers}
      style={[
        styles.node,
        {
          left: screen.x + offset.dx,
          top: screen.y + offset.dy,
          minWidth: screen.width,
          minHeight: screen.height,
        },
        selected && styles.selected,
        editing && styles.editing,
      ]}
    >
      {editing ? (
        <TextInput
          autoFocus
          selectTextOnFocus
          accessibilityLabel="Edit text"
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
          onPressIn={resetDrop}
          onPress={() => {
            if (wasDropped()) {
              return;
            }
            if (selected) {
              startEditing();
            } else {
              onSelect();
            }
          }}
          onLongPress={startEditing}
        >
          <Text
            style={{
              color:
                showContent || dragging
                  ? `rgb(${Math.round(node.color.r * 255)}, ${Math.round(node.color.g * 255)}, ${Math.round(node.color.b * 255)})`
                  : 'transparent',
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
  editing: {
    backgroundColor: colors.paper,
  },
  input: {
    color: colors.textInverse,
    padding: 0,
    margin: 0,
  },
});

import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextStyle,
  type TextInputKeyPressEventData,
} from 'react-native';

import type { PdfTextNode } from '@/domain/entities/PdfTextNode';
import type { Rect } from '@/domain/valueObjects/Rect';
import {
  offsetByScreenDelta,
  pdfToScreen,
} from '@/presentation/canvas/coordinates';
import { useNodeDrag } from '@/presentation/canvas/useNodeDrag';
import { colors } from '@/presentation/theme';

/** Close to the sans faces PDFs use, so the edit box looks like the page. */
const EDIT_FONT = Platform.select({
  ios: 'Helvetica',
  android: 'sans-serif',
  default: 'Arial, Helvetica, "Liberation Sans", sans-serif',
});

/**
 * Width of the edit box for a draft: the run's own width scaled by how much
 * longer the draft is, plus room for the caret, so text never scrolls out of
 * view while typing.
 */
export function editorWidth(
  runWidth: number,
  original: string,
  draft: string,
  fontSize: number,
): number {
  const perChar =
    original.length > 0 ? runWidth / original.length : fontSize * 0.55;
  return Math.max(runWidth, perChar * draft.length) + fontSize;
}

function cssColor(color: PdfTextNode['color']): string {
  return `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
}

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

  const finishEditing = (commit: boolean): void => {
    if (!editing) {
      return;
    }
    setEditing(false);
    if (commit && draft.trim().length > 0 && draft !== node.content) {
      onCommitText(draft);
    }
  };

  const onKeyPress = (
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ): void => {
    if (event.nativeEvent.key === 'Escape') {
      setDraft(node.content);
      finishEditing(false);
    }
  };

  const fontSize = node.fontSize * scale;

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
          onKeyPress={onKeyPress}
          onSubmitEditing={() => finishEditing(true)}
          onBlur={() => finishEditing(true)}
          returnKeyType="done"
          blurOnSubmit
          style={[
            styles.input,
            {
              fontSize,
              lineHeight: fontSize * 1.2,
              color: cssColor(node.color),
              width: editorWidth(screen.width, node.content, draft, fontSize),
            },
          ]}
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
                showContent || dragging ? cssColor(node.color) : 'transparent',
              fontSize,
              fontFamily: EDIT_FONT,
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
    // Covers the rendered glyphs while typing; PDF pages are white.
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  input: {
    fontFamily: EDIT_FONT,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    // react-native-web passes outlineStyle through; the native types omit
    // 'none'. Without it browsers draw their focus ring over the page.
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none' } as unknown as TextStyle)
      : {}),
  },
});

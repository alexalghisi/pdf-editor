import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';

import type { PdfPage } from '@/domain/entities/PdfPage';
import { fitScale } from '@/presentation/canvas/coordinates';
import { ImageNodeView } from '@/presentation/canvas/ImageNodeView';
import { TextNodeView } from '@/presentation/canvas/TextNodeView';
import { useEditorStore } from '@/presentation/store/editorStore';
import { colors, spacing } from '@/presentation/theme';
import type { PdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import type { Rect } from '@/domain/valueObjects/Rect';

type Props = {
  readonly page: PdfPage;
  readonly rasterUri: string;
};

export function PdfCanvas({ page, rasterUri }: Props) {
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const pinchOrigin = useRef(1);
  const zoom = useEditorStore((state) => state.zoom);
  const rendering = useEditorStore((state) => state.rendering);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectNode = useEditorStore((state) => state.selectNode);
  const moveNode = useEditorStore((state) => state.moveNode);
  const updateText = useEditorStore((state) => state.updateText);
  const setZoom = useEditorStore((state) => state.setZoom);

  const scale = fitScale(page.mediaBox, stage, spacing.lg) * zoom;
  const pageWidth = page.mediaBox.width * scale;
  const pageHeight = page.mediaBox.height * scale;
  const showContent = rasterUri.length === 0 && !rendering;

  const onMove = (nodeId: PdfObjectId, bounds: Rect): Promise<void> =>
    moveNode(nodeId, bounds);

  return (
    <PinchGestureHandler
      onHandlerStateChange={(event) => {
        if (event.nativeEvent.state === State.BEGAN) {
          pinchOrigin.current = zoom;
        }
      }}
      onGestureEvent={(event) => {
        setZoom(pinchOrigin.current * event.nativeEvent.scale);
      }}
    >
      <View
        style={styles.stage}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setStage({ width, height });
        }}
      >
        <ScrollView contentContainerStyle={styles.scrollFill}>
          <ScrollView horizontal contentContainerStyle={styles.scrollContent}>
            {scale > 0 ? (
              <Pressable onPress={() => selectNode(null)}>
                <View
                  style={[
                    styles.paper,
                    { width: pageWidth, height: pageHeight },
                  ]}
                >
                  {rasterUri.length > 0 ? (
                    <Image
                      source={{ uri: rasterUri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="stretch"
                    />
                  ) : null}
                  {page.nodes.map((node) =>
                    node.type === 'text' ? (
                      <TextNodeView
                        key={node.id}
                        node={node}
                        mediaBox={page.mediaBox}
                        scale={scale}
                        showContent={showContent}
                        selected={selectedNodeId === node.id}
                        onSelect={() => selectNode(node.id)}
                        onMove={(bounds) => onMove(node.id, bounds)}
                        onCommitText={(content) => {
                          void updateText(node.id, content);
                        }}
                      />
                    ) : (
                      <ImageNodeView
                        key={node.id}
                        node={node}
                        mediaBox={page.mediaBox}
                        scale={scale}
                        showContent={showContent}
                        selected={selectedNodeId === node.id}
                        onSelect={() => selectNode(node.id)}
                        onMove={(bounds) => onMove(node.id, bounds)}
                      />
                    ),
                  )}
                </View>
              </Pressable>
            ) : null}
          </ScrollView>
        </ScrollView>
        {rendering ? (
          <ActivityIndicator
            accessibilityLabel="Rendering page"
            color={colors.accent}
            style={styles.spinner}
          />
        ) : null}
      </View>
    </PinchGestureHandler>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
  },
  scrollFill: {
    flexGrow: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  spinner: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.xl,
  },
  paper: {
    backgroundColor: colors.paper,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});

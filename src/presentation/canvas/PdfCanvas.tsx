import {
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { PinchGestureHandler } from 'react-native-gesture-handler';

import type { PdfPage } from '@/domain/entities/PdfPage';
import { ImageNodeView } from '@/presentation/canvas/ImageNodeView';
import { TextNodeView } from '@/presentation/canvas/TextNodeView';
import { useEditorStore } from '@/presentation/store/editorStore';
import { colors } from '@/presentation/theme';
import type { PdfObjectId } from '@/domain/valueObjects/PdfObjectId';
import type { Rect } from '@/domain/valueObjects/Rect';

type Props = {
  readonly page: PdfPage;
  readonly rasterUri: string;
};

export function PdfCanvas({ page, rasterUri }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const zoom = useEditorStore((state) => state.zoom);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectNode = useEditorStore((state) => state.selectNode);
  const moveNode = useEditorStore((state) => state.moveNode);
  const updateText = useEditorStore((state) => state.updateText);
  const setZoom = useEditorStore((state) => state.setZoom);

  const fitScale = (windowWidth - 32) / page.mediaBox.width;
  const scale = fitScale * zoom;
  const pageWidth = page.mediaBox.width * scale;
  const pageHeight = page.mediaBox.height * scale;

  const onMove = (nodeId: PdfObjectId, bounds: Rect): void => {
    void moveNode(nodeId, bounds);
  };

  return (
    <PinchGestureHandler
      onGestureEvent={(event) => {
        setZoom(event.nativeEvent.scale);
      }}
    >
      <View style={styles.stage}>
        <Pressable onPress={() => selectNode(null)}>
          <View
            style={[styles.paper, { width: pageWidth, height: pageHeight }]}
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
                  selected={selectedNodeId === node.id}
                  onSelect={() => selectNode(node.id)}
                  onMove={(bounds) => onMove(node.id, bounds)}
                />
              ),
            )}
          </View>
        </Pressable>
      </View>
    </PinchGestureHandler>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
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

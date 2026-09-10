import { Buffer } from 'buffer';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPage } from '@/domain/entities/PdfDocument';
import { PdfCanvas } from '@/presentation/canvas/PdfCanvas';
import { ToolbarButton } from '@/presentation/components/ToolbarButton';
import { useEditorStore } from '@/presentation/store/editorStore';
import { colors, spacing, typography } from '@/presentation/theme';

export function EditorScreen() {
  const navigation = useNavigation();
  const document = useEditorStore((state) => state.document);
  const fileName = useEditorStore((state) => state.fileName);
  const currentPageIndex = useEditorStore((state) => state.currentPageIndex);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const status = useEditorStore((state) => state.status);
  const rasterUri = useEditorStore((state) => state.rasterUri);
  const addText = useEditorStore((state) => state.addText);
  const addImage = useEditorStore((state) => state.addImage);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const save = useEditorStore((state) => state.save);
  const setPage = useEditorStore((state) => state.setPage);
  const setZoom = useEditorStore((state) => state.setZoom);
  const zoom = useEditorStore((state) => state.zoom);

  if (document === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.meta}>No document loaded.</Text>
        <ToolbarButton label="Back" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const page = getPage(document, currentPageIndex);

  const insertImage = async (): Promise<void> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos', 'Photo library access is required to insert an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 1,
    });
    if (result.canceled || result.assets[0] === undefined) {
      return;
    }
    const asset = result.assets[0];
    if (asset.base64 === undefined || asset.base64 === null) {
      Alert.alert('Image', 'The selected image could not be read.');
      return;
    }
    const bytes = new Uint8Array(Buffer.from(asset.base64, 'base64'));
    const mimeType = asset.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    await addImage(bytes, mimeType);
  };

  const exportPdf = async (): Promise<void> => {
    const uri = await save();
    if (uri === null) {
      return;
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    } else {
      Alert.alert('Saved', `Wrote ${uri}`);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <ToolbarButton label="Close" onPress={() => navigation.goBack()} />
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={styles.title}>
            {fileName}
          </Text>
          <Text style={styles.meta}>
            Page {currentPageIndex + 1} / {document.pageCount} · {status}
          </Text>
        </View>
        <ToolbarButton
          label="Save"
          onPress={() => {
            void exportPdf();
          }}
        />
      </View>

      <PdfCanvas page={page} rasterUri={rasterUri} />

      <View style={styles.bottomBar}>
        <ToolbarButton
          label="Text"
          onPress={() => {
            void addText('New text');
          }}
        />
        <ToolbarButton
          label="Image"
          onPress={() => {
            void insertImage();
          }}
        />
        <ToolbarButton
          label="Delete"
          danger
          disabled={selectedNodeId === null}
          onPress={() => {
            void deleteSelected();
          }}
        />
        <ToolbarButton
          label="−"
          onPress={() => setZoom(zoom - 0.2)}
        />
        <ToolbarButton
          label="+"
          onPress={() => setZoom(zoom + 0.2)}
        />
        <ToolbarButton
          label="Prev"
          disabled={currentPageIndex === 0}
          onPress={() => setPage(currentPageIndex - 1)}
        />
        <ToolbarButton
          label="Next"
          disabled={currentPageIndex >= document.pageCount - 1}
          onPress={() => setPage(currentPageIndex + 1)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  bottomBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});

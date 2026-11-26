import { Buffer } from 'buffer';
import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatInfo, type ExportFormat } from '@/application/export/exporters';
import { getPage } from '@/domain/entities/PdfDocument';
import { PdfCanvas } from '@/presentation/canvas/PdfCanvas';
import { SaveAsSheet } from '@/presentation/components/SaveAsSheet';
import { ToolbarButton } from '@/presentation/components/ToolbarButton';
import { useEditorStore } from '@/presentation/store/editorStore';
import {
  colors,
  elevation,
  radius,
  spacing,
  typography,
} from '@/presentation/theme';
import { formatZoom, useCompact } from '@/presentation/theme/responsive';

export function EditorScreen() {
  const navigation = useNavigation();
  const document = useEditorStore((state) => state.document);
  const fileName = useEditorStore((state) => state.fileName);
  const currentPageIndex = useEditorStore((state) => state.currentPageIndex);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const status = useEditorStore((state) => state.status);
  const errorMessage = useEditorStore((state) => state.errorMessage);
  const rasterUri = useEditorStore((state) => state.rasterUri);
  const addText = useEditorStore((state) => state.addText);
  const addImage = useEditorStore((state) => state.addImage);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const saveAs = useEditorStore((state) => state.saveAs);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const compact = useCompact();
  const setPage = useEditorStore((state) => state.setPage);
  const setZoom = useEditorStore((state) => state.setZoom);
  const zoom = useEditorStore((state) => state.zoom);
  const renderCurrentPage = useEditorStore((state) => state.renderCurrentPage);

  useEffect(() => {
    void renderCurrentPage();
  }, [document, currentPageIndex, renderCurrentPage]);

  if (document === null) {
    return (
      <SafeAreaView style={[styles.safe, styles.empty]}>
        <Feather name="file" size={32} color={colors.textSecondary} />
        <Text style={styles.emptyTitle}>No document is open</Text>
        <ToolbarButton
          label="Back to start"
          icon="arrow-left"
          onPress={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  const page = getPage(document, currentPageIndex);

  const insertImage = async (): Promise<void> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photos',
        'Photo library access is required to insert an image.',
      );
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
    const mimeType =
      asset.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    await addImage(bytes, mimeType);
  };

  const exportAs = async (format: ExportFormat): Promise<void> => {
    setSaveMenuOpen(false);
    const uri = await saveAs(format);
    if (uri === null || Platform.OS === 'web') {
      return;
    }
    const info = formatInfo(format);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: info.mimeType,
        UTI: info.uti,
        dialogTitle: 'Save as',
      });
    } else {
      Alert.alert('Saved', `Wrote ${uri}`);
    }
  };

  const pageLabel = `Page ${currentPageIndex + 1} of ${document.pageCount}`;
  const activity =
    status === 'saving'
      ? ' · Saving…'
      : status === 'loading'
        ? ' · Loading…'
        : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <ToolbarButton
          label="Close"
          icon="arrow-left"
          iconOnly
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={styles.title}>
            {fileName}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {pageLabel}
            {activity}
          </Text>
        </View>
        <ToolbarButton
          label="Save as…"
          icon="download"
          iconOnly={compact}
          variant="primary"
          onPress={() => setSaveMenuOpen(true)}
        />
      </View>

      {errorMessage !== null ? (
        <View accessible accessibilityRole="alert" style={styles.error}>
          <Feather name="alert-circle" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.stage}>
        <PdfCanvas page={page} rasterUri={rasterUri} />
        {document.pageCount > 1 ? (
          <View style={styles.pager}>
            <ToolbarButton
              label="Previous page"
              icon="chevron-left"
              iconOnly
              variant="ghost"
              disabled={currentPageIndex === 0}
              onPress={() => setPage(currentPageIndex - 1)}
            />
            <Text style={styles.pagerLabel}>
              {currentPageIndex + 1} / {document.pageCount}
            </Text>
            <ToolbarButton
              label="Next page"
              icon="chevron-right"
              iconOnly
              variant="ghost"
              disabled={currentPageIndex >= document.pageCount - 1}
              onPress={() => setPage(currentPageIndex + 1)}
            />
          </View>
        ) : null}
      </View>

      <SaveAsSheet
        visible={saveMenuOpen}
        onClose={() => setSaveMenuOpen(false)}
        onPick={(format) => {
          void exportAs(format);
        }}
      />

      <View style={styles.bottomBar}>
        <View style={styles.group}>
          <ToolbarButton
            label="Add text"
            text="Text"
            icon="type"
            iconOnly={compact}
            onPress={() => {
              void addText('New text');
            }}
          />
          <ToolbarButton
            label="Add image"
            text="Image"
            icon="image"
            iconOnly={compact}
            onPress={() => {
              void insertImage();
            }}
          />
          <ToolbarButton
            label="Delete"
            icon="trash-2"
            iconOnly={compact}
            variant="danger"
            disabled={selectedNodeId === null}
            onPress={() => {
              void deleteSelected();
            }}
          />
        </View>
        <View style={styles.group}>
          <ToolbarButton
            label="Zoom out"
            icon="minus"
            iconOnly
            variant="ghost"
            disabled={zoom <= MIN_ZOOM}
            onPress={() => setZoom(zoom - ZOOM_STEP)}
          />
          <ToolbarButton
            label="Reset zoom"
            text={formatZoom(zoom)}
            variant="ghost"
            onPress={() => setZoom(1)}
          />
          <ToolbarButton
            label="Zoom in"
            icon="plus"
            iconOnly
            variant="ghost"
            disabled={zoom >= MAX_ZOOM}
            onPress={() => setZoom(zoom + ZOOM_STEP)}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.dangerSoft,
  },
  errorText: {
    ...typography.caption,
    flex: 1,
    color: colors.danger,
  },
  stage: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  pager: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...elevation,
  },
  pagerLabel: {
    ...typography.label,
    color: colors.textPrimary,
    minWidth: 52,
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: spacing.xl,
    rowGap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});

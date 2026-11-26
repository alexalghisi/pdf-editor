import Feather from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ToolbarButton,
  type IconName,
} from '@/presentation/components/ToolbarButton';
import { useFileDrop } from '@/presentation/hooks/useFileDrop';
import type { RootStackParamList } from '@/presentation/navigation/types';
import { useEditorStore } from '@/presentation/store/editorStore';
import {
  colors,
  layout,
  radius,
  spacing,
  typography,
} from '@/presentation/theme';
import { useCompact } from '@/presentation/theme/responsive';

const features: readonly { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'edit-3',
    title: 'Edit the real text',
    text: 'Click a line, type, press Enter. The page itself is rewritten.',
  },
  {
    icon: 'lock',
    title: 'Private by design',
    text: 'Your file is processed on this device and never uploaded.',
  },
  {
    icon: 'download',
    title: 'Save in five formats',
    text: 'PDF, Word, web page, spreadsheet or plain text.',
  },
];

export function HomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const openFromUri = useEditorStore((state) => state.openFromUri);
  const createBlank = useEditorStore((state) => state.createBlank);
  const status = useEditorStore((state) => state.status);
  const errorMessage = useEditorStore((state) => state.errorMessage);
  const compact = useCompact();
  const loading = status === 'loading';

  const enterEditor = useCallback((): void => {
    if (useEditorStore.getState().status !== 'error') {
      navigation.navigate('Editor');
    }
  }, [navigation]);

  const openDocument = useCallback(
    async (uri: string, fileName: string): Promise<void> => {
      await openFromUri(uri, fileName);
      enterEditor();
    },
    [openFromUri, enterEditor],
  );

  const dragging = useFileDrop((uri, fileName) => {
    void openDocument(uri, fileName);
  });

  const openPicker = async (): Promise<void> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets[0] === undefined) {
      return;
    }
    const asset = result.assets[0];
    await openDocument(asset.uri, asset.name ?? 'Document.pdf');
  };

  const startBlank = async (): Promise<void> => {
    await createBlank();
    enterEditor();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.scroll, compact && styles.scrollCompact]}
      >
        <View style={styles.content}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Feather name="file-text" size={22} color={colors.textInverse} />
            </View>
            <Text style={styles.brandName}>PDF Editor</Text>
          </View>

          <Text
            accessibilityRole="header"
            style={[styles.title, compact && styles.titleCompact]}
          >
            Edit any PDF like a normal document.
          </Text>
          <Text style={styles.subtitle}>
            Change the words on the page, add text and images, then save the
            result in the format you need.
          </Text>

          <View
            testID="drop-zone"
            style={[styles.dropZone, dragging && styles.dropZoneActive]}
          >
            <View style={styles.dropIcon}>
              <Feather name="upload-cloud" size={26} color={colors.accent} />
            </View>
            <Text style={styles.dropTitle}>
              {dragging ? 'Drop it to start editing' : 'Choose a file to begin'}
            </Text>
            {Platform.OS === 'web' && !compact ? (
              <Text style={styles.dropHint}>
                or drag a file anywhere onto this page
              </Text>
            ) : null}
            <View style={styles.actions}>
              <ToolbarButton
                label="Open PDF"
                text={loading ? 'Opening…' : 'Open PDF'}
                icon="folder"
                variant="primary"
                disabled={loading}
                onPress={() => {
                  void openPicker();
                }}
              />
              <ToolbarButton
                label="Start with a blank page"
                icon="plus"
                disabled={loading}
                onPress={() => {
                  void startBlank();
                }}
              />
            </View>
            {errorMessage !== null ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {errorMessage}
              </Text>
            ) : null}
          </View>

          <View style={styles.features}>
            {features.map((feature) => (
              <View key={feature.title} style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Feather
                    name={feature.icon}
                    size={16}
                    color={colors.textPrimary}
                  />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureBody}>{feature.text}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.footer}>
            Built by Alghisi Alessandro Paolo · alexalghisi@gmail.com
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  scrollCompact: {
    padding: spacing.lg,
    justifyContent: 'flex-start',
  },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  brandName: {
    ...typography.title,
    color: colors.textPrimary,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  titleCompact: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  dropZone: {
    alignItems: 'center',
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  dropZoneActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  dropIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  dropTitle: {
    ...typography.title,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  dropHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  features: {
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  feature: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  featureBody: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  footer: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
});

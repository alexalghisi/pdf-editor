import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/presentation/navigation/types';
import { useEditorStore } from '@/presentation/store/editorStore';
import { colors, radius, spacing, typography } from '@/presentation/theme';

export function HomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const openFromUri = useEditorStore((state) => state.openFromUri);
  const createBlank = useEditorStore((state) => state.createBlank);
  const status = useEditorStore((state) => state.status);
  const errorMessage = useEditorStore((state) => state.errorMessage);

  const openPicker = async (): Promise<void> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets[0] === undefined) {
      return;
    }
    const asset = result.assets[0];
    await openFromUri(asset.uri, asset.name ?? 'Document.pdf');
    navigation.navigate('Editor');
  };

  const startBlank = async (): Promise<void> => {
    await createBlank();
    navigation.navigate('Editor');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>STRUCTURAL PDF WORKSPACE</Text>
        <Text style={styles.title}>PDF Editor</Text>
        <Text style={styles.subtitle}>
          Load a document, rewrite its content stream, and export a lossless
          PDF. Text and images are first-class AST nodes — not flattened
          annotations.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void openPicker();
          }}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryLabel}>
            {status === 'loading' ? 'Opening…' : 'Open PDF'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void startBlank();
          }}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryLabel}>Create blank letter page</Text>
        </Pressable>
        {errorMessage !== null ? (
          <Text style={styles.error}>{errorMessage}</Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Author Alghisi Alessandro Paolo</Text>
        <Text style={styles.footerText}>alexalghisi@gmail.com</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  hero: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  kicker: {
    ...typography.caption,
    color: colors.accent,
    letterSpacing: 1.6,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.md,
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  secondary: {
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  primaryLabel: {
    ...typography.heading,
    color: colors.textInverse,
  },
  secondaryLabel: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  pressed: {
    opacity: 0.85,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  footer: {
    gap: 2,
  },
  footerText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

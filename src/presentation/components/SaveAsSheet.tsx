import Feather from '@expo/vector-icons/Feather';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  EXPORT_FORMATS,
  type ExportFormat,
} from '@/application/export/exporters';
import type { IconName } from '@/presentation/components/ToolbarButton';
import {
  colors,
  elevation,
  layout,
  radius,
  spacing,
  typography,
} from '@/presentation/theme';
import { useCompact } from '@/presentation/theme/responsive';

type Props = {
  readonly visible: boolean;
  readonly onPick: (format: ExportFormat) => void;
  readonly onClose: () => void;
};

type InteractionState = {
  readonly pressed: boolean;
  readonly hovered?: boolean;
};

const details: Record<ExportFormat, { icon: IconName; hint: string }> = {
  pdf: { icon: 'file-text', hint: 'Keeps the exact layout' },
  docx: { icon: 'edit-3', hint: 'Editable in Word and Google Docs' },
  html: { icon: 'globe', hint: 'Opens in any browser' },
  csv: { icon: 'grid', hint: 'Tables for Excel and Sheets' },
  txt: { icon: 'align-left', hint: 'Just the words' },
  png: { icon: 'image', hint: 'This page as a sharp picture' },
  jpg: { icon: 'camera', hint: 'This page as a small photo file' },
};

export function SaveAsSheet({ visible, onPick, onClose }: Props) {
  const compact = useCompact();
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel="Close save menu"
        style={[styles.backdrop, compact && styles.backdropCompact]}
        onPress={onClose}
      >
        <Pressable
          accessibilityRole="none"
          style={[styles.sheet, compact && styles.sheetCompact]}
          onPress={() => undefined}
        >
          <Text accessibilityRole="header" style={styles.title}>
            Save as
          </Text>
          <Text style={styles.subtitle}>Choose a format to download.</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.rows}>
            {EXPORT_FORMATS.map((entry) => (
              <Pressable
                key={entry.format}
                accessibilityRole="button"
                accessibilityLabel={`Save as ${entry.label}`}
                onPress={() => onPick(entry.format)}
                style={(state) => [
                  styles.row,
                  (state as InteractionState).hovered === true &&
                    styles.rowHover,
                  state.pressed && styles.pressed,
                ]}
              >
                <View style={styles.rowIcon}>
                  <Feather
                    name={details[entry.format].icon}
                    size={18}
                    color={colors.accent}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.label}>{entry.label}</Text>
                  <Text style={styles.hint}>{details[entry.format].hint}</Text>
                </View>
                <Feather
                  name="download"
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onClose}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  backdropCompact: {
    justifyContent: 'flex-end',
    padding: 0,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...elevation,
  },
  sheetCompact: {
    maxWidth: '100%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  scroll: {
    flexShrink: 1,
  },
  rows: {
    gap: spacing.sm,
  },
  row: {
    minHeight: layout.touchTarget + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  rowHover: {
    backgroundColor: colors.surfaceHover,
    borderColor: colors.borderStrong,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  rowText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  cancel: {
    minHeight: layout.touchTarget,
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  cancelLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
});

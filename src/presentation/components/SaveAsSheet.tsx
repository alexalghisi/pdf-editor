import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  EXPORT_FORMATS,
  type ExportFormat,
} from '@/application/export/exporters';
import { colors, radius, spacing, typography } from '@/presentation/theme';

type Props = {
  readonly visible: boolean;
  readonly onPick: (format: ExportFormat) => void;
  readonly onClose: () => void;
};

/** The "Save as" menu: one row per export format. */
export function SaveAsSheet({ visible, onPick, onClose }: Props) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel="Close save menu"
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>Save as</Text>
          {EXPORT_FORMATS.map((entry) => (
            <Pressable
              key={entry.format}
              accessibilityRole="button"
              accessibilityLabel={`Save as ${entry.label}`}
              onPress={() => onPick(entry.format)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.label}>{entry.label}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
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
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  row: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
  },
  cancel: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelLabel: {
    ...typography.heading,
    color: colors.accent,
  },
});

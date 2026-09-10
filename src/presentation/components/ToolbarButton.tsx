import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '@/presentation/theme';

type Props = {
  readonly label: string;
  readonly onPress: () => void;
  readonly danger?: boolean;
  readonly disabled?: boolean;
};

export function ToolbarButton({ label, onPress, danger = false, disabled = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        danger ? styles.danger : styles.neutral,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, danger && styles.dangerLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  neutral: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: '#2A1515',
    borderColor: colors.danger,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  dangerLabel: {
    color: colors.danger,
  },
});

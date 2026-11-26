import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import {
  colors,
  layout,
  radius,
  spacing,
  typography,
} from '@/presentation/theme';

export type IconName = ComponentProps<typeof Feather>['name'];

type Variant = 'neutral' | 'primary' | 'danger' | 'ghost';

type Props = {
  readonly label: string;
  readonly onPress: () => void;
  readonly icon?: IconName;
  readonly iconOnly?: boolean;
  readonly text?: string;
  readonly variant?: Variant;
  readonly disabled?: boolean;
};

type InteractionState = {
  readonly pressed: boolean;
  readonly hovered?: boolean;
};

const foreground: Record<Variant, string> = {
  neutral: colors.textPrimary,
  primary: colors.textInverse,
  danger: colors.danger,
  ghost: colors.textPrimary,
};

export function ToolbarButton({
  label,
  onPress,
  icon,
  iconOnly = false,
  text,
  variant = 'neutral',
  disabled = false,
}: Props) {
  const showText = !iconOnly || icon === undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={(state) => [
        styles.button,
        styles[variant],
        (state as InteractionState).hovered === true &&
          !disabled &&
          hoverStyles[variant],
        state.pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {icon !== undefined ? (
        <Feather name={icon} size={18} color={foreground[variant]} />
      ) : null}
      {showText ? (
        <Text
          numberOfLines={1}
          style={[styles.label, { color: foreground[variant] }]}
        >
          {text ?? label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: layout.touchTarget,
    minWidth: layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  neutral: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: 'transparent',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.35,
  },
  label: {
    ...typography.label,
  },
});

const hoverStyles = StyleSheet.create({
  neutral: {
    backgroundColor: colors.surfaceHover,
    borderColor: colors.borderStrong,
  },
  primary: {
    backgroundColor: colors.accentHover,
    borderColor: colors.accentHover,
  },
  danger: {
    borderColor: colors.danger,
  },
  ghost: {
    backgroundColor: colors.surfaceRaised,
  },
});

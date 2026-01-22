import React, { ReactNode } from "react";
import { Pressable, Text, StyleSheet, ViewStyle, StyleProp, View } from "react-native";
import { TerminalColors, TerminalSpacing, TerminalRadius, TerminalTypography } from "./theme";

interface TerminalButtonProps {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "buy" | "sell" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
}

export function TerminalButton({
  children,
  onPress,
  disabled = false,
  variant = "primary",
  size = "md",
  fullWidth = false,
  style,
  icon,
}: TerminalButtonProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[
          styles.text,
          variant === "ghost" && styles.textGhost,
          variant === "secondary" && styles.textSecondary,
          size === "sm" && styles.textSm,
          size === "lg" && styles.textLg,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: TerminalRadius.sm,
    gap: TerminalSpacing.xs,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.4,
  },
  fullWidth: {
    width: "100%",
  },
  icon: {
    marginRight: TerminalSpacing.xs,
  },

  primary: {
    backgroundColor: TerminalColors.accent,
  },
  secondary: {
    backgroundColor: TerminalColors.bgElevated,
    borderWidth: 1,
    borderColor: TerminalColors.border,
  },
  buy: {
    backgroundColor: TerminalColors.positive,
  },
  sell: {
    backgroundColor: TerminalColors.negative,
  },
  ghost: {
    backgroundColor: "transparent",
  },

  sm: {
    height: 28,
    paddingHorizontal: TerminalSpacing.md,
  },
  md: {
    height: 36,
    paddingHorizontal: TerminalSpacing.lg,
  },
  lg: {
    height: 44,
    paddingHorizontal: TerminalSpacing.xl,
  },

  text: {
    ...TerminalTypography.button,
    color: TerminalColors.textPrimary,
  },
  textGhost: {
    color: TerminalColors.textSecondary,
  },
  textSecondary: {
    color: TerminalColors.textPrimary,
  },
  textSm: {
    fontSize: 10,
  },
  textLg: {
    fontSize: 13,
  },
});

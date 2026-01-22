import React, { ReactNode } from "react";
import { Pressable, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { TerminalColors, TerminalSpacing, TerminalRadius } from "./theme";

interface TerminalIconButtonProps {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "default" | "danger" | "success" | "ghost";
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
  active?: boolean;
}

export function TerminalIconButton({
  children,
  onPress,
  disabled = false,
  variant = "default",
  size = "md",
  style,
  active = false,
}: TerminalIconButtonProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles[size],
        styles[variant],
        active && styles.active,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: TerminalRadius.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
  active: {
    backgroundColor: TerminalColors.accent + "30",
    borderColor: TerminalColors.accent,
  },

  default: {
    backgroundColor: TerminalColors.bgSurface,
    borderWidth: 1,
    borderColor: TerminalColors.border,
  },
  danger: {
    backgroundColor: TerminalColors.negativeBg,
    borderWidth: 1,
    borderColor: TerminalColors.negative + "40",
  },
  success: {
    backgroundColor: TerminalColors.positiveBg,
    borderWidth: 1,
    borderColor: TerminalColors.positive + "40",
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },

  sm: {
    width: 24,
    height: 24,
  },
  md: {
    width: 32,
    height: 32,
  },
  lg: {
    width: 40,
    height: 40,
  },
});

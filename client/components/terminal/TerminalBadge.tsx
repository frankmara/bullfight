import React, { ReactNode } from "react";
import { View, Text, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { TerminalColors, TerminalSpacing, TerminalRadius } from "./theme";

interface TerminalBadgeProps {
  children: ReactNode;
  variant?: "default" | "positive" | "negative" | "warning" | "info" | "accent";
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
}

export function TerminalBadge({
  children,
  variant = "default",
  size = "md",
  style,
}: TerminalBadgeProps) {
  return (
    <View style={[styles.badge, styles[variant], size === "sm" && styles.sm, style]}>
      <Text style={[styles.text, styles[`${variant}Text` as keyof typeof styles] as any, size === "sm" && styles.textSm]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: TerminalSpacing.sm,
    paddingVertical: TerminalSpacing.xxs,
    borderRadius: TerminalRadius.xs,
    alignSelf: "flex-start",
  },
  sm: {
    paddingHorizontal: TerminalSpacing.xs,
    paddingVertical: 1,
  },
  text: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  textSm: {
    fontSize: 9,
  },

  default: {
    backgroundColor: TerminalColors.bgElevated,
  },
  defaultText: {
    color: TerminalColors.textSecondary,
  },

  positive: {
    backgroundColor: TerminalColors.positiveBg,
  },
  positiveText: {
    color: TerminalColors.positive,
  },

  negative: {
    backgroundColor: TerminalColors.negativeBg,
  },
  negativeText: {
    color: TerminalColors.negative,
  },

  warning: {
    backgroundColor: TerminalColors.warningBg,
  },
  warningText: {
    color: TerminalColors.warning,
  },

  info: {
    backgroundColor: TerminalColors.infoBg,
  },
  infoText: {
    color: TerminalColors.info,
  },

  accent: {
    backgroundColor: TerminalColors.accentGlow,
  },
  accentText: {
    color: TerminalColors.accent,
  },
});

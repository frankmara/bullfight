import React, { ReactNode } from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { TerminalColors, TerminalSpacing, TerminalRadius } from "./theme";

interface TerminalPanelProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "elevated" | "inset";
  noPadding?: boolean;
}

export function TerminalPanel({
  children,
  style,
  variant = "default",
  noPadding = false,
}: TerminalPanelProps) {
  return (
    <View
      style={[
        styles.panel,
        variant === "elevated" && styles.elevated,
        variant === "inset" && styles.inset,
        noPadding && styles.noPadding,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: TerminalColors.bgPanel,
    borderWidth: 1,
    borderColor: TerminalColors.border,
    borderRadius: TerminalRadius.md,
    padding: TerminalSpacing.lg,
  },
  elevated: {
    backgroundColor: TerminalColors.bgElevated,
    borderColor: TerminalColors.borderLight,
  },
  inset: {
    backgroundColor: TerminalColors.bgBase,
    borderColor: TerminalColors.border,
  },
  noPadding: {
    padding: 0,
  },
});

import React, { ReactNode } from "react";
import { View, Text, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { TerminalColors, TerminalSpacing, TerminalTypography } from "./theme";

interface TerminalHeaderProps {
  title: string;
  rightContent?: ReactNode;
  style?: StyleProp<ViewStyle>;
  size?: "sm" | "md";
}

export function TerminalHeader({
  title,
  rightContent,
  style,
  size = "md",
}: TerminalHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <Text
        style={[
          styles.title,
          size === "sm" && styles.titleSm,
        ]}
      >
        {title}
      </Text>
      {rightContent ? <View style={styles.right}>{rightContent}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: TerminalSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
    marginBottom: TerminalSpacing.md,
  },
  title: {
    ...TerminalTypography.header,
  },
  titleSm: {
    fontSize: 11,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: TerminalSpacing.sm,
  },
});

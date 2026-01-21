import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface StatusBadgeProps {
  status: string;
  size?: "small" | "medium";
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "open":
      return Colors.dark.success;
    case "running":
      return Colors.dark.primaryBlue;
    case "ended":
      return Colors.dark.warning;
    case "paid":
      return Colors.dark.gold;
    case "draft":
      return Colors.dark.textMuted;
    default:
      return Colors.dark.textMuted;
  }
};

export function StatusBadge({ status, size = "small" }: StatusBadgeProps) {
  const color = getStatusColor(status);
  const isSmall = size === "small";

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: `${color}20`, borderColor: color },
        isSmall ? styles.small : styles.medium,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText
        style={[
          styles.text,
          { color },
          isSmall ? styles.textSmall : styles.textMedium,
        ]}
      >
        {status.toUpperCase()}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.full,
  },
  small: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  medium: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.xs,
  },
  text: {
    fontWeight: "600",
  },
  textSmall: {
    fontSize: 10,
  },
  textMedium: {
    fontSize: 12,
  },
});

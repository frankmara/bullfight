import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing } from "@/constants/theme";

interface PriceDisplayProps {
  value: number;
  showSign?: boolean;
  size?: "small" | "medium" | "large";
  isCurrency?: boolean;
}

export function PriceDisplay({
  value,
  showSign = false,
  size = "medium",
  isCurrency = true,
}: PriceDisplayProps) {
  const isPositive = value >= 0;
  const color = showSign
    ? isPositive
      ? Colors.dark.success
      : Colors.dark.danger
    : Colors.dark.text;

  const formattedValue = isCurrency
    ? `$${Math.abs(value / 100).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : value.toFixed(5);

  const fontSize = size === "small" ? 14 : size === "medium" ? 18 : 28;

  return (
    <View style={styles.container}>
      {showSign && (
        <ThemedText style={[styles.sign, { color, fontSize }]}>
          {isPositive ? "+" : "-"}
        </ThemedText>
      )}
      <ThemedText style={[styles.value, { color, fontSize }]}>
        {formattedValue}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  sign: {
    fontWeight: "600",
    fontFamily: "monospace",
  },
  value: {
    fontWeight: "600",
    fontFamily: "monospace",
  },
});

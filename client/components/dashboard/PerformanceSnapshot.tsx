import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { EquityChart } from "./EquityChart";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface EquityPoint {
  time: number;
  value: number;
}

interface PerformanceSnapshotProps {
  points: EquityPoint[];
  balance: number;
  equity: number;
  returnPct: number;
  drawdownPct: number;
  rank?: number;
  selectedRange: string;
  onRangeChange: (range: string) => void;
  isLoading?: boolean;
}

const formatCurrency = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PerformanceSnapshot({
  points,
  balance,
  equity,
  returnPct,
  drawdownPct,
  rank,
  selectedRange,
  onRangeChange,
  isLoading,
}: PerformanceSnapshotProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Performance</ThemedText>
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiItem}>
          <ThemedText style={styles.kpiLabel}>Balance</ThemedText>
          <ThemedText style={styles.kpiValue}>{formatCurrency(balance)}</ThemedText>
        </View>
        <View style={styles.kpiItem}>
          <ThemedText style={styles.kpiLabel}>Equity</ThemedText>
          <ThemedText style={styles.kpiValue}>{formatCurrency(equity)}</ThemedText>
        </View>
        <View style={styles.kpiItem}>
          <ThemedText style={styles.kpiLabel}>Return</ThemedText>
          <ThemedText
            style={[
              styles.kpiValue,
              { color: returnPct >= 0 ? Colors.dark.success : Colors.dark.danger },
            ]}
          >
            {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
          </ThemedText>
        </View>
        <View style={styles.kpiItem}>
          <ThemedText style={styles.kpiLabel}>Drawdown</ThemedText>
          <ThemedText style={[styles.kpiValue, { color: Colors.dark.danger }]}>
            {drawdownPct.toFixed(2)}%
          </ThemedText>
        </View>
        {rank ? (
          <View style={styles.kpiItem}>
            <ThemedText style={styles.kpiLabel}>Rank</ThemedText>
            <ThemedText style={[styles.kpiValue, { color: Colors.dark.gold }]}>
              #{rank}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.chartContainer}>
        <EquityChart
          points={points}
          height={140}
          showRangeToggle={true}
          selectedRange={selectedRange}
          onRangeChange={onRangeChange}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    ...(Platform.OS === "web" ? {
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
    } : {}),
  } as any,
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  kpiItem: {
    minWidth: 80,
  },
  kpiLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    fontFamily: "monospace",
  },
  chartContainer: {
    marginTop: Spacing.sm,
  },
});

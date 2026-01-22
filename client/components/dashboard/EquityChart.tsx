import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface EquityPoint {
  time: number;
  value: number;
}

interface EquityChartProps {
  points: EquityPoint[];
  height?: number;
  showRangeToggle?: boolean;
  selectedRange?: string;
  onRangeChange?: (range: string) => void;
}

const RANGE_OPTIONS = ["1D", "1W", "1M", "All"];

export function EquityChart({
  points,
  height = 160,
  showRangeToggle = true,
  selectedRange = "1W",
  onRangeChange,
}: EquityChartProps) {
  const [activeRange, setActiveRange] = useState(selectedRange);

  const handleRangePress = (range: string) => {
    setActiveRange(range);
    onRangeChange?.(range);
  };

  const renderChart = () => {
    if (points.length < 2) {
      return (
        <View style={[styles.chartArea, { height }]}>
          <ThemedText style={styles.noDataText}>No data available</ThemedText>
        </View>
      );
    }

    const minValue = Math.min(...points.map((p) => p.value));
    const maxValue = Math.max(...points.map((p) => p.value));
    const range = maxValue - minValue || 1;

    const chartWidth = Dimensions.get("window").width - Spacing.lg * 4 - 32;
    const isPositive = points[points.length - 1].value >= points[0].value;

    const pathPoints = points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * chartWidth;
        const y = height - ((point.value - minValue) / range) * (height - 20);
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

    const fillPath = `${pathPoints} L ${chartWidth} ${height} L 0 ${height} Z`;

    return (
      <View style={[styles.chartArea, { height }]}>
        {Platform.OS === "web" ? (
          <svg
            width="100%"
            height={height}
            viewBox={`0 0 ${chartWidth} ${height}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={isPositive ? Colors.dark.success : Colors.dark.danger}
                  stopOpacity="0.3"
                />
                <stop
                  offset="100%"
                  stopColor={isPositive ? Colors.dark.success : Colors.dark.danger}
                  stopOpacity="0.05"
                />
              </linearGradient>
            </defs>
            <path d={fillPath} fill="url(#chartGradient)" />
            <path
              d={pathPoints}
              fill="none"
              stroke={isPositive ? Colors.dark.success : Colors.dark.danger}
              strokeWidth="2"
            />
          </svg>
        ) : (
          <View style={styles.placeholderChart}>
            <View
              style={[
                styles.placeholderLine,
                { backgroundColor: isPositive ? Colors.dark.success : Colors.dark.danger },
              ]}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {showRangeToggle ? (
        <View style={styles.rangeToggle}>
          {RANGE_OPTIONS.map((range) => (
            <Pressable
              key={range}
              style={[
                styles.rangeButton,
                activeRange === range && styles.rangeButtonActive,
              ]}
              onPress={() => handleRangePress(range)}
            >
              <ThemedText
                style={[
                  styles.rangeButtonText,
                  activeRange === range && styles.rangeButtonTextActive,
                ]}
              >
                {range}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {renderChart()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  rangeToggle: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  rangeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  rangeButtonActive: {
    backgroundColor: Colors.dark.accent,
  },
  rangeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  rangeButtonTextActive: {
    color: Colors.dark.text,
  },
  chartArea: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  noDataText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  placeholderChart: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
  },
  placeholderLine: {
    height: 2,
    width: "100%",
    borderRadius: 1,
  },
});

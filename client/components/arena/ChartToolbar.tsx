import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { TerminalColors, TerminalTypography } from "@/components/terminal";

interface ChartToolbarProps {
  symbol: string;
  currentPrice?: number;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  formatPrice: (price: number) => string;
}

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"];

export function ChartToolbar({ 
  symbol, 
  currentPrice, 
  timeframe, 
  onTimeframeChange,
  formatPrice 
}: ChartToolbarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <ThemedText style={styles.symbol}>{symbol.replace("-", "/")}</ThemedText>
        {currentPrice !== undefined ? (
          <ThemedText style={styles.price}>{formatPrice(currentPrice)}</ThemedText>
        ) : null}
      </View>
      
      <View style={styles.centerSection}>
        <View style={styles.timeframeGroup}>
          {TIMEFRAMES.map((tf) => (
            <Pressable
              key={tf}
              style={[styles.timeframeBtn, timeframe === tf && styles.timeframeBtnActive]}
              onPress={() => onTimeframeChange(tf)}
            >
              <ThemedText style={[styles.timeframeBtnText, timeframe === tf && styles.timeframeBtnTextActive]}>
                {tf}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>
      
      <View style={styles.rightSection}>
        <Pressable style={styles.iconBtn}>
          <Feather name="bar-chart-2" size={14} color={TerminalColors.textMuted} />
        </Pressable>
        <Pressable style={styles.iconBtn}>
          <Feather name="settings" size={14} color={TerminalColors.textMuted} />
        </Pressable>
        <Pressable style={styles.iconBtn}>
          <Feather name="maximize-2" size={14} color={TerminalColors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 16,
  },
  
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  
  symbol: {
    fontSize: 14,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
  },
  
  price: {
    ...TerminalTypography.priceLarge,
    color: TerminalColors.positive,
  },
  
  centerSection: {
    flex: 1,
    alignItems: "center",
  },
  
  timeframeGroup: {
    flexDirection: "row",
    backgroundColor: TerminalColors.bgElevated,
    borderRadius: 4,
    padding: 2,
  },
  
  timeframeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 3,
  },
  
  timeframeBtnActive: {
    backgroundColor: TerminalColors.accent,
  },
  
  timeframeBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: TerminalColors.textMuted,
  },
  
  timeframeBtnTextActive: {
    color: TerminalColors.textPrimary,
  },
  
  rightSection: {
    flexDirection: "row",
    gap: 4,
  },
  
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
});

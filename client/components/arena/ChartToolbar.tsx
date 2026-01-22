import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { TerminalColors, TerminalTypography } from "@/components/terminal";

type QuoteStatus = "live" | "delayed" | "stale" | "disconnected";

interface Quote {
  bid: number;
  ask: number;
  spreadPips: number;
  timestamp: number;
  status: QuoteStatus;
}

interface ChartToolbarProps {
  symbol: string;
  currentQuote?: Quote;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  formatPrice: (price: number) => string;
}

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"];

const STATUS_COLORS: Record<QuoteStatus, string> = {
  live: "#16C784",
  delayed: "#F5A623",
  stale: "#FF6B35",
  disconnected: "#FF3B3B",
};

const STATUS_LABELS: Record<QuoteStatus, string> = {
  live: "LIVE",
  delayed: "DELAYED",
  stale: "STALE",
  disconnected: "DISCONNECTED",
};

export function ChartToolbar({ 
  symbol, 
  currentQuote, 
  timeframe, 
  onTimeframeChange,
  formatPrice 
}: ChartToolbarProps) {
  const [tickAge, setTickAge] = useState<number>(0);

  useEffect(() => {
    if (!currentQuote) return;
    
    const updateAge = () => {
      const age = Math.floor((Date.now() - currentQuote.timestamp) / 1000);
      setTickAge(age);
    };
    
    updateAge();
    const interval = setInterval(updateAge, 1000);
    return () => clearInterval(interval);
  }, [currentQuote?.timestamp]);

  const status = currentQuote?.status || "disconnected";
  const statusColor = STATUS_COLORS[status];
  const statusLabel = STATUS_LABELS[status];

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <ThemedText style={styles.symbol}>{symbol.replace("-", "/")}</ThemedText>
        
        {currentQuote ? (
          <>
            <View style={styles.priceGroup}>
              <View style={styles.priceItem}>
                <ThemedText style={styles.priceLabel}>BID</ThemedText>
                <ThemedText style={styles.bidPrice}>{formatPrice(currentQuote.bid)}</ThemedText>
              </View>
              <View style={styles.priceItem}>
                <ThemedText style={styles.priceLabel}>ASK</ThemedText>
                <ThemedText style={styles.askPrice}>{formatPrice(currentQuote.ask)}</ThemedText>
              </View>
              <View style={styles.priceItem}>
                <ThemedText style={styles.priceLabel}>SPREAD</ThemedText>
                <ThemedText style={styles.spreadValue}>{currentQuote.spreadPips.toFixed(1)} pips</ThemedText>
              </View>
            </View>
            
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "20", borderColor: statusColor }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <ThemedText style={[styles.statusText, { color: statusColor }]}>{statusLabel}</ThemedText>
            </View>
            
            <ThemedText style={styles.tickAge}>Last tick: {tickAge}s</ThemedText>
          </>
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
    gap: 16,
  },
  
  symbol: {
    fontSize: 14,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
  },
  
  priceGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  
  priceItem: {
    alignItems: "center",
  },
  
  priceLabel: {
    fontSize: 9,
    fontWeight: "500",
    color: TerminalColors.textMuted,
    marginBottom: 1,
  },
  
  bidPrice: {
    ...TerminalTypography.price,
    color: TerminalColors.negative,
    fontSize: 13,
  },
  
  askPrice: {
    ...TerminalTypography.price,
    color: TerminalColors.positive,
    fontSize: 13,
  },
  
  spreadValue: {
    ...TerminalTypography.price,
    color: TerminalColors.textSecondary,
    fontSize: 12,
  },
  
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    gap: 5,
  },
  
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  
  tickAge: {
    fontSize: 11,
    color: TerminalColors.textMuted,
    fontVariant: ["tabular-nums"],
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

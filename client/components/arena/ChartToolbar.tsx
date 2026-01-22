import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
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
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const TIMEFRAMES = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1D" },
];

const STATUS_COLORS: Record<QuoteStatus, string> = {
  live: "#16C784",
  delayed: "#F5A623",
  stale: "#FF6B35",
  disconnected: "#FF3B3B",
};

export function ChartToolbar({ 
  symbol, 
  currentQuote, 
  timeframe, 
  onTimeframeChange,
  formatPrice,
  isFullscreen = false,
  onToggleFullscreen,
}: ChartToolbarProps) {
  const [showTimeframeMenu, setShowTimeframeMenu] = useState(false);
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

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen && onToggleFullscreen) {
        onToggleFullscreen();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onToggleFullscreen]);

  const status = currentQuote?.status || "disconnected";
  const statusColor = STATUS_COLORS[status];
  const currentTfLabel = TIMEFRAMES.find(tf => tf.value === timeframe)?.label || timeframe;

  const handleTimeframeSelect = (tf: string) => {
    onTimeframeChange(tf);
    setShowTimeframeMenu(false);
  };

  const renderTimeframeMenu = () => {
    if (!showTimeframeMenu || Platform.OS !== 'web') return null;
    
    return React.createElement('div', {
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      },
      onClick: () => setShowTimeframeMenu(false),
    }, 
      React.createElement('div', {
        style: {
          position: 'absolute',
          top: 140,
          left: 60,
          backgroundColor: TerminalColors.bgPanel,
          borderRadius: 4,
          border: `1px solid ${TerminalColors.border}`,
          minWidth: 80,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        },
        onClick: (e: any) => e.stopPropagation(),
      },
        TIMEFRAMES.map((tf) => 
          React.createElement('div', {
            key: tf.value,
            style: {
              padding: '8px 12px',
              cursor: 'pointer',
              backgroundColor: timeframe === tf.value ? TerminalColors.bgElevated : 'transparent',
              color: timeframe === tf.value ? TerminalColors.accent : TerminalColors.textSecondary,
              fontSize: 12,
              fontWeight: timeframe === tf.value ? 600 : 400,
            },
            onClick: () => handleTimeframeSelect(tf.value),
            onMouseEnter: (e: any) => { e.currentTarget.style.backgroundColor = TerminalColors.bgElevated; },
            onMouseLeave: (e: any) => { 
              e.currentTarget.style.backgroundColor = timeframe === tf.value ? TerminalColors.bgElevated : 'transparent';
            },
          }, tf.label)
        )
      )
    );
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' && renderTimeframeMenu()}
      <View style={styles.leftSection}>
        <View style={styles.timeframeDropdown}>
          <Pressable 
            style={styles.timeframeBtn}
            onPress={() => setShowTimeframeMenu(!showTimeframeMenu)}
          >
            <ThemedText style={styles.timeframeBtnText}>{currentTfLabel}</ThemedText>
            <Feather name="chevron-down" size={12} color={TerminalColors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.separator} />
        
        <Pressable style={styles.toolBtn}>
          <Feather name="bar-chart" size={14} color={TerminalColors.textMuted} />
        </Pressable>
        
        <Pressable style={styles.indicatorBtn}>
          <Feather name="activity" size={14} color={TerminalColors.textMuted} />
          <ThemedText style={styles.indicatorText}>Indicators</ThemedText>
        </Pressable>
        
        <View style={styles.separator} />
        
        <Pressable style={styles.toolBtn}>
          <Feather name="grid" size={14} color={TerminalColors.textMuted} />
        </Pressable>
        
        <Pressable style={styles.toolBtn}>
          <Feather name="settings" size={14} color={TerminalColors.textMuted} />
        </Pressable>
      </View>
      
      <View style={styles.centerSection}>
        <View style={styles.symbolInfo}>
          <ThemedText style={styles.symbolName}>{symbol.replace("-", " / ")}</ThemedText>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <ThemedText style={styles.symbolMeta}>• {currentTfLabel}</ThemedText>
          {currentQuote && (
            <ThemedText style={styles.tickAgeText}>• {tickAge}s ago</ThemedText>
          )}
        </View>
      </View>
      
      <View style={styles.rightSection}>
        <Pressable style={styles.saveBtn}>
          <ThemedText style={styles.saveBtnText}>Save</ThemedText>
          <Feather name="chevron-down" size={12} color={TerminalColors.textMuted} />
        </Pressable>
        
        <View style={styles.separator} />
        
        <Pressable style={styles.toolBtn}>
          <Feather name="rotate-ccw" size={14} color={TerminalColors.textMuted} />
        </Pressable>
        
        <Pressable style={styles.toolBtn}>
          <Feather name="rotate-cw" size={14} color={TerminalColors.textMuted} />
        </Pressable>
        
        <View style={styles.separator} />
        
        <Pressable style={styles.toolBtn}>
          <Feather name="camera" size={14} color={TerminalColors.textMuted} />
        </Pressable>
        
        {Platform.OS === 'web' ? (
          React.createElement('button', {
            onClick: () => {
              console.log('[ChartToolbar] Fullscreen button clicked');
              if (onToggleFullscreen) onToggleFullscreen();
            },
            style: {
              width: 30,
              height: 30,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isFullscreen ? TerminalColors.bgElevated : 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            },
            'data-testid': 'button-fullscreen-toggle',
            'aria-label': isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen',
          }, React.createElement(Feather, {
            name: isFullscreen ? 'minimize-2' : 'maximize-2',
            size: 14,
            color: isFullscreen ? TerminalColors.accent : TerminalColors.textMuted,
          }))
        ) : (
          <Pressable 
            style={[styles.toolBtn, isFullscreen && styles.toolBtnActive]}
            onPress={onToggleFullscreen}
          >
            <Feather 
              name={isFullscreen ? "minimize-2" : "maximize-2"} 
              size={14} 
              color={isFullscreen ? TerminalColors.accent : TerminalColors.textMuted} 
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    backgroundColor: TerminalColors.bgPanel,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  
  centerSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  
  separator: {
    width: 1,
    height: 20,
    backgroundColor: TerminalColors.border,
    marginHorizontal: 6,
  },
  
  timeframeDropdown: {
    position: "relative",
  },
  
  timeframeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: TerminalColors.bgElevated,
    borderRadius: 4,
    gap: 6,
  },
  
  timeframeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: TerminalColors.textPrimary,
  },
  
  timeframeMenu: {
    position: "absolute",
    top: 32,
    left: 0,
    backgroundColor: TerminalColors.bgPanel,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: TerminalColors.border,
    minWidth: 80,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  
  timeframeMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  
  timeframeMenuItemActive: {
    backgroundColor: TerminalColors.bgElevated,
  },
  
  timeframeMenuItemText: {
    fontSize: 12,
    color: TerminalColors.textSecondary,
  },
  
  timeframeMenuItemTextActive: {
    color: TerminalColors.accent,
    fontWeight: "600",
  },
  
  toolBtn: {
    width: 30,
    height: 30,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  
  toolBtnActive: {
    backgroundColor: TerminalColors.bgElevated,
  },
  
  indicatorBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    gap: 6,
  },
  
  indicatorText: {
    fontSize: 12,
    color: TerminalColors.textMuted,
  },
  
  symbolInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  
  symbolName: {
    fontSize: 13,
    fontWeight: "600",
    color: TerminalColors.textPrimary,
  },
  
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  
  symbolMeta: {
    fontSize: 12,
    color: TerminalColors.textMuted,
  },
  
  tickAgeText: {
    fontSize: 11,
    color: TerminalColors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    gap: 4,
  },
  
  saveBtnText: {
    fontSize: 12,
    color: TerminalColors.textMuted,
  },
});

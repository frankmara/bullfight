import React, { useState, useCallback } from "react";
import { View, StyleSheet, Pressable, TextInput, Platform, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { TerminalColors, TerminalTypography } from "@/components/terminal";

interface Quote {
  bid: number;
  ask: number;
}

interface OrderTicketProps {
  selectedPair: string;
  currentQuote?: Quote;
  orderSide: "buy" | "sell";
  orderType: "market" | "limit" | "stop";
  lotSize: string;
  limitPrice: string;
  stopPrice: string;
  stopLoss: string;
  takeProfit: string;
  oneClickTrading: boolean;
  isTradeDisabled: boolean;
  isPending: boolean;
  competitionStatus?: string;
  onOrderSideChange: (side: "buy" | "sell") => void;
  onOrderTypeChange: (type: "market" | "limit" | "stop") => void;
  onLotSizeChange: (size: string) => void;
  onLimitPriceChange: (price: string) => void;
  onStopPriceChange: (price: string) => void;
  onStopLossChange: (price: string) => void;
  onTakeProfitChange: (price: string) => void;
  onOneClickTradingChange: (enabled: boolean) => void;
  onPlaceOrder: () => void;
  formatPrice: (price: number) => string;
  onPairChange?: (pair: string) => void;
  availablePairs?: string[];
}

const UNITS_PER_LOT = 100000;
const MIN_LOTS = 0.01;
const MAX_LOTS = 100.0;
const LOT_STEP = 0.01;


function formatUnits(lots: number): string {
  const units = lots * UNITS_PER_LOT;
  if (units >= 1000000) return `${(units / 1000000).toFixed(1)}M`;
  if (units >= 1000) return `${(units / 1000).toFixed(0)}K`;
  return units.toFixed(0);
}

function calculateSpread(bid: number, ask: number, pair: string): string {
  const isJpy = pair.includes("JPY");
  const pipMultiplier = isJpy ? 100 : 10000;
  const spread = (ask - bid) * pipMultiplier;
  return spread.toFixed(1);
}

export function OrderTicket({
  selectedPair,
  currentQuote,
  orderSide,
  orderType,
  lotSize,
  limitPrice,
  stopPrice,
  stopLoss,
  takeProfit,
  oneClickTrading,
  isTradeDisabled,
  isPending,
  competitionStatus,
  onOrderSideChange,
  onOrderTypeChange,
  onLotSizeChange,
  onLimitPriceChange,
  onStopPriceChange,
  onStopLossChange,
  onTakeProfitChange,
  onOneClickTradingChange,
  onPlaceOrder,
  formatPrice,
  onPairChange,
  availablePairs,
}: OrderTicketProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSide, setPendingSide] = useState<"buy" | "sell">("buy");
  const [slEnabled, setSlEnabled] = useState(false);
  const [tpEnabled, setTpEnabled] = useState(false);
  const [tsEnabled, setTsEnabled] = useState(false);
  const [showPairDropdown, setShowPairDropdown] = useState(false);

  const lots = parseFloat(lotSize) || 0.01;
  const units = lots * UNITS_PER_LOT;

  const isQuoteStale = !currentQuote;
  const canTrade = !isTradeDisabled && !isPending && !isQuoteStale && competitionStatus === "running";
  const disabledReason = isQuoteStale 
    ? "Quote stale" 
    : competitionStatus !== "running" 
      ? "Competition not running" 
      : "";

  const handleTrade = useCallback((side: "buy" | "sell") => {
    if (!canTrade) return;
    
    onOrderSideChange(side);
    if (oneClickTrading) {
      onPlaceOrder();
    } else {
      setPendingSide(side);
      setShowConfirmModal(true);
    }
  }, [canTrade, oneClickTrading, onOrderSideChange, onPlaceOrder]);

  const confirmOrder = useCallback(() => {
    setShowConfirmModal(false);
    onPlaceOrder();
  }, [onPlaceOrder]);

  const adjustLotSize = useCallback((delta: number) => {
    const current = parseFloat(lotSize) || MIN_LOTS;
    const newValue = Math.min(MAX_LOTS, Math.max(MIN_LOTS, Math.round((current + delta * LOT_STEP) * 100) / 100));
    onLotSizeChange(newValue.toFixed(2));
  }, [lotSize, onLotSizeChange]);


  const handleLotInputChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    onLotSizeChange(cleaned);
  }, [onLotSizeChange]);

  const handleLotInputBlur = useCallback(() => {
    const parsed = parseFloat(lotSize) || MIN_LOTS;
    const clamped = Math.min(MAX_LOTS, Math.max(MIN_LOTS, parsed));
    onLotSizeChange(clamped.toFixed(2));
  }, [lotSize, onLotSizeChange]);

  const fillPrice = currentQuote 
    ? (pendingSide === "buy" ? currentQuote.ask : currentQuote.bid) 
    : 0;

  const spread = currentQuote ? calculateSpread(currentQuote.bid, currentQuote.ask, selectedPair) : "--";

  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Pressable 
          style={styles.symbolDropdown}
          onPress={() => setShowPairDropdown(!showPairDropdown)}
        >
          <View style={styles.symbolIcon}>
            <Feather name="activity" size={12} color={TerminalColors.accent} />
          </View>
          <ThemedText style={styles.symbolText}>
            {selectedPair.replace("-", "")}
          </ThemedText>
          <Feather name="chevron-down" size={12} color={TerminalColors.textMuted} />
        </Pressable>

        <View style={styles.orderTypePill}>
          <ThemedText style={styles.orderTypeText}>MARKET</ThemedText>
        </View>

        <View style={styles.toggleChips}>
          <Pressable 
            style={[styles.toggleChip, slEnabled && styles.toggleChipActive]}
            onPress={() => setSlEnabled(!slEnabled)}
          >
            <ThemedText style={[styles.toggleChipText, slEnabled && styles.toggleChipTextActive]}>SL</ThemedText>
          </Pressable>
          <Pressable 
            style={[styles.toggleChip, tpEnabled && styles.toggleChipActive]}
            onPress={() => setTpEnabled(!tpEnabled)}
          >
            <ThemedText style={[styles.toggleChipText, tpEnabled && styles.toggleChipTextActive]}>TP</ThemedText>
          </Pressable>
          <Pressable 
            style={[styles.toggleChip, tsEnabled && styles.toggleChipActive]}
            onPress={() => setTsEnabled(!tsEnabled)}
          >
            <ThemedText style={[styles.toggleChipText, tsEnabled && styles.toggleChipTextActive]}>TS</ThemedText>
          </Pressable>
        </View>

        <Pressable 
          style={[styles.oneClickToggle, oneClickTrading && styles.oneClickToggleActive]}
          onPress={() => onOneClickTradingChange(!oneClickTrading)}
        >
          <Feather 
            name="zap" 
            size={12} 
            color={oneClickTrading ? "#fff" : TerminalColors.textMuted} 
          />
        </Pressable>
      </View>

      {/* Info Row */}
      <View style={styles.infoRow}>
        <ThemedText style={styles.infoText}>
          Spread: {spread} pips
        </ThemedText>
        <ThemedText style={styles.infoText}>
          Competition Mode
        </ThemedText>
        <ThemedText style={styles.infoText}>
          {lots.toFixed(2)} lots
        </ThemedText>
      </View>

      {/* Execution Row */}
      <View style={styles.executionRow}>
        <Pressable
          style={[
            styles.tradeBtn, 
            styles.sellBtn, 
            !canTrade && styles.tradeBtnDisabled
          ]}
          onPress={() => handleTrade("sell")}
          disabled={!canTrade}
        >
          <ThemedText style={styles.tradeBtnPrice}>
            {currentQuote ? formatPrice(currentQuote.bid) : "--"}
          </ThemedText>
          <ThemedText style={styles.tradeBtnLabel}>SELL</ThemedText>
          {!canTrade && disabledReason ? (
            <View style={styles.disabledBadge}>
              <ThemedText style={styles.disabledBadgeText}>
                {isQuoteStale ? "STALE" : ""}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>

        <View style={styles.lotControls}>
          <Pressable 
            style={styles.stepperBtn} 
            onPress={() => adjustLotSize(-1)}
          >
            <Feather name="minus" size={18} color={TerminalColors.textSecondary} />
          </Pressable>
          
          <View style={styles.lotInputWrapper}>
            <TextInput
              style={styles.lotInput}
              value={lotSize}
              onChangeText={handleLotInputChange}
              onBlur={handleLotInputBlur}
              keyboardType="decimal-pad"
              selectTextOnFocus
              placeholderTextColor={TerminalColors.textMuted}
            />
          </View>
          
          <Pressable 
            style={styles.stepperBtn} 
            onPress={() => adjustLotSize(1)}
          >
            <Feather name="plus" size={18} color={TerminalColors.textSecondary} />
          </Pressable>
        </View>

        <Pressable
          style={[
            styles.tradeBtn, 
            styles.buyBtn, 
            !canTrade && styles.tradeBtnDisabled
          ]}
          onPress={() => handleTrade("buy")}
          disabled={!canTrade}
        >
          <ThemedText style={styles.tradeBtnPrice}>
            {currentQuote ? formatPrice(currentQuote.ask) : "--"}
          </ThemedText>
          <ThemedText style={styles.tradeBtnLabel}>BUY</ThemedText>
        </Pressable>
      </View>

      {/* Lot Helper */}
      <View style={styles.helperRow}>
        <ThemedText style={styles.helperText}>
          {lots.toFixed(2)} lots = {formatUnits(lots)} units
        </ThemedText>
      </View>

      {/* Confirm Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowConfirmModal(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Confirm Order</ThemedText>
              <Pressable onPress={() => setShowConfirmModal(false)}>
                <Feather name="x" size={18} color={TerminalColors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.confirmRow}>
                <ThemedText style={styles.confirmLabel}>Side</ThemedText>
                <ThemedText style={[
                  styles.confirmValue,
                  pendingSide === "buy" ? styles.confirmBuy : styles.confirmSell
                ]}>
                  {pendingSide.toUpperCase()}
                </ThemedText>
              </View>
              <View style={styles.confirmRow}>
                <ThemedText style={styles.confirmLabel}>Symbol</ThemedText>
                <ThemedText style={styles.confirmValue}>{selectedPair.replace("-", "/")}</ThemedText>
              </View>
              <View style={styles.confirmRow}>
                <ThemedText style={styles.confirmLabel}>Size</ThemedText>
                <ThemedText style={styles.confirmValue}>{lots.toFixed(2)} lots ({formatUnits(lots)} units)</ThemedText>
              </View>
              <View style={styles.confirmRow}>
                <ThemedText style={styles.confirmLabel}>Spread</ThemedText>
                <ThemedText style={styles.confirmValue}>{spread} pips</ThemedText>
              </View>
              <View style={styles.confirmRow}>
                <ThemedText style={styles.confirmLabel}>Est. Fill</ThemedText>
                <ThemedText style={styles.confirmValue}>{formatPrice(fillPrice)}</ThemedText>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowConfirmModal(false)}>
                <ThemedText style={styles.cancelBtnText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmBtn,
                  pendingSide === "buy" ? styles.confirmBtnBuy : styles.confirmBtnSell
                ]}
                onPress={confirmOrder}
              >
                <ThemedText style={styles.confirmBtnText}>
                  Confirm {pendingSide.toUpperCase()}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0E141C",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#1C2533",
  },
  
  // Header Row
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    gap: 8,
    marginBottom: 8,
  },
  symbolDropdown: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#101924",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#1C2533",
    gap: 6,
  },
  symbolIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(209, 75, 58, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  symbolText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  orderTypePill: {
    backgroundColor: "#1C2533",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  orderTypeText: {
    fontSize: 10,
    fontWeight: "700",
    color: TerminalColors.textSecondary,
    letterSpacing: 0.5,
  },
  toggleChips: {
    flexDirection: "row",
    gap: 4,
    marginLeft: "auto",
  },
  toggleChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#101924",
    borderWidth: 1,
    borderColor: "#1C2533",
  },
  toggleChipActive: {
    backgroundColor: "rgba(209, 75, 58, 0.2)",
    borderColor: TerminalColors.accent,
  },
  toggleChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: TerminalColors.textMuted,
  },
  toggleChipTextActive: {
    color: TerminalColors.accent,
  },
  oneClickToggle: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: "#101924",
    borderWidth: 1,
    borderColor: "#1C2533",
    alignItems: "center",
    justifyContent: "center",
  },
  oneClickToggleActive: {
    backgroundColor: TerminalColors.accent,
    borderColor: TerminalColors.accent,
  },

  // Info Row
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 22,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  infoText: {
    fontSize: 11,
    color: TerminalColors.textMuted,
  },

  // Execution Row
  executionRow: {
    flexDirection: "row",
    alignItems: "stretch",
    height: 56,
    gap: 8,
  },
  tradeBtn: {
    flex: 1,
    minWidth: 120,
    maxWidth: 160,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    position: "relative",
  },
  tradeBtnDisabled: {
    opacity: 0.5,
  },
  sellBtn: {
    backgroundColor: "#D14B3A",
  },
  buyBtn: {
    backgroundColor: "#16C784",
  },
  tradeBtnPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  tradeBtnLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 1,
    marginTop: 2,
    textTransform: "uppercase",
  },
  disabledBadge: {
    position: "absolute",
    top: 4,
    right: 4,
  },
  disabledBadgeText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#FFB74D",
  },

  lotControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    justifyContent: "center",
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#101924",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1C2533",
  },
  lotInputWrapper: {
    backgroundColor: "#0A0F14",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1C2533",
    width: 84,
    height: 44,
    justifyContent: "center",
  },
  lotInput: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },

  // Helper Row
  helperRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  helperText: {
    fontSize: 10,
    color: TerminalColors.textMuted,
    fontVariant: ["tabular-nums"],
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    width: 320,
    backgroundColor: "#0E141C",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1C2533",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1C2533",
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  modalBody: {
    padding: 16,
  },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  confirmLabel: {
    fontSize: 12,
    color: TerminalColors.textMuted,
  },
  confirmValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  confirmBuy: {
    color: "#16C784",
  },
  confirmSell: {
    color: "#D14B3A",
  },
  modalActions: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#1C2533",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#1C2533",
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: TerminalColors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  confirmBtnBuy: {
    backgroundColor: "#16C784",
  },
  confirmBtnSell: {
    backgroundColor: "#D14B3A",
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
});

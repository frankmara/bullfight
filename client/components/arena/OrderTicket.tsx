import React, { useState } from "react";
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
}

const UNITS_PER_LOT = 100000;

function formatUnits(lots: number): string {
  const units = lots * UNITS_PER_LOT;
  if (units >= 1000000) return `${(units / 1000000).toFixed(1)}M`;
  if (units >= 1000) return `${(units / 1000).toFixed(0)}K`;
  return units.toFixed(0);
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
}: OrderTicketProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSide, setPendingSide] = useState<"buy" | "sell">("buy");

  const lots = parseFloat(lotSize) || 0.01;

  const handleTrade = (side: "buy" | "sell") => {
    onOrderSideChange(side);
    if (oneClickTrading && !isTradeDisabled) {
      onPlaceOrder();
    } else if (!isTradeDisabled) {
      setPendingSide(side);
      setShowConfirmModal(true);
    }
  };

  const confirmOrder = () => {
    setShowConfirmModal(false);
    onPlaceOrder();
  };

  const adjustLotSize = (delta: number) => {
    const current = parseFloat(lotSize) || 0.01;
    const step = delta > 0 ? 0.01 : -0.01;
    const newValue = Math.max(0.01, Math.round((current + step) * 100) / 100);
    onLotSizeChange(newValue.toFixed(2));
  };

  const fillPrice = currentQuote 
    ? (pendingSide === "buy" ? currentQuote.ask : currentQuote.bid) 
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {currentQuote ? (
          <Pressable
            style={[styles.tradeBtn, styles.sellBtn, (isPending || isTradeDisabled) && styles.tradeBtnDisabled]}
            onPress={() => handleTrade("sell")}
            disabled={isTradeDisabled || isPending}
          >
            <ThemedText style={styles.tradeBtnPrice}>{formatPrice(currentQuote.bid)}</ThemedText>
            <ThemedText style={styles.tradeBtnLabel}>SELL</ThemedText>
          </Pressable>
        ) : (
          <View style={[styles.tradeBtn, styles.sellBtn, styles.tradeBtnDisabled]}>
            <ThemedText style={styles.tradeBtnPrice}>--</ThemedText>
            <ThemedText style={styles.tradeBtnLabel}>SELL</ThemedText>
          </View>
        )}

        <View style={styles.centerSection}>
          <Pressable style={styles.sizeAdjustBtn} onPress={() => adjustLotSize(-1)}>
            <Feather name="minus" size={16} color={TerminalColors.textSecondary} />
          </Pressable>
          
          <View style={styles.sizeInputWrapper}>
            <TextInput
              style={styles.sizeInput}
              value={lotSize}
              onChangeText={onLotSizeChange}
              keyboardType="decimal-pad"
              placeholderTextColor={TerminalColors.textMuted}
            />
          </View>
          
          <Pressable style={styles.sizeAdjustBtn} onPress={() => adjustLotSize(1)}>
            <Feather name="plus" size={16} color={TerminalColors.textSecondary} />
          </Pressable>
        </View>

        {currentQuote ? (
          <Pressable
            style={[styles.tradeBtn, styles.buyBtn, (isPending || isTradeDisabled) && styles.tradeBtnDisabled]}
            onPress={() => handleTrade("buy")}
            disabled={isTradeDisabled || isPending}
          >
            <ThemedText style={styles.tradeBtnPrice}>{formatPrice(currentQuote.ask)}</ThemedText>
            <ThemedText style={styles.tradeBtnLabel}>BUY</ThemedText>
          </Pressable>
        ) : (
          <View style={[styles.tradeBtn, styles.buyBtn, styles.tradeBtnDisabled]}>
            <ThemedText style={styles.tradeBtnPrice}>--</ThemedText>
            <ThemedText style={styles.tradeBtnLabel}>BUY</ThemedText>
          </View>
        )}
      </View>

      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowConfirmModal(false)}>
          <View style={styles.modalContent}>
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
                <ThemedText style={styles.confirmValue}>{lots.toFixed(2)} lots</ThemedText>
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
                  {pendingSide.toUpperCase()}
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
    backgroundColor: TerminalColors.bgPanel,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: TerminalColors.border,
  },
  
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  tradeBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  tradeBtnDisabled: {
    opacity: 0.5,
  },
  sellBtn: {
    backgroundColor: "#B71C1C",
  },
  buyBtn: {
    backgroundColor: "#1B5E20",
  },
  tradeBtnPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  tradeBtnLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.5,
    marginTop: 2,
  },

  centerSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sizeAdjustBtn: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: TerminalColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: TerminalColors.border,
  },
  sizeInputWrapper: {
    backgroundColor: TerminalColors.bgBase,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: TerminalColors.border,
    paddingHorizontal: 8,
    minWidth: 70,
    height: 32,
    justifyContent: "center",
  },
  sizeInput: {
    fontSize: 16,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    width: 280,
    backgroundColor: TerminalColors.bgPanel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TerminalColors.border,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
  },
  modalBody: {
    padding: 12,
  },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  confirmLabel: {
    fontSize: 11,
    color: TerminalColors.textMuted,
  },
  confirmValue: {
    fontSize: 11,
    fontWeight: "600",
    color: TerminalColors.textPrimary,
  },
  confirmBuy: {
    color: TerminalColors.positive,
  },
  confirmSell: {
    color: TerminalColors.negative,
  },
  modalActions: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: TerminalColors.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: TerminalColors.bgElevated,
    borderRadius: 4,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: TerminalColors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 4,
  },
  confirmBtnBuy: {
    backgroundColor: "#1B5E20",
  },
  confirmBtnSell: {
    backgroundColor: "#B71C1C",
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
});

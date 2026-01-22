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
  const [slEnabled, setSlEnabled] = useState(false);
  const [tpEnabled, setTpEnabled] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSide, setPendingSide] = useState<"buy" | "sell">("buy");

  const lots = parseFloat(lotSize) || 0.01;
  const unitsDisplay = formatUnits(lots);
  const spreadPips = currentQuote ? ((currentQuote.ask - currentQuote.bid) * 10000).toFixed(1) : "-";

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
      <View style={styles.topRow}>
        <View style={styles.orderTypeTabs}>
          {(["market", "limit", "stop"] as const).map((type) => (
            <Pressable
              key={type}
              style={[styles.orderTypeTab, orderType === type && styles.orderTypeTabActive]}
              onPress={() => onOrderTypeChange(type)}
            >
              <ThemedText style={[styles.orderTypeText, orderType === type && styles.orderTypeTextActive]}>
                {type.charAt(0).toUpperCase()}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        
        <View style={styles.oneClickToggle}>
          <ThemedText style={styles.oneClickLabel}>1-Click</ThemedText>
          <Pressable
            style={[styles.toggle, oneClickTrading && styles.toggleActive]}
            onPress={() => onOneClickTradingChange(!oneClickTrading)}
          >
            <View style={[styles.toggleKnob, oneClickTrading && styles.toggleKnobActive]} />
          </Pressable>
        </View>
      </View>

      <View style={styles.sizeRow}>
        <Pressable style={styles.sizeAdjustBtn} onPress={() => adjustLotSize(-1)}>
          <Feather name="minus" size={14} color={TerminalColors.textSecondary} />
        </Pressable>
        <View style={styles.sizeInputContainer}>
          <TextInput
            style={styles.sizeInput}
            value={lotSize}
            onChangeText={onLotSizeChange}
            keyboardType="decimal-pad"
            placeholderTextColor={TerminalColors.textMuted}
          />
          <ThemedText style={styles.sizeUnitLabel}>lots</ThemedText>
        </View>
        <Pressable style={styles.sizeAdjustBtn} onPress={() => adjustLotSize(1)}>
          <Feather name="plus" size={14} color={TerminalColors.textSecondary} />
        </Pressable>
      </View>

      {orderType !== "market" && (
        <View style={styles.priceRow}>
          <ThemedText style={styles.priceLabel}>
            {orderType === "limit" ? "Limit" : "Stop"}
          </ThemedText>
          <TextInput
            style={styles.priceInput}
            value={orderType === "limit" ? limitPrice : stopPrice}
            onChangeText={orderType === "limit" ? onLimitPriceChange : onStopPriceChange}
            keyboardType="decimal-pad"
            placeholder={currentQuote ? formatPrice((currentQuote.bid + currentQuote.ask) / 2) : "0.00000"}
            placeholderTextColor={TerminalColors.textMuted}
          />
        </View>
      )}

      <View style={styles.riskRow}>
        <Pressable
          style={[styles.riskToggle, slEnabled && styles.riskToggleActive]}
          onPress={() => setSlEnabled(!slEnabled)}
        >
          <ThemedText style={[styles.riskToggleText, slEnabled && styles.riskToggleTextActive]}>SL</ThemedText>
        </Pressable>
        {slEnabled && (
          <TextInput
            style={[styles.riskInput, styles.slInput]}
            value={stopLoss}
            onChangeText={onStopLossChange}
            keyboardType="decimal-pad"
            placeholder="Price"
            placeholderTextColor={TerminalColors.textMuted}
          />
        )}
        <Pressable
          style={[styles.riskToggle, tpEnabled && styles.riskToggleActive]}
          onPress={() => setTpEnabled(!tpEnabled)}
        >
          <ThemedText style={[styles.riskToggleText, tpEnabled && styles.riskToggleTextActive]}>TP</ThemedText>
        </Pressable>
        {tpEnabled && (
          <TextInput
            style={[styles.riskInput, styles.tpInput]}
            value={takeProfit}
            onChangeText={onTakeProfitChange}
            keyboardType="decimal-pad"
            placeholder="Price"
            placeholderTextColor={TerminalColors.textMuted}
          />
        )}
      </View>

      {currentQuote ? (
        <View style={styles.tradeButtonsContainer}>
          <Pressable
            style={[styles.tradeBtn, styles.sellBtn, isPending && styles.tradeBtnDisabled]}
            onPress={() => handleTrade("sell")}
            disabled={isTradeDisabled || isPending}
          >
            <ThemedText style={styles.tradeBtnLabel}>SELL</ThemedText>
            <ThemedText style={styles.tradeBtnPrice}>{formatPrice(currentQuote.bid)}</ThemedText>
          </Pressable>

          <View style={styles.spreadColumn}>
            <ThemedText style={styles.spreadValue}>{spreadPips}</ThemedText>
          </View>

          <Pressable
            style={[styles.tradeBtn, styles.buyBtn, isPending && styles.tradeBtnDisabled]}
            onPress={() => handleTrade("buy")}
            disabled={isTradeDisabled || isPending}
          >
            <ThemedText style={styles.tradeBtnLabel}>BUY</ThemedText>
            <ThemedText style={styles.tradeBtnPrice}>{formatPrice(currentQuote.ask)}</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {isTradeDisabled && (
        <View style={styles.disabledNotice}>
          <Feather name="alert-circle" size={12} color={TerminalColors.warning} />
          <ThemedText style={styles.disabledText}>Not running</ThemedText>
        </View>
      )}

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
    padding: 8,
  },
  
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  orderTypeTabs: {
    flexDirection: "row",
    backgroundColor: TerminalColors.bgBase,
    borderRadius: 4,
    padding: 2,
  },
  orderTypeTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 3,
  },
  orderTypeTabActive: {
    backgroundColor: TerminalColors.bgPanel,
  },
  orderTypeText: {
    fontSize: 10,
    fontWeight: "600",
    color: TerminalColors.textMuted,
  },
  orderTypeTextActive: {
    color: TerminalColors.textPrimary,
  },
  oneClickToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  oneClickLabel: {
    fontSize: 9,
    color: TerminalColors.textMuted,
  },
  toggle: {
    width: 32,
    height: 16,
    borderRadius: 8,
    backgroundColor: TerminalColors.bgElevated,
    padding: 2,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: TerminalColors.accent,
  },
  toggleKnob: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: TerminalColors.textMuted,
  },
  toggleKnobActive: {
    backgroundColor: "#fff",
    marginLeft: "auto",
  },

  sizeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  sizeAdjustBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: TerminalColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TerminalColors.bgInput,
    borderRadius: 4,
    paddingHorizontal: 8,
    height: 28,
  },
  sizeInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  sizeUnitLabel: {
    fontSize: 10,
    color: TerminalColors.textMuted,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  priceLabel: {
    fontSize: 10,
    color: TerminalColors.textMuted,
    width: 32,
  },
  priceInput: {
    flex: 1,
    backgroundColor: TerminalColors.bgInput,
    borderRadius: 4,
    paddingHorizontal: 8,
    height: 28,
    fontSize: 12,
    fontWeight: "600",
    color: TerminalColors.textPrimary,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },

  riskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  riskToggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: TerminalColors.bgBase,
    borderRadius: 4,
  },
  riskToggleActive: {
    backgroundColor: "rgba(209, 75, 58, 0.15)",
  },
  riskToggleText: {
    fontSize: 9,
    fontWeight: "600",
    color: TerminalColors.textMuted,
  },
  riskToggleTextActive: {
    color: TerminalColors.accent,
  },
  riskInput: {
    flex: 1,
    backgroundColor: TerminalColors.bgInput,
    borderRadius: 4,
    paddingHorizontal: 6,
    height: 24,
    fontSize: 11,
    fontWeight: "600",
    color: TerminalColors.textPrimary,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  slInput: {
    borderWidth: 1,
    borderColor: TerminalColors.negative,
  },
  tpInput: {
    borderWidth: 1,
    borderColor: TerminalColors.positive,
  },

  tradeButtonsContainer: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 4,
  },
  tradeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  tradeBtnDisabled: {
    opacity: 0.5,
  },
  sellBtn: {
    backgroundColor: "#C62828",
  },
  buyBtn: {
    backgroundColor: "#2E7D32",
  },
  tradeBtnLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 0.5,
  },
  tradeBtnPrice: {
    ...TerminalTypography.priceLarge,
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  spreadColumn: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  spreadValue: {
    fontSize: 10,
    color: TerminalColors.textMuted,
    fontVariant: ["tabular-nums"],
  },

  disabledNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    marginTop: 6,
    backgroundColor: TerminalColors.bgElevated,
    borderRadius: 4,
  },
  disabledText: {
    fontSize: 10,
    color: TerminalColors.warning,
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
    backgroundColor: "#2E7D32",
  },
  confirmBtnSell: {
    backgroundColor: "#C62828",
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
});

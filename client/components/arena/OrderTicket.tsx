import React, { useState } from "react";
import { View, StyleSheet, Pressable, TextInput, ScrollView, Platform, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { TerminalColors, TerminalTypography, TerminalSpacing, TerminalRadius } from "@/components/terminal";

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
const QUICK_LOT_SIZES = [0.01, 0.05, 0.1, 0.5, 1.0];

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <View style={styles.symbolBadge}>
          <ThemedText style={styles.symbolText}>{selectedPair.replace("-", "/")}</ThemedText>
          <Feather name="chevron-down" size={12} color={TerminalColors.textMuted} />
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

      <View style={styles.orderTypeTabs}>
        {(["market", "limit", "stop"] as const).map((type) => (
          <Pressable
            key={type}
            style={[styles.orderTypeTab, orderType === type && styles.orderTypeTabActive]}
            onPress={() => onOrderTypeChange(type)}
          >
            <ThemedText style={[styles.orderTypeText, orderType === type && styles.orderTypeTextActive]}>
              {type.toUpperCase()}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.riskToggles}>
        <Pressable
          style={[styles.riskToggle, slEnabled && styles.riskToggleActive]}
          onPress={() => setSlEnabled(!slEnabled)}
        >
          <ThemedText style={[styles.riskToggleText, slEnabled && styles.riskToggleTextActive]}>SL</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.riskToggle, tpEnabled && styles.riskToggleActive]}
          onPress={() => setTpEnabled(!tpEnabled)}
        >
          <ThemedText style={[styles.riskToggleText, tpEnabled && styles.riskToggleTextActive]}>TP</ThemedText>
        </Pressable>
        <Pressable style={[styles.riskToggle, styles.riskToggleDisabled]}>
          <ThemedText style={styles.riskToggleTextDisabled}>TS</ThemedText>
        </Pressable>
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
            <ThemedText style={styles.spreadLabel}>SPREAD</ThemedText>
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

      <View style={styles.sizeSection}>
        <ThemedText style={styles.sectionLabel}>VOLUME</ThemedText>
        <View style={styles.sizeRow}>
          <Pressable style={styles.sizeAdjustBtn} onPress={() => adjustLotSize(-1)}>
            <Feather name="minus" size={16} color={TerminalColors.textSecondary} />
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
            <Feather name="plus" size={16} color={TerminalColors.textSecondary} />
          </Pressable>
        </View>
        <ThemedText style={styles.unitsDisplay}>= {unitsDisplay} units</ThemedText>
        
        <View style={styles.quickSizeRow}>
          {QUICK_LOT_SIZES.map((size) => (
            <Pressable
              key={size}
              style={[styles.quickSizeBtn, parseFloat(lotSize) === size && styles.quickSizeBtnActive]}
              onPress={() => onLotSizeChange(size.toFixed(2))}
            >
              <ThemedText style={[styles.quickSizeText, parseFloat(lotSize) === size && styles.quickSizeTextActive]}>
                {size}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {orderType !== "market" && (
        <View style={styles.priceInputSection}>
          <ThemedText style={styles.sectionLabel}>
            {orderType === "limit" ? "LIMIT PRICE" : "STOP PRICE"}
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

      {(slEnabled || tpEnabled) && (
        <View style={styles.riskInputSection}>
          {slEnabled && (
            <View style={styles.riskInputField}>
              <ThemedText style={styles.riskInputLabel}>Stop Loss</ThemedText>
              <TextInput
                style={[styles.riskInput, styles.slInput]}
                value={stopLoss}
                onChangeText={onStopLossChange}
                keyboardType="decimal-pad"
                placeholder="Price"
                placeholderTextColor={TerminalColors.textMuted}
              />
            </View>
          )}
          {tpEnabled && (
            <View style={styles.riskInputField}>
              <ThemedText style={styles.riskInputLabel}>Take Profit</ThemedText>
              <TextInput
                style={[styles.riskInput, styles.tpInput]}
                value={takeProfit}
                onChangeText={onTakeProfitChange}
                keyboardType="decimal-pad"
                placeholder="Price"
                placeholderTextColor={TerminalColors.textMuted}
              />
            </View>
          )}
        </View>
      )}

      {isTradeDisabled && (
        <View style={styles.disabledNotice}>
          <Feather name="alert-circle" size={14} color={TerminalColors.warning} />
          <ThemedText style={styles.disabledText}>Competition not running</ThemedText>
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
                <Feather name="x" size={20} color={TerminalColors.textMuted} />
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
                <ThemedText style={styles.confirmValue}>{lots.toFixed(2)} lots ({unitsDisplay} units)</ThemedText>
              </View>
              <View style={styles.confirmRow}>
                <ThemedText style={styles.confirmLabel}>Est. Fill</ThemedText>
                <ThemedText style={styles.confirmValue}>{formatPrice(fillPrice)}</ThemedText>
              </View>
              <View style={styles.confirmRow}>
                <ThemedText style={styles.confirmLabel}>Spread</ThemedText>
                <ThemedText style={styles.confirmValue}>{spreadPips} pips</ThemedText>
              </View>
              {slEnabled && stopLoss && (
                <View style={styles.confirmRow}>
                  <ThemedText style={styles.confirmLabel}>Stop Loss</ThemedText>
                  <ThemedText style={[styles.confirmValue, styles.confirmSl]}>{stopLoss}</ThemedText>
                </View>
              )}
              {tpEnabled && takeProfit && (
                <View style={styles.confirmRow}>
                  <ThemedText style={styles.confirmLabel}>Take Profit</ThemedText>
                  <ThemedText style={[styles.confirmValue, styles.confirmTp]}>{takeProfit}</ThemedText>
                </View>
              )}
              
              <ThemedText style={styles.slippageNote}>
                Note: Market orders may experience slippage
              </ThemedText>
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
                  {pendingSide.toUpperCase()} {lots.toFixed(2)} LOTS
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TerminalColors.bgPanel,
  },
  content: {
    padding: 10,
  },
  
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  symbolBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: TerminalColors.bgBase,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  symbolText: {
    fontSize: 12,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
  },
  oneClickToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  oneClickLabel: {
    fontSize: 10,
    color: TerminalColors.textMuted,
  },
  toggle: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: TerminalColors.bgElevated,
    padding: 2,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: TerminalColors.accent,
  },
  toggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: TerminalColors.textMuted,
  },
  toggleKnobActive: {
    backgroundColor: "#fff",
    marginLeft: "auto",
  },

  orderTypeTabs: {
    flexDirection: "row",
    backgroundColor: TerminalColors.bgBase,
    borderRadius: 4,
    padding: 2,
    marginBottom: 8,
  },
  orderTypeTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 3,
  },
  orderTypeTabActive: {
    backgroundColor: TerminalColors.bgPanel,
  },
  orderTypeText: {
    fontSize: 10,
    fontWeight: "600",
    color: TerminalColors.textMuted,
    letterSpacing: 0.5,
  },
  orderTypeTextActive: {
    color: TerminalColors.textPrimary,
  },

  riskToggles: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  riskToggle: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: TerminalColors.bgBase,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: TerminalColors.border,
  },
  riskToggleActive: {
    backgroundColor: "rgba(209, 75, 58, 0.15)",
    borderColor: TerminalColors.accent,
  },
  riskToggleDisabled: {
    opacity: 0.4,
  },
  riskToggleText: {
    fontSize: 10,
    fontWeight: "600",
    color: TerminalColors.textMuted,
  },
  riskToggleTextActive: {
    color: TerminalColors.accent,
  },
  riskToggleTextDisabled: {
    fontSize: 10,
    fontWeight: "600",
    color: TerminalColors.textMuted,
  },

  tradeButtonsContainer: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 12,
    gap: 4,
  },
  tradeBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
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
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  tradeBtnPrice: {
    ...TerminalTypography.priceLarge,
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  spreadColumn: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  spreadLabel: {
    fontSize: 8,
    color: TerminalColors.textMuted,
    letterSpacing: 0.3,
  },
  spreadValue: {
    ...TerminalTypography.price,
    fontSize: 11,
    color: TerminalColors.textSecondary,
  },

  sizeSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: TerminalColors.textMuted,
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  sizeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  sizeInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TerminalColors.bgInput,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: TerminalColors.border,
    paddingHorizontal: 10,
  },
  sizeInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
    textAlign: "center",
    paddingVertical: 6,
    fontVariant: ["tabular-nums"],
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  sizeUnitLabel: {
    fontSize: 11,
    color: TerminalColors.textMuted,
    marginLeft: 4,
  },
  unitsDisplay: {
    fontSize: 10,
    color: TerminalColors.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  quickSizeRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 4,
  },
  quickSizeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    backgroundColor: TerminalColors.bgElevated,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: TerminalColors.border,
  },
  quickSizeBtnActive: {
    backgroundColor: "rgba(209, 75, 58, 0.15)",
    borderColor: TerminalColors.accent,
  },
  quickSizeText: {
    fontSize: 10,
    fontWeight: "600",
    color: TerminalColors.textMuted,
  },
  quickSizeTextActive: {
    color: TerminalColors.accent,
  },

  priceInputSection: {
    marginBottom: 12,
  },
  priceInput: {
    backgroundColor: TerminalColors.bgInput,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: TerminalColors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: "600",
    color: TerminalColors.textPrimary,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },

  riskInputSection: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  riskInputField: {
    flex: 1,
  },
  riskInputLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: TerminalColors.textMuted,
    marginBottom: 4,
  },
  riskInput: {
    backgroundColor: TerminalColors.bgInput,
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "600",
    color: TerminalColors.textPrimary,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  slInput: {
    borderColor: TerminalColors.negative,
  },
  tpInput: {
    borderColor: TerminalColors.positive,
  },

  disabledNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    backgroundColor: TerminalColors.bgElevated,
    borderRadius: 4,
  },
  disabledText: {
    fontSize: 11,
    color: TerminalColors.warning,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    width: 340,
    backgroundColor: TerminalColors.bgPanel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TerminalColors.border,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
  },
  modalBody: {
    padding: 16,
  },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  confirmLabel: {
    fontSize: 12,
    color: TerminalColors.textMuted,
  },
  confirmValue: {
    fontSize: 12,
    fontWeight: "600",
    color: TerminalColors.textPrimary,
  },
  confirmBuy: {
    color: TerminalColors.positive,
  },
  confirmSell: {
    color: TerminalColors.negative,
  },
  confirmSl: {
    color: TerminalColors.negative,
  },
  confirmTp: {
    color: TerminalColors.positive,
  },
  slippageNote: {
    fontSize: 10,
    color: TerminalColors.textMuted,
    fontStyle: "italic",
    marginTop: 12,
    textAlign: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: TerminalColors.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: TerminalColors.bgElevated,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: TerminalColors.border,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: TerminalColors.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 4,
  },
  confirmBtnBuy: {
    backgroundColor: TerminalColors.positive,
  },
  confirmBtnSell: {
    backgroundColor: TerminalColors.negative,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
});

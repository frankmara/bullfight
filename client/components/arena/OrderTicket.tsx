import React from "react";
import { View, StyleSheet, Pressable, TextInput, ScrollView } from "react-native";
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

const QUICK_LOT_SIZES = [0.01, 0.05, 0.1, 0.5, 1.0];

export function OrderTicket({
  selectedPair,
  currentQuote,
  orderSide,
  orderType,
  lotSize,
  stopLoss,
  takeProfit,
  oneClickTrading,
  isTradeDisabled,
  isPending,
  onOrderSideChange,
  onLotSizeChange,
  onStopLossChange,
  onTakeProfitChange,
  onOneClickTradingChange,
  onPlaceOrder,
  formatPrice,
}: OrderTicketProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Order Ticket</ThemedText>
        <View style={styles.oneClickRow}>
          <ThemedText style={styles.oneClickLabel}>1-Click</ThemedText>
          <Pressable
            style={[styles.toggle, oneClickTrading && styles.toggleActive]}
            onPress={() => onOneClickTradingChange(!oneClickTrading)}
          >
            <View style={[styles.toggleKnob, oneClickTrading && styles.toggleKnobActive]} />
          </Pressable>
        </View>
      </View>
      
      <View style={styles.lotSizeSection}>
        <ThemedText style={styles.inputLabel}>VOLUME (LOTS)</ThemedText>
        <View style={styles.lotSizeInputRow}>
          <Pressable style={styles.lotAdjustBtn} onPress={() => {
            const current = parseFloat(lotSize) || 0.1;
            onLotSizeChange(Math.max(0.01, current - 0.01).toFixed(2));
          }}>
            <Feather name="minus" size={14} color={TerminalColors.textMuted} />
          </Pressable>
          <TextInput
            style={styles.lotSizeInput}
            value={lotSize}
            onChangeText={onLotSizeChange}
            keyboardType="decimal-pad"
            placeholderTextColor={TerminalColors.textMuted}
          />
          <Pressable style={styles.lotAdjustBtn} onPress={() => {
            const current = parseFloat(lotSize) || 0.1;
            onLotSizeChange((current + 0.01).toFixed(2));
          }}>
            <Feather name="plus" size={14} color={TerminalColors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.quickLotRow}>
          {QUICK_LOT_SIZES.map((size) => (
            <Pressable
              key={size}
              style={[styles.quickLotBtn, parseFloat(lotSize) === size && styles.quickLotBtnActive]}
              onPress={() => onLotSizeChange(size.toString())}
            >
              <ThemedText style={[styles.quickLotText, parseFloat(lotSize) === size && styles.quickLotTextActive]}>
                {size}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>
      
      <View style={styles.slTpRow}>
        <View style={styles.slTpField}>
          <ThemedText style={styles.slTpLabel}>SL</ThemedText>
          <TextInput
            style={styles.slTpInput}
            value={stopLoss}
            onChangeText={onStopLossChange}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={TerminalColors.textMuted}
          />
        </View>
        <View style={styles.slTpField}>
          <ThemedText style={styles.slTpLabel}>TP</ThemedText>
          <TextInput
            style={styles.slTpInput}
            value={takeProfit}
            onChangeText={onTakeProfitChange}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={TerminalColors.textMuted}
          />
        </View>
      </View>
      
      {currentQuote ? (
        <View style={styles.tradeButtons}>
          <Pressable
            style={[styles.tradeBtn, styles.sellBtn, orderSide === "sell" && styles.tradeBtnActive]}
            onPress={() => {
              onOrderSideChange("sell");
              if (oneClickTrading && !isTradeDisabled) onPlaceOrder();
            }}
            disabled={isTradeDisabled}
          >
            <ThemedText style={styles.tradeBtnPrice}>{formatPrice(currentQuote.bid)}</ThemedText>
            <ThemedText style={styles.tradeBtnLabel}>SELL</ThemedText>
          </Pressable>
          
          <View style={styles.spreadBadge}>
            <ThemedText style={styles.spreadValue}>
              {((currentQuote.ask - currentQuote.bid) * 10000).toFixed(1)}
            </ThemedText>
          </View>

          <Pressable
            style={[styles.tradeBtn, styles.buyBtn, orderSide === "buy" && styles.tradeBtnActive]}
            onPress={() => {
              onOrderSideChange("buy");
              if (oneClickTrading && !isTradeDisabled) onPlaceOrder();
            }}
            disabled={isTradeDisabled}
          >
            <ThemedText style={styles.tradeBtnPrice}>{formatPrice(currentQuote.ask)}</ThemedText>
            <ThemedText style={styles.tradeBtnLabel}>BUY</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {!oneClickTrading && currentQuote ? (
        <Pressable
          style={[
            styles.executeBtn,
            orderSide === "buy" ? styles.executeBtnBuy : styles.executeBtnSell,
            (isTradeDisabled || isPending) && styles.executeBtnDisabled,
          ]}
          onPress={onPlaceOrder}
          disabled={isTradeDisabled || isPending}
        >
          <ThemedText style={styles.executeBtnText}>
            {isPending
              ? "EXECUTING..."
              : `${orderSide.toUpperCase()} ${parseFloat(lotSize || "0.1").toFixed(2)} LOTS`}
          </ThemedText>
        </Pressable>
      ) : null}

      {isTradeDisabled ? (
        <View style={styles.disabledNotice}>
          <Feather name="info" size={12} color={TerminalColors.textMuted} />
          <ThemedText style={styles.disabledText}>Competition not running</ThemedText>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TerminalColors.bgPanel,
  },
  
  content: {
    padding: 12,
  },
  
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  
  title: {
    fontSize: 12,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
    letterSpacing: 0.5,
  },
  
  oneClickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  
  oneClickLabel: {
    fontSize: 10,
    color: TerminalColors.textMuted,
  },
  
  toggle: {
    width: 32,
    height: 18,
    borderRadius: 9,
    backgroundColor: TerminalColors.bgElevated,
    padding: 2,
    justifyContent: "center",
  },
  
  toggleActive: {
    backgroundColor: TerminalColors.accent,
  },
  
  toggleKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: TerminalColors.textMuted,
  },
  
  toggleKnobActive: {
    backgroundColor: TerminalColors.textPrimary,
    marginLeft: "auto",
  },
  
  lotSizeSection: {
    marginBottom: 12,
  },
  
  inputLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: TerminalColors.textMuted,
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  
  lotSizeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  
  lotAdjustBtn: {
    width: 28,
    height: 28,
    borderRadius: TerminalRadius.sm,
    backgroundColor: TerminalColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: TerminalColors.border,
  },
  
  lotSizeInput: {
    flex: 1,
    backgroundColor: TerminalColors.bgInput,
    borderRadius: TerminalRadius.sm,
    paddingHorizontal: TerminalSpacing.md,
    paddingVertical: TerminalSpacing.sm,
    ...TerminalTypography.priceLarge,
    fontSize: 16,
    textAlign: "center",
    borderWidth: 1,
    borderColor: TerminalColors.border,
  },
  
  quickLotRow: {
    flexDirection: "row",
    marginTop: 6,
    gap: 4,
  },
  
  quickLotBtn: {
    flex: 1,
    paddingVertical: 5,
    alignItems: "center",
    backgroundColor: TerminalColors.bgElevated,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: TerminalColors.border,
  },
  
  quickLotBtnActive: {
    backgroundColor: "rgba(209, 75, 58, 0.15)",
    borderColor: TerminalColors.accent,
  },
  
  quickLotText: {
    fontSize: 10,
    fontWeight: "600",
    color: TerminalColors.textMuted,
  },
  
  quickLotTextActive: {
    color: TerminalColors.accent,
  },
  
  slTpRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  
  slTpField: {
    flex: 1,
  },
  
  slTpLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: TerminalColors.textMuted,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  
  slTpInput: {
    backgroundColor: TerminalColors.bgInput,
    borderRadius: TerminalRadius.sm,
    paddingHorizontal: TerminalSpacing.md,
    paddingVertical: TerminalSpacing.sm,
    ...TerminalTypography.price,
    fontSize: 11,
    borderWidth: 1,
    borderColor: TerminalColors.border,
    textAlign: "center",
  },
  
  tradeButtons: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 8,
    gap: 6,
  },
  
  tradeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 2,
  },
  
  tradeBtnActive: {
    borderWidth: 3,
  },
  
  sellBtn: {
    backgroundColor: "rgba(209, 75, 58, 0.1)",
    borderColor: TerminalColors.negative,
  },
  
  buyBtn: {
    backgroundColor: "rgba(22, 199, 132, 0.1)",
    borderColor: TerminalColors.positive,
  },
  
  tradeBtnPrice: {
    ...TerminalTypography.priceLarge,
    fontSize: 13,
    marginBottom: 1,
  },
  
  tradeBtnLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: TerminalColors.textSecondary,
    letterSpacing: 0.5,
  },
  
  spreadBadge: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  
  spreadValue: {
    ...TerminalTypography.price,
    fontSize: 10,
    color: TerminalColors.textMuted,
  },
  
  executeBtn: {
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  
  executeBtnBuy: {
    backgroundColor: TerminalColors.positive,
  },
  
  executeBtnSell: {
    backgroundColor: TerminalColors.negative,
  },
  
  executeBtnDisabled: {
    opacity: 0.5,
  },
  
  executeBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
    letterSpacing: 0.3,
  },
  
  disabledNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    backgroundColor: TerminalColors.bgElevated,
    borderRadius: 4,
  },
  
  disabledText: {
    fontSize: 10,
    color: TerminalColors.textMuted,
  },
});

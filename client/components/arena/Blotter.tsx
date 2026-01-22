import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { TerminalColors, TerminalTypography } from "@/components/terminal";

interface Position {
  id: string;
  pair: string;
  side: string;
  quantityUnits: number;
  avgEntryPrice: number;
  unrealizedPnlCents: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
}

interface PendingOrder {
  id: string;
  pair: string;
  side: string;
  type: string;
  quantityUnits: number;
  limitPrice?: number;
  stopPrice?: number;
}

interface Fill {
  id: string;
  pair: string;
  side: string;
  quantityUnits: number;
  fillPrice: number;
  realizedPnlCents?: number;
  filledAt: string;
}

interface BlotterProps {
  positions: Position[];
  pendingOrders: PendingOrder[];
  fills: Fill[];
  quotes: Record<string, { bid: number; ask: number }>;
  onClosePosition: (positionId: string) => void;
  onCancelOrder: (orderId: string) => void;
  formatPrice: (price: number, pair: string) => string;
  formatCurrency: (cents: number) => string;
  unitsToLots: (units: number) => number;
}

type BlotterTab = "positions" | "pending" | "closed" | "trades" | "deals" | "orders";

const TABS: { key: BlotterTab; label: string }[] = [
  { key: "positions", label: "Positions" },
  { key: "pending", label: "Pending" },
  { key: "closed", label: "Closed Positions" },
  { key: "trades", label: "Trades" },
  { key: "deals", label: "Deal History" },
  { key: "orders", label: "Order History" },
];

export function Blotter({
  positions,
  pendingOrders,
  fills,
  quotes,
  onClosePosition,
  onCancelOrder,
  formatPrice,
  formatCurrency,
  unitsToLots,
}: BlotterProps) {
  const [activeTab, setActiveTab] = useState<BlotterTab>("positions");
  
  const renderEmptyState = (message: string) => (
    <View style={styles.emptyState}>
      <Feather name="inbox" size={24} color={TerminalColors.textMuted} />
      <ThemedText style={styles.emptyStateText}>{message}</ThemedText>
    </View>
  );

  const renderPositionsTab = () => (
    <View style={styles.tableContainer}>
      <View style={styles.tableHeader}>
        <ThemedText style={[styles.headerCell, { flex: 0.8 }]}>Symbol</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 50 }]}>Side</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 60, textAlign: "right" }]}>Lots</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 80, textAlign: "right" }]}>Entry</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 80, textAlign: "right" }]}>Current</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 80, textAlign: "right" }]}>P&L</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 70, textAlign: "right" }]}>SL</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 70, textAlign: "right" }]}>TP</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 40 }]}></ThemedText>
      </View>
      <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={false}>
        {positions.length > 0 ? (
          positions.map((pos) => {
            const quote = quotes[pos.pair];
            const markPrice = pos.side === "buy" ? quote?.bid : quote?.ask;
            return (
              <View key={pos.id} style={styles.tableRow}>
                <ThemedText style={[styles.cellText, { flex: 0.8, fontWeight: "600" }]}>{pos.pair}</ThemedText>
                <View style={[styles.sideBadge, pos.side === "buy" ? styles.sideBadgeBuy : styles.sideBadgeSell, { width: 50 }]}>
                  <ThemedText style={styles.sideBadgeText}>{pos.side.toUpperCase()}</ThemedText>
                </View>
                <ThemedText style={[styles.cellTextMono, { width: 60, textAlign: "right" }]}>
                  {unitsToLots(pos.quantityUnits).toFixed(2)}
                </ThemedText>
                <ThemedText style={[styles.cellTextMono, { width: 80, textAlign: "right" }]}>
                  {formatPrice(pos.avgEntryPrice, pos.pair)}
                </ThemedText>
                <ThemedText style={[styles.cellTextMono, { width: 80, textAlign: "right" }]}>
                  {markPrice ? formatPrice(markPrice, pos.pair) : "—"}
                </ThemedText>
                <ThemedText style={[
                  styles.cellTextMono, 
                  { width: 80, textAlign: "right", fontWeight: "600" },
                  { color: pos.unrealizedPnlCents >= 0 ? TerminalColors.positive : TerminalColors.negative }
                ]}>
                  {pos.unrealizedPnlCents >= 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnlCents)}
                </ThemedText>
                <ThemedText style={[styles.cellTextMono, { width: 70, textAlign: "right", color: TerminalColors.textMuted }]}>
                  {pos.stopLossPrice ? formatPrice(pos.stopLossPrice, pos.pair) : "—"}
                </ThemedText>
                <ThemedText style={[styles.cellTextMono, { width: 70, textAlign: "right", color: TerminalColors.textMuted }]}>
                  {pos.takeProfitPrice ? formatPrice(pos.takeProfitPrice, pos.pair) : "—"}
                </ThemedText>
                <Pressable style={styles.closeBtn} onPress={() => onClosePosition(pos.id)}>
                  <Feather name="x" size={14} color={TerminalColors.negative} />
                </Pressable>
              </View>
            );
          })
        ) : renderEmptyState("No open positions")}
      </ScrollView>
    </View>
  );

  const renderPendingTab = () => (
    <View style={styles.tableContainer}>
      <View style={styles.tableHeader}>
        <ThemedText style={[styles.headerCell, { flex: 0.8 }]}>Symbol</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 50 }]}>Side</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 60 }]}>Type</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 60, textAlign: "right" }]}>Lots</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 80, textAlign: "right" }]}>Price</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 40 }]}></ThemedText>
      </View>
      <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={false}>
        {pendingOrders.length > 0 ? (
          pendingOrders.map((order) => (
            <View key={order.id} style={styles.tableRow}>
              <ThemedText style={[styles.cellText, { flex: 0.8, fontWeight: "600" }]}>{order.pair}</ThemedText>
              <View style={[styles.sideBadge, order.side === "buy" ? styles.sideBadgeBuy : styles.sideBadgeSell, { width: 50 }]}>
                <ThemedText style={styles.sideBadgeText}>{order.side.toUpperCase()}</ThemedText>
              </View>
              <View style={[styles.typeBadge, { width: 60 }]}>
                <ThemedText style={styles.typeBadgeText}>{order.type.toUpperCase()}</ThemedText>
              </View>
              <ThemedText style={[styles.cellTextMono, { width: 60, textAlign: "right" }]}>
                {unitsToLots(order.quantityUnits).toFixed(2)}
              </ThemedText>
              <ThemedText style={[styles.cellTextMono, { width: 80, textAlign: "right" }]}>
                {order.limitPrice 
                  ? formatPrice(order.limitPrice, order.pair) 
                  : order.stopPrice 
                    ? formatPrice(order.stopPrice, order.pair) 
                    : "—"}
              </ThemedText>
              <Pressable style={styles.closeBtn} onPress={() => onCancelOrder(order.id)}>
                <Feather name="x" size={14} color={TerminalColors.textMuted} />
              </Pressable>
            </View>
          ))
        ) : renderEmptyState("No pending orders")}
      </ScrollView>
    </View>
  );

  const renderClosedTab = () => (
    <View style={styles.tableContainer}>
      <View style={styles.tableHeader}>
        <ThemedText style={[styles.headerCell, { flex: 0.8 }]}>Symbol</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 50 }]}>Side</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 60, textAlign: "right" }]}>Lots</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 80, textAlign: "right" }]}>Price</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 80, textAlign: "right" }]}>P&L</ThemedText>
      </View>
      <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={false}>
        {fills.length > 0 ? (
          fills.slice(0, 20).map((fill) => (
            <View key={fill.id} style={styles.tableRow}>
              <ThemedText style={[styles.cellText, { flex: 0.8, fontWeight: "600" }]}>{fill.pair}</ThemedText>
              <View style={[styles.sideBadge, fill.side === "buy" ? styles.sideBadgeBuy : styles.sideBadgeSell, { width: 50 }]}>
                <ThemedText style={styles.sideBadgeText}>{fill.side.toUpperCase()}</ThemedText>
              </View>
              <ThemedText style={[styles.cellTextMono, { width: 60, textAlign: "right" }]}>
                {unitsToLots(fill.quantityUnits).toFixed(2)}
              </ThemedText>
              <ThemedText style={[styles.cellTextMono, { width: 80, textAlign: "right" }]}>
                {formatPrice(fill.fillPrice, fill.pair)}
              </ThemedText>
              <ThemedText style={[
                styles.cellTextMono, 
                { width: 80, textAlign: "right", fontWeight: "600" },
                { color: (fill.realizedPnlCents || 0) >= 0 ? TerminalColors.positive : TerminalColors.negative }
              ]}>
                {fill.realizedPnlCents !== undefined 
                  ? `${fill.realizedPnlCents >= 0 ? "+" : ""}${formatCurrency(fill.realizedPnlCents)}` 
                  : "—"}
              </ThemedText>
            </View>
          ))
        ) : renderEmptyState("No closed positions")}
      </ScrollView>
    </View>
  );

  const renderPlaceholderTab = (tabName: string) => (
    <View style={styles.tableContainer}>
      {renderEmptyState(`${tabName} - Coming soon`)}
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "positions":
        return renderPositionsTab();
      case "pending":
        return renderPendingTab();
      case "closed":
        return renderClosedTab();
      case "trades":
        return renderPlaceholderTab("Trades");
      case "deals":
        return renderPlaceholderTab("Deal History");
      case "orders":
        return renderPlaceholderTab("Order History");
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabList}
        >
          {TABS.map((tab) => {
            const count = tab.key === "positions" 
              ? positions.length 
              : tab.key === "pending" 
                ? pendingOrders.length 
                : tab.key === "closed" 
                  ? fills.length 
                  : 0;
                  
            return (
              <Pressable
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <ThemedText style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </ThemedText>
                {count > 0 ? (
                  <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
                    <ThemedText style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>
                      {count}
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {renderTabContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TerminalColors.bgPanel,
  },
  
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  
  tabList: {
    paddingHorizontal: 12,
  },
  
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  
  tabActive: {
    borderBottomColor: TerminalColors.accent,
  },
  
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    color: TerminalColors.textMuted,
  },
  
  tabTextActive: {
    color: TerminalColors.textPrimary,
  },
  
  tabBadge: {
    backgroundColor: TerminalColors.bgElevated,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  
  tabBadgeActive: {
    backgroundColor: TerminalColors.accent,
  },
  
  tabBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: TerminalColors.textMuted,
  },
  
  tabBadgeTextActive: {
    color: TerminalColors.textPrimary,
  },
  
  tableContainer: {
    flex: 1,
  },
  
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: TerminalColors.bgBase,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
    gap: 8,
  },
  
  headerCell: {
    fontSize: 9,
    fontWeight: "600",
    color: TerminalColors.textMuted,
    letterSpacing: 0.3,
  },
  
  tableBody: {
    flex: 1,
  },
  
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
    gap: 8,
  },
  
  cellText: {
    fontSize: 11,
    color: TerminalColors.textPrimary,
  },
  
  cellTextMono: {
    ...TerminalTypography.tableCell,
    color: TerminalColors.textSecondary,
  },
  
  sideBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignItems: "center",
  },
  
  sideBadgeBuy: {
    backgroundColor: "rgba(22, 199, 132, 0.2)",
  },
  
  sideBadgeSell: {
    backgroundColor: "rgba(209, 75, 58, 0.2)",
  },
  
  sideBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
    letterSpacing: 0.3,
  },
  
  typeBadge: {
    backgroundColor: "rgba(209, 75, 58, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignItems: "center",
  },
  
  typeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: TerminalColors.accent,
    letterSpacing: 0.3,
  },
  
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: "rgba(209, 75, 58, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  
  emptyStateText: {
    fontSize: 11,
    color: TerminalColors.textMuted,
    marginTop: 8,
  },
});

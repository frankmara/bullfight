import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EquityChart } from "./EquityChart";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface Competitor {
  rank: number;
  userId: string;
  username: string;
  returnPct: number;
  equityCents: number;
  drawdownPct: number;
  winRate: number;
  tradesCount: number;
}

interface CompetitorDrawerProps {
  visible: boolean;
  onClose: () => void;
  competitor: Competitor | null;
  competitionId: string;
}

type TabType = "summary" | "trades" | "deals" | "orders";

const TAB_OPTIONS: { key: TabType; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "trades", label: "Trades" },
  { key: "deals", label: "Deals" },
  { key: "orders", label: "Orders" },
];

const formatCurrency = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

export function CompetitorDrawer({
  visible,
  onClose,
  competitor,
  competitionId,
}: CompetitorDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>("summary");
  const [equityRange, setEquityRange] = useState("1W");
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = Platform.OS === "web" && windowWidth >= 768;
  const drawerWidth = isDesktop ? 450 : windowWidth;

  const { data: equityData, isLoading: equityLoading } = useQuery<{
    points: { time: number; value: number }[];
  }>({
    queryKey: [
      `/api/competitions/${competitionId}/competitors/${competitor?.userId}/equity`,
      equityRange,
    ],
    enabled: visible && !!competitor,
  });

  const { data: trades, isLoading: tradesLoading } = useQuery<any[]>({
    queryKey: [
      `/api/competitions/${competitionId}/competitors/${competitor?.userId}/trades`,
    ],
    enabled: visible && !!competitor && activeTab === "trades",
  });

  const { data: deals, isLoading: dealsLoading } = useQuery<any[]>({
    queryKey: [
      `/api/competitions/${competitionId}/competitors/${competitor?.userId}/deals`,
    ],
    enabled: visible && !!competitor && activeTab === "deals",
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: [
      `/api/competitions/${competitionId}/competitors/${competitor?.userId}/orders`,
    ],
    enabled: visible && !!competitor && activeTab === "orders",
  });

  if (!competitor) return null;

  const renderTabContent = () => {
    switch (activeTab) {
      case "summary":
        return (
          <View style={styles.summaryContent}>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Return</ThemedText>
                <ThemedText
                  style={[
                    styles.statValue,
                    {
                      color:
                        competitor.returnPct >= 0
                          ? Colors.dark.success
                          : Colors.dark.danger,
                    },
                  ]}
                >
                  {competitor.returnPct >= 0 ? "+" : ""}
                  {competitor.returnPct.toFixed(2)}%
                </ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Equity</ThemedText>
                <ThemedText style={styles.statValue}>
                  {formatCurrency(competitor.equityCents)}
                </ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Max Drawdown</ThemedText>
                <ThemedText
                  style={[styles.statValue, { color: Colors.dark.danger }]}
                >
                  {competitor.drawdownPct.toFixed(2)}%
                </ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Win Rate</ThemedText>
                <ThemedText style={styles.statValue}>
                  {competitor.winRate.toFixed(0)}%
                </ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Total Trades</ThemedText>
                <ThemedText style={styles.statValue}>
                  {competitor.tradesCount}
                </ThemedText>
              </View>
            </View>

            <View style={styles.chartSection}>
              <ThemedText style={styles.chartTitle}>Equity Curve</ThemedText>
              {equityLoading ? (
                <LoadingSpinner />
              ) : (
                <EquityChart
                  points={equityData?.points || []}
                  height={160}
                  selectedRange={equityRange}
                  onRangeChange={setEquityRange}
                />
              )}
            </View>
          </View>
        );

      case "trades":
        if (tradesLoading) {
          return (
            <View style={styles.loadingContainer}>
              <LoadingSpinner />
            </View>
          );
        }
        return (
          <ScrollView style={styles.tableContainer}>
            {trades && trades.length > 0 ? (
              trades.map((trade: any, index: number) => (
                <View
                  key={trade.id || index}
                  style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}
                >
                  <View style={styles.tradeRow}>
                    <View style={styles.tradeLeft}>
                      <ThemedText style={styles.tradeSymbol}>
                        {trade.pair}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.tradeSide,
                          {
                            color:
                              trade.side === "buy"
                                ? Colors.dark.success
                                : Colors.dark.danger,
                          },
                        ]}
                      >
                        {trade.side?.toUpperCase()}
                      </ThemedText>
                    </View>
                    <View style={styles.tradeRight}>
                      <ThemedText
                        style={[
                          styles.tradePnl,
                          {
                            color:
                              (trade.realizedPnlCents || 0) >= 0
                                ? Colors.dark.success
                                : Colors.dark.danger,
                          },
                        ]}
                      >
                        {formatCurrency(trade.realizedPnlCents || 0)}
                      </ThemedText>
                      <ThemedText style={styles.tradeLots}>
                        {trade.lots || (trade.volume / 100000).toFixed(2)} lots
                      </ThemedText>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>No trades yet</ThemedText>
              </View>
            )}
          </ScrollView>
        );

      case "deals":
        if (dealsLoading) {
          return (
            <View style={styles.loadingContainer}>
              <LoadingSpinner />
            </View>
          );
        }
        return (
          <ScrollView style={styles.tableContainer}>
            {deals && deals.length > 0 ? (
              deals.map((deal: any, index: number) => (
                <View
                  key={deal.id || index}
                  style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}
                >
                  <View style={styles.dealRow}>
                    <View>
                      <ThemedText style={styles.dealId}>
                        #{deal.id?.slice(-6) || index}
                      </ThemedText>
                      <ThemedText style={styles.dealSymbol}>
                        {deal.pair}
                      </ThemedText>
                    </View>
                    <View style={styles.dealRight}>
                      <ThemedText style={styles.dealPrice}>
                        @{deal.executionPrice?.toFixed(5)}
                      </ThemedText>
                      <ThemedText style={styles.dealVolume}>
                        {((deal.volume || 0) / 100000).toFixed(2)} lots
                      </ThemedText>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>No deals yet</ThemedText>
              </View>
            )}
          </ScrollView>
        );

      case "orders":
        if (ordersLoading) {
          return (
            <View style={styles.loadingContainer}>
              <LoadingSpinner />
            </View>
          );
        }
        return (
          <ScrollView style={styles.tableContainer}>
            {orders && orders.length > 0 ? (
              orders.map((order: any, index: number) => (
                <View
                  key={order.id || index}
                  style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}
                >
                  <View style={styles.orderRow}>
                    <View>
                      <ThemedText style={styles.orderSymbol}>
                        {order.pair}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.orderType,
                          {
                            color:
                              order.side === "buy"
                                ? Colors.dark.success
                                : Colors.dark.danger,
                          },
                        ]}
                      >
                        {order.type?.toUpperCase()} {order.side?.toUpperCase()}
                      </ThemedText>
                    </View>
                    <View style={styles.orderRight}>
                      <ThemedText style={styles.orderStatus}>
                        {order.status}
                      </ThemedText>
                      <ThemedText style={styles.orderVolume}>
                        {((order.requestedVolume || 0) / 100000).toFixed(2)} lots
                      </ThemedText>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>No orders yet</ThemedText>
              </View>
            )}
          </ScrollView>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType={isDesktop ? "fade" : "slide"}
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.drawer,
            isDesktop
              ? { width: drawerWidth, height: "100%", right: 0 }
              : { width: "100%", height: "85%", bottom: 0 },
            { paddingBottom: insets.bottom },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.rankBadge}>
                <ThemedText style={styles.rankText}>#{competitor.rank}</ThemedText>
              </View>
              <ThemedText style={styles.username}>{competitor.username}</ThemedText>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Feather name="x" size={24} color={Colors.dark.text} />
            </Pressable>
          </View>

          <View style={styles.tabs}>
            {TAB_OPTIONS.map((tab) => (
              <Pressable
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <ThemedText
                  style={[
                    styles.tabText,
                    activeTab === tab.key && styles.tabTextActive,
                  ]}
                >
                  {tab.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {renderTabContent()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  drawer: {
    position: "absolute",
    backgroundColor: Colors.dark.backgroundDefault,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: Platform.OS === "web" ? 0 : BorderRadius.xl,
    borderBottomLeftRadius: Platform.OS === "web" ? BorderRadius.xl : 0,
    ...(Platform.OS === "web"
      ? {
          boxShadow: "-4px 0 20px rgba(0,0,0,0.4)",
        }
      : {}),
  } as any,
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  rankBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.dark.gold,
    borderRadius: BorderRadius.sm,
  },
  rankText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.dark.backgroundRoot,
  },
  username: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.dark.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.dark.textSecondary,
  },
  tabTextActive: {
    color: Colors.dark.accent,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  summaryContent: {},
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  statItem: {
    minWidth: 100,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.text,
    fontFamily: "monospace",
  },
  chartSection: {
    marginTop: Spacing.md,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.md,
  },
  tableContainer: {
    flex: 1,
  },
  tableRow: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  tableRowAlt: {
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  tradeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tradeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  tradeSymbol: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  tradeSide: {
    fontSize: 12,
    fontWeight: "600",
  },
  tradeRight: {
    alignItems: "flex-end",
  },
  tradePnl: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  tradeLots: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  dealRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dealId: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontFamily: "monospace",
  },
  dealSymbol: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.dark.text,
  },
  dealRight: {
    alignItems: "flex-end",
  },
  dealPrice: {
    fontSize: 14,
    color: Colors.dark.text,
    fontFamily: "monospace",
  },
  dealVolume: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  orderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderSymbol: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  orderType: {
    fontSize: 12,
    fontWeight: "500",
  },
  orderRight: {
    alignItems: "flex-end",
  },
  orderStatus: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textTransform: "uppercase",
  },
  orderVolume: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
});

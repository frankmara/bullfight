import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  FlatList,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, SlideInRight } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { Leaderboard } from "@/components/Leaderboard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { TradingViewChart } from "@/components/TradingViewChart";
import { useAuthContext } from "@/context/AuthContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";

interface Quote {
  pair: string;
  bid: number;
  ask: number;
  timestamp: number;
}

interface Position {
  id: string;
  pair: string;
  side: string;
  quantityUnits: number;
  avgEntryPrice: number;
  unrealizedPnlCents: number;
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

interface ArenaData {
  competition: {
    id: string;
    title: string;
    status: string;
    startingBalanceCents: number;
    allowedPairsJson: string[];
    endAt?: string;
  };
  entry: {
    cashCents: number;
    equityCents: number;
    rank?: number;
  };
  positions: Position[];
  pendingOrders: PendingOrder[];
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userEmail: string;
  equityCents: number;
  returnPct: number;
}

export default function ArenaScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<RootStackParamList, "Arena">>();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const { id } = route.params;

  const [selectedPair, setSelectedPair] = useState("EUR-USD");
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit" | "stop">("market");
  const [quantity, setQuantity] = useState("10000");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const { data: arenaData, isLoading, refetch } = useQuery<ArenaData>({
    queryKey: ["/api/arena", id],
    refetchInterval: 2000,
  });

  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/competitions", id, "leaderboard"],
    refetchInterval: 5000,
  });

  useEffect(() => {
    const pairs = arenaData?.competition.allowedPairsJson || ["EUR-USD"];
    const interval = setInterval(() => {
      const newQuotes: Record<string, Quote> = {};
      pairs.forEach((pair) => {
        const basePrice = getBasePrice(pair);
        const spread = 0.0002;
        newQuotes[pair] = {
          pair,
          bid: basePrice - spread / 2 + (Math.random() - 0.5) * 0.0005,
          ask: basePrice + spread / 2 + (Math.random() - 0.5) * 0.0005,
          timestamp: Date.now(),
        };
      });
      setQuotes(newQuotes);
    }, 1000);

    return () => clearInterval(interval);
  }, [arenaData?.competition.allowedPairsJson]);

  const getBasePrice = (pair: string) => {
    const prices: Record<string, number> = {
      "EUR-USD": 1.0875,
      "GBP-USD": 1.2650,
      "USD-JPY": 149.50,
      "AUD-USD": 0.6520,
      "USD-CAD": 1.3580,
    };
    return prices[pair] || 1.0;
  };

  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const res = await apiRequest("POST", `/api/arena/${id}/orders`, orderData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/arena", id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setQuantity("10000");
      setLimitPrice("");
      setStopPrice("");
    },
    onError: (error: any) => {
      Alert.alert("Order Failed", error.message || "Failed to place order");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const closePositionMutation = useMutation({
    mutationFn: async (positionId: string) => {
      const res = await apiRequest("POST", `/api/arena/${id}/positions/${positionId}/close`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/arena", id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to close position");
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("POST", `/api/arena/${id}/orders/${orderId}/cancel`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/arena", id] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to cancel order");
    },
  });

  const handlePlaceOrder = () => {
    const orderData: any = {
      pair: selectedPair,
      side: orderSide,
      type: orderType,
      quantityUnits: parseInt(quantity, 10),
    };

    if (orderType === "limit" && limitPrice) {
      orderData.limitPrice = parseFloat(limitPrice);
    }
    if (orderType === "stop" && stopPrice) {
      orderData.stopPrice = parseFloat(stopPrice);
    }
    if (stopLoss) {
      orderData.stopLossPrice = parseFloat(stopLoss);
    }
    if (takeProfit) {
      orderData.takeProfitPrice = parseFloat(takeProfit);
    }

    placeOrderMutation.mutate(orderData);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <LoadingSpinner />
      </View>
    );
  }

  if (!arenaData) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ThemedText style={styles.errorText}>Arena not found</ThemedText>
      </View>
    );
  }

  const { competition, entry, positions, pendingOrders } = arenaData;
  const currentQuote = quotes[selectedPair];
  const formatPrice = (price: number) => {
    if (selectedPair.includes("JPY")) {
      return price.toFixed(3);
    }
    return price.toFixed(5);
  };

  const formatCurrency = (cents: number) =>
    `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const returnPct =
    ((entry.equityCents - competition.startingBalanceCents) /
      competition.startingBalanceCents) *
    100;

  const isTradeDisabled = competition.status !== "running";

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 60, paddingBottom: Spacing["3xl"] },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ThemedText style={styles.title} numberOfLines={1}>
              {competition.title}
            </ThemedText>
            <StatusBadge status={competition.status} />
          </View>
          <Pressable
            style={styles.leaderboardToggle}
            onPress={() => setShowLeaderboard(!showLeaderboard)}
          >
            <Feather
              name="bar-chart-2"
              size={20}
              color={showLeaderboard ? Colors.dark.accent : Colors.dark.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <ThemedText style={styles.statLabel}>Equity</ThemedText>
            <ThemedText style={styles.statValue}>
              {formatCurrency(entry.equityCents)}
            </ThemedText>
          </View>
          <View style={styles.statBox}>
            <ThemedText style={styles.statLabel}>Return</ThemedText>
            <ThemedText
              style={[
                styles.statValue,
                { color: returnPct >= 0 ? Colors.dark.success : Colors.dark.danger },
              ]}
            >
              {returnPct >= 0 ? "+" : ""}
              {returnPct.toFixed(2)}%
            </ThemedText>
          </View>
          <View style={styles.statBox}>
            <ThemedText style={styles.statLabel}>Rank</ThemedText>
            <ThemedText style={styles.statValue}>#{entry.rank || "-"}</ThemedText>
          </View>
        </View>

        {showLeaderboard && leaderboard ? (
          <Animated.View entering={SlideInRight} style={styles.leaderboardSection}>
            <Leaderboard
              entries={leaderboard}
              currentUserId={user?.id}
              startingBalanceCents={competition.startingBalanceCents}
            />
          </Animated.View>
        ) : null}

        <View style={styles.priceSection}>
          <View style={styles.pairSelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {competition.allowedPairsJson?.map((pair) => (
                <Pressable
                  key={pair}
                  style={[
                    styles.pairButton,
                    selectedPair === pair ? styles.pairButtonActive : null,
                  ]}
                  onPress={() => setSelectedPair(pair)}
                >
                  <ThemedText
                    style={[
                      styles.pairButtonText,
                      selectedPair === pair ? styles.pairButtonTextActive : null,
                    ]}
                  >
                    {pair}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {currentQuote ? (
            <View style={styles.quoteDisplay}>
              <View style={styles.quoteBox}>
                <ThemedText style={styles.quoteLabel}>BID</ThemedText>
                <ThemedText style={[styles.quotePrice, { color: Colors.dark.danger }]}>
                  {formatPrice(currentQuote.bid)}
                </ThemedText>
              </View>
              <View style={styles.spreadDisplay}>
                <ThemedText style={styles.spreadText}>
                  {((currentQuote.ask - currentQuote.bid) * 10000).toFixed(1)} pips
                </ThemedText>
              </View>
              <View style={styles.quoteBox}>
                <ThemedText style={styles.quoteLabel}>ASK</ThemedText>
                <ThemedText style={[styles.quotePrice, { color: Colors.dark.success }]}>
                  {formatPrice(currentQuote.ask)}
                </ThemedText>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.chartSection}>
          <TradingViewChart pair={selectedPair} height={350} />
        </View>

        <View style={styles.orderSection}>
          <ThemedText style={styles.sectionTitle}>Place Order</ThemedText>

          <View style={styles.sideSelector}>
            <Pressable
              style={[
                styles.sideButton,
                orderSide === "buy" ? styles.sideButtonBuy : null,
              ]}
              onPress={() => setOrderSide("buy")}
            >
              <ThemedText
                style={[
                  styles.sideButtonText,
                  orderSide === "buy" ? styles.sideButtonTextActive : null,
                ]}
              >
                BUY
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.sideButton,
                orderSide === "sell" ? styles.sideButtonSell : null,
              ]}
              onPress={() => setOrderSide("sell")}
            >
              <ThemedText
                style={[
                  styles.sideButtonText,
                  orderSide === "sell" ? styles.sideButtonTextActive : null,
                ]}
              >
                SELL
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.typeSelector}>
            {(["market", "limit", "stop"] as const).map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.typeButton,
                  orderType === type ? styles.typeButtonActive : null,
                ]}
                onPress={() => setOrderType(type)}
              >
                <ThemedText
                  style={[
                    styles.typeButtonText,
                    orderType === type ? styles.typeButtonTextActive : null,
                  ]}
                >
                  {type.toUpperCase()}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Units</ThemedText>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholderTextColor={Colors.dark.textMuted}
              />
            </View>
          </View>

          {orderType === "limit" && (
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Limit Price</ThemedText>
                <TextInput
                  style={styles.input}
                  value={limitPrice}
                  onChangeText={setLimitPrice}
                  keyboardType="decimal-pad"
                  placeholder={currentQuote ? formatPrice(currentQuote.bid) : ""}
                  placeholderTextColor={Colors.dark.textMuted}
                />
              </View>
            </View>
          )}

          {orderType === "stop" && (
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Stop Price</ThemedText>
                <TextInput
                  style={styles.input}
                  value={stopPrice}
                  onChangeText={setStopPrice}
                  keyboardType="decimal-pad"
                  placeholder={currentQuote ? formatPrice(currentQuote.ask) : ""}
                  placeholderTextColor={Colors.dark.textMuted}
                />
              </View>
            </View>
          )}

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { marginRight: Spacing.sm }]}>
              <ThemedText style={styles.inputLabel}>Stop Loss</ThemedText>
              <TextInput
                style={styles.input}
                value={stopLoss}
                onChangeText={setStopLoss}
                keyboardType="decimal-pad"
                placeholder="Optional"
                placeholderTextColor={Colors.dark.textMuted}
              />
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Take Profit</ThemedText>
              <TextInput
                style={styles.input}
                value={takeProfit}
                onChangeText={setTakeProfit}
                keyboardType="decimal-pad"
                placeholder="Optional"
                placeholderTextColor={Colors.dark.textMuted}
              />
            </View>
          </View>

          <Button
            onPress={handlePlaceOrder}
            disabled={isTradeDisabled || placeOrderMutation.isPending}
            style={[
              styles.orderButton,
              {
                backgroundColor:
                  orderSide === "buy" ? Colors.dark.success : Colors.dark.danger,
              },
            ]}
          >
            {placeOrderMutation.isPending
              ? "Placing..."
              : `${orderSide.toUpperCase()} ${quantity} ${selectedPair}`}
          </Button>

          {isTradeDisabled && (
            <ThemedText style={styles.disabledNote}>
              Trading is disabled - competition is not running
            </ThemedText>
          )}
        </View>

        {positions.length > 0 && (
          <View style={styles.positionsSection}>
            <ThemedText style={styles.sectionTitle}>Open Positions</ThemedText>
            {positions.map((pos) => (
              <View key={pos.id} style={styles.positionItem}>
                <View style={styles.positionHeader}>
                  <ThemedText style={styles.positionPair}>{pos.pair}</ThemedText>
                  <View
                    style={[
                      styles.positionSide,
                      {
                        backgroundColor:
                          pos.side === "buy"
                            ? `${Colors.dark.success}20`
                            : `${Colors.dark.danger}20`,
                      },
                    ]}
                  >
                    <ThemedText
                      style={{
                        color:
                          pos.side === "buy"
                            ? Colors.dark.success
                            : Colors.dark.danger,
                        fontSize: 11,
                        fontWeight: "600",
                      }}
                    >
                      {pos.side.toUpperCase()}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.positionDetails}>
                  <View style={styles.positionDetail}>
                    <ThemedText style={styles.positionDetailLabel}>Qty</ThemedText>
                    <ThemedText style={styles.positionDetailValue}>
                      {pos.quantityUnits.toLocaleString()}
                    </ThemedText>
                  </View>
                  <View style={styles.positionDetail}>
                    <ThemedText style={styles.positionDetailLabel}>Entry</ThemedText>
                    <ThemedText style={styles.positionDetailValue}>
                      {formatPrice(pos.avgEntryPrice)}
                    </ThemedText>
                  </View>
                  <View style={styles.positionDetail}>
                    <ThemedText style={styles.positionDetailLabel}>P&L</ThemedText>
                    <ThemedText
                      style={[
                        styles.positionDetailValue,
                        {
                          color:
                            pos.unrealizedPnlCents >= 0
                              ? Colors.dark.success
                              : Colors.dark.danger,
                        },
                      ]}
                    >
                      {pos.unrealizedPnlCents >= 0 ? "+" : ""}
                      {formatCurrency(pos.unrealizedPnlCents)}
                    </ThemedText>
                  </View>
                </View>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => closePositionMutation.mutate(pos.id)}
                >
                  <ThemedText style={styles.closeButtonText}>Close</ThemedText>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {pendingOrders.length > 0 && (
          <View style={styles.ordersSection}>
            <ThemedText style={styles.sectionTitle}>Pending Orders</ThemedText>
            {pendingOrders.map((order) => (
              <View key={order.id} style={styles.orderItem}>
                <View style={styles.orderHeader}>
                  <ThemedText style={styles.orderPair}>{order.pair}</ThemedText>
                  <ThemedText style={styles.orderType}>
                    {order.type.toUpperCase()}
                  </ThemedText>
                </View>
                <View style={styles.orderDetails}>
                  <ThemedText style={styles.orderDetailText}>
                    {order.side.toUpperCase()} {order.quantityUnits.toLocaleString()}
                  </ThemedText>
                  {order.limitPrice && (
                    <ThemedText style={styles.orderDetailText}>
                      @ {formatPrice(order.limitPrice)}
                    </ThemedText>
                  )}
                </View>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => cancelOrderMutation.mutate(order.id)}
                >
                  <Feather name="x" size={16} color={Colors.dark.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.dark.text,
    marginRight: Spacing.md,
    flex: 1,
  },
  leaderboardToggle: {
    padding: Spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundDefault,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.xs,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: "monospace",
  },
  leaderboardSection: {
    marginBottom: Spacing.lg,
  },
  priceSection: {
    marginBottom: Spacing.lg,
  },
  pairSelector: {
    marginBottom: Spacing.md,
  },
  pairButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dark.backgroundDefault,
    marginRight: Spacing.sm,
  },
  pairButtonActive: {
    backgroundColor: Colors.dark.accent,
  },
  pairButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  pairButtonTextActive: {
    color: Colors.dark.text,
  },
  quoteDisplay: {
    flexDirection: "row",
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  quoteBox: {
    flex: 1,
    alignItems: "center",
  },
  quoteLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.xs,
  },
  quotePrice: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  spreadDisplay: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
  },
  spreadText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  chartSection: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  orderSection: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.md,
  },
  sideSelector: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  sideButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    marginHorizontal: Spacing.xs,
  },
  sideButtonBuy: {
    backgroundColor: Colors.dark.success,
  },
  sideButtonSell: {
    backgroundColor: Colors.dark.danger,
  },
  sideButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.dark.textSecondary,
  },
  sideButtonTextActive: {
    color: Colors.dark.text,
  },
  typeSelector: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
  },
  typeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    marginHorizontal: Spacing.xs,
  },
  typeButtonActive: {
    backgroundColor: Colors.dark.accent,
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  typeButtonTextActive: {
    color: Colors.dark.text,
  },
  inputRow: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    color: Colors.dark.text,
    fontFamily: "monospace",
  },
  orderButton: {
    marginTop: Spacing.md,
  },
  disabledNote: {
    fontSize: 12,
    color: Colors.dark.warning,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  positionsSection: {
    marginBottom: Spacing.lg,
  },
  positionItem: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  positionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  positionPair: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  positionSide: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  positionDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  positionDetail: {
    alignItems: "center",
  },
  positionDetailLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
  },
  positionDetailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
    fontFamily: "monospace",
  },
  closeButton: {
    backgroundColor: Colors.dark.backgroundSecondary,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.danger,
  },
  ordersSection: {
    marginBottom: Spacing.lg,
  },
  orderItem: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  orderHeader: {
    flex: 1,
  },
  orderPair: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  orderType: {
    fontSize: 10,
    color: Colors.dark.textMuted,
  },
  orderDetails: {
    flex: 1,
  },
  orderDetailText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  cancelButton: {
    padding: Spacing.sm,
  },
});

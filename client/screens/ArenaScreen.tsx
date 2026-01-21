import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { SlideInRight } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { Leaderboard } from "@/components/Leaderboard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { TradingViewChart } from "@/components/TradingViewChart";
import { useAuthContext } from "@/context/AuthContext";
import { apiRequest } from "@/lib/query-client";
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

const DESKTOP_BREAKPOINT = 1024;
const TABLET_BREAKPOINT = 768;

export default function ArenaScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const route = useRoute<RouteProp<RootStackParamList, "Arena">>();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const { id } = route.params;

  const isDesktop = Platform.OS === "web" && width > DESKTOP_BREAKPOINT;
  const isTablet = Platform.OS === "web" && width > TABLET_BREAKPOINT && width <= DESKTOP_BREAKPOINT;
  const isMobile = !isDesktop && !isTablet;

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

  const { data: arenaData, isLoading } = useQuery<ArenaData>({
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
      "GBP-USD": 1.265,
      "USD-JPY": 149.5,
      "AUD-USD": 0.652,
      "USD-CAD": 1.358,
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
  
  const formatPrice = (price: number, pair?: string) => {
    const pairToCheck = pair || selectedPair;
    if (pairToCheck.includes("JPY")) {
      return price.toFixed(3);
    }
    return price.toFixed(5);
  };

  const formatCurrency = (cents: number) =>
    `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const returnPct =
    ((entry.equityCents - competition.startingBalanceCents) / competition.startingBalanceCents) * 100;

  const isTradeDisabled = competition.status !== "running";

  const renderTopHeader = () => (
    <View style={[styles.topHeader, { paddingTop: isMobile ? insets.top + Spacing.sm : Spacing.md }]}>
      <View style={styles.headerLeft}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {competition.title}
        </ThemedText>
        <StatusBadge status={competition.status} />
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>EQUITY</ThemedText>
          <ThemedText style={styles.statValue}>{formatCurrency(entry.equityCents)}</ThemedText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>RETURN</ThemedText>
          <ThemedText
            style={[styles.statValue, { color: returnPct >= 0 ? Colors.dark.success : Colors.dark.danger }]}
          >
            {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
          </ThemedText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>RANK</ThemedText>
          <ThemedText style={styles.statValue}>#{entry.rank || "-"}</ThemedText>
        </View>
        <Pressable style={styles.leaderboardBtn} onPress={() => setShowLeaderboard(!showLeaderboard)}>
          <Feather
            name="bar-chart-2"
            size={18}
            color={showLeaderboard ? Colors.dark.accent : Colors.dark.textSecondary}
          />
        </Pressable>
      </View>
    </View>
  );

  const renderInstrumentsSidebar = () => (
    <View style={[styles.instrumentsSidebar, isDesktop ? styles.sidebarDesktop : styles.sidebarMobile]}>
      {!isMobile ? (
        <ThemedText style={styles.sidebarTitle}>INSTRUMENTS</ThemedText>
      ) : null}
      <ScrollView
        horizontal={isMobile}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={isMobile ? styles.instrumentsHorizontal : undefined}
      >
        {competition.allowedPairsJson?.map((pair) => {
          const quote = quotes[pair];
          const isSelected = selectedPair === pair;
          return (
            <Pressable
              key={pair}
              style={[
                styles.instrumentItem,
                isSelected && styles.instrumentItemSelected,
                isMobile && styles.instrumentItemMobile,
              ]}
              onPress={() => setSelectedPair(pair)}
            >
              <ThemedText style={[styles.instrumentPair, isSelected && styles.instrumentPairSelected]}>
                {pair}
              </ThemedText>
              {quote && !isMobile ? (
                <View style={styles.instrumentPrices}>
                  <ThemedText style={[styles.instrumentBid, { color: Colors.dark.danger }]}>
                    {formatPrice(quote.bid, pair)}
                  </ThemedText>
                  <ThemedText style={[styles.instrumentAsk, { color: Colors.dark.success }]}>
                    {formatPrice(quote.ask, pair)}
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderOrderPanel = () => (
    <View style={[styles.orderPanel, isDesktop ? styles.orderPanelDesktop : styles.orderPanelMobile]}>
      <ThemedText style={styles.orderPanelTitle}>ORDER</ThemedText>
      
      {currentQuote ? (
        <View style={styles.quoteRow}>
          <View style={styles.quoteBlock}>
            <ThemedText style={styles.quoteLabel}>BID</ThemedText>
            <ThemedText style={[styles.quotePrice, { color: Colors.dark.danger }]}>
              {formatPrice(currentQuote.bid)}
            </ThemedText>
          </View>
          <View style={styles.spreadBlock}>
            <ThemedText style={styles.spreadText}>
              {((currentQuote.ask - currentQuote.bid) * 10000).toFixed(1)}
            </ThemedText>
            <ThemedText style={styles.spreadLabel}>SPREAD</ThemedText>
          </View>
          <View style={styles.quoteBlock}>
            <ThemedText style={styles.quoteLabel}>ASK</ThemedText>
            <ThemedText style={[styles.quotePrice, { color: Colors.dark.success }]}>
              {formatPrice(currentQuote.ask)}
            </ThemedText>
          </View>
        </View>
      ) : null}

      <View style={styles.sideButtons}>
        <Pressable
          style={[styles.sideBtn, orderSide === "buy" && styles.sideBtnBuyActive]}
          onPress={() => setOrderSide("buy")}
        >
          <ThemedText style={[styles.sideBtnText, orderSide === "buy" && styles.sideBtnTextActive]}>
            BUY
          </ThemedText>
          {currentQuote ? (
            <ThemedText style={[styles.sideBtnPrice, orderSide === "buy" && styles.sideBtnPriceActive]}>
              {formatPrice(currentQuote.ask)}
            </ThemedText>
          ) : null}
        </Pressable>
        <Pressable
          style={[styles.sideBtn, orderSide === "sell" && styles.sideBtnSellActive]}
          onPress={() => setOrderSide("sell")}
        >
          <ThemedText style={[styles.sideBtnText, orderSide === "sell" && styles.sideBtnTextActive]}>
            SELL
          </ThemedText>
          {currentQuote ? (
            <ThemedText style={[styles.sideBtnPrice, orderSide === "sell" && styles.sideBtnPriceActive]}>
              {formatPrice(currentQuote.bid)}
            </ThemedText>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.orderTypeRow}>
        {(["market", "limit", "stop"] as const).map((type) => (
          <Pressable
            key={type}
            style={[styles.orderTypeBtn, orderType === type && styles.orderTypeBtnActive]}
            onPress={() => setOrderType(type)}
          >
            <ThemedText style={[styles.orderTypeBtnText, orderType === type && styles.orderTypeBtnTextActive]}>
              {type.toUpperCase()}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.inputGroup}>
        <ThemedText style={styles.inputLabel}>QUANTITY (UNITS)</ThemedText>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          placeholderTextColor={Colors.dark.textMuted}
        />
      </View>

      {orderType === "limit" ? (
        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>LIMIT PRICE</ThemedText>
          <TextInput
            style={styles.input}
            value={limitPrice}
            onChangeText={setLimitPrice}
            keyboardType="decimal-pad"
            placeholder={currentQuote ? formatPrice(currentQuote.bid) : ""}
            placeholderTextColor={Colors.dark.textMuted}
          />
        </View>
      ) : null}

      {orderType === "stop" ? (
        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>STOP PRICE</ThemedText>
          <TextInput
            style={styles.input}
            value={stopPrice}
            onChangeText={setStopPrice}
            keyboardType="decimal-pad"
            placeholder={currentQuote ? formatPrice(currentQuote.ask) : ""}
            placeholderTextColor={Colors.dark.textMuted}
          />
        </View>
      ) : null}

      <View style={styles.slTpRow}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.xs }]}>
          <ThemedText style={styles.inputLabel}>SL</ThemedText>
          <TextInput
            style={styles.input}
            value={stopLoss}
            onChangeText={setStopLoss}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={Colors.dark.textMuted}
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.xs }]}>
          <ThemedText style={styles.inputLabel}>TP</ThemedText>
          <TextInput
            style={styles.input}
            value={takeProfit}
            onChangeText={setTakeProfit}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={Colors.dark.textMuted}
          />
        </View>
      </View>

      <Pressable
        style={[
          styles.submitBtn,
          { backgroundColor: orderSide === "buy" ? Colors.dark.success : Colors.dark.danger },
          (isTradeDisabled || placeOrderMutation.isPending) && styles.submitBtnDisabled,
        ]}
        onPress={handlePlaceOrder}
        disabled={isTradeDisabled || placeOrderMutation.isPending}
      >
        <ThemedText style={styles.submitBtnText}>
          {placeOrderMutation.isPending
            ? "PLACING..."
            : `${orderSide.toUpperCase()} ${parseInt(quantity || "0").toLocaleString()} ${selectedPair}`}
        </ThemedText>
      </Pressable>

      {isTradeDisabled ? (
        <ThemedText style={styles.disabledNote}>Competition not running</ThemedText>
      ) : null}
    </View>
  );

  const renderPositionsTable = () => (
    <View style={styles.positionsPanel}>
      <View style={styles.positionsHeader}>
        <ThemedText style={styles.positionsTitle}>POSITIONS</ThemedText>
        <ThemedText style={styles.positionsCount}>({positions.length})</ThemedText>
      </View>
      {positions.length > 0 ? (
        <ScrollView horizontal={isDesktop} showsHorizontalScrollIndicator={false}>
          <View style={isDesktop ? styles.positionsTable : undefined}>
            {isDesktop ? (
              <View style={styles.tableHeader}>
                <ThemedText style={[styles.tableHeaderCell, { width: 100 }]}>PAIR</ThemedText>
                <ThemedText style={[styles.tableHeaderCell, { width: 60 }]}>SIDE</ThemedText>
                <ThemedText style={[styles.tableHeaderCell, { width: 100 }]}>QTY</ThemedText>
                <ThemedText style={[styles.tableHeaderCell, { width: 100 }]}>ENTRY</ThemedText>
                <ThemedText style={[styles.tableHeaderCell, { width: 100 }]}>P&L</ThemedText>
                <ThemedText style={[styles.tableHeaderCell, { width: 80 }]}>ACTION</ThemedText>
              </View>
            ) : null}
            {positions.map((pos) => (
              <View key={pos.id} style={isDesktop ? styles.tableRow : styles.positionCard}>
                {isDesktop ? (
                  <>
                    <ThemedText style={[styles.tableCell, { width: 100 }]}>{pos.pair}</ThemedText>
                    <View style={[styles.tableCell, { width: 60 }]}>
                      <View
                        style={[
                          styles.sideBadge,
                          { backgroundColor: pos.side === "buy" ? `${Colors.dark.success}20` : `${Colors.dark.danger}20` },
                        ]}
                      >
                        <ThemedText
                          style={[styles.sideBadgeText, { color: pos.side === "buy" ? Colors.dark.success : Colors.dark.danger }]}
                        >
                          {pos.side.toUpperCase()}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText style={[styles.tableCell, { width: 100 }]}>
                      {pos.quantityUnits.toLocaleString()}
                    </ThemedText>
                    <ThemedText style={[styles.tableCell, styles.monoText, { width: 100 }]}>
                      {formatPrice(pos.avgEntryPrice, pos.pair)}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.tableCell,
                        styles.monoText,
                        { width: 100, color: pos.unrealizedPnlCents >= 0 ? Colors.dark.success : Colors.dark.danger },
                      ]}
                    >
                      {pos.unrealizedPnlCents >= 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnlCents)}
                    </ThemedText>
                    <View style={[styles.tableCell, { width: 80 }]}>
                      <Pressable style={styles.closeBtn} onPress={() => closePositionMutation.mutate(pos.id)}>
                        <ThemedText style={styles.closeBtnText}>CLOSE</ThemedText>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.positionCardHeader}>
                      <ThemedText style={styles.positionCardPair}>{pos.pair}</ThemedText>
                      <View
                        style={[
                          styles.sideBadge,
                          { backgroundColor: pos.side === "buy" ? `${Colors.dark.success}20` : `${Colors.dark.danger}20` },
                        ]}
                      >
                        <ThemedText
                          style={[styles.sideBadgeText, { color: pos.side === "buy" ? Colors.dark.success : Colors.dark.danger }]}
                        >
                          {pos.side.toUpperCase()}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.positionCardRow}>
                      <View style={styles.positionCardItem}>
                        <ThemedText style={styles.positionCardLabel}>Qty</ThemedText>
                        <ThemedText style={styles.positionCardValue}>{pos.quantityUnits.toLocaleString()}</ThemedText>
                      </View>
                      <View style={styles.positionCardItem}>
                        <ThemedText style={styles.positionCardLabel}>Entry</ThemedText>
                        <ThemedText style={[styles.positionCardValue, styles.monoText]}>
                          {formatPrice(pos.avgEntryPrice, pos.pair)}
                        </ThemedText>
                      </View>
                      <View style={styles.positionCardItem}>
                        <ThemedText style={styles.positionCardLabel}>P&L</ThemedText>
                        <ThemedText
                          style={[
                            styles.positionCardValue,
                            styles.monoText,
                            { color: pos.unrealizedPnlCents >= 0 ? Colors.dark.success : Colors.dark.danger },
                          ]}
                        >
                          {pos.unrealizedPnlCents >= 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnlCents)}
                        </ThemedText>
                      </View>
                    </View>
                    <Pressable style={styles.positionCardCloseBtn} onPress={() => closePositionMutation.mutate(pos.id)}>
                      <ThemedText style={styles.closeBtnText}>CLOSE POSITION</ThemedText>
                    </Pressable>
                  </>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ThemedText style={styles.emptyText}>No open positions</ThemedText>
      )}
    </View>
  );

  const renderOrdersTable = () => (
    <View style={styles.ordersPanel}>
      <View style={styles.positionsHeader}>
        <ThemedText style={styles.positionsTitle}>PENDING ORDERS</ThemedText>
        <ThemedText style={styles.positionsCount}>({pendingOrders.length})</ThemedText>
      </View>
      {pendingOrders.length > 0 ? (
        <ScrollView horizontal={isDesktop} showsHorizontalScrollIndicator={false}>
          <View style={isDesktop ? styles.positionsTable : undefined}>
            {isDesktop ? (
              <View style={styles.tableHeader}>
                <ThemedText style={[styles.tableHeaderCell, { width: 100 }]}>PAIR</ThemedText>
                <ThemedText style={[styles.tableHeaderCell, { width: 70 }]}>TYPE</ThemedText>
                <ThemedText style={[styles.tableHeaderCell, { width: 60 }]}>SIDE</ThemedText>
                <ThemedText style={[styles.tableHeaderCell, { width: 100 }]}>QTY</ThemedText>
                <ThemedText style={[styles.tableHeaderCell, { width: 100 }]}>PRICE</ThemedText>
                <ThemedText style={[styles.tableHeaderCell, { width: 80 }]}>ACTION</ThemedText>
              </View>
            ) : null}
            {pendingOrders.map((order) => (
              <View key={order.id} style={isDesktop ? styles.tableRow : styles.orderCard}>
                {isDesktop ? (
                  <>
                    <ThemedText style={[styles.tableCell, { width: 100 }]}>{order.pair}</ThemedText>
                    <ThemedText style={[styles.tableCell, { width: 70, color: Colors.dark.accent }]}>
                      {order.type.toUpperCase()}
                    </ThemedText>
                    <View style={[styles.tableCell, { width: 60 }]}>
                      <View
                        style={[
                          styles.sideBadge,
                          { backgroundColor: order.side === "buy" ? `${Colors.dark.success}20` : `${Colors.dark.danger}20` },
                        ]}
                      >
                        <ThemedText
                          style={[styles.sideBadgeText, { color: order.side === "buy" ? Colors.dark.success : Colors.dark.danger }]}
                        >
                          {order.side.toUpperCase()}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText style={[styles.tableCell, { width: 100 }]}>
                      {order.quantityUnits.toLocaleString()}
                    </ThemedText>
                    <ThemedText style={[styles.tableCell, styles.monoText, { width: 100 }]}>
                      {order.limitPrice ? formatPrice(order.limitPrice, order.pair) : order.stopPrice ? formatPrice(order.stopPrice, order.pair) : "—"}
                    </ThemedText>
                    <View style={[styles.tableCell, { width: 80 }]}>
                      <Pressable style={styles.cancelBtn} onPress={() => cancelOrderMutation.mutate(order.id)}>
                        <Feather name="x" size={14} color={Colors.dark.danger} />
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.orderCardHeader}>
                      <ThemedText style={styles.orderCardPair}>{order.pair}</ThemedText>
                      <ThemedText style={styles.orderCardType}>{order.type.toUpperCase()}</ThemedText>
                    </View>
                    <View style={styles.orderCardRow}>
                      <ThemedText
                        style={{ color: order.side === "buy" ? Colors.dark.success : Colors.dark.danger, fontWeight: "600" }}
                      >
                        {order.side.toUpperCase()}
                      </ThemedText>
                      <ThemedText style={styles.orderCardQty}>{order.quantityUnits.toLocaleString()} units</ThemedText>
                      {order.limitPrice || order.stopPrice ? (
                        <ThemedText style={[styles.orderCardPrice, styles.monoText]}>
                          @ {formatPrice(order.limitPrice || order.stopPrice!, order.pair)}
                        </ThemedText>
                      ) : null}
                    </View>
                    <Pressable style={styles.orderCardCancelBtn} onPress={() => cancelOrderMutation.mutate(order.id)}>
                      <Feather name="x" size={16} color={Colors.dark.danger} />
                      <ThemedText style={styles.cancelBtnText}>CANCEL</ThemedText>
                    </Pressable>
                  </>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ThemedText style={styles.emptyText}>No pending orders</ThemedText>
      )}
    </View>
  );

  if (isDesktop) {
    return (
      <View style={styles.container}>
        {renderTopHeader()}
        {showLeaderboard && leaderboard ? (
          <Animated.View entering={SlideInRight} style={styles.leaderboardOverlay}>
            <Leaderboard
              entries={leaderboard}
              currentUserId={user?.id}
              startingBalanceCents={competition.startingBalanceCents}
            />
          </Animated.View>
        ) : null}
        <View style={styles.desktopMain}>
          {renderInstrumentsSidebar()}
          <View style={styles.desktopCenter}>
            <View style={styles.chartContainer}>
              <TradingViewChart pair={selectedPair} height={Math.max(400, (width - 540) * 0.4)} />
            </View>
          </View>
          {renderOrderPanel()}
        </View>
        <View style={styles.desktopBottom}>
          {renderPositionsTable()}
          {renderOrdersTable()}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.mobileContent, { paddingBottom: insets.bottom + Spacing["3xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        {renderTopHeader()}
        {showLeaderboard && leaderboard ? (
          <Animated.View entering={SlideInRight} style={styles.leaderboardSection}>
            <Leaderboard
              entries={leaderboard}
              currentUserId={user?.id}
              startingBalanceCents={competition.startingBalanceCents}
            />
          </Animated.View>
        ) : null}
        {renderInstrumentsSidebar()}
        <View style={styles.mobileChartContainer}>
          <TradingViewChart pair={selectedPair} height={300} />
        </View>
        {renderOrderPanel()}
        {renderPositionsTable()}
        {renderOrdersTable()}
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
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.dark.backgroundDefault,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.text,
    marginRight: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: Spacing.md,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.dark.text,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.dark.border,
  },
  leaderboardBtn: {
    marginLeft: Spacing.md,
    padding: Spacing.sm,
  },
  instrumentsSidebar: {
    backgroundColor: Colors.dark.backgroundDefault,
  },
  sidebarDesktop: {
    width: 180,
    borderRightWidth: 1,
    borderRightColor: Colors.dark.border,
    paddingVertical: Spacing.md,
  },
  sidebarMobile: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  sidebarTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  instrumentsHorizontal: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  instrumentItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: "transparent",
  },
  instrumentItemMobile: {
    borderLeftWidth: 0,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  instrumentItemSelected: {
    backgroundColor: `${Colors.dark.accent}10`,
    borderLeftColor: Colors.dark.accent,
  },
  instrumentPair: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  instrumentPairSelected: {
    color: Colors.dark.text,
  },
  instrumentPrices: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  instrumentBid: {
    fontSize: 11,
    fontFamily: "monospace",
  },
  instrumentAsk: {
    fontSize: 11,
    fontFamily: "monospace",
  },
  orderPanel: {
    backgroundColor: Colors.dark.backgroundDefault,
    padding: Spacing.md,
  },
  orderPanelDesktop: {
    width: 280,
    borderLeftWidth: 1,
    borderLeftColor: Colors.dark.border,
  },
  orderPanelMobile: {
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  orderPanelTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  quoteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  quoteBlock: {
    alignItems: "center",
  },
  quoteLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    marginBottom: 2,
  },
  quotePrice: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  spreadBlock: {
    alignItems: "center",
  },
  spreadText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  spreadLabel: {
    fontSize: 8,
    color: Colors.dark.textMuted,
  },
  sideButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sideBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  sideBtnBuyActive: {
    backgroundColor: Colors.dark.success,
    borderColor: Colors.dark.success,
  },
  sideBtnSellActive: {
    backgroundColor: Colors.dark.danger,
    borderColor: Colors.dark.danger,
  },
  sideBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.dark.textSecondary,
  },
  sideBtnTextActive: {
    color: Colors.dark.text,
  },
  sideBtnPrice: {
    fontSize: 11,
    fontFamily: "monospace",
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  sideBtnPriceActive: {
    color: Colors.dark.text,
    opacity: 0.8,
  },
  orderTypeRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  orderTypeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  orderTypeBtnActive: {
    backgroundColor: Colors.dark.accent,
  },
  orderTypeBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  orderTypeBtnTextActive: {
    color: Colors.dark.text,
  },
  inputGroup: {
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.dark.backgroundRoot,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: Colors.dark.text,
    fontFamily: "monospace",
  },
  slTpRow: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  submitBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  disabledNote: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  desktopMain: {
    flex: 1,
    flexDirection: "row",
  },
  desktopCenter: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  chartContainer: {
    flex: 1,
    padding: Spacing.sm,
  },
  mobileChartContainer: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    backgroundColor: Colors.dark.backgroundRoot,
  },
  desktopBottom: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    maxHeight: 250,
  },
  positionsPanel: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundDefault,
    padding: Spacing.md,
    borderRightWidth: 1,
    borderRightColor: Colors.dark.border,
  },
  ordersPanel: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundDefault,
    padding: Spacing.md,
  },
  positionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  positionsTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    letterSpacing: 0.5,
  },
  positionsCount: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginLeft: Spacing.xs,
  },
  positionsTable: {
    minWidth: 540,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  tableCell: {
    fontSize: 12,
    color: Colors.dark.text,
  },
  monoText: {
    fontFamily: "monospace",
  },
  sideBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  sideBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  closeBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: `${Colors.dark.danger}20`,
    borderRadius: BorderRadius.xs,
  },
  closeBtnText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.dark.danger,
  },
  cancelBtn: {
    padding: Spacing.xs,
    backgroundColor: `${Colors.dark.danger}10`,
    borderRadius: BorderRadius.xs,
  },
  cancelBtnText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.dark.danger,
    marginLeft: Spacing.xs,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontStyle: "italic",
  },
  mobileContent: {
    paddingHorizontal: 0,
  },
  leaderboardOverlay: {
    position: "absolute",
    top: 60,
    right: Spacing.lg,
    zIndex: 100,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.md,
    maxWidth: 400,
    maxHeight: 400,
  },
  leaderboardSection: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.md,
  },
  positionCard: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    marginHorizontal: Spacing.md,
  },
  positionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  positionCardPair: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  positionCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  positionCardItem: {
    alignItems: "center",
  },
  positionCardLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    marginBottom: 2,
  },
  positionCardValue: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  positionCardCloseBtn: {
    backgroundColor: `${Colors.dark.danger}20`,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
  },
  orderCard: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    marginHorizontal: Spacing.md,
  },
  orderCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  orderCardPair: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  orderCardType: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.accent,
  },
  orderCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  orderCardQty: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  orderCardPrice: {
    fontSize: 12,
    color: Colors.dark.text,
  },
  orderCardCancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${Colors.dark.danger}10`,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
});

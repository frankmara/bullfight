import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  withSequence,
  runOnJS,
} from "react-native-reanimated";

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
  prevBid?: number;
  prevAsk?: number;
}

interface Position {
  id: string;
  pair: string;
  side: string;
  quantityUnits: number;
  avgEntryPrice: number;
  unrealizedPnlCents: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  openedAt?: string;
}

interface PendingOrder {
  id: string;
  pair: string;
  side: string;
  type: string;
  quantityUnits: number;
  limitPrice?: number;
  stopPrice?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  createdAt?: string;
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

interface ArenaData {
  competition: {
    id: string;
    title: string;
    status: string;
    startingBalanceCents: number;
    allowedPairsJson: string[];
    endAt?: string;
    startAt?: string;
  };
  entry: {
    cashCents: number;
    equityCents: number;
    maxEquityCents: number;
    maxDrawdownPct: number;
    rank?: number;
  };
  positions: Position[];
  pendingOrders: PendingOrder[];
  fills?: Fill[];
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

const QUICK_LOT_SIZES = [0.01, 0.05, 0.1, 0.5, 1.0];
const UNITS_PER_LOT = 100000;

function lotsToUnits(lots: number): number {
  return Math.round(lots * UNITS_PER_LOT);
}

function unitsToLots(units: number): number {
  return Math.round((units / UNITS_PER_LOT) * 100) / 100;
}

function formatLots(lots: number): string {
  return lots >= 0.01 ? lots.toFixed(2) : (lots * 1000).toFixed(1) + 'K';
}

type BlotterTab = "positions" | "orders" | "history";

export default function ArenaScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const route = useRoute<RouteProp<RootStackParamList, "Arena">>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const { id } = route.params;

  const isDesktop = Platform.OS === "web" && width > DESKTOP_BREAKPOINT;
  const isTablet = Platform.OS === "web" && width > TABLET_BREAKPOINT && width <= DESKTOP_BREAKPOINT;
  const isMobile = !isDesktop && !isTablet;

  const [selectedPair, setSelectedPair] = useState("EUR-USD");
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit" | "stop">("market");
  const [lotSize, setLotSize] = useState("0.1");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [oneClickTrading, setOneClickTrading] = useState(false);
  const [watchlistSearch, setWatchlistSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeBlotterTab, setActiveBlotterTab] = useState<BlotterTab>("positions");
  const [timeRemaining, setTimeRemaining] = useState("");
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const toastOpacity = useSharedValue(0);
  const searchInputRef = useRef<TextInput>(null);

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
      setQuotes((prevQuotes) => {
        const newQuotes: Record<string, Quote> = {};
        pairs.forEach((pair) => {
          const basePrice = getBasePrice(pair);
          const spread = 0.0002;
          const prevQuote = prevQuotes[pair];
          newQuotes[pair] = {
            pair,
            bid: basePrice - spread / 2 + (Math.random() - 0.5) * 0.0005,
            ask: basePrice + spread / 2 + (Math.random() - 0.5) * 0.0005,
            timestamp: Date.now(),
            prevBid: prevQuote?.bid,
            prevAsk: prevQuote?.ask,
          };
        });
        return newQuotes;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [arenaData?.competition.allowedPairsJson]);

  useEffect(() => {
    if (!arenaData?.competition.endAt) return;
    
    const updateTimer = () => {
      const endTime = new Date(arenaData.competition.endAt!).getTime();
      const now = Date.now();
      const diff = endTime - now;
      
      if (diff <= 0) {
        setTimeRemaining("ENDED");
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeRemaining(`${days}d ${hours % 24}h`);
      } else {
        setTimeRemaining(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [arenaData?.competition.endAt]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    toastOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(1, { duration: 2000 }),
      withTiming(0, { duration: 300 })
    );
    setTimeout(() => setToast(null), 2500);
  }, [toastOpacity]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      
      switch (e.key.toLowerCase()) {
        case 'b':
          setOrderSide('buy');
          showToast('BUY selected', 'info');
          break;
        case 's':
          setOrderSide('sell');
          showToast('SELL selected', 'info');
          break;
        case 'escape':
          setShowLeaderboard(false);
          break;
        case 'k':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            searchInputRef.current?.focus();
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showToast]);

  const toastAnimatedStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
  }));

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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/arena", id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const lotsStr = variables.lots ? variables.lots.toFixed(2) : formatLots(unitsToLots(variables.quantityUnits || 0));
      showToast(`Order placed: ${variables.side.toUpperCase()} ${lotsStr} lots ${variables.pair}`, 'success');
      setLotSize("0.1");
      setLimitPrice("");
      setStopPrice("");
      setStopLoss("");
      setTakeProfit("");
    },
    onError: (error: any) => {
      showToast(error.message || "Failed to place order", 'error');
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
      showToast('Position closed', 'success');
    },
    onError: (error: any) => {
      showToast(error.message || "Failed to close position", 'error');
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
      showToast('Order cancelled', 'info');
    },
    onError: (error: any) => {
      showToast(error.message || "Failed to cancel order", 'error');
    },
  });

  const handlePlaceOrder = useCallback(() => {
    const lots = parseFloat(lotSize) || 0.1;
    const orderData: any = {
      pair: selectedPair,
      side: orderSide,
      type: orderType,
      lots: lots,
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

    if (oneClickTrading) {
      placeOrderMutation.mutate(orderData);
    } else {
      const quote = quotes[selectedPair];
      const fillPrice = orderSide === "buy" ? quote?.ask : quote?.bid;
      Alert.alert(
        "Confirm Order",
        `${orderSide.toUpperCase()} ${lots.toFixed(2)} lots ${selectedPair}\nEstimated fill: ${fillPrice?.toFixed(5) || "N/A"}`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Confirm", onPress: () => placeOrderMutation.mutate(orderData) },
        ]
      );
    }
  }, [selectedPair, orderSide, orderType, lotSize, limitPrice, stopPrice, stopLoss, takeProfit, oneClickTrading, quotes, placeOrderMutation]);

  const toggleFavorite = (pair: string) => {
    setFavorites((prev) =>
      prev.includes(pair) ? prev.filter((p) => p !== pair) : [...prev, pair]
    );
  };

  const filteredPairs = useMemo(() => {
    const pairs = arenaData?.competition.allowedPairsJson || [];
    if (!watchlistSearch) return pairs;
    return pairs.filter((p) => p.toLowerCase().includes(watchlistSearch.toLowerCase()));
  }, [arenaData?.competition.allowedPairsJson, watchlistSearch]);

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
  const fills = arenaData.fills || [];
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

  const unrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnlCents, 0);
  const returnPct =
    ((entry.equityCents - competition.startingBalanceCents) / competition.startingBalanceCents) * 100;
  const balance = entry.cashCents;
  const equity = entry.equityCents;
  const drawdownPct = entry.maxDrawdownPct || 0;

  const isTradeDisabled = competition.status !== "running";

  const renderTopHeader = () => (
    <View style={[styles.topHeader, { paddingTop: isMobile ? insets.top : 0 }]}>
      <View style={styles.headerSection}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={18} color={Colors.dark.textSecondary} />
        </Pressable>
        <View style={styles.competitionInfo}>
          <ThemedText style={styles.competitionTitle} numberOfLines={1}>
            {competition.title}
          </ThemedText>
          <View style={styles.competitionMeta}>
            <StatusBadge status={competition.status} />
            {timeRemaining ? (
              <View style={styles.timerBadge}>
                <Feather name="clock" size={12} color={Colors.dark.textSecondary} />
                <ThemedText style={styles.timerText}>{timeRemaining}</ThemedText>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {isDesktop || isTablet ? (
        <View style={styles.symbolDisplay}>
          <ThemedText style={styles.symbolText}>{selectedPair}</ThemedText>
          {currentQuote ? (
            <View style={styles.livePrices}>
              <View style={styles.priceBlock}>
                <ThemedText style={styles.priceLabel}>BID</ThemedText>
                <ThemedText style={[styles.priceValue, styles.bidPrice]}>
                  {formatPrice(currentQuote.bid)}
                </ThemedText>
              </View>
              <View style={styles.spreadBadge}>
                <ThemedText style={styles.spreadValue}>
                  {((currentQuote.ask - currentQuote.bid) * 10000).toFixed(1)}
                </ThemedText>
              </View>
              <View style={styles.priceBlock}>
                <ThemedText style={styles.priceLabel}>ASK</ThemedText>
                <ThemedText style={[styles.priceValue, styles.askPrice]}>
                  {formatPrice(currentQuote.ask)}
                </ThemedText>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <ThemedText style={styles.metricLabel}>BALANCE</ThemedText>
          <ThemedText style={styles.metricValue}>{formatCurrency(balance)}</ThemedText>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <ThemedText style={styles.metricLabel}>EQUITY</ThemedText>
          <ThemedText style={styles.metricValue}>{formatCurrency(equity)}</ThemedText>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <ThemedText style={styles.metricLabel}>P&L</ThemedText>
          <ThemedText style={[styles.metricValue, { color: unrealizedPnl >= 0 ? Colors.dark.success : Colors.dark.danger }]}>
            {unrealizedPnl >= 0 ? "+" : ""}{formatCurrency(unrealizedPnl)}
          </ThemedText>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <ThemedText style={styles.metricLabel}>RETURN</ThemedText>
          <ThemedText style={[styles.metricValue, { color: returnPct >= 0 ? Colors.dark.success : Colors.dark.danger }]}>
            {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
          </ThemedText>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <ThemedText style={styles.metricLabel}>RANK</ThemedText>
          <ThemedText style={[styles.metricValue, styles.rankValue]}>#{entry.rank || "-"}</ThemedText>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <ThemedText style={styles.metricLabel}>DD</ThemedText>
          <ThemedText style={[styles.metricValue, { color: Colors.dark.danger }]}>
            -{drawdownPct.toFixed(1)}%
          </ThemedText>
        </View>
        <Pressable style={styles.leaderboardBtn} onPress={() => setShowLeaderboard(!showLeaderboard)}>
          <Feather name="bar-chart-2" size={16} color={showLeaderboard ? Colors.dark.accent : Colors.dark.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  const renderWatchlist = () => (
    <View style={[styles.watchlist, isDesktop ? styles.watchlistDesktop : styles.watchlistMobile]}>
      <View style={styles.watchlistHeader}>
        <ThemedText style={styles.watchlistTitle}>WATCHLIST</ThemedText>
      </View>
      {isDesktop ? (
        <View style={styles.searchContainer}>
          <Feather name="search" size={14} color={Colors.dark.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={watchlistSearch}
            onChangeText={setWatchlistSearch}
            placeholder="Search..."
            placeholderTextColor={Colors.dark.textMuted}
          />
        </View>
      ) : null}
      <ScrollView
        horizontal={isMobile}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={isMobile ? styles.watchlistHorizontal : undefined}
      >
        {filteredPairs.map((pair) => {
          const quote = quotes[pair];
          const isSelected = selectedPair === pair;
          const isFavorite = favorites.includes(pair);
          const bidUp = quote && quote.prevBid ? quote.bid > quote.prevBid : false;
          const bidDown = quote && quote.prevBid ? quote.bid < quote.prevBid : false;

          return (
            <Pressable
              key={pair}
              style={[
                styles.watchlistItem,
                isSelected && styles.watchlistItemSelected,
                isMobile && styles.watchlistItemMobile,
              ]}
              onPress={() => setSelectedPair(pair)}
            >
              <View style={styles.watchlistItemLeft}>
                {isDesktop ? (
                  <Pressable onPress={() => toggleFavorite(pair)} style={styles.favoriteBtn}>
                    <Feather
                      name="star"
                      size={12}
                      color={isFavorite ? Colors.dark.accent : Colors.dark.textMuted}
                      fill={isFavorite ? Colors.dark.accent : "transparent"}
                    />
                  </Pressable>
                ) : null}
                <ThemedText style={[styles.watchlistPair, isSelected && styles.watchlistPairSelected]}>
                  {pair}
                </ThemedText>
              </View>
              {quote && !isMobile ? (
                <View style={styles.watchlistPrices}>
                  <View style={styles.watchlistPriceRow}>
                    <ThemedText style={[styles.watchlistBid, bidUp && styles.priceUp, bidDown && styles.priceDown]}>
                      {formatPrice(quote.bid, pair)}
                    </ThemedText>
                    {bidUp ? (
                      <Feather name="arrow-up" size={10} color={Colors.dark.success} />
                    ) : bidDown ? (
                      <Feather name="arrow-down" size={10} color={Colors.dark.danger} />
                    ) : null}
                  </View>
                  <ThemedText style={styles.watchlistAsk}>
                    {formatPrice(quote.ask, pair)}
                  </ThemedText>
                  <ThemedText style={styles.watchlistSpread}>
                    {((quote.ask - quote.bid) * 10000).toFixed(1)} pips
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderOrderTicket = () => (
    <View style={[styles.orderTicket, isDesktop ? styles.orderTicketDesktop : styles.orderTicketMobile]}>
      <View style={styles.ticketHeader}>
        <ThemedText style={styles.ticketTitle}>{selectedPair}</ThemedText>
        <View style={styles.oneClickToggle}>
          <ThemedText style={styles.oneClickLabel}>1-Click</ThemedText>
          <Pressable
            style={[styles.toggleBtn, oneClickTrading && styles.toggleBtnActive]}
            onPress={() => setOneClickTrading(!oneClickTrading)}
          >
            <View style={[styles.toggleKnob, oneClickTrading && styles.toggleKnobActive]} />
          </Pressable>
        </View>
      </View>

      {currentQuote ? (
        <View style={styles.bidAskButtons}>
          <Pressable
            style={[styles.tradeBtn, styles.sellBtn, orderSide === "sell" && styles.tradeBtnActive]}
            onPress={() => setOrderSide("sell")}
          >
            <ThemedText style={styles.tradeBtnLabel}>SELL</ThemedText>
            <ThemedText style={styles.tradeBtnPrice}>{formatPrice(currentQuote.bid)}</ThemedText>
          </Pressable>
          <View style={styles.spreadDisplay}>
            <ThemedText style={styles.spreadDisplayValue}>
              {((currentQuote.ask - currentQuote.bid) * 10000).toFixed(1)}
            </ThemedText>
          </View>
          <Pressable
            style={[styles.tradeBtn, styles.buyBtn, orderSide === "buy" && styles.tradeBtnActive]}
            onPress={() => setOrderSide("buy")}
          >
            <ThemedText style={styles.tradeBtnLabel}>BUY</ThemedText>
            <ThemedText style={styles.tradeBtnPrice}>{formatPrice(currentQuote.ask)}</ThemedText>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.orderTypeSelector}>
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

      <View style={styles.inputSection}>
        <ThemedText style={styles.inputLabel}>SIZE (LOTS)</ThemedText>
        <TextInput
          style={styles.sizeInput}
          value={lotSize}
          onChangeText={setLotSize}
          keyboardType="decimal-pad"
          placeholderTextColor={Colors.dark.textMuted}
          placeholder="0.1"
        />
        <View style={styles.quickSizeRow}>
          {QUICK_LOT_SIZES.map((size) => (
            <Pressable
              key={size}
              style={[styles.quickSizeBtn, parseFloat(lotSize) === size && styles.quickSizeBtnActive]}
              onPress={() => setLotSize(size.toString())}
            >
              <ThemedText style={styles.quickSizeBtnText}>
                {size}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {orderType === "limit" ? (
        <View style={styles.inputSection}>
          <ThemedText style={styles.inputLabel}>LIMIT PRICE</ThemedText>
          <TextInput
            style={styles.priceInput}
            value={limitPrice}
            onChangeText={setLimitPrice}
            keyboardType="decimal-pad"
            placeholder={currentQuote ? formatPrice(currentQuote.bid) : ""}
            placeholderTextColor={Colors.dark.textMuted}
          />
        </View>
      ) : null}

      {orderType === "stop" ? (
        <View style={styles.inputSection}>
          <ThemedText style={styles.inputLabel}>STOP PRICE</ThemedText>
          <TextInput
            style={styles.priceInput}
            value={stopPrice}
            onChangeText={setStopPrice}
            keyboardType="decimal-pad"
            placeholder={currentQuote ? formatPrice(currentQuote.ask) : ""}
            placeholderTextColor={Colors.dark.textMuted}
          />
        </View>
      ) : null}

      <View style={styles.slTpSection}>
        <View style={styles.slTpInput}>
          <ThemedText style={styles.inputLabel}>STOP LOSS</ThemedText>
          <TextInput
            style={styles.priceInput}
            value={stopLoss}
            onChangeText={setStopLoss}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={Colors.dark.textMuted}
          />
        </View>
        <View style={styles.slTpInput}>
          <ThemedText style={styles.inputLabel}>TAKE PROFIT</ThemedText>
          <TextInput
            style={styles.priceInput}
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
          styles.executeBtn,
          orderSide === "buy" ? styles.executeBtnBuy : styles.executeBtnSell,
          (isTradeDisabled || placeOrderMutation.isPending) && styles.executeBtnDisabled,
        ]}
        onPress={handlePlaceOrder}
        disabled={isTradeDisabled || placeOrderMutation.isPending}
      >
        <ThemedText style={styles.executeBtnText}>
          {placeOrderMutation.isPending
            ? "EXECUTING..."
            : `${orderSide.toUpperCase()} ${parseFloat(lotSize || "0.1").toFixed(2)} LOTS`}
        </ThemedText>
      </Pressable>

      {isTradeDisabled ? (
        <View style={styles.disabledBanner}>
          <Feather name="alert-circle" size={14} color={Colors.dark.textMuted} />
          <ThemedText style={styles.disabledText}>Competition not running</ThemedText>
        </View>
      ) : null}
    </View>
  );

  const renderBlotterTabs = () => (
    <View style={styles.blotterTabs}>
      {(["positions", "orders", "history"] as const).map((tab) => {
        const count = tab === "positions" ? positions.length : tab === "orders" ? pendingOrders.length : fills.length;
        return (
          <Pressable
            key={tab}
            style={[styles.blotterTab, activeBlotterTab === tab && styles.blotterTabActive]}
            onPress={() => setActiveBlotterTab(tab)}
          >
            <ThemedText style={[styles.blotterTabText, activeBlotterTab === tab && styles.blotterTabTextActive]}>
              {tab.toUpperCase()}
            </ThemedText>
            <View style={[styles.blotterTabCount, activeBlotterTab === tab && styles.blotterTabCountActive]}>
              <ThemedText style={styles.blotterTabCountText}>{count}</ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  const renderPositionsBlotter = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.blotterTable}>
        <View style={styles.blotterHeader}>
          <ThemedText style={[styles.blotterHeaderCell, { width: 80 }]}>SYMBOL</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 50 }]}>SIDE</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 80 }]}>LOTS</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 90 }]}>ENTRY</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 90 }]}>MARK</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 90 }]}>P&L</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 70 }]}>SL</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 70 }]}>TP</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 80 }]}>ACTION</ThemedText>
        </View>
        {positions.length > 0 ? (
          positions.map((pos) => {
            const quote = quotes[pos.pair];
            const markPrice = pos.side === "buy" ? quote?.bid : quote?.ask;
            return (
              <View key={pos.id} style={styles.blotterRow}>
                <ThemedText style={[styles.blotterCell, { width: 80 }]}>{pos.pair}</ThemedText>
                <View style={[styles.blotterCell, { width: 50 }]}>
                  <View style={[styles.sideBadge, pos.side === "buy" ? styles.sideBadgeBuy : styles.sideBadgeSell]}>
                    <ThemedText style={styles.sideBadgeText}>{pos.side.toUpperCase()}</ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.blotterCell, styles.monoText, { width: 80 }]}>
                  {unitsToLots(pos.quantityUnits).toFixed(2)}
                </ThemedText>
                <ThemedText style={[styles.blotterCell, styles.monoText, { width: 90 }]}>
                  {formatPrice(pos.avgEntryPrice, pos.pair)}
                </ThemedText>
                <ThemedText style={[styles.blotterCell, styles.monoText, { width: 90 }]}>
                  {markPrice ? formatPrice(markPrice, pos.pair) : "—"}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.blotterCell,
                    styles.monoText,
                    { width: 90, color: pos.unrealizedPnlCents >= 0 ? Colors.dark.success : Colors.dark.danger },
                  ]}
                >
                  {pos.unrealizedPnlCents >= 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnlCents)}
                </ThemedText>
                <ThemedText style={[styles.blotterCell, styles.monoText, { width: 70 }]}>
                  {pos.stopLossPrice ? formatPrice(pos.stopLossPrice, pos.pair) : "—"}
                </ThemedText>
                <ThemedText style={[styles.blotterCell, styles.monoText, { width: 70 }]}>
                  {pos.takeProfitPrice ? formatPrice(pos.takeProfitPrice, pos.pair) : "—"}
                </ThemedText>
                <View style={[styles.blotterCell, { width: 80 }]}>
                  <Pressable
                    style={styles.closePositionBtn}
                    onPress={() => closePositionMutation.mutate(pos.id)}
                  >
                    <ThemedText style={styles.closePositionBtnText}>CLOSE</ThemedText>
                  </Pressable>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyBlotter}>
            <ThemedText style={styles.emptyBlotterText}>No open positions</ThemedText>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderOrdersBlotter = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.blotterTable}>
        <View style={styles.blotterHeader}>
          <ThemedText style={[styles.blotterHeaderCell, { width: 80 }]}>SYMBOL</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 60 }]}>TYPE</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 50 }]}>SIDE</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 80 }]}>LOTS</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 90 }]}>PRICE</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 70 }]}>SL</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 70 }]}>TP</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 80 }]}>ACTION</ThemedText>
        </View>
        {pendingOrders.length > 0 ? (
          pendingOrders.map((order) => (
            <View key={order.id} style={styles.blotterRow}>
              <ThemedText style={[styles.blotterCell, { width: 80 }]}>{order.pair}</ThemedText>
              <ThemedText style={[styles.blotterCell, { width: 60, color: Colors.dark.accent }]}>
                {order.type.toUpperCase()}
              </ThemedText>
              <View style={[styles.blotterCell, { width: 50 }]}>
                <View style={[styles.sideBadge, order.side === "buy" ? styles.sideBadgeBuy : styles.sideBadgeSell]}>
                  <ThemedText style={styles.sideBadgeText}>{order.side.toUpperCase()}</ThemedText>
                </View>
              </View>
              <ThemedText style={[styles.blotterCell, styles.monoText, { width: 80 }]}>
                {unitsToLots(order.quantityUnits).toFixed(2)}
              </ThemedText>
              <ThemedText style={[styles.blotterCell, styles.monoText, { width: 90 }]}>
                {order.limitPrice
                  ? formatPrice(order.limitPrice, order.pair)
                  : order.stopPrice
                  ? formatPrice(order.stopPrice, order.pair)
                  : "—"}
              </ThemedText>
              <ThemedText style={[styles.blotterCell, styles.monoText, { width: 70 }]}>
                {order.stopLossPrice ? formatPrice(order.stopLossPrice, order.pair) : "—"}
              </ThemedText>
              <ThemedText style={[styles.blotterCell, styles.monoText, { width: 70 }]}>
                {order.takeProfitPrice ? formatPrice(order.takeProfitPrice, order.pair) : "—"}
              </ThemedText>
              <View style={[styles.blotterCell, { width: 80 }]}>
                <Pressable
                  style={styles.cancelOrderBtn}
                  onPress={() => cancelOrderMutation.mutate(order.id)}
                >
                  <ThemedText style={styles.cancelOrderBtnText}>CANCEL</ThemedText>
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyBlotter}>
            <ThemedText style={styles.emptyBlotterText}>No pending orders</ThemedText>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderHistoryBlotter = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.blotterTable}>
        <View style={styles.blotterHeader}>
          <ThemedText style={[styles.blotterHeaderCell, { width: 140 }]}>TIME</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 80 }]}>SYMBOL</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 50 }]}>SIDE</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 80 }]}>LOTS</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 90 }]}>PRICE</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 90 }]}>P&L</ThemedText>
        </View>
        {fills.length > 0 ? (
          fills.map((fill) => (
            <View key={fill.id} style={styles.blotterRow}>
              <ThemedText style={[styles.blotterCell, styles.monoText, { width: 140 }]}>
                {new Date(fill.filledAt).toLocaleString()}
              </ThemedText>
              <ThemedText style={[styles.blotterCell, { width: 80 }]}>{fill.pair}</ThemedText>
              <View style={[styles.blotterCell, { width: 50 }]}>
                <View style={[styles.sideBadge, fill.side === "buy" ? styles.sideBadgeBuy : styles.sideBadgeSell]}>
                  <ThemedText style={styles.sideBadgeText}>{fill.side.toUpperCase()}</ThemedText>
                </View>
              </View>
              <ThemedText style={[styles.blotterCell, styles.monoText, { width: 80 }]}>
                {unitsToLots(fill.quantityUnits).toFixed(2)}
              </ThemedText>
              <ThemedText style={[styles.blotterCell, styles.monoText, { width: 90 }]}>
                {formatPrice(fill.fillPrice, fill.pair)}
              </ThemedText>
              <ThemedText
                style={[
                  styles.blotterCell,
                  styles.monoText,
                  {
                    width: 90,
                    color: (fill.realizedPnlCents || 0) >= 0 ? Colors.dark.success : Colors.dark.danger,
                  },
                ]}
              >
                {fill.realizedPnlCents !== undefined
                  ? `${fill.realizedPnlCents >= 0 ? "+" : ""}${formatCurrency(fill.realizedPnlCents)}`
                  : "—"}
              </ThemedText>
            </View>
          ))
        ) : (
          <View style={styles.emptyBlotter}>
            <ThemedText style={styles.emptyBlotterText}>No trade history</ThemedText>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderBlotter = () => (
    <View style={[styles.blotter, isDesktop ? styles.blotterDesktop : styles.blotterMobile]}>
      {renderBlotterTabs()}
      <View style={styles.blotterContent}>
        {activeBlotterTab === "positions" && renderPositionsBlotter()}
        {activeBlotterTab === "orders" && renderOrdersBlotter()}
        {activeBlotterTab === "history" && renderHistoryBlotter()}
      </View>
    </View>
  );

  const renderChart = () => (
    <View style={[styles.chartContainer, isDesktop ? styles.chartDesktop : styles.chartMobile]}>
      <TradingViewChart
        pair={selectedPair}
        height={isDesktop ? Math.max(height - 400, 300) : 300}
        positions={positions.filter((p) => p.pair === selectedPair)}
        orders={pendingOrders.filter((o) => o.pair === selectedPair)}
      />
    </View>
  );

  const renderLeaderboardPanel = () =>
    showLeaderboard ? (
      <View style={[styles.leaderboardPanel, isDesktop ? styles.leaderboardDesktop : styles.leaderboardMobile]}>
        <View style={styles.leaderboardHeader}>
          <ThemedText style={styles.leaderboardTitle}>LEADERBOARD</ThemedText>
          <Pressable onPress={() => setShowLeaderboard(false)}>
            <Feather name="x" size={18} color={Colors.dark.textSecondary} />
          </Pressable>
        </View>
        <Leaderboard
          entries={leaderboard || []}
          currentUserId={user?.id}
          compact
        />
      </View>
    ) : null;

  const renderToast = () =>
    toast ? (
      <Animated.View
        style={[
          styles.toast,
          toastAnimatedStyle,
          toast.type === 'success' && styles.toastSuccess,
          toast.type === 'error' && styles.toastError,
        ]}
      >
        <Feather
          name={toast.type === 'success' ? 'check-circle' : toast.type === 'error' ? 'alert-circle' : 'info'}
          size={16}
          color="#fff"
        />
        <ThemedText style={styles.toastText}>{toast.message}</ThemedText>
      </Animated.View>
    ) : null;

  if (isDesktop) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderTopHeader()}
        <View style={styles.mainContent}>
          {renderWatchlist()}
          <View style={styles.centerContent}>
            {renderChart()}
            {renderBlotter()}
          </View>
          {renderOrderTicket()}
          {renderLeaderboardPanel()}
        </View>
        {renderToast()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.mobileContent}>
        {renderTopHeader()}
        {renderWatchlist()}
        {renderChart()}
        {renderOrderTicket()}
        {renderBlotter()}
        {renderLeaderboardPanel()}
      </ScrollView>
      {renderToast()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: Colors.dark.textMuted,
    fontSize: 16,
  },
  mobileContent: {
    paddingBottom: 40,
  },

  topHeader: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  backBtn: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  competitionInfo: {
    flex: 1,
  },
  competitionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  competitionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 2,
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.dark.backgroundTertiary,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timerText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.dark.textSecondary,
  },
  symbolDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
    gap: Spacing.md,
  },
  symbolText: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.text,
    letterSpacing: 1,
  },
  livePrices: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  priceBlock: {
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 9,
    color: Colors.dark.textMuted,
    marginBottom: 1,
  },
  priceValue: {
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "600",
  },
  bidPrice: {
    color: Colors.dark.danger,
  },
  askPrice: {
    color: Colors.dark.success,
  },
  spreadBadge: {
    backgroundColor: Colors.dark.backgroundTertiary,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  spreadValue: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  metricItem: {
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
  },
  metricLabel: {
    fontSize: 9,
    color: Colors.dark.textMuted,
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.text,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.dark.border,
  },
  rankValue: {
    color: Colors.dark.accent,
  },
  leaderboardBtn: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },

  mainContent: {
    flex: 1,
    flexDirection: "row",
  },
  centerContent: {
    flex: 1,
    flexDirection: "column",
  },

  watchlist: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRightWidth: 1,
    borderRightColor: Colors.dark.border,
  },
  watchlistDesktop: {
    width: 180,
  },
  watchlistMobile: {
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  watchlistHeader: {
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  watchlistTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    letterSpacing: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.xs,
    margin: Spacing.xs,
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.xs,
    color: Colors.dark.text,
    fontSize: 12,
    padding: 0,
  },
  watchlistHorizontal: {
    flexDirection: "row",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  watchlistItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  watchlistItemSelected: {
    backgroundColor: `${Colors.dark.accent}15`,
    borderLeftWidth: 2,
    borderLeftColor: Colors.dark.accent,
  },
  watchlistItemMobile: {
    borderBottomWidth: 0,
    borderRightWidth: 1,
    borderRightColor: Colors.dark.border,
    paddingHorizontal: Spacing.md,
  },
  watchlistItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  favoriteBtn: {
    padding: 2,
  },
  watchlistPair: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.dark.textSecondary,
  },
  watchlistPairSelected: {
    color: Colors.dark.text,
  },
  watchlistPrices: {
    alignItems: "flex-end",
  },
  watchlistPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  watchlistBid: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.dark.danger,
  },
  watchlistAsk: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.dark.success,
  },
  watchlistSpread: {
    fontSize: 9,
    color: Colors.dark.textMuted,
  },
  priceUp: {
    color: Colors.dark.success,
  },
  priceDown: {
    color: Colors.dark.danger,
  },

  chartContainer: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  chartDesktop: {
    minHeight: 300,
  },
  chartMobile: {
    height: 300,
  },

  orderTicket: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderLeftWidth: 1,
    borderLeftColor: Colors.dark.border,
    padding: Spacing.md,
  },
  orderTicketDesktop: {
    width: 260,
  },
  orderTicketMobile: {
    borderLeftWidth: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.dark.text,
    letterSpacing: 1,
  },
  oneClickToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  oneClickLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
  },
  toggleBtn: {
    width: 36,
    height: 20,
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 10,
    padding: 2,
  },
  toggleBtnActive: {
    backgroundColor: Colors.dark.accent,
  },
  toggleKnob: {
    width: 16,
    height: 16,
    backgroundColor: Colors.dark.textMuted,
    borderRadius: 8,
  },
  toggleKnobActive: {
    backgroundColor: "#fff",
    marginLeft: "auto",
  },
  bidAskButtons: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  tradeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
  },
  sellBtn: {
    backgroundColor: `${Colors.dark.danger}15`,
    borderColor: Colors.dark.danger,
  },
  buyBtn: {
    backgroundColor: `${Colors.dark.success}15`,
    borderColor: Colors.dark.success,
  },
  tradeBtnActive: {
    borderWidth: 2,
  },
  tradeBtnLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    marginBottom: 2,
  },
  tradeBtnPrice: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.dark.text,
  },
  spreadDisplay: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xs,
  },
  spreadDisplayValue: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  orderTypeSelector: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 6,
    padding: 2,
  },
  orderTypeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.xs,
    borderRadius: 4,
  },
  orderTypeBtnActive: {
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  orderTypeBtnText: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.dark.textMuted,
  },
  orderTypeBtnTextActive: {
    color: Colors.dark.text,
  },
  inputSection: {
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sizeInput: {
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 6,
    padding: Spacing.sm,
    color: Colors.dark.text,
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    textAlign: "center",
  },
  priceInput: {
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 6,
    padding: Spacing.sm,
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  quickSizeRow: {
    flexDirection: "row",
    marginTop: Spacing.xs,
    gap: 4,
  },
  quickSizeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 4,
  },
  quickSizeBtnActive: {
    backgroundColor: Colors.dark.accent,
  },
  quickSizeBtnText: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    fontWeight: "500",
  },
  slTpSection: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  slTpInput: {
    flex: 1,
  },
  executeBtn: {
    paddingVertical: Spacing.md,
    borderRadius: 6,
    alignItems: "center",
  },
  executeBtnBuy: {
    backgroundColor: Colors.dark.success,
  },
  executeBtnSell: {
    backgroundColor: Colors.dark.danger,
  },
  executeBtnDisabled: {
    opacity: 0.5,
  },
  executeBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  disabledBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    padding: Spacing.xs,
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 4,
  },
  disabledText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },

  blotter: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  blotterDesktop: {
    height: 200,
  },
  blotterMobile: {
    minHeight: 200,
  },
  blotterTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  blotterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  blotterTabActive: {
    borderBottomColor: Colors.dark.accent,
  },
  blotterTabText: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.dark.textMuted,
    letterSpacing: 0.5,
  },
  blotterTabTextActive: {
    color: Colors.dark.text,
  },
  blotterTabCount: {
    backgroundColor: Colors.dark.backgroundTertiary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  blotterTabCountActive: {
    backgroundColor: Colors.dark.accent,
  },
  blotterTabCountText: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    fontWeight: "500",
  },
  blotterContent: {
    flex: 1,
  },
  blotterTable: {
    minWidth: "100%",
  },
  blotterHeader: {
    flexDirection: "row",
    backgroundColor: Colors.dark.backgroundTertiary,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  blotterHeaderCell: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    letterSpacing: 0.5,
  },
  blotterRow: {
    flexDirection: "row",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  blotterCell: {
    fontSize: 11,
    color: Colors.dark.text,
    justifyContent: "center",
  },
  monoText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  sideBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  sideBadgeBuy: {
    backgroundColor: `${Colors.dark.success}25`,
  },
  sideBadgeSell: {
    backgroundColor: `${Colors.dark.danger}25`,
  },
  sideBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  closePositionBtn: {
    backgroundColor: Colors.dark.danger,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 3,
    borderRadius: 3,
  },
  closePositionBtnText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#fff",
  },
  cancelOrderBtn: {
    backgroundColor: Colors.dark.backgroundTertiary,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 3,
    borderRadius: 3,
  },
  cancelOrderBtnText: {
    fontSize: 9,
    fontWeight: "500",
    color: Colors.dark.textSecondary,
  },
  emptyBlotter: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  emptyBlotterText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },

  leaderboardPanel: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderLeftWidth: 1,
    borderLeftColor: Colors.dark.border,
  },
  leaderboardDesktop: {
    position: "absolute",
    right: 260,
    top: 0,
    bottom: 0,
    width: 280,
    zIndex: 100,
  },
  leaderboardMobile: {
    marginTop: Spacing.md,
  },
  leaderboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  leaderboardTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    letterSpacing: 1,
  },

  toast: {
    position: "absolute",
    bottom: 80,
    left: "50%",
    transform: [{ translateX: -150 }],
    width: 300,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  toastSuccess: {
    borderColor: Colors.dark.success,
    backgroundColor: `${Colors.dark.success}20`,
  },
  toastError: {
    borderColor: Colors.dark.danger,
    backgroundColor: `${Colors.dark.danger}20`,
  },
  toastText: {
    fontSize: 13,
    color: Colors.dark.text,
    flex: 1,
  },
});

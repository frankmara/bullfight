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
const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

function unitsToLots(units: number): number {
  return Math.round((units / UNITS_PER_LOT) * 100) / 100;
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
  const [activeBlotterTab, setActiveBlotterTab] = useState<BlotterTab>("positions");
  const [timeRemaining, setTimeRemaining] = useState("");
  const [selectedTimeframe, setSelectedTimeframe] = useState("15m");
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

  const { data: marketStatus } = useQuery<{ isUsingMock: boolean }>({
    queryKey: ["/api/market/status"],
    refetchInterval: 30000,
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

  const getPairName = (pair: string) => {
    const names: Record<string, string> = {
      "EUR-USD": "Euro / US Dollar",
      "GBP-USD": "British Pound / US Dollar",
      "USD-JPY": "US Dollar / Japanese Yen",
      "AUD-USD": "Australian Dollar / US Dollar",
      "USD-CAD": "US Dollar / Canadian Dollar",
    };
    return names[pair] || pair;
  };

  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const res = await apiRequest("POST", `/api/arena/${id}/orders`, orderData);
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/arena", id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const lotsStr = variables.lots?.toFixed(2) || "0.10";
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
      const confirmMessage = `${orderSide.toUpperCase()} ${lots.toFixed(2)} lots ${selectedPair}\nEstimated fill: ${fillPrice?.toFixed(5) || "N/A"}`;
      
      if (Platform.OS === "web") {
        if (window.confirm(`Confirm Order\n\n${confirmMessage}`)) {
          placeOrderMutation.mutate(orderData);
        }
      } else {
        Alert.alert(
          "Confirm Order",
          confirmMessage,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Confirm", onPress: () => placeOrderMutation.mutate(orderData) },
          ]
        );
      }
    }
  }, [selectedPair, orderSide, orderType, lotSize, limitPrice, stopPrice, stopLoss, takeProfit, oneClickTrading, quotes, placeOrderMutation]);

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
  const marginUsed = positions.length > 0 ? positions.reduce((sum, p) => sum + Math.abs(p.quantityUnits * p.avgEntryPrice * 0.01), 0) : 0;
  const marginAvailable = equity - marginUsed;
  const marginLevel = marginUsed > 0 ? ((equity / marginUsed) * 100) : 0;

  const isTradeDisabled = competition.status !== "running";

  const renderChartToolbar = () => (
    <View style={styles.chartToolbar}>
      <View style={styles.toolbarLeft}>
        <View style={styles.timeframeSelector}>
          {TIMEFRAMES.map((tf) => (
            <Pressable
              key={tf}
              style={[styles.timeframeBtn, selectedTimeframe === tf && styles.timeframeBtnActive]}
              onPress={() => setSelectedTimeframe(tf)}
            >
              <ThemedText style={[styles.timeframeBtnText, selectedTimeframe === tf && styles.timeframeBtnTextActive]}>
                {tf}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.toolbarBtn}>
          <Feather name="sliders" size={14} color={Colors.dark.textSecondary} />
          <ThemedText style={styles.toolbarBtnText}>Indicators</ThemedText>
        </Pressable>
      </View>
      <View style={styles.toolbarCenter}>
        <ThemedText style={styles.symbolTitle}>{selectedPair.replace("-", " / ")}</ThemedText>
        {currentQuote ? (
          <View style={styles.ohlcDisplay}>
            <ThemedText style={styles.ohlcLabel}>O:</ThemedText>
            <ThemedText style={styles.ohlcValue}>{formatPrice(currentQuote.bid)}</ThemedText>
            <ThemedText style={styles.ohlcLabel}>H:</ThemedText>
            <ThemedText style={styles.ohlcValue}>{formatPrice(currentQuote.ask + 0.0005)}</ThemedText>
            <ThemedText style={styles.ohlcLabel}>L:</ThemedText>
            <ThemedText style={styles.ohlcValue}>{formatPrice(currentQuote.bid - 0.0005)}</ThemedText>
            <ThemedText style={styles.ohlcLabel}>C:</ThemedText>
            <ThemedText style={[styles.ohlcValue, { color: Colors.dark.success }]}>{formatPrice(currentQuote.ask)}</ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.toolbarRight}>
        <View style={[styles.dataStatusBadge, marketStatus?.isUsingMock ? styles.dataStatusMock : styles.dataStatusLive]}>
          <View style={[styles.dataStatusDot, marketStatus?.isUsingMock ? styles.dataDotMock : styles.dataDotLive]} />
          <ThemedText style={[styles.dataStatusText, marketStatus?.isUsingMock ? styles.dataStatusTextMock : styles.dataStatusTextLive]}>
            {marketStatus?.isUsingMock ? "MOCK" : "LIVE"}
          </ThemedText>
        </View>
        <Pressable style={styles.toolbarBtn} onPress={() => setShowLeaderboard(!showLeaderboard)}>
          <Feather name="bar-chart-2" size={14} color={showLeaderboard ? Colors.dark.accent : Colors.dark.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  const renderMarketWatch = () => (
    <View style={styles.marketWatch}>
      <View style={styles.marketWatchHeader}>
        <View style={styles.marketWatchTitleRow}>
          <Feather name="activity" size={14} color={Colors.dark.accent} />
          <ThemedText style={styles.marketWatchTitle}>Market Watch</ThemedText>
        </View>
        <View style={styles.searchContainer}>
          <Feather name="search" size={12} color={Colors.dark.textMuted} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            value={watchlistSearch}
            onChangeText={setWatchlistSearch}
            placeholder="Search..."
            placeholderTextColor={Colors.dark.textMuted}
          />
          <View style={styles.allDropdown}>
            <ThemedText style={styles.allDropdownText}>All</ThemedText>
            <Feather name="chevron-down" size={10} color={Colors.dark.textMuted} />
          </View>
        </View>
      </View>

      <View style={styles.marketWatchTable}>
        <View style={styles.marketWatchTableHeader}>
          <ThemedText style={[styles.tableHeaderCell, { flex: 1.5 }]}>SYMBOL</ThemedText>
          <ThemedText style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>BID</ThemedText>
          <ThemedText style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>ASK</ThemedText>
          <ThemedText style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'right' }]}>SPREAD</ThemedText>
        </View>
        <ScrollView style={styles.marketWatchTableBody} showsVerticalScrollIndicator={false}>
          {filteredPairs.map((pair) => {
            const quote = quotes[pair];
            const isSelected = selectedPair === pair;
            const spread = quote ? ((quote.ask - quote.bid) * 10000).toFixed(1) : "—";
            const bidUp = quote && quote.prevBid ? quote.bid > quote.prevBid : false;
            const bidDown = quote && quote.prevBid ? quote.bid < quote.prevBid : false;

            return (
              <Pressable
                key={pair}
                style={[styles.marketWatchRow, isSelected && styles.marketWatchRowSelected]}
                onPress={() => setSelectedPair(pair)}
              >
                <View style={[styles.tableCell, { flex: 1.5 }]}>
                  <ThemedText style={[styles.symbolText, isSelected && styles.symbolTextSelected]}>
                    {pair}
                  </ThemedText>
                </View>
                <View style={[styles.tableCell, { flex: 1, alignItems: 'flex-end' }]}>
                  <ThemedText style={[styles.bidText, bidUp && styles.priceUp, bidDown && styles.priceDown]}>
                    {quote ? formatPrice(quote.bid, pair) : "—"}
                  </ThemedText>
                </View>
                <View style={[styles.tableCell, { flex: 1, alignItems: 'flex-end' }]}>
                  <ThemedText style={styles.askText}>
                    {quote ? formatPrice(quote.ask, pair) : "—"}
                  </ThemedText>
                </View>
                <View style={[styles.tableCell, { flex: 0.6, alignItems: 'flex-end' }]}>
                  <ThemedText style={styles.spreadText}>{spread}</ThemedText>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.orderTicket}>
        <View style={styles.orderTicketHeader}>
          <View style={styles.symbolDropdown}>
            <ThemedText style={styles.symbolDropdownText}>{selectedPair}</ThemedText>
            <Feather name="chevron-down" size={12} color={Colors.dark.textSecondary} />
          </View>
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
          <View style={styles.oneClickToggle}>
            <Pressable
              style={[styles.toggleBtn, oneClickTrading && styles.toggleBtnActive]}
              onPress={() => setOneClickTrading(!oneClickTrading)}
            >
              <View style={[styles.toggleKnob, oneClickTrading && styles.toggleKnobActive]} />
            </Pressable>
          </View>
        </View>

        {currentQuote ? (
          <View style={styles.bidAskRow}>
            <Pressable
              style={[styles.priceBtn, styles.sellBtn, orderSide === "sell" && styles.priceBtnActive]}
              onPress={() => { setOrderSide("sell"); if (oneClickTrading) handlePlaceOrder(); }}
            >
              <ThemedText style={styles.priceBtnPrice}>{formatPrice(currentQuote.bid)}</ThemedText>
              <ThemedText style={styles.priceBtnLabel}>SELL</ThemedText>
            </Pressable>
            <View style={styles.spreadCenter}>
              <ThemedText style={styles.spreadCenterValue}>
                {((currentQuote.ask - currentQuote.bid) * 10000).toFixed(1)}
              </ThemedText>
            </View>
            <View style={styles.lotSizeContainer}>
              <TextInput
                style={styles.lotSizeInput}
                value={lotSize}
                onChangeText={setLotSize}
                keyboardType="decimal-pad"
                placeholderTextColor={Colors.dark.textMuted}
              />
            </View>
            <Pressable
              style={[styles.priceBtn, styles.buyBtn, orderSide === "buy" && styles.priceBtnActive]}
              onPress={() => { setOrderSide("buy"); if (oneClickTrading) handlePlaceOrder(); }}
            >
              <ThemedText style={styles.priceBtnPrice}>{formatPrice(currentQuote.ask)}</ThemedText>
              <ThemedText style={styles.priceBtnLabel}>BUY</ThemedText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.quickSizeRow}>
          {QUICK_LOT_SIZES.map((size) => (
            <Pressable
              key={size}
              style={[styles.quickSizeBtn, parseFloat(lotSize) === size && styles.quickSizeBtnActive]}
              onPress={() => setLotSize(size.toString())}
            >
              <ThemedText style={[styles.quickSizeBtnText, parseFloat(lotSize) === size && styles.quickSizeBtnTextActive]}>
                {size}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {orderType !== "market" ? (
          <View style={styles.priceInputRow}>
            <ThemedText style={styles.priceInputLabel}>{orderType === "limit" ? "Limit" : "Stop"} Price</ThemedText>
            <TextInput
              style={styles.priceInput}
              value={orderType === "limit" ? limitPrice : stopPrice}
              onChangeText={orderType === "limit" ? setLimitPrice : setStopPrice}
              keyboardType="decimal-pad"
              placeholder={currentQuote ? formatPrice(currentQuote.bid) : ""}
              placeholderTextColor={Colors.dark.textMuted}
            />
          </View>
        ) : null}

        <View style={styles.slTpRow}>
          <View style={styles.slTpInputContainer}>
            <ThemedText style={styles.slTpLabel}>SL</ThemedText>
            <TextInput
              style={styles.slTpInput}
              value={stopLoss}
              onChangeText={setStopLoss}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={Colors.dark.textMuted}
            />
          </View>
          <View style={styles.slTpInputContainer}>
            <ThemedText style={styles.slTpLabel}>TP</ThemedText>
            <TextInput
              style={styles.slTpInput}
              value={takeProfit}
              onChangeText={setTakeProfit}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={Colors.dark.textMuted}
            />
          </View>
        </View>

        {!oneClickTrading ? (
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
        ) : null}

        {isTradeDisabled ? (
          <View style={styles.disabledBanner}>
            <Feather name="alert-circle" size={12} color={Colors.dark.textMuted} />
            <ThemedText style={styles.disabledText}>Competition not running</ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );

  const renderBlotterSummary = () => (
    <View style={styles.blotterSummary}>
      <View style={styles.summaryItem}>
        <ThemedText style={styles.summaryLabel}>BALANCE</ThemedText>
        <ThemedText style={styles.summaryValue}>{formatCurrency(balance)}</ThemedText>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <ThemedText style={styles.summaryLabel}>EQUITY</ThemedText>
        <ThemedText style={styles.summaryValue}>{formatCurrency(equity)}</ThemedText>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <ThemedText style={styles.summaryLabel}>PROFIT & LOSS</ThemedText>
        <ThemedText style={[styles.summaryValue, { color: unrealizedPnl >= 0 ? Colors.dark.success : Colors.dark.danger }]}>
          {unrealizedPnl >= 0 ? "+" : ""}{formatCurrency(unrealizedPnl)}
        </ThemedText>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <ThemedText style={styles.summaryLabel}>RETURN</ThemedText>
        <ThemedText style={[styles.summaryValue, { color: returnPct >= 0 ? Colors.dark.success : Colors.dark.danger }]}>
          {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
        </ThemedText>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <ThemedText style={styles.summaryLabel}>MARGIN USED</ThemedText>
        <ThemedText style={styles.summaryValue}>{formatCurrency(Math.round(marginUsed))}</ThemedText>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <ThemedText style={styles.summaryLabel}>MARGIN AVAIL</ThemedText>
        <ThemedText style={styles.summaryValue}>{formatCurrency(Math.round(marginAvailable))}</ThemedText>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <ThemedText style={styles.summaryLabel}>MARGIN LEVEL</ThemedText>
        <ThemedText style={styles.summaryValue}>{marginLevel > 0 ? marginLevel.toFixed(1) + "%" : "—"}</ThemedText>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <ThemedText style={styles.summaryLabel}>RANK</ThemedText>
        <ThemedText style={[styles.summaryValue, styles.rankValue]}>#{entry.rank || "—"}</ThemedText>
      </View>
      <View style={{ flex: 1 }} />
      <Pressable style={styles.closeAllBtn}>
        <Feather name="x" size={12} color={Colors.dark.textSecondary} />
        <ThemedText style={styles.closeAllBtnText}>Close All</ThemedText>
        <Feather name="chevron-down" size={10} color={Colors.dark.textSecondary} />
      </Pressable>
    </View>
  );

  const renderBlotterTabs = () => (
    <View style={styles.blotterTabs}>
      {([
        { key: "positions", label: "Positions", count: positions.length },
        { key: "orders", label: "Pending", count: pendingOrders.length },
        { key: "history", label: "History", count: fills.length },
      ] as const).map((tab) => (
        <Pressable
          key={tab.key}
          style={[styles.blotterTab, activeBlotterTab === tab.key && styles.blotterTabActive]}
          onPress={() => setActiveBlotterTab(tab.key)}
        >
          <ThemedText style={[styles.blotterTabText, activeBlotterTab === tab.key && styles.blotterTabTextActive]}>
            {tab.label}
          </ThemedText>
          <View style={[styles.blotterTabCount, activeBlotterTab === tab.key && styles.blotterTabCountActive]}>
            <ThemedText style={[styles.blotterTabCountText, activeBlotterTab === tab.key && styles.blotterTabCountTextActive]}>
              {tab.count}
            </ThemedText>
          </View>
        </Pressable>
      ))}
    </View>
  );

  const renderPositionsBlotter = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.blotterTable}>
        <View style={styles.blotterHeader}>
          <ThemedText style={[styles.blotterHeaderCell, { width: 70 }]}>SYMBOL</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 45 }]}>SIDE</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 55 }]}>SIZE</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 100 }]}>ENTRY → MARKET</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 60 }]}>SL</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 60 }]}>TP</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 65 }]}>MARGIN</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 65 }]}>COMM</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 55 }]}>SWAP</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 70 }]}>P&L</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 120 }]}>OPEN TIME</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 60 }]}>ACTIONS</ThemedText>
        </View>
        {positions.length > 0 ? (
          positions.map((pos) => {
            const quote = quotes[pos.pair];
            const markPrice = pos.side === "buy" ? quote?.bid : quote?.ask;
            return (
              <View key={pos.id} style={styles.blotterRow}>
                <ThemedText style={[styles.blotterCell, { width: 70 }]}>{pos.pair}</ThemedText>
                <View style={[styles.blotterCell, { width: 45 }]}>
                  <ThemedText style={[styles.sideText, pos.side === "buy" ? styles.buyText : styles.sellText]}>
                    {pos.side.toUpperCase()}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.blotterCell, styles.monoText, { width: 55 }]}>
                  {unitsToLots(pos.quantityUnits).toFixed(2)}
                </ThemedText>
                <View style={[styles.blotterCell, { width: 100, flexDirection: 'row' }]}>
                  <ThemedText style={[styles.monoText, { color: Colors.dark.textSecondary }]}>
                    {formatPrice(pos.avgEntryPrice, pos.pair)}
                  </ThemedText>
                  <ThemedText style={{ color: Colors.dark.textMuted }}> → </ThemedText>
                  <ThemedText style={styles.monoText}>
                    {markPrice ? formatPrice(markPrice, pos.pair) : "—"}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.blotterCell, styles.monoText, { width: 60 }]}>
                  {pos.stopLossPrice ? formatPrice(pos.stopLossPrice, pos.pair) : "—"}
                </ThemedText>
                <ThemedText style={[styles.blotterCell, styles.monoText, { width: 60 }]}>
                  {pos.takeProfitPrice ? formatPrice(pos.takeProfitPrice, pos.pair) : "—"}
                </ThemedText>
                <ThemedText style={[styles.blotterCell, styles.monoText, { width: 65 }]}>
                  {formatCurrency(Math.round(pos.quantityUnits * pos.avgEntryPrice * 0.01))}
                </ThemedText>
                <ThemedText style={[styles.blotterCell, styles.monoText, { width: 65 }]}>$0.00</ThemedText>
                <ThemedText style={[styles.blotterCell, styles.monoText, { width: 55 }]}>$0.00</ThemedText>
                <ThemedText
                  style={[
                    styles.blotterCell,
                    styles.monoText,
                    { width: 70, color: pos.unrealizedPnlCents >= 0 ? Colors.dark.success : Colors.dark.danger },
                  ]}
                >
                  {pos.unrealizedPnlCents >= 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnlCents)}
                </ThemedText>
                <ThemedText style={[styles.blotterCell, styles.monoText, { width: 120, fontSize: 10 }]}>
                  {pos.openedAt ? new Date(pos.openedAt).toLocaleString() : "—"}
                </ThemedText>
                <View style={[styles.blotterCell, { width: 60, flexDirection: 'row', gap: 4 }]}>
                  <Pressable style={styles.actionBtn} onPress={() => closePositionMutation.mutate(pos.id)}>
                    <Feather name="x" size={12} color={Colors.dark.danger} />
                  </Pressable>
                  <Pressable style={styles.actionBtn}>
                    <Feather name="edit-2" size={12} color={Colors.dark.textSecondary} />
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
          <ThemedText style={[styles.blotterHeaderCell, { width: 70 }]}>SYMBOL</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 50 }]}>TYPE</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 45 }]}>SIDE</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 55 }]}>SIZE</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 80 }]}>PRICE</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 60 }]}>SL</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 60 }]}>TP</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 60 }]}>ACTIONS</ThemedText>
        </View>
        {pendingOrders.length > 0 ? (
          pendingOrders.map((order) => (
            <View key={order.id} style={styles.blotterRow}>
              <ThemedText style={[styles.blotterCell, { width: 70 }]}>{order.pair}</ThemedText>
              <ThemedText style={[styles.blotterCell, { width: 50, color: Colors.dark.accent }]}>
                {order.type.toUpperCase()}
              </ThemedText>
              <View style={[styles.blotterCell, { width: 45 }]}>
                <ThemedText style={[styles.sideText, order.side === "buy" ? styles.buyText : styles.sellText]}>
                  {order.side.toUpperCase()}
                </ThemedText>
              </View>
              <ThemedText style={[styles.blotterCell, styles.monoText, { width: 55 }]}>
                {unitsToLots(order.quantityUnits).toFixed(2)}
              </ThemedText>
              <ThemedText style={[styles.blotterCell, styles.monoText, { width: 80 }]}>
                {order.limitPrice
                  ? formatPrice(order.limitPrice, order.pair)
                  : order.stopPrice
                  ? formatPrice(order.stopPrice, order.pair)
                  : "—"}
              </ThemedText>
              <ThemedText style={[styles.blotterCell, styles.monoText, { width: 60 }]}>
                {order.stopLossPrice ? formatPrice(order.stopLossPrice, order.pair) : "—"}
              </ThemedText>
              <ThemedText style={[styles.blotterCell, styles.monoText, { width: 60 }]}>
                {order.takeProfitPrice ? formatPrice(order.takeProfitPrice, order.pair) : "—"}
              </ThemedText>
              <View style={[styles.blotterCell, { width: 60, flexDirection: 'row', gap: 4 }]}>
                <Pressable style={styles.actionBtn} onPress={() => cancelOrderMutation.mutate(order.id)}>
                  <Feather name="x" size={12} color={Colors.dark.danger} />
                </Pressable>
                <Pressable style={styles.actionBtn}>
                  <Feather name="edit-2" size={12} color={Colors.dark.textSecondary} />
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
          <ThemedText style={[styles.blotterHeaderCell, { width: 120 }]}>TIME</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 70 }]}>SYMBOL</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 45 }]}>SIDE</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 55 }]}>SIZE</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 80 }]}>PRICE</ThemedText>
          <ThemedText style={[styles.blotterHeaderCell, { width: 70 }]}>P&L</ThemedText>
        </View>
        {fills.length > 0 ? (
          fills.map((fill) => (
            <View key={fill.id} style={styles.blotterRow}>
              <ThemedText style={[styles.blotterCell, styles.monoText, { width: 120, fontSize: 10 }]}>
                {new Date(fill.filledAt).toLocaleString()}
              </ThemedText>
              <ThemedText style={[styles.blotterCell, { width: 70 }]}>{fill.pair}</ThemedText>
              <View style={[styles.blotterCell, { width: 45 }]}>
                <ThemedText style={[styles.sideText, fill.side === "buy" ? styles.buyText : styles.sellText]}>
                  {fill.side.toUpperCase()}
                </ThemedText>
              </View>
              <ThemedText style={[styles.blotterCell, styles.monoText, { width: 55 }]}>
                {unitsToLots(fill.quantityUnits).toFixed(2)}
              </ThemedText>
              <ThemedText style={[styles.blotterCell, styles.monoText, { width: 80 }]}>
                {formatPrice(fill.fillPrice, fill.pair)}
              </ThemedText>
              <ThemedText
                style={[
                  styles.blotterCell,
                  styles.monoText,
                  {
                    width: 70,
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
    <View style={styles.blotter}>
      {renderBlotterTabs()}
      {renderBlotterSummary()}
      <View style={styles.blotterContent}>
        {activeBlotterTab === "positions" && renderPositionsBlotter()}
        {activeBlotterTab === "orders" && renderOrdersBlotter()}
        {activeBlotterTab === "history" && renderHistoryBlotter()}
      </View>
    </View>
  );

  const renderChart = () => (
    <View style={styles.chartContainer}>
      {renderChartToolbar()}
      <View style={styles.chartArea}>
        <TradingViewChart
          pair={selectedPair}
          height={isDesktop ? Math.max(height - 380, 250) : 280}
          positions={positions.filter((p) => p.pair === selectedPair)}
          orders={pendingOrders.filter((o) => o.pair === selectedPair)}
        />
      </View>
    </View>
  );

  const renderTopBar = () => (
    <View style={[styles.topBar, { paddingTop: isMobile ? insets.top : 0 }]}>
      <View style={styles.topBarLeft}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={16} color={Colors.dark.textSecondary} />
        </Pressable>
        <ThemedText style={styles.competitionTitle} numberOfLines={1}>
          {competition.title}
        </ThemedText>
        <StatusBadge status={competition.status} />
        {timeRemaining ? (
          <View style={styles.timerBadge}>
            <Feather name="clock" size={11} color={Colors.dark.textSecondary} />
            <ThemedText style={styles.timerText}>{timeRemaining}</ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );

  const renderLeaderboardPanel = () =>
    showLeaderboard ? (
      <View style={styles.leaderboardPanel}>
        <View style={styles.leaderboardHeader}>
          <ThemedText style={styles.leaderboardTitle}>LEADERBOARD</ThemedText>
          <Pressable onPress={() => setShowLeaderboard(false)}>
            <Feather name="x" size={16} color={Colors.dark.textSecondary} />
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
          size={14}
          color="#fff"
        />
        <ThemedText style={styles.toastText}>{toast.message}</ThemedText>
      </Animated.View>
    ) : null;

  if (isDesktop) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderTopBar()}
        <View style={styles.mainContent}>
          <View style={styles.chartSection}>
            {renderChart()}
            {renderBlotter()}
          </View>
          {renderMarketWatch()}
          {renderLeaderboardPanel()}
        </View>
        {renderToast()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.mobileContent}>
        {renderTopBar()}
        {renderChart()}
        {renderMarketWatch()}
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
    backgroundColor: "#0A0A0A",
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

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111111",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    minHeight: 36,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  backBtn: {
    padding: 4,
  },
  competitionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  timerText: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.dark.textSecondary,
  },

  mainContent: {
    flex: 1,
    flexDirection: "row",
  },
  chartSection: {
    flex: 1,
    flexDirection: "column",
  },

  chartContainer: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  chartToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111111",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    minHeight: 32,
  },
  toolbarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  timeframeSelector: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    borderRadius: 4,
    padding: 2,
  },
  timeframeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  timeframeBtnActive: {
    backgroundColor: "#252525",
  },
  timeframeBtnText: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    fontWeight: "500",
  },
  timeframeBtnTextActive: {
    color: Colors.dark.text,
  },
  toolbarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  toolbarBtnText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  toolbarCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  symbolTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  ohlcDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ohlcLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
  },
  ohlcValue: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.dark.textSecondary,
    marginRight: 6,
  },
  toolbarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  dataStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  dataStatusMock: {
    backgroundColor: "rgba(255, 171, 0, 0.15)",
  },
  dataStatusLive: {
    backgroundColor: "rgba(76, 175, 80, 0.15)",
  },
  dataStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dataDotMock: {
    backgroundColor: "#FFAB00",
  },
  dataDotLive: {
    backgroundColor: "#4CAF50",
  },
  dataStatusText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  dataStatusTextMock: {
    color: "#FFAB00",
  },
  dataStatusTextLive: {
    color: "#4CAF50",
  },
  chartArea: {
    flex: 1,
  },

  marketWatch: {
    width: 320,
    backgroundColor: "#111111",
    borderLeftWidth: 1,
    borderLeftColor: "#1A1A1A",
    flexDirection: "column",
  },
  marketWatchHeader: {
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  marketWatchTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.xs,
  },
  marketWatchTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.text,
    letterSpacing: 0.5,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    color: Colors.dark.text,
    fontSize: 11,
    padding: 0,
  },
  allDropdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: "#252525",
  },
  allDropdownText: {
    fontSize: 10,
    color: Colors.dark.textMuted,
  },

  marketWatchTable: {
    flex: 1,
    maxHeight: 200,
  },
  marketWatchTableHeader: {
    flexDirection: "row",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: "#0A0A0A",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    letterSpacing: 0.5,
  },
  marketWatchTableBody: {
    flex: 1,
  },
  marketWatchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  marketWatchRowSelected: {
    backgroundColor: "rgba(255, 59, 59, 0.1)",
    borderLeftWidth: 2,
    borderLeftColor: "#FF3B3B",
  },
  tableCell: {
    justifyContent: "center",
  },
  symbolText: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.dark.textSecondary,
  },
  symbolTextSelected: {
    color: Colors.dark.text,
  },
  bidText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#FF3B3B",
  },
  askText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#4CAF50",
  },
  spreadText: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.dark.textMuted,
  },
  priceUp: {
    color: "#4CAF50",
  },
  priceDown: {
    color: "#FF3B3B",
  },

  orderTicket: {
    padding: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#1A1A1A",
  },
  orderTicketHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  symbolDropdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  symbolDropdownText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  orderTypeSelector: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    borderRadius: 4,
    padding: 2,
    flex: 1,
  },
  orderTypeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
    borderRadius: 3,
  },
  orderTypeBtnActive: {
    backgroundColor: "#252525",
  },
  orderTypeBtnText: {
    fontSize: 9,
    fontWeight: "500",
    color: Colors.dark.textMuted,
  },
  orderTypeBtnTextActive: {
    color: Colors.dark.text,
  },
  oneClickToggle: {
    padding: 2,
  },
  toggleBtn: {
    width: 28,
    height: 16,
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    padding: 2,
    justifyContent: "center",
  },
  toggleBtnActive: {
    backgroundColor: "#FF3B3B",
  },
  toggleKnob: {
    width: 12,
    height: 12,
    backgroundColor: Colors.dark.textMuted,
    borderRadius: 6,
  },
  toggleKnobActive: {
    backgroundColor: "#fff",
    marginLeft: "auto",
  },

  bidAskRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 4,
    marginBottom: Spacing.xs,
  },
  priceBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  sellBtn: {
    backgroundColor: "rgba(255, 59, 59, 0.1)",
    borderColor: "#FF3B3B",
  },
  buyBtn: {
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderColor: "#4CAF50",
  },
  priceBtnActive: {
    borderWidth: 2,
  },
  priceBtnPrice: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.dark.text,
  },
  priceBtnLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  spreadCenter: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  spreadCenterValue: {
    fontSize: 9,
    color: Colors.dark.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  lotSizeContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 4,
    paddingHorizontal: 8,
  },
  lotSizeInput: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.dark.text,
    textAlign: "center",
    width: 50,
    padding: 0,
  },

  quickSizeRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: Spacing.xs,
  },
  quickSizeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
    backgroundColor: "#1A1A1A",
    borderRadius: 3,
  },
  quickSizeBtnActive: {
    backgroundColor: "#FF3B3B",
  },
  quickSizeBtnText: {
    fontSize: 9,
    color: Colors.dark.textSecondary,
    fontWeight: "500",
  },
  quickSizeBtnTextActive: {
    color: "#fff",
  },

  priceInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  priceInputLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    width: 60,
  },
  priceInput: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: Colors.dark.text,
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  slTpRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  slTpInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  slTpLabel: {
    fontSize: 9,
    color: Colors.dark.textMuted,
    fontWeight: "600",
    marginRight: 6,
  },
  slTpInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    padding: 0,
  },

  executeBtn: {
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: "center",
  },
  executeBtnBuy: {
    backgroundColor: "#4CAF50",
  },
  executeBtnSell: {
    backgroundColor: "#FF3B3B",
  },
  executeBtnDisabled: {
    opacity: 0.5,
  },
  executeBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  disabledBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: Spacing.xs,
    padding: 4,
    backgroundColor: "#1A1A1A",
    borderRadius: 3,
  },
  disabledText: {
    fontSize: 10,
    color: Colors.dark.textMuted,
  },

  blotter: {
    backgroundColor: "#111111",
    borderTopWidth: 1,
    borderTopColor: "#1A1A1A",
    minHeight: 180,
  },
  blotterTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
    paddingHorizontal: Spacing.sm,
  },
  blotterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  blotterTabActive: {
    borderBottomColor: "#FF3B3B",
  },
  blotterTabText: {
    fontSize: 10,
    fontWeight: "500",
    color: Colors.dark.textMuted,
  },
  blotterTabTextActive: {
    color: Colors.dark.text,
  },
  blotterTabCount: {
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  blotterTabCountActive: {
    backgroundColor: "#FF3B3B",
  },
  blotterTabCountText: {
    fontSize: 9,
    color: Colors.dark.textMuted,
    fontWeight: "600",
  },
  blotterTabCountTextActive: {
    color: "#fff",
  },

  blotterSummary: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    backgroundColor: "#0A0A0A",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  summaryItem: {
    paddingHorizontal: Spacing.sm,
  },
  summaryLabel: {
    fontSize: 8,
    color: Colors.dark.textMuted,
    letterSpacing: 0.3,
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.text,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#1A1A1A",
  },
  rankValue: {
    color: "#FF3B3B",
  },
  closeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
  },
  closeAllBtnText: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
  },

  blotterContent: {
    flex: 1,
  },
  blotterTable: {
    minWidth: "100%",
  },
  blotterHeader: {
    flexDirection: "row",
    backgroundColor: "#0A0A0A",
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  blotterHeaderCell: {
    fontSize: 9,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    letterSpacing: 0.3,
  },
  blotterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  blotterCell: {
    fontSize: 10,
    color: Colors.dark.text,
    justifyContent: "center",
  },
  monoText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  sideText: {
    fontSize: 9,
    fontWeight: "600",
  },
  buyText: {
    color: "#4CAF50",
  },
  sellText: {
    color: "#FF3B3B",
  },
  actionBtn: {
    padding: 4,
    backgroundColor: "#1A1A1A",
    borderRadius: 3,
  },
  emptyBlotter: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  emptyBlotterText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },

  leaderboardPanel: {
    position: "absolute",
    right: 320,
    top: 0,
    bottom: 0,
    width: 260,
    backgroundColor: "#111111",
    borderLeftWidth: 1,
    borderLeftColor: "#1A1A1A",
    zIndex: 100,
  },
  leaderboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  leaderboardTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    letterSpacing: 0.5,
  },

  toast: {
    position: "absolute",
    bottom: 60,
    left: "50%",
    transform: [{ translateX: -140 }],
    width: 280,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    backgroundColor: "#1A1A1A",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#252525",
    zIndex: 1000,
  },
  toastSuccess: {
    borderColor: "#4CAF50",
    backgroundColor: "rgba(76, 175, 80, 0.15)",
  },
  toastError: {
    borderColor: "#FF3B3B",
    backgroundColor: "rgba(255, 59, 59, 0.15)",
  },
  toastText: {
    fontSize: 12,
    color: Colors.dark.text,
    flex: 1,
  },
});

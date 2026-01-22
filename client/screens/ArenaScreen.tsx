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
  Modal,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
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
import { TerminalColors, TerminalTypography, TerminalSpacing, TerminalRadius } from "@/components/terminal";
import { ArenaLayout, ToolDock, ChartToolbar, MarketWatch, OrderTicket, Blotter, LAYOUT_CONSTANTS, CompetitionSwitcher } from "@/components/arena";
import type { DrawingTool, DrawnLine } from "@/components/arena/ToolDock";

type QuoteStatus = "live" | "delayed" | "stale" | "disconnected";

interface Quote {
  pair: string;
  bid: number;
  ask: number;
  timestamp: number;
  spreadPips: number;
  status: QuoteStatus;
  prevBid?: number;
  prevAsk?: number;
}

interface MarketQuotesResponse {
  isUsingMock: boolean;
  isConnected: boolean;
  serverTime: number;
  quotes: Array<{
    pair: string;
    bid: number;
    ask: number;
    spreadPips: number;
    timestamp: number;
    ageMs: number;
    status: QuoteStatus;
  }>;
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

interface Trade {
  id: string;
  pair: string;
  sideInitial: string;
  totalInUnits: number;
  totalOutUnits: number;
  avgEntryPrice: number;
  avgExitPrice?: number;
  realizedPnlCents: number;
  status: string;
  openedAt: string;
  closedAt?: string;
}

interface Deal {
  id: string;
  tradeId: string;
  orderId?: string;
  pair: string;
  side: string;
  units: number;
  lots: number;
  price: number;
  kind: string;
  realizedPnlCents: number;
  createdAt: string;
}

interface OrderHistoryItem {
  id: string;
  pair: string;
  side: string;
  type: string;
  quantityUnits: number;
  limitPrice?: number;
  stopPrice?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
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
const QUICK_LOT_SIZES = [0.01, 0.05, 0.1, 0.5, 1.0];
const UNITS_PER_LOT = 100000;
const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

const THEME = {
  bg: TerminalColors.bgBase,
  bgCard: TerminalColors.bgPanel,
  bgElevated: TerminalColors.bgElevated,
  bgInput: TerminalColors.bgInput,
  border: TerminalColors.border,
  borderLight: TerminalColors.borderLight,
  accent: TerminalColors.accent,
  accentGlow: TerminalColors.accentGlow,
  success: TerminalColors.positive,
  successGlow: TerminalColors.positiveGlow,
  danger: TerminalColors.negative,
  dangerGlow: TerminalColors.negativeGlow,
  textPrimary: TerminalColors.textPrimary,
  textSecondary: TerminalColors.textSecondary,
  textMuted: TerminalColors.textMuted,
};

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

  const isDesktop = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;

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
  const [activeBlotterTab, setActiveBlotterTab] = useState<BlotterTab>("positions");
  const [timeRemaining, setTimeRemaining] = useState("");
  const [selectedTimeframe, setSelectedTimeframe] = useState("15m");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [sltpDragModal, setSltpDragModal] = useState<{
    positionId: string;
    type: 'sl' | 'tp';
    originalPrice: number;
    newPrice: number;
  } | null>(null);
  const [selectedTool, setSelectedTool] = useState<DrawingTool>("cursor");
  const [drawnLines, setDrawnLines] = useState<DrawnLine[]>([]);
  const [pendingTrendLine, setPendingTrendLine] = useState<{ startPrice: number; startTime: number } | null>(null);
  
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

  const { data: closedTrades } = useQuery<Trade[]>({
    queryKey: ["/api/arena", id, "trades"],
    refetchInterval: 5000,
  });

  const { data: deals } = useQuery<Deal[]>({
    queryKey: ["/api/arena", id, "deals"],
    refetchInterval: 5000,
  });

  const { data: orderHistory } = useQuery<OrderHistoryItem[]>({
    queryKey: ["/api/arena", id, "order-history"],
    refetchInterval: 5000,
  });

  const { data: marketQuotes } = useQuery<MarketQuotesResponse>({
    queryKey: ["/api/market/quotes"],
    refetchInterval: 1000,
  });

  useEffect(() => {
    if (!marketQuotes?.quotes) return;
    
    setQuotes((prevQuotes) => {
      const newQuotes: Record<string, Quote> = {};
      marketQuotes.quotes.forEach((q) => {
        const prevQuote = prevQuotes[q.pair];
        newQuotes[q.pair] = {
          pair: q.pair,
          bid: q.bid,
          ask: q.ask,
          timestamp: q.timestamp,
          spreadPips: q.spreadPips,
          status: q.status,
          prevBid: prevQuote?.bid,
          prevAsk: prevQuote?.ask,
        };
      });
      return newQuotes;
    });
  }, [marketQuotes]);

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

  const handleChartClick = useCallback((price: number, time: number) => {
    if (selectedTool === "horizontal") {
      const newLine: DrawnLine = {
        id: `line-${Date.now()}`,
        type: "horizontal",
        price,
        color: TerminalColors.accent,
      };
      setDrawnLines(prev => [...prev, newLine]);
      showToast(`Horizontal line placed at ${formatPrice(price, selectedPair)}`, 'info');
      setSelectedTool("cursor");
    } else if (selectedTool === "trend") {
      if (!pendingTrendLine) {
        setPendingTrendLine({ startPrice: price, startTime: time });
        showToast("Click second point to complete trend line", 'info');
      } else {
        const newLine: DrawnLine = {
          id: `line-${Date.now()}`,
          type: "trend",
          startPrice: pendingTrendLine.startPrice,
          startTime: pendingTrendLine.startTime,
          endPrice: price,
          endTime: time,
          color: TerminalColors.accent,
        };
        setDrawnLines(prev => [...prev, newLine]);
        setPendingTrendLine(null);
        showToast("Trend line placed", 'info');
        setSelectedTool("cursor");
      }
    }
  }, [selectedTool, pendingTrendLine, selectedPair, showToast]);

  const handleDeleteLine = useCallback((lineId: string) => {
    setDrawnLines(prev => prev.filter(l => l.id !== lineId));
    showToast("Line deleted", 'info');
  }, [showToast]);

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

  const partialCloseMutation = useMutation({
    mutationFn: async ({ positionId, lots, percentage }: { positionId: string; lots?: number; percentage?: number }) => {
      const res = await apiRequest("POST", `/api/arena/${id}/positions/${positionId}/partial-close`, { lots, percentage });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/arena", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/arena", id, "trades"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Partial close executed', 'success');
    },
    onError: (error: any) => {
      showToast(error.message || "Failed to partial close", 'error');
    },
  });

  const editPositionMutation = useMutation({
    mutationFn: async ({ positionId, stopLossPrice, takeProfitPrice }: { positionId: string; stopLossPrice?: number | null; takeProfitPrice?: number | null }) => {
      const res = await apiRequest("PUT", `/api/arena/${id}/positions/${positionId}`, { stopLossPrice, takeProfitPrice });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/arena", id] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast('Position updated', 'success');
    },
    onError: (error: any) => {
      showToast(error.message || "Failed to update position", 'error');
    },
  });

  const editOrderMutation = useMutation({
    mutationFn: async ({ orderId, limitPrice, stopPrice, stopLossPrice, takeProfitPrice }: { orderId: string; limitPrice?: number; stopPrice?: number; stopLossPrice?: number | null; takeProfitPrice?: number | null }) => {
      const res = await apiRequest("PUT", `/api/arena/${id}/orders/${orderId}`, { limitPrice, stopPrice, stopLossPrice, takeProfitPrice });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/arena", id] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast('Order updated', 'success');
    },
    onError: (error: any) => {
      showToast(error.message || "Failed to update order", 'error');
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

    placeOrderMutation.mutate(orderData);
  }, [selectedPair, orderSide, orderType, lotSize, limitPrice, stopPrice, stopLoss, takeProfit, placeOrderMutation]);

  const handleSLTPDrag = useCallback((dragInfo: {
    positionId: string;
    type: 'sl' | 'tp';
    originalPrice: number;
    newPrice: number;
  }) => {
    setSltpDragModal(dragInfo);
  }, []);

  const confirmSLTPDrag = useCallback(() => {
    if (!sltpDragModal) return;
    
    const { positionId, type, newPrice } = sltpDragModal;
    const updates: { stopLossPrice?: number; takeProfitPrice?: number } = {};
    
    if (type === 'sl') {
      updates.stopLossPrice = newPrice;
    } else {
      updates.takeProfitPrice = newPrice;
    }
    
    editPositionMutation.mutate({
      positionId,
      ...updates,
    });
    
    setSltpDragModal(null);
  }, [sltpDragModal, editPositionMutation]);

  const cancelSLTPDrag = useCallback(() => {
    setSltpDragModal(null);
    queryClient.invalidateQueries({ queryKey: [`/api/arena/${id}`] });
  }, [id, queryClient]);

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
  const pairs = competition.allowedPairsJson || [];

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
  const returnPct = ((entry.equityCents - competition.startingBalanceCents) / competition.startingBalanceCents) * 100;
  const isTradeDisabled = competition.status !== "running";

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={THEME.textPrimary} />
        </Pressable>
        <View style={styles.headerInfo}>
          <ThemedText style={styles.competitionName}>{competition.title}</ThemedText>
          <View style={styles.headerMeta}>
            <StatusBadge status={competition.status} />
            {timeRemaining ? (
              <View style={styles.timerChip}>
                <Feather name="clock" size={12} color={THEME.accent} />
                <ThemedText style={styles.timerText}>{timeRemaining}</ThemedText>
              </View>
            ) : null}
            <View style={[styles.dataChip, marketStatus?.isUsingMock ? styles.dataChipMock : styles.dataChipLive]}>
              <View style={[styles.dataChipDot, marketStatus?.isUsingMock ? styles.dotMock : styles.dotLive]} />
              <ThemedText style={[styles.dataChipText, marketStatus?.isUsingMock ? styles.textMock : styles.textLive]}>
                {marketStatus?.isUsingMock ? "DEMO" : "LIVE"}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>
      <Pressable style={styles.leaderboardButton} onPress={() => setShowLeaderboard(!showLeaderboard)}>
        <Feather name="award" size={18} color={showLeaderboard ? THEME.accent : THEME.textSecondary} />
      </Pressable>
    </View>
  );


  const renderInstrumentSelector = () => (
    <View style={styles.instrumentSelector}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.instrumentList}>
        {pairs.map((pair) => {
          const quote = quotes[pair];
          const isSelected = selectedPair === pair;
          const bidChange = quote && quote.prevBid ? (quote.bid > quote.prevBid ? 'up' : quote.bid < quote.prevBid ? 'down' : null) : null;
          
          return (
            <Pressable
              key={pair}
              style={[styles.instrumentCard, isSelected && styles.instrumentCardSelected]}
              onPress={() => setSelectedPair(pair)}
            >
              {isSelected ? (
                <LinearGradient
                  colors={['rgba(255, 59, 59, 0.15)', 'rgba(255, 59, 59, 0.05)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              ) : null}
              <ThemedText style={[styles.instrumentPair, isSelected && styles.instrumentPairSelected]}>
                {pair.replace("-", "/")}
              </ThemedText>
              <View style={styles.instrumentPrices}>
                <ThemedText style={[styles.instrumentBid, bidChange === 'up' && styles.priceUp, bidChange === 'down' && styles.priceDown]}>
                  {quote ? formatPrice(quote.bid, pair) : "-.-----"}
                </ThemedText>
                <ThemedText style={styles.instrumentSpread}>
                  {quote ? ((quote.ask - quote.bid) * 10000).toFixed(1) : "-"}
                </ThemedText>
                <ThemedText style={styles.instrumentAsk}>
                  {quote ? formatPrice(quote.ask, pair) : "-.-----"}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderChartSection = () => (
    <View style={styles.chartSection}>
      <View style={styles.chartHeader}>
        <View style={styles.symbolInfo}>
          <ThemedText style={styles.chartSymbol}>{selectedPair.replace("-", "/")}</ThemedText>
          {currentQuote ? (
            <ThemedText style={[styles.chartPrice, { color: THEME.success }]}>
              {formatPrice(currentQuote.ask)}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.timeframeButtons}>
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
      </View>
      <View style={styles.chartContainer}>
        <TradingViewChart
          key={`${selectedPair}-${selectedTimeframe}`}
          pair={selectedPair}
          height={isDesktop ? Math.max(height - 520, 300) : 280}
          positions={positions.filter((p) => p.pair === selectedPair)}
          orders={pendingOrders.filter((o) => o.pair === selectedPair)}
          timeframe={selectedTimeframe}
          currentQuote={currentQuote ? { bid: currentQuote.bid, ask: currentQuote.ask } : undefined}
          selectedTool={selectedTool}
          drawnLines={drawnLines}
          onChartClick={handleChartClick}
          onSLTPDrag={handleSLTPDrag}
        />
      </View>
    </View>
  );

  const renderOrderPanel = () => (
    <View style={styles.orderPanel}>
      <View style={styles.orderPanelHeader}>
        <ThemedText style={styles.orderPanelTitle}>Place Order</ThemedText>
        <View style={styles.oneClickRow}>
          <ThemedText style={styles.oneClickLabel}>1-Click</ThemedText>
          <Pressable
            style={[styles.toggle, oneClickTrading && styles.toggleActive]}
            onPress={() => setOneClickTrading(!oneClickTrading)}
          >
            <View style={[styles.toggleKnob, oneClickTrading && styles.toggleKnobActive]} />
          </Pressable>
        </View>
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

      <View style={styles.lotSizeSection}>
        <ThemedText style={styles.inputLabel}>LOT SIZE</ThemedText>
        <View style={styles.lotSizeInputRow}>
          <TextInput
            style={styles.lotSizeInput}
            value={lotSize}
            onChangeText={setLotSize}
            keyboardType="decimal-pad"
            placeholderTextColor={THEME.textMuted}
          />
        </View>
        <View style={styles.quickLotRow}>
          {QUICK_LOT_SIZES.map((size) => (
            <Pressable
              key={size}
              style={[styles.quickLotBtn, parseFloat(lotSize) === size && styles.quickLotBtnActive]}
              onPress={() => setLotSize(size.toString())}
            >
              <ThemedText style={[styles.quickLotText, parseFloat(lotSize) === size && styles.quickLotTextActive]}>
                {size}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {orderType !== "market" ? (
        <View style={styles.priceInputSection}>
          <ThemedText style={styles.inputLabel}>{orderType === "limit" ? "LIMIT PRICE" : "STOP PRICE"}</ThemedText>
          <TextInput
            style={styles.priceInputField}
            value={orderType === "limit" ? limitPrice : stopPrice}
            onChangeText={orderType === "limit" ? setLimitPrice : setStopPrice}
            keyboardType="decimal-pad"
            placeholder={currentQuote ? formatPrice(currentQuote.bid) : ""}
            placeholderTextColor={THEME.textMuted}
          />
        </View>
      ) : null}

      <View style={styles.slTpRow}>
        <View style={styles.slTpField}>
          <ThemedText style={styles.slTpLabel}>SL</ThemedText>
          <TextInput
            style={styles.slTpInput}
            value={stopLoss}
            onChangeText={setStopLoss}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={THEME.textMuted}
          />
        </View>
        <View style={styles.slTpField}>
          <ThemedText style={styles.slTpLabel}>TP</ThemedText>
          <TextInput
            style={styles.slTpInput}
            value={takeProfit}
            onChangeText={setTakeProfit}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={THEME.textMuted}
          />
        </View>
      </View>

      {currentQuote ? (
        <View style={styles.tradeButtons}>
          <Pressable
            style={[styles.tradeBtn, styles.sellBtn, orderSide === "sell" && styles.tradeBtnActive]}
            onPress={() => {
              setOrderSide("sell");
              if (oneClickTrading && !isTradeDisabled) handlePlaceOrder();
            }}
            disabled={isTradeDisabled}
          >
            <ThemedText style={styles.tradeBtnPrice}>{formatPrice(currentQuote.bid)}</ThemedText>
            <ThemedText style={styles.tradeBtnLabel}>SELL</ThemedText>
          </Pressable>
          
          <View style={styles.spreadBadge}>
            <ThemedText style={styles.spreadValue}>{((currentQuote.ask - currentQuote.bid) * 10000).toFixed(1)}</ThemedText>
            <ThemedText style={styles.spreadLabel}>SPREAD</ThemedText>
          </View>

          <Pressable
            style={[styles.tradeBtn, styles.buyBtn, orderSide === "buy" && styles.tradeBtnActive]}
            onPress={() => {
              setOrderSide("buy");
              if (oneClickTrading && !isTradeDisabled) handlePlaceOrder();
            }}
            disabled={isTradeDisabled}
          >
            <ThemedText style={styles.tradeBtnPrice}>{formatPrice(currentQuote.ask)}</ThemedText>
            <ThemedText style={styles.tradeBtnLabel}>BUY</ThemedText>
          </Pressable>
        </View>
      ) : null}

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
        <View style={styles.disabledNotice}>
          <Feather name="info" size={14} color={THEME.textMuted} />
          <ThemedText style={styles.disabledText}>Competition not running</ThemedText>
        </View>
      ) : null}
    </View>
  );

  const renderPositionsPanel = () => (
    <View style={styles.positionsPanel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTabs}>
          {([
            { key: "positions", label: "Positions", count: positions.length },
            { key: "orders", label: "Orders", count: pendingOrders.length },
            { key: "history", label: "History", count: fills.length },
          ] as const).map((tab) => (
            <Pressable
              key={tab.key}
              style={[styles.panelTab, activeBlotterTab === tab.key && styles.panelTabActive]}
              onPress={() => setActiveBlotterTab(tab.key)}
            >
              <ThemedText style={[styles.panelTabText, activeBlotterTab === tab.key && styles.panelTabTextActive]}>
                {tab.label}
              </ThemedText>
              {tab.count > 0 ? (
                <View style={[styles.tabBadge, activeBlotterTab === tab.key && styles.tabBadgeActive]}>
                  <ThemedText style={[styles.tabBadgeText, activeBlotterTab === tab.key && styles.tabBadgeTextActive]}>
                    {tab.count}
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView style={styles.panelContent} showsVerticalScrollIndicator={false}>
        {activeBlotterTab === "positions" && (
          positions.length > 0 ? (
            positions.map((pos) => {
              const quote = quotes[pos.pair];
              const markPrice = pos.side === "buy" ? quote?.bid : quote?.ask;
              return (
                <View key={pos.id} style={styles.positionRow}>
                  <View style={styles.positionMain}>
                    <View style={styles.positionSymbol}>
                      <ThemedText style={styles.positionPair}>{pos.pair}</ThemedText>
                      <View style={[styles.sideBadge, pos.side === "buy" ? styles.sideBadgeBuy : styles.sideBadgeSell]}>
                        <ThemedText style={styles.sideBadgeText}>{pos.side.toUpperCase()}</ThemedText>
                      </View>
                    </View>
                    <ThemedText style={styles.positionLots}>{unitsToLots(pos.quantityUnits).toFixed(2)} lots</ThemedText>
                  </View>
                  <View style={styles.positionDetails}>
                    <View style={styles.positionPriceRow}>
                      <ThemedText style={styles.positionLabel}>Entry</ThemedText>
                      <ThemedText style={styles.positionValue}>{formatPrice(pos.avgEntryPrice, pos.pair)}</ThemedText>
                    </View>
                    <View style={styles.positionPriceRow}>
                      <ThemedText style={styles.positionLabel}>Current</ThemedText>
                      <ThemedText style={styles.positionValue}>{markPrice ? formatPrice(markPrice, pos.pair) : "—"}</ThemedText>
                    </View>
                    <View style={styles.positionPriceRow}>
                      <ThemedText style={styles.positionLabel}>P&L</ThemedText>
                      <ThemedText style={[styles.positionPnl, { color: pos.unrealizedPnlCents >= 0 ? THEME.success : THEME.danger }]}>
                        {pos.unrealizedPnlCents >= 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnlCents)}
                      </ThemedText>
                    </View>
                  </View>
                  <Pressable style={styles.closeBtn} onPress={() => closePositionMutation.mutate(pos.id)}>
                    <Feather name="x" size={16} color={THEME.danger} />
                  </Pressable>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={32} color={THEME.textMuted} />
              <ThemedText style={styles.emptyStateText}>No open positions</ThemedText>
            </View>
          )
        )}

        {activeBlotterTab === "orders" && (
          pendingOrders.length > 0 ? (
            pendingOrders.map((order) => (
              <View key={order.id} style={styles.positionRow}>
                <View style={styles.positionMain}>
                  <View style={styles.positionSymbol}>
                    <ThemedText style={styles.positionPair}>{order.pair}</ThemedText>
                    <View style={[styles.sideBadge, order.side === "buy" ? styles.sideBadgeBuy : styles.sideBadgeSell]}>
                      <ThemedText style={styles.sideBadgeText}>{order.side.toUpperCase()}</ThemedText>
                    </View>
                    <View style={styles.typeBadge}>
                      <ThemedText style={styles.typeBadgeText}>{order.type.toUpperCase()}</ThemedText>
                    </View>
                  </View>
                  <ThemedText style={styles.positionLots}>{unitsToLots(order.quantityUnits).toFixed(2)} lots</ThemedText>
                </View>
                <View style={styles.positionDetails}>
                  <View style={styles.positionPriceRow}>
                    <ThemedText style={styles.positionLabel}>Price</ThemedText>
                    <ThemedText style={styles.positionValue}>
                      {order.limitPrice ? formatPrice(order.limitPrice, order.pair) : order.stopPrice ? formatPrice(order.stopPrice, order.pair) : "—"}
                    </ThemedText>
                  </View>
                </View>
                <Pressable style={styles.closeBtn} onPress={() => cancelOrderMutation.mutate(order.id)}>
                  <Feather name="x" size={16} color={THEME.textMuted} />
                </Pressable>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={32} color={THEME.textMuted} />
              <ThemedText style={styles.emptyStateText}>No pending orders</ThemedText>
            </View>
          )
        )}

        {activeBlotterTab === "history" && (
          fills.length > 0 ? (
            fills.slice(0, 20).map((fill) => (
              <View key={fill.id} style={styles.historyRow}>
                <View style={styles.historyMain}>
                  <ThemedText style={styles.historyPair}>{fill.pair}</ThemedText>
                  <View style={[styles.sideBadge, fill.side === "buy" ? styles.sideBadgeBuy : styles.sideBadgeSell]}>
                    <ThemedText style={styles.sideBadgeText}>{fill.side.toUpperCase()}</ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.historyLots}>{unitsToLots(fill.quantityUnits).toFixed(2)} @ {formatPrice(fill.fillPrice, fill.pair)}</ThemedText>
                <ThemedText style={[styles.historyPnl, { color: (fill.realizedPnlCents || 0) >= 0 ? THEME.success : THEME.danger }]}>
                  {fill.realizedPnlCents !== undefined ? `${fill.realizedPnlCents >= 0 ? "+" : ""}${formatCurrency(fill.realizedPnlCents)}` : "—"}
                </ThemedText>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={32} color={THEME.textMuted} />
              <ThemedText style={styles.emptyStateText}>No trade history</ThemedText>
            </View>
          )
        )}
      </ScrollView>
    </View>
  );

  const renderLeaderboardPanel = () =>
    showLeaderboard ? (
      <View style={styles.leaderboardOverlay}>
        <View style={styles.leaderboardPanel}>
          <View style={styles.leaderboardHeader}>
            <ThemedText style={styles.leaderboardTitle}>Leaderboard</ThemedText>
            <Pressable onPress={() => setShowLeaderboard(false)}>
              <Feather name="x" size={20} color={THEME.textSecondary} />
            </Pressable>
          </View>
          <Leaderboard entries={leaderboard || []} currentUserId={user?.id} compact />
        </View>
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

  const renderSLTPDragModal = () =>
    sltpDragModal ? (
      <Modal
        visible={true}
        transparent
        animationType="fade"
        onRequestClose={cancelSLTPDrag}
      >
        <Pressable style={styles.sltpModalOverlay} onPress={cancelSLTPDrag}>
          <View style={styles.sltpModalContent}>
            <View style={styles.sltpModalHeader}>
              <ThemedText style={styles.sltpModalTitle}>
                Move {sltpDragModal.type === 'sl' ? 'Stop Loss' : 'Take Profit'}?
              </ThemedText>
              <Pressable onPress={cancelSLTPDrag}>
                <Feather name="x" size={20} color={THEME.textMuted} />
              </Pressable>
            </View>
            
            <View style={styles.sltpModalBody}>
              <View style={styles.sltpPriceRow}>
                <ThemedText style={styles.sltpLabel}>From:</ThemedText>
                <ThemedText style={[styles.sltpPrice, sltpDragModal.type === 'sl' ? styles.slPrice : styles.tpPrice]}>
                  {formatPrice(sltpDragModal.originalPrice)}
                </ThemedText>
              </View>
              <View style={styles.sltpArrow}>
                <Feather name="arrow-down" size={20} color={THEME.textMuted} />
              </View>
              <View style={styles.sltpPriceRow}>
                <ThemedText style={styles.sltpLabel}>To:</ThemedText>
                <ThemedText style={[styles.sltpPrice, sltpDragModal.type === 'sl' ? styles.slPrice : styles.tpPrice]}>
                  {formatPrice(sltpDragModal.newPrice)}
                </ThemedText>
              </View>
              
              <View style={styles.sltpDiff}>
                <ThemedText style={styles.sltpDiffLabel}>Change:</ThemedText>
                <ThemedText style={[
                  styles.sltpDiffValue,
                  (sltpDragModal.newPrice - sltpDragModal.originalPrice) >= 0 ? styles.positive : styles.negative
                ]}>
                  {(sltpDragModal.newPrice - sltpDragModal.originalPrice) >= 0 ? '+' : ''}
                  {((sltpDragModal.newPrice - sltpDragModal.originalPrice) * 10000).toFixed(1)} pips
                </ThemedText>
              </View>
            </View>

            <View style={styles.sltpModalActions}>
              <Pressable style={styles.sltpCancelBtn} onPress={cancelSLTPDrag}>
                <ThemedText style={styles.sltpCancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.sltpConfirmBtn, sltpDragModal.type === 'sl' ? styles.slConfirmBtn : styles.tpConfirmBtn]}
                onPress={confirmSLTPDrag}
              >
                <ThemedText style={styles.sltpConfirmText}>
                  Confirm {sltpDragModal.type.toUpperCase()}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    ) : null;

  if (isDesktop) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ArenaLayout
          header={renderHeader()}
          toolDock={
            <ToolDock
              selectedTool={selectedTool}
              onToolSelect={setSelectedTool}
              onShowToast={(msg) => showToast(msg, 'info')}
              drawnLines={drawnLines}
              onDeleteLine={handleDeleteLine}
            />
          }
          chartToolbar={
            <ChartToolbar
              symbol={selectedPair}
              currentQuote={currentQuote ? {
                bid: currentQuote.bid,
                ask: currentQuote.ask,
                spreadPips: currentQuote.spreadPips,
                timestamp: currentQuote.timestamp,
                status: currentQuote.status,
              } : undefined}
              timeframe={selectedTimeframe}
              onTimeframeChange={setSelectedTimeframe}
              formatPrice={(price) => formatPrice(price, selectedPair)}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
            />
          }
          chart={(isBlotterCollapsed: boolean) => (
            <TradingViewChart
              key={`${selectedPair}-${selectedTimeframe}-${isBlotterCollapsed}`}
              pair={selectedPair}
              height={isFullscreen ? height - 120 : height - (isBlotterCollapsed ? 272 : 520)}
              positions={positions.filter((p) => p.pair === selectedPair)}
              orders={pendingOrders.filter((o) => o.pair === selectedPair)}
              timeframe={selectedTimeframe}
              currentQuote={currentQuote ? { bid: currentQuote.bid, ask: currentQuote.ask } : undefined}
              selectedTool={selectedTool}
              drawnLines={drawnLines}
              onChartClick={handleChartClick}
              onSLTPDrag={handleSLTPDrag}
            />
          )}
          marketWatch={
            <MarketWatch
              pairs={pairs}
              quotes={quotes}
              selectedPair={selectedPair}
              onSelectPair={setSelectedPair}
              formatPrice={formatPrice}
              searchRef={searchInputRef}
              isMockData={marketStatus?.isUsingMock ?? true}
            />
          }
          orderTicket={
            <OrderTicket
              selectedPair={selectedPair}
              currentQuote={currentQuote}
              orderSide={orderSide}
              orderType={orderType}
              lotSize={lotSize}
              limitPrice={limitPrice}
              stopPrice={stopPrice}
              stopLoss={stopLoss}
              takeProfit={takeProfit}
              oneClickTrading={oneClickTrading}
              isTradeDisabled={isTradeDisabled}
              isPending={placeOrderMutation.isPending}
              onOrderSideChange={setOrderSide}
              onOrderTypeChange={setOrderType}
              onLotSizeChange={setLotSize}
              onLimitPriceChange={setLimitPrice}
              onStopPriceChange={setStopPrice}
              onStopLossChange={setStopLoss}
              onTakeProfitChange={setTakeProfit}
              onOneClickTradingChange={setOneClickTrading}
              onPlaceOrder={handlePlaceOrder}
              formatPrice={(price) => formatPrice(price, selectedPair)}
            />
          }
          blotter={
            <Blotter
              positions={positions}
              pendingOrders={pendingOrders}
              closedTrades={(closedTrades || []).filter(t => t.status === 'closed')}
              allTrades={closedTrades || []}
              deals={deals || []}
              orderHistory={orderHistory || []}
              quotes={quotes}
              onClosePosition={(positionId) => closePositionMutation.mutate(positionId)}
              onPartialClose={(positionId, lots, percentage) => partialCloseMutation.mutate({ positionId, lots, percentage })}
              onEditPosition={(positionId, sl, tp) => editPositionMutation.mutate({ positionId, stopLossPrice: sl, takeProfitPrice: tp })}
              onCancelOrder={(orderId) => cancelOrderMutation.mutate(orderId)}
              onEditOrder={(orderId, updates) => editOrderMutation.mutate({ orderId, ...updates })}
              formatPrice={formatPrice}
              formatCurrency={formatCurrency}
              unitsToLots={unitsToLots}
              balance={competition.startingBalanceCents}
              equity={entry.equityCents}
              pnl={unrealizedPnl}
              onCloseAll={() => {
                positions.forEach(pos => closePositionMutation.mutate(pos.id));
              }}
            />
          }
          blotterDockButton={
            <CompetitionSwitcher
              currentCompetitionId={competition.id}
              currentCompetitionTitle={competition.title}
              currentRank={entry.rank}
              onSwitchCompetition={(newId) => {
                navigation.navigate('Arena', { id: newId });
              }}
            />
          }
          overlays={
            <>
              {renderLeaderboardPanel()}
              {renderToast()}
              {renderSLTPDragModal()}
            </>
          }
          isFullscreen={isFullscreen}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView 
        style={styles.mobileScroll} 
        contentContainerStyle={styles.mobileContent}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        {renderInstrumentSelector()}
        {renderChartSection()}
        {renderOrderPanel()}
        {renderPositionsPanel()}
      </ScrollView>
      {renderLeaderboardPanel()}
      {renderToast()}
      {renderSLTPDragModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: THEME.textMuted,
    fontSize: 16,
  },
  mobileScroll: {
    flex: 1,
  },
  mobileContent: {
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: THEME.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
  },
  competitionName: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 59, 59, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timerText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.accent,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  dataChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dataChipMock: {
    backgroundColor: "rgba(255, 171, 0, 0.15)",
  },
  dataChipLive: {
    backgroundColor: "rgba(0, 200, 83, 0.15)",
  },
  dataChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotMock: {
    backgroundColor: "#FFAB00",
  },
  dotLive: {
    backgroundColor: THEME.success,
  },
  dataChipText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  textMock: {
    color: "#FFAB00",
  },
  textLive: {
    color: THEME.success,
  },
  leaderboardButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: THEME.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },

  instrumentSelector: {
    backgroundColor: THEME.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    paddingVertical: 8,
  },
  instrumentList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  instrumentCard: {
    backgroundColor: THEME.bgElevated,
    borderRadius: 8,
    padding: 12,
    minWidth: 140,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: "hidden",
  },
  instrumentCardSelected: {
    borderColor: THEME.accent,
  },
  instrumentPair: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME.textSecondary,
    marginBottom: 8,
  },
  instrumentPairSelected: {
    color: THEME.textPrimary,
  },
  instrumentPrices: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  instrumentBid: {
    ...TerminalTypography.price,
    color: THEME.danger,
  },
  instrumentSpread: {
    ...TerminalTypography.tableCell,
    fontSize: 10,
    color: THEME.textMuted,
  },
  instrumentAsk: {
    ...TerminalTypography.price,
    color: THEME.success,
  },
  priceUp: {
    color: THEME.success,
  },
  priceDown: {
    color: THEME.danger,
  },

  chartSection: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: THEME.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  symbolInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chartSymbol: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  chartPrice: {
    ...TerminalTypography.priceLarge,
  },
  timeframeButtons: {
    flexDirection: "row",
    backgroundColor: THEME.bgElevated,
    borderRadius: 6,
    padding: 2,
  },
  timeframeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  timeframeBtnActive: {
    backgroundColor: THEME.accent,
  },
  timeframeBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.textMuted,
  },
  timeframeBtnTextActive: {
    color: THEME.textPrimary,
  },
  chartContainer: {
    flex: 1,
    minHeight: 280,
  },

  orderPanel: {
    backgroundColor: THEME.bgCard,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  orderPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  orderPanelTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  oneClickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  oneClickLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  toggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: THEME.bgElevated,
    padding: 2,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: THEME.accent,
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: THEME.textMuted,
  },
  toggleKnobActive: {
    backgroundColor: THEME.textPrimary,
    marginLeft: "auto",
  },

  orderTypeRow: {
    flexDirection: "row",
    backgroundColor: THEME.bgElevated,
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  orderTypeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  orderTypeBtnActive: {
    backgroundColor: THEME.bgCard,
  },
  orderTypeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.textMuted,
  },
  orderTypeBtnTextActive: {
    color: THEME.textPrimary,
  },

  lotSizeSection: {
    marginBottom: 16,
  },
  inputLabel: {
    ...TerminalTypography.label,
    marginBottom: 8,
  },
  lotSizeInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  lotSizeInput: {
    flex: 1,
    backgroundColor: THEME.bgInput,
    borderRadius: TerminalRadius.sm,
    paddingHorizontal: TerminalSpacing.lg,
    paddingVertical: TerminalSpacing.lg,
    ...TerminalTypography.priceLarge,
    fontSize: 18,
    textAlign: "center",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  quickLotRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 6,
  },
  quickLotBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: THEME.bgElevated,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  quickLotBtnActive: {
    backgroundColor: "rgba(255, 59, 59, 0.15)",
    borderColor: THEME.accent,
  },
  quickLotText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.textMuted,
  },
  quickLotTextActive: {
    color: THEME.accent,
  },

  priceInputSection: {
    marginBottom: 16,
  },
  priceInputField: {
    backgroundColor: THEME.bgInput,
    borderRadius: TerminalRadius.sm,
    paddingHorizontal: TerminalSpacing.lg,
    paddingVertical: TerminalSpacing.lg,
    ...TerminalTypography.price,
    fontSize: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },

  slTpRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  slTpField: {
    flex: 1,
  },
  slTpLabel: {
    ...TerminalTypography.label,
    marginBottom: 6,
  },
  slTpInput: {
    backgroundColor: THEME.bgInput,
    borderRadius: TerminalRadius.sm,
    paddingHorizontal: TerminalSpacing.lg,
    paddingVertical: TerminalSpacing.md,
    ...TerminalTypography.price,
    fontSize: 13,
    borderWidth: 1,
    borderColor: THEME.border,
    textAlign: "center",
  },

  tradeButtons: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 16,
    gap: 8,
  },
  tradeBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 2,
  },
  tradeBtnActive: {
    borderWidth: 3,
  },
  sellBtn: {
    backgroundColor: "rgba(255, 59, 59, 0.1)",
    borderColor: THEME.danger,
  },
  buyBtn: {
    backgroundColor: "rgba(0, 200, 83, 0.1)",
    borderColor: THEME.success,
  },
  tradeBtnPrice: {
    ...TerminalTypography.priceLarge,
    fontSize: 16,
    marginBottom: 2,
  },
  tradeBtnLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.textSecondary,
    letterSpacing: 1,
  },
  spreadBadge: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  spreadValue: {
    ...TerminalTypography.priceLarge,
  },
  spreadLabel: {
    fontSize: 8,
    fontWeight: "600",
    color: THEME.textMuted,
    letterSpacing: 0.5,
  },

  executeBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  executeBtnBuy: {
    backgroundColor: THEME.success,
  },
  executeBtnSell: {
    backgroundColor: THEME.danger,
  },
  executeBtnDisabled: {
    opacity: 0.5,
  },
  executeBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.textPrimary,
    letterSpacing: 0.5,
  },
  disabledNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    backgroundColor: THEME.bgElevated,
    borderRadius: 6,
  },
  disabledText: {
    fontSize: 12,
    color: THEME.textMuted,
  },

  positionsPanel: {
    backgroundColor: THEME.bgCard,
    borderRadius: 12,
    margin: 16,
    marginTop: 0,
    borderWidth: 1,
    borderColor: THEME.border,
    maxHeight: 300,
  },
  panelHeader: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  panelTabs: {
    flexDirection: "row",
    paddingHorizontal: 8,
  },
  panelTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  panelTabActive: {
    borderBottomColor: THEME.accent,
  },
  panelTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.textMuted,
  },
  panelTabTextActive: {
    color: THEME.textPrimary,
  },
  tabBadge: {
    backgroundColor: THEME.bgElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: THEME.accent,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: THEME.textMuted,
  },
  tabBadgeTextActive: {
    color: THEME.textPrimary,
  },
  panelContent: {
    flex: 1,
    padding: 12,
  },

  positionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.bgElevated,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  positionMain: {
    flex: 1,
  },
  positionSymbol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  positionPair: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  sideBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sideBadgeBuy: {
    backgroundColor: "rgba(0, 200, 83, 0.2)",
  },
  sideBadgeSell: {
    backgroundColor: "rgba(255, 59, 59, 0.2)",
  },
  sideBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: THEME.textPrimary,
    letterSpacing: 0.5,
  },
  typeBadge: {
    backgroundColor: "rgba(255, 59, 59, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: THEME.accent,
    letterSpacing: 0.5,
  },
  positionLots: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  positionDetails: {
    alignItems: "flex-end",
    marginRight: 12,
  },
  positionPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  positionLabel: {
    fontSize: 10,
    color: THEME.textMuted,
  },
  positionValue: {
    ...TerminalTypography.tableCell,
    color: THEME.textSecondary,
  },
  positionPnl: {
    ...TerminalTypography.price,
    fontWeight: "700",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(255, 59, 59, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.bgElevated,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  historyMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  historyPair: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.textPrimary,
  },
  historyLots: {
    ...TerminalTypography.tableCell,
    color: THEME.textSecondary,
    flex: 1,
    textAlign: "center",
  },
  historyPnl: {
    ...TerminalTypography.price,
    fontWeight: "700",
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 13,
    color: THEME.textMuted,
    marginTop: 8,
  },

  desktopMain: {
    flex: 1,
    flexDirection: "row",
  },
  desktopLeft: {
    flex: 1,
    flexDirection: "column",
  },
  desktopRight: {
    width: 340,
    borderLeftWidth: 1,
    borderLeftColor: THEME.border,
    backgroundColor: THEME.bg,
  },

  leaderboardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  leaderboardPanel: {
    backgroundColor: THEME.bgCard,
    borderRadius: 12,
    padding: 16,
    width: 320,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  leaderboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  leaderboardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: THEME.textPrimary,
  },

  toast: {
    position: "absolute",
    bottom: 100,
    left: "50%",
    transform: [{ translateX: -150 }],
    width: 300,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: THEME.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    zIndex: 2000,
  },
  toastSuccess: {
    borderColor: THEME.success,
    backgroundColor: "rgba(0, 200, 83, 0.15)",
  },
  toastError: {
    borderColor: THEME.danger,
    backgroundColor: "rgba(255, 59, 59, 0.15)",
  },
  toastText: {
    fontSize: 13,
    color: THEME.textPrimary,
    flex: 1,
  },

  sltpModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  sltpModalContent: {
    backgroundColor: THEME.bgCard,
    borderRadius: 12,
    width: 320,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: "hidden",
  },
  sltpModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    backgroundColor: THEME.bgElevated,
  },
  sltpModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  sltpModalBody: {
    padding: 20,
    alignItems: "center",
  },
  sltpPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sltpLabel: {
    fontSize: 13,
    color: THEME.textMuted,
    width: 50,
  },
  sltpPrice: {
    ...TerminalTypography.price,
    fontSize: 18,
    fontWeight: "700",
  },
  slPrice: {
    color: THEME.danger,
  },
  tpPrice: {
    color: THEME.success,
  },
  sltpArrow: {
    paddingVertical: 8,
  },
  sltpDiff: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  sltpDiffLabel: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  sltpDiffValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  positive: {
    color: THEME.success,
  },
  negative: {
    color: THEME.danger,
  },
  sltpModalActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  sltpCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: THEME.border,
  },
  sltpCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME.textMuted,
  },
  sltpConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  slConfirmBtn: {
    backgroundColor: "rgba(234, 57, 67, 0.2)",
  },
  tpConfirmBtn: {
    backgroundColor: "rgba(22, 199, 132, 0.2)",
  },
  sltpConfirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.textPrimary,
  },

});

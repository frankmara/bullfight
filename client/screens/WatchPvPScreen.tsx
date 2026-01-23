import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Pressable,
  FlatList,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ChatPanel } from "@/components/ChatPanel";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePresence } from "@/hooks/usePresence";

type WatchPvPRouteProp = RouteProp<RootStackParamList, "WatchPvP">;

interface TraderStats {
  id: string;
  username: string;
  equityCents: number;
  startingBalanceCents: number;
  cashCents: number;
  openPositionsCount: number;
  pnlCents: number;
  returnPct: number;
}

interface WatchData {
  id: string;
  name: string;
  status: string;
  liveStatus: string;
  chatEnabled: boolean;
  bettingEnabled: boolean;
  streamEmbedType: string;
  streamUrl: string | null;
  startAt: string | null;
  endAt: string | null;
  stakeTokens: number;
  challenger: TraderStats;
  invitee: TraderStats;
  viewerCount: number;
  lastUpdatedAt: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatPercent(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function formatTimeRemaining(endAt: string | null): string {
  if (!endAt) return "No end time";
  const end = new Date(endAt);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return "Ended";
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s remaining`;
  }
  return `${seconds}s remaining`;
}

function TraderCard({ trader, label, isLeading }: { trader: TraderStats; label: string; isLeading: boolean }) {
  const pnlColor = trader.pnlCents >= 0 ? Colors.dark.success : Colors.dark.danger;
  
  return (
    <View style={[styles.traderCard, isLeading && styles.traderCardLeading]}>
      <View style={styles.traderHeader}>
        <View style={styles.traderAvatar}>
          <ThemedText style={styles.avatarText}>
            {trader.username?.[0]?.toUpperCase() || "?"}
          </ThemedText>
        </View>
        <View style={styles.traderInfo}>
          <ThemedText style={styles.traderLabel}>{label}</ThemedText>
          <ThemedText style={styles.traderName}>{trader.username || "Unknown"}</ThemedText>
        </View>
        {isLeading ? (
          <View style={styles.leadingBadge}>
            <Feather name="trending-up" size={12} color={Colors.dark.success} />
            <ThemedText style={styles.leadingText}>Leading</ThemedText>
          </View>
        ) : null}
      </View>
      
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>Equity</ThemedText>
          <ThemedText style={styles.statValue}>{formatCurrency(trader.equityCents)}</ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>P&L</ThemedText>
          <ThemedText style={[styles.statValue, { color: pnlColor }]}>
            {formatCurrency(trader.pnlCents)}
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>Return</ThemedText>
          <ThemedText style={[styles.statValue, { color: pnlColor }]}>
            {formatPercent(trader.returnPct)}
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>Positions</ThemedText>
          <ThemedText style={styles.statValue}>{trader.openPositionsCount}</ThemedText>
        </View>
      </View>
    </View>
  );
}

function LocalChatPanel({ chatEnabled, matchId }: { chatEnabled: boolean; matchId: string }) {
  if (!chatEnabled) {
    return (
      <View style={styles.chatDisabled}>
        <Feather name="message-circle" size={32} color={Colors.dark.textMuted} />
        <ThemedText style={styles.chatDisabledText}>Chat is disabled for this match</ThemedText>
      </View>
    );
  }
  
  return (
    <ChatPanel 
      channelKind="PVP_MATCH" 
      refId={matchId} 
      enabled={chatEnabled}
      style={styles.chatPanel}
    />
  );
}

function StreamPlaceholder() {
  return (
    <View style={styles.streamPlaceholder}>
      <View style={styles.streamIcon}>
        <Feather name="video" size={48} color={Colors.dark.textMuted} />
      </View>
      <ThemedText style={styles.streamText}>Stream Coming Soon</ThemedText>
      <ThemedText style={styles.streamSubtext}>
        Live video feed will be displayed here
      </ThemedText>
    </View>
  );
}

function BetBehindPanel({ bettingEnabled }: { bettingEnabled: boolean }) {
  if (!bettingEnabled) {
    return null;
  }
  
  return (
    <View style={styles.betBehindPanel}>
      <View style={styles.betBehindHeader}>
        <Feather name="dollar-sign" size={16} color={Colors.dark.warning} />
        <ThemedText style={styles.betBehindTitle}>Bet Behind</ThemedText>
        <View style={styles.betBehindBadge}>
          <ThemedText style={styles.betBehindBadgeText}>Coming Soon</ThemedText>
        </View>
      </View>
      <ThemedText style={styles.betBehindText}>
        Place bets on who will win this match. Feature coming soon.
      </ThemedText>
    </View>
  );
}

export default function WatchPvPScreen() {
  const route = useRoute<WatchPvPRouteProp>();
  const { matchId } = route.params;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 1024;
  const [timeRemaining, setTimeRemaining] = React.useState("");
  
  const { viewerCount: realtimeViewerCount, liveStatus: realtimeLiveStatus } = usePresence({
    matchId,
    enabled: true,
  });
  
  const { data, isLoading, error, refetch, isRefetching } = useQuery<WatchData>({
    queryKey: ["/api/watch/pvp", matchId],
    refetchInterval: 5000,
  });
  
  React.useEffect(() => {
    if (data?.endAt) {
      const updateTimer = () => {
        setTimeRemaining(formatTimeRemaining(data.endAt));
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [data?.endAt]);
  
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <LoadingSpinner />
      </View>
    );
  }
  
  if (error || !data) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Feather name="alert-circle" size={48} color={Colors.dark.danger} />
        <ThemedText style={styles.errorText}>Failed to load match data</ThemedText>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <ThemedText style={styles.retryText}>Retry</ThemedText>
        </Pressable>
      </View>
    );
  }
  
  const challengerLeading = data.challenger.returnPct > data.invitee.returnPct;
  const inviteeLeading = data.invitee.returnPct > data.challenger.returnPct;
  
  const effectiveLiveStatus = realtimeLiveStatus || data.liveStatus;
  const effectiveViewerCount = realtimeViewerCount > 0 ? realtimeViewerCount : (data.viewerCount || 0);
  
  const liveStatusColor = {
    live: Colors.dark.success,
    scheduled: Colors.dark.warning,
    ended: Colors.dark.textMuted,
    offline: Colors.dark.textMuted,
  }[effectiveLiveStatus] || Colors.dark.textMuted;
  
  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.dark.accent}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.liveStatusBadge, { backgroundColor: liveStatusColor + "20" }]}>
              {effectiveLiveStatus === "live" ? (
                <View style={[styles.liveDot, { backgroundColor: liveStatusColor }]} />
              ) : null}
              <ThemedText style={[styles.liveStatusText, { color: liveStatusColor }]}>
                {effectiveLiveStatus.toUpperCase()}
              </ThemedText>
            </View>
            {effectiveViewerCount > 0 ? (
              <View style={styles.viewerCountBadge}>
                <Feather name="eye" size={14} color={Colors.dark.accent} />
                <ThemedText style={styles.viewerCountText}>
                  {effectiveViewerCount} {effectiveViewerCount === 1 ? "viewer" : "viewers"}
                </ThemedText>
              </View>
            ) : null}
            <ThemedText style={styles.matchTitle}>{data.name || "PvP Match"}</ThemedText>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.stakeContainer}>
              <Feather name="zap" size={14} color={Colors.dark.accent} />
              <ThemedText style={styles.stakeText}>{data.stakeTokens} tokens stake</ThemedText>
            </View>
            <ThemedText style={styles.timeRemaining}>{timeRemaining}</ThemedText>
            <ThemedText style={styles.lastUpdated}>
              Updated: {new Date(data.lastUpdatedAt).toLocaleTimeString()}
            </ThemedText>
          </View>
        </View>
        
        <View style={styles.scoreboard}>
          <TraderCard 
            trader={data.challenger} 
            label="Challenger" 
            isLeading={challengerLeading} 
          />
          <View style={styles.vsContainer}>
            <ThemedText style={styles.vsText}>VS</ThemedText>
          </View>
          <TraderCard 
            trader={data.invitee} 
            label="Invitee" 
            isLeading={inviteeLeading} 
          />
        </View>
        
        <View style={[styles.mainContent, isDesktop && styles.mainContentDesktop]}>
          <View style={[styles.streamContainer, isDesktop && styles.streamContainerDesktop]}>
            <StreamPlaceholder />
          </View>
          
          {isDesktop ? (
            <View style={styles.chatContainer}>
              <LocalChatPanel chatEnabled={data.chatEnabled} matchId={matchId} />
            </View>
          ) : null}
        </View>
        
        {!isDesktop ? (
          <View style={styles.mobileChatContainer}>
            <LocalChatPanel chatEnabled={data.chatEnabled} matchId={matchId} />
          </View>
        ) : null}
        
        <BetBehindPanel bettingEnabled={data.bettingEnabled} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  liveStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveStatusText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  viewerCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.accent + "20",
  },
  viewerCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.accent,
  },
  matchTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  stakeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stakeText: {
    fontSize: 14,
    color: Colors.dark.accent,
    fontWeight: "600",
  },
  timeRemaining: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.warning,
  },
  lastUpdated: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  scoreboard: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: Spacing.md,
    flexWrap: "wrap",
  },
  traderCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  traderCardLeading: {
    borderColor: Colors.dark.success,
    borderWidth: 2,
  },
  traderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  traderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.accent + "30",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.accent,
  },
  traderInfo: {
    flex: 1,
  },
  traderLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  traderName: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  leadingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.dark.success + "20",
    borderRadius: BorderRadius.sm,
  },
  leadingText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.success,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  statItem: {
    flex: 1,
    minWidth: 80,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  vsContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
  },
  vsText: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.dark.textMuted,
  },
  mainContent: {
    gap: Spacing.lg,
  },
  mainContentDesktop: {
    flexDirection: "row",
  },
  streamContainer: {
    flex: 1,
  },
  streamContainerDesktop: {
    flex: 2,
  },
  streamPlaceholder: {
    aspectRatio: 16 / 9,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderStyle: "dashed",
  },
  streamIcon: {
    marginBottom: Spacing.md,
  },
  streamText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.textMuted,
  },
  streamSubtext: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginTop: Spacing.xs,
  },
  chatContainer: {
    flex: 1,
    minWidth: 300,
  },
  mobileChatContainer: {
    marginTop: Spacing.lg,
  },
  chatPanel: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    height: 400,
    overflow: "hidden",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  chatTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  chatMessages: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  chatPlaceholder: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: "center",
  },
  chatInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  chatInput: {
    flex: 1,
    height: 40,
    backgroundColor: Colors.dark.backgroundRoot,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    color: Colors.dark.text,
    fontSize: 14,
  },
  chatSendButton: {
    width: 40,
    height: 40,
    backgroundColor: Colors.dark.accent,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  chatDisabled: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  chatDisabledText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  betBehindPanel: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.warning + "40",
  },
  betBehindHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  betBehindTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.warning,
  },
  betBehindBadge: {
    backgroundColor: Colors.dark.textMuted + "30",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  betBehindBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.dark.textMuted,
  },
  betBehindText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  errorText: {
    fontSize: 16,
    color: Colors.dark.textMuted,
    marginTop: Spacing.md,
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.dark.accent,
    borderRadius: BorderRadius.md,
  },
  retryText: {
    color: Colors.dark.buttonText,
    fontWeight: "600",
  },
});

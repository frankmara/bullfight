import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import { ThemedText } from "@/components/ThemedText";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";

function useSafeTabBarHeight() {
  try {
    return useBottomTabBarHeight();
  } catch {
    return 0;
  }
}

function useSafeHeaderHeight() {
  try {
    return useHeaderHeight();
  } catch {
    return 0;
  }
}

interface ArenaMatch {
  id: string;
  name: string | null;
  challengerId: string;
  inviteeId: string | null;
  inviteeEmail: string;
  status: string;
  stakeCents: number;
  stakeTokens?: number;
  startingBalanceCents: number;
  startAt: string | null;
  endAt: string | null;
  visibility: string;
  arenaListed: boolean;
  chatEnabled: boolean;
  bettingEnabled: boolean;
  scheduledLiveAt: string | null;
  liveStatus: string;
  competitionId: string | null;
  challengerUsername: string;
  challengerAvatar: string | null;
  inviteeUsername: string;
  inviteeAvatar: string | null;
  viewersCount: number;
  chatMessageCount: number;
  createdAt: string;
}

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_NAV_HEIGHT = 64;

type TabType = "LIVE" | "UPCOMING" | "ALL";

export default function ArenaModeScreen() {
  const insets = useSafeAreaInsets();
  const rawHeaderHeight = useSafeHeaderHeight();
  const tabBarHeight = useSafeTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
  const headerHeight = isDesktop ? DESKTOP_NAV_HEIGHT : Math.max(rawHeaderHeight, insets.top);
  const bottomPadding = isDesktop ? Spacing.xl : tabBarHeight + Spacing.lg;

  const [activeTab, setActiveTab] = useState<TabType>("ALL");

  const isWeb = Platform.OS === "web";
  const maxWidth = 1200;
  const containerWidth = isWeb ? Math.min(width - Spacing.lg * 2, maxWidth) : width - Spacing.lg * 2;

  const {
    data: matches,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<ArenaMatch[]>({
    queryKey: ["/api/arena-mode/matches", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/arena-mode/matches?status=${activeTab}`);
      if (!res.ok) throw new Error("Failed to fetch matches");
      return res.json();
    },
  });

  const handleWatchMatch = (match: ArenaMatch) => {
    if (match.competitionId) {
      navigation.navigate("Arena", { competitionId: match.competitionId });
    } else {
      navigation.navigate("PvPDetail" as any, { id: match.id });
    }
  };

  const getLiveStatusBadge = (match: ArenaMatch) => {
    const isLive = match.liveStatus === "live" || match.status === "active";
    if (isLive) {
      return { label: "LIVE", color: Colors.dark.danger, icon: "radio" as const };
    }
    if (match.liveStatus === "scheduled" || match.scheduledLiveAt) {
      return { label: "UPCOMING", color: Colors.dark.warning, icon: "clock" as const };
    }
    if (match.status === "pending" || match.status === "payment_pending") {
      return { label: "PENDING", color: Colors.dark.textMuted, icon: "loader" as const };
    }
    return { label: "ENDED", color: Colors.dark.textMuted, icon: "check-circle" as const };
  };

  const formatDuration = (startAt: string | null, endAt: string | null) => {
    if (!startAt || !endAt) return "TBD";
    const durationHours = Math.round(
      (new Date(endAt).getTime() - new Date(startAt).getTime()) / (1000 * 60 * 60)
    );
    return `${durationHours}h`;
  };

  const renderMatchCard = ({ item }: { item: ArenaMatch }) => {
    const statusBadge = getLiveStatusBadge(item);
    const isLive = statusBadge.label === "LIVE";

    return (
      <Pressable
        style={[styles.matchCard, isLive && styles.matchCardLive]}
        onPress={() => handleWatchMatch(item)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.color + "20" }]}>
            <Feather name={statusBadge.icon} size={12} color={statusBadge.color} />
            <ThemedText style={[styles.statusText, { color: statusBadge.color }]}>
              {statusBadge.label}
            </ThemedText>
          </View>
          <View style={styles.stakeBadge}>
            <Feather name="zap" size={12} color={Colors.dark.gold} />
            <ThemedText style={styles.stakeText}>
              {item.stakeTokens ?? Math.round(item.stakeCents / 100)} tokens
            </ThemedText>
          </View>
        </View>

        <View style={styles.matchupContainer}>
          <View style={styles.traderCard}>
            <View style={styles.avatarPlaceholder}>
              <ThemedText style={styles.avatarText}>
                {item.challengerUsername.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <ThemedText style={styles.traderName} numberOfLines={1}>
              {item.challengerUsername}
            </ThemedText>
          </View>

          <View style={styles.vsContainer}>
            <ThemedText style={styles.vsText}>VS</ThemedText>
          </View>

          <View style={styles.traderCard}>
            <View style={[styles.avatarPlaceholder, styles.avatarSecondary]}>
              <ThemedText style={styles.avatarText}>
                {item.inviteeUsername.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <ThemedText style={styles.traderName} numberOfLines={1}>
              {item.inviteeUsername}
            </ThemedText>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={12} color={Colors.dark.textMuted} />
              <ThemedText style={styles.metaText}>
                {formatDuration(item.startAt, item.endAt)}
              </ThemedText>
            </View>
            {item.viewersCount > 0 ? (
              <View style={styles.metaItem}>
                <Feather name="eye" size={12} color={Colors.dark.textMuted} />
                <ThemedText style={styles.metaText}>{item.viewersCount}</ThemedText>
              </View>
            ) : null}
            {item.chatEnabled && item.chatMessageCount > 0 ? (
              <View style={styles.metaItem}>
                <Feather name="message-circle" size={12} color={Colors.dark.textMuted} />
                <ThemedText style={styles.metaText}>{item.chatMessageCount}</ThemedText>
              </View>
            ) : null}
          </View>
          <Pressable style={styles.watchButton} onPress={() => handleWatchMatch(item)}>
            <Feather name="play" size={14} color={Colors.dark.buttonText} />
            <ThemedText style={styles.watchButtonText}>Watch</ThemedText>
          </Pressable>
        </View>

        {item.scheduledLiveAt && statusBadge.label !== "LIVE" ? (
          <View style={styles.scheduledRow}>
            <Feather name="calendar" size={12} color={Colors.dark.textMuted} />
            <ThemedText style={styles.scheduledText}>
              {new Date(item.scheduledLiveAt).toLocaleString()}
            </ThemedText>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="tv" size={48} color={Colors.dark.textMuted} />
      <ThemedText style={styles.emptyTitle}>No Matches Found</ThemedText>
      <ThemedText style={styles.emptyText}>
        {activeTab === "LIVE"
          ? "No live matches right now. Check back soon!"
          : activeTab === "UPCOMING"
          ? "No upcoming matches scheduled."
          : "No public arena matches available yet."}
      </ThemedText>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={matches || []}
        keyExtractor={(item) => item.id}
        renderItem={renderMatchCard}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: bottomPadding,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.dark.accent}
          />
        }
        ListHeaderComponent={
          <View style={[styles.contentWrapper, { width: containerWidth }]}>
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <Feather name="tv" size={28} color={Colors.dark.accent} />
                <ThemedText style={styles.pageTitle}>Arena Mode</ThemedText>
              </View>
              <ThemedText style={styles.pageSubtitle}>
                Watch public PvP trading matches live
              </ThemedText>
            </View>

            <View style={styles.tabsContainer}>
              {(["LIVE", "UPCOMING", "ALL"] as TabType[]).map((tab) => (
                <Pressable
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  {tab === "LIVE" ? (
                    <View style={styles.liveIndicator} />
                  ) : null}
                  <ThemedText
                    style={[styles.tabText, activeTab === tab && styles.tabTextActive]}
                  >
                    {tab}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={isLoading ? (
          <View style={styles.loadingContainer}>
            <LoadingSpinner />
            <ThemedText style={styles.loadingText}>Loading matches...</ThemedText>
          </View>
        ) : renderEmptyState()}
        numColumns={isDesktop ? 2 : 1}
        key={isDesktop ? "desktop" : "mobile"}
        columnWrapperStyle={isDesktop ? styles.columnWrapper : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  contentWrapper: {
    alignSelf: "center",
    width: "100%",
    marginBottom: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: 4,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  tabActive: {
    backgroundColor: Colors.dark.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textMuted,
  },
  tabTextActive: {
    color: Colors.dark.buttonText,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.danger,
  },
  columnWrapper: {
    gap: Spacing.md,
    justifyContent: "flex-start",
  },
  matchCard: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    maxWidth: 560,
  },
  matchCardLive: {
    borderColor: Colors.dark.danger,
    shadowColor: Colors.dark.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  stakeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stakeText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.gold,
  },
  matchupContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  traderCard: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSecondary: {
    backgroundColor: Colors.dark.danger,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.buttonText,
  },
  traderName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
    textAlign: "center",
    maxWidth: 100,
  },
  vsContainer: {
    paddingHorizontal: Spacing.md,
  },
  vsText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.dark.textMuted,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  metaRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  watchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.dark.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  watchButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.buttonText,
  },
  scheduledRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  scheduledText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: "center",
    maxWidth: 280,
  },
});

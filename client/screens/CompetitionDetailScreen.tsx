import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { Leaderboard } from "@/components/Leaderboard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuthContext } from "@/context/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";

interface CompetitionDetail {
  id: string;
  title: string;
  theme?: string;
  description?: string;
  status: string;
  buyInCents: number;
  entryCap: number;
  entryCount: number;
  prizePoolCents: number;
  rakeBps: number;
  startAt?: string;
  endAt?: string;
  startingBalanceCents: number;
  allowedPairsJson: string[];
  prizeSplitsJson: number[];
  spreadMarkupPips: number;
  maxSlippagePips: number;
  minOrderIntervalMs: number;
  maxDrawdownPct?: number;
  isJoined?: boolean;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userEmail: string;
  equityCents: number;
  returnPct: number;
}

const DESKTOP_BREAKPOINT = 768;
const MAX_CONTENT_WIDTH = 900;

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (Platform.OS === "web") {
      return Dimensions.get("window").width >= DESKTOP_BREAKPOINT;
    }
    return false;
  });

  React.useEffect(() => {
    if (Platform.OS !== "web") return;

    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setIsDesktop(window.width >= DESKTOP_BREAKPOINT);
    });

    return () => subscription?.remove();
  }, []);

  return isDesktop;
};

const PRIZE_COLORS = {
  gold: "#FFD700",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
};

export default function CompetitionDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<RootStackParamList, "CompetitionDetail">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthContext();
  const { id } = route.params;
  const isDesktop = useIsDesktop();

  const [isJoining, setIsJoining] = useState(false);

  const { data: competition, isLoading } = useQuery<CompetitionDetail>({
    queryKey: ["/api/competitions", id],
  });

  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/competitions", id, "leaderboard"],
    enabled: !!competition,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/competitions/${id}/join`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/competitions"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("Arena", { id });
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to join competition");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleJoin = async () => {
    if (!isAuthenticated) {
      navigation.navigate("Login");
      return;
    }
    setIsJoining(true);
    try {
      await joinMutation.mutateAsync();
    } finally {
      setIsJoining(false);
    }
  };

  const handleEnterArena = () => {
    navigation.navigate("Arena", { id });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <LoadingSpinner />
      </View>
    );
  }

  if (!competition) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ThemedText style={styles.errorText}>Competition not found</ThemedText>
      </View>
    );
  }

  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString()}`;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "TBD";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const prizeSplits = competition.prizeSplitsJson || [60, 30, 10];
  const prizeAmounts = prizeSplits.map(
    (pct) => (competition.prizePoolCents * pct) / 100
  );

  const canJoin = (competition.status === "open" || competition.status === "running") && !competition.isJoined;
  const canEnter =
    competition.isJoined &&
    (competition.status === "open" || competition.status === "running");

  const getPrizeColor = (index: number) => {
    if (index === 0) return PRIZE_COLORS.gold;
    if (index === 1) return PRIZE_COLORS.silver;
    return PRIZE_COLORS.bronze;
  };

  const getPrizeLabel = (index: number) => {
    if (index === 0) return "1st";
    if (index === 1) return "2nd";
    return "3rd";
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { 
          paddingTop: insets.top + 60, 
          paddingBottom: insets.bottom + Spacing.xl,
          alignItems: isDesktop ? "center" : "stretch",
        },
      ]}
    >
      <View style={[styles.innerContainer, isDesktop && styles.desktopContainer]}>
        <View style={[styles.heroSection, Platform.OS === "web" && styles.heroSectionWeb]}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTitleContainer}>
              <ThemedText style={styles.title}>{competition.title}</ThemedText>
              <StatusBadge status={competition.status} size="medium" />
            </View>
            {competition.theme ? (
              <ThemedText style={styles.theme}>{competition.theme}</ThemedText>
            ) : null}
          </View>
          <View style={styles.heroDates}>
            <View style={styles.dateItem}>
              <Feather name="play-circle" size={14} color={Colors.dark.textMuted} />
              <ThemedText style={styles.dateLabel}>Starts</ThemedText>
              <ThemedText style={styles.dateValue}>{formatDate(competition.startAt)}</ThemedText>
            </View>
            <View style={styles.dateDivider} />
            <View style={styles.dateItem}>
              <Feather name="flag" size={14} color={Colors.dark.textMuted} />
              <ThemedText style={styles.dateLabel}>Ends</ThemedText>
              <ThemedText style={styles.dateValue}>{formatDate(competition.endAt)}</ThemedText>
            </View>
          </View>
          {competition.description ? (
            <ThemedText style={styles.description}>{competition.description}</ThemedText>
          ) : null}
        </View>

        <View style={[styles.mainContent, isDesktop && styles.desktopGrid]}>
          <View style={[styles.leftColumn, isDesktop && styles.desktopLeftColumn]}>
            <View style={[styles.prizePoolCard, Platform.OS === "web" && styles.prizePoolCardWeb]}>
              <View style={styles.prizePoolHeader}>
                <Feather name="award" size={20} color={Colors.dark.gold} />
                <ThemedText style={styles.prizePoolLabel}>PRIZE POOL</ThemedText>
              </View>
              <ThemedText style={styles.prizePoolAmount}>
                {formatCurrency(competition.prizePoolCents)}
              </ThemedText>
              <ThemedText style={styles.prizePoolNote}>
                {100 - competition.rakeBps / 100}% of buy-ins distributed
              </ThemedText>
              
              <View style={styles.prizeBreakdown}>
                {prizeSplits.slice(0, 3).map((pct, index) => (
                  <View key={index} style={styles.prizeRow}>
                    <View style={[styles.prizeRankBadge, { backgroundColor: getPrizeColor(index) + "20" }]}>
                      <ThemedText style={[styles.prizeRankText, { color: getPrizeColor(index) }]}>
                        {getPrizeLabel(index)}
                      </ThemedText>
                    </View>
                    <View style={styles.prizeDotLine}>
                      <View style={[styles.prizeDot, { backgroundColor: getPrizeColor(index) }]} />
                      <View style={styles.priceLine} />
                    </View>
                    <View style={styles.prizeAmountContainer}>
                      <ThemedText style={styles.prizeAmount}>
                        {formatCurrency(prizeAmounts[index])}
                      </ThemedText>
                      <ThemedText style={styles.prizePct}>{pct}%</ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.entryCard}>
              <ThemedText style={styles.cardTitle}>Entry Information</ThemedText>
              <View style={styles.entryGrid}>
                <View style={styles.entryItem}>
                  <Feather name="dollar-sign" size={16} color={Colors.dark.accent} />
                  <ThemedText style={styles.entryLabel}>Buy-in</ThemedText>
                  <ThemedText style={styles.entryValue}>
                    {formatCurrency(competition.buyInCents)}
                  </ThemedText>
                </View>
                <View style={styles.entryItem}>
                  <Feather name="users" size={16} color={Colors.dark.accent} />
                  <ThemedText style={styles.entryLabel}>Entries</ThemedText>
                  <ThemedText style={styles.entryValue}>
                    {competition.entryCount} / {competition.entryCap}
                  </ThemedText>
                </View>
                <View style={styles.entryItem}>
                  <Feather name="briefcase" size={16} color={Colors.dark.accent} />
                  <ThemedText style={styles.entryLabel}>Starting Balance</ThemedText>
                  <ThemedText style={styles.entryValue}>
                    {formatCurrency(competition.startingBalanceCents)}
                  </ThemedText>
                </View>
                <View style={styles.entryItem}>
                  <Feather name="percent" size={16} color={Colors.dark.accent} />
                  <ThemedText style={styles.entryLabel}>Max Drawdown</ThemedText>
                  <ThemedText style={styles.entryValue}>
                    {competition.maxDrawdownPct ? `${competition.maxDrawdownPct}%` : "None"}
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={styles.rulesCard}>
              <ThemedText style={styles.cardTitle}>Trading Rules</ThemedText>
              <View style={styles.rulesList}>
                <View style={styles.ruleRow}>
                  <ThemedText style={styles.ruleLabel}>Spread Markup</ThemedText>
                  <ThemedText style={styles.ruleValue}>{competition.spreadMarkupPips} pips</ThemedText>
                </View>
                <View style={styles.ruleRow}>
                  <ThemedText style={styles.ruleLabel}>Max Slippage</ThemedText>
                  <ThemedText style={styles.ruleValue}>{competition.maxSlippagePips} pips</ThemedText>
                </View>
                <View style={styles.ruleRow}>
                  <ThemedText style={styles.ruleLabel}>Order Interval</ThemedText>
                  <ThemedText style={styles.ruleValue}>{competition.minOrderIntervalMs}ms min</ThemedText>
                </View>
              </View>
              
              <ThemedText style={styles.pairsLabel}>Allowed Pairs</ThemedText>
              <View style={styles.pairsList}>
                {competition.allowedPairsJson?.map((pair) => (
                  <View key={pair} style={styles.pairTag}>
                    <ThemedText style={styles.pairText}>{pair}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.rightColumn, isDesktop && styles.desktopRightColumn]}>
            {leaderboard && leaderboard.length > 0 ? (
              <View style={styles.leaderboardCard}>
                <View style={styles.leaderboardHeader}>
                  <Feather name="trending-up" size={18} color={Colors.dark.accent} />
                  <ThemedText style={styles.cardTitle}>Live Standings</ThemedText>
                </View>
                <Leaderboard
                  entries={leaderboard.slice(0, 10)}
                  currentUserId={user?.id}
                  startingBalanceCents={competition.startingBalanceCents}
                  compact
                />
              </View>
            ) : (
              <View style={styles.noLeaderboardCard}>
                <Feather name="bar-chart-2" size={32} color={Colors.dark.textMuted} />
                <ThemedText style={styles.noLeaderboardText}>
                  Leaderboard will appear once the competition starts
                </ThemedText>
              </View>
            )}
          </View>
        </View>

        <View style={styles.actionSection}>
          {!isAuthenticated && (competition.status === "open" || competition.status === "running") ? (
            <Button onPress={() => navigation.navigate("Login")} style={styles.actionButton}>
              Sign In to Join
            </Button>
          ) : null}
          {isAuthenticated && canJoin ? (
            <Button onPress={handleJoin} disabled={isJoining} style={styles.actionButton}>
              {isJoining
                ? "Joining..."
                : `Join Competition - ${formatCurrency(competition.buyInCents)}`}
            </Button>
          ) : null}
          {canEnter ? (
            <Button onPress={handleEnterArena} style={styles.actionButton}>
              Enter Trading Arena
            </Button>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  innerContainer: {
    width: "100%",
  },
  desktopContainer: {
    maxWidth: MAX_CONTENT_WIDTH,
    width: "100%",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  heroSection: {
    marginBottom: Spacing.xl,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  heroSectionWeb: {
    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
  } as any,
  heroHeader: {
    marginBottom: Spacing.md,
  },
  heroTitleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.dark.text,
    flex: 1,
    marginRight: Spacing.md,
  },
  theme: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  heroDates: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  dateItem: {
    flex: 1,
    alignItems: "center",
  },
  dateLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dateValue: {
    fontSize: 13,
    color: Colors.dark.text,
    fontWeight: "600",
    marginTop: Spacing.xs,
  },
  dateDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.dark.border,
    marginHorizontal: Spacing.md,
  },
  description: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  mainContent: {
    marginBottom: Spacing.xl,
  },
  desktopGrid: {
    flexDirection: "row",
    gap: Spacing.xl,
  },
  leftColumn: {
    flex: 1,
  },
  desktopLeftColumn: {
    flex: 1.2,
  },
  rightColumn: {
    marginTop: Spacing.lg,
  },
  desktopRightColumn: {
    flex: 0.8,
    marginTop: 0,
  },
  prizePoolCard: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.gold + "40",
  },
  prizePoolCardWeb: {
    boxShadow: "0 2px 16px rgba(255, 215, 0, 0.1)",
  } as any,
  prizePoolHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  prizePoolLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.gold,
    letterSpacing: 1,
  },
  prizePoolAmount: {
    fontSize: 42,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  prizePoolNote: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  prizeBreakdown: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingTop: Spacing.lg,
  },
  prizeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  prizeRankBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    width: 50,
    alignItems: "center",
  },
  prizeRankText: {
    fontSize: 13,
    fontWeight: "700",
  },
  prizeDotLine: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginHorizontal: Spacing.md,
  },
  prizeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priceLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.dark.border,
    marginLeft: Spacing.sm,
  },
  prizeAmountContainer: {
    alignItems: "flex-end",
  },
  prizeAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  prizePct: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  entryCard: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.lg,
  },
  entryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -Spacing.xs,
  },
  entryItem: {
    width: "50%",
    padding: Spacing.xs,
    marginBottom: Spacing.md,
  },
  entryLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: Spacing.sm,
  },
  entryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    marginTop: Spacing.xs,
  },
  rulesCard: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  rulesList: {
    marginBottom: Spacing.lg,
  },
  ruleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  ruleLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  ruleValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  pairsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pairsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  pairTag: {
    backgroundColor: Colors.dark.backgroundSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.accent + "30",
  },
  pairText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.accent,
  },
  leaderboardCard: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  leaderboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  noLeaderboardCard: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  noLeaderboardText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  actionSection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  actionButton: {
    marginBottom: Spacing.md,
  },
});

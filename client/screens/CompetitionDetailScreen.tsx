import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
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

const trophyGold = require("../../attached_assets/generated_images/gold_trophy_first_place.png");
const trophySilver = require("../../attached_assets/generated_images/silver_trophy_second_place.png");
const trophyBronze = require("../../attached_assets/generated_images/bronze_trophy_third_place.png");

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

export default function CompetitionDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<RootStackParamList, "CompetitionDetail">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthContext();
  const { id } = route.params;

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

  const canJoin = competition.status === "open" && !competition.isJoined;
  const canEnter =
    competition.isJoined &&
    (competition.status === "open" || competition.status === "running");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 60, paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      <View style={styles.header}>
        <ThemedText style={styles.title}>{competition.title}</ThemedText>
        <StatusBadge status={competition.status} size="medium" />
      </View>

      {competition.theme ? (
        <ThemedText style={styles.theme}>{competition.theme}</ThemedText>
      ) : null}

      {competition.description ? (
        <ThemedText style={styles.description}>{competition.description}</ThemedText>
      ) : null}

      <View style={styles.prizeSection}>
        <ThemedText style={styles.sectionLabel}>PRIZE POOL</ThemedText>
        <ThemedText style={styles.prizeAmount}>
          {formatCurrency(competition.prizePoolCents)}
        </ThemedText>
        <ThemedText style={styles.prizeNote}>
          {100 - competition.rakeBps / 100}% of buy-ins
        </ThemedText>
      </View>

      <View style={styles.prizeDistribution}>
        <ThemedText style={styles.sectionTitle}>Prize Distribution</ThemedText>
        <View style={styles.prizeList}>
          {prizeSplits.slice(0, 3).map((pct, index) => (
            <View key={index} style={styles.prizeItem}>
              <Image
                source={
                  index === 0
                    ? trophyGold
                    : index === 1
                    ? trophySilver
                    : trophyBronze
                }
                style={styles.trophyIcon}
              />
              <View style={styles.prizeItemText}>
                <ThemedText style={styles.prizePlace}>
                  {index === 0 ? "1st" : index === 1 ? "2nd" : "3rd"} Place
                </ThemedText>
                <ThemedText style={styles.prizePercent}>{pct}%</ThemedText>
              </View>
              <ThemedText style={styles.prizeValue}>
                {formatCurrency(prizeAmounts[index])}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.detailsSection}>
        <ThemedText style={styles.sectionTitle}>Competition Details</ThemedText>
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Feather name="dollar-sign" size={16} color={Colors.dark.textSecondary} />
            <ThemedText style={styles.detailLabel}>Buy-in</ThemedText>
            <ThemedText style={styles.detailValue}>
              {formatCurrency(competition.buyInCents)}
            </ThemedText>
          </View>
          <View style={styles.detailItem}>
            <Feather name="users" size={16} color={Colors.dark.textSecondary} />
            <ThemedText style={styles.detailLabel}>Entries</ThemedText>
            <ThemedText style={styles.detailValue}>
              {competition.entryCount} / {competition.entryCap}
            </ThemedText>
          </View>
          <View style={styles.detailItem}>
            <Feather name="calendar" size={16} color={Colors.dark.textSecondary} />
            <ThemedText style={styles.detailLabel}>Starts</ThemedText>
            <ThemedText style={styles.detailValue}>
              {formatDate(competition.startAt)}
            </ThemedText>
          </View>
          <View style={styles.detailItem}>
            <Feather name="flag" size={16} color={Colors.dark.textSecondary} />
            <ThemedText style={styles.detailLabel}>Ends</ThemedText>
            <ThemedText style={styles.detailValue}>
              {formatDate(competition.endAt)}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.rulesSection}>
        <ThemedText style={styles.sectionTitle}>Trading Rules</ThemedText>
        <View style={styles.rulesList}>
          <View style={styles.ruleItem}>
            <ThemedText style={styles.ruleLabel}>Starting Balance</ThemedText>
            <ThemedText style={styles.ruleValue}>
              {formatCurrency(competition.startingBalanceCents)}
            </ThemedText>
          </View>
          <View style={styles.ruleItem}>
            <ThemedText style={styles.ruleLabel}>Spread Markup</ThemedText>
            <ThemedText style={styles.ruleValue}>
              {competition.spreadMarkupPips} pips
            </ThemedText>
          </View>
          <View style={styles.ruleItem}>
            <ThemedText style={styles.ruleLabel}>Max Slippage</ThemedText>
            <ThemedText style={styles.ruleValue}>
              {competition.maxSlippagePips} pips
            </ThemedText>
          </View>
          <View style={styles.ruleItem}>
            <ThemedText style={styles.ruleLabel}>Order Interval</ThemedText>
            <ThemedText style={styles.ruleValue}>
              {competition.minOrderIntervalMs}ms min
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.pairsSection}>
        <ThemedText style={styles.sectionTitle}>Allowed Pairs</ThemedText>
        <View style={styles.pairsList}>
          {competition.allowedPairsJson?.map((pair) => (
            <View key={pair} style={styles.pairTag}>
              <ThemedText style={styles.pairText}>{pair}</ThemedText>
            </View>
          ))}
        </View>
      </View>

      {leaderboard && leaderboard.length > 0 ? (
        <View style={styles.leaderboardSection}>
          <ThemedText style={styles.sectionTitle}>Current Standings</ThemedText>
          <Leaderboard
            entries={leaderboard.slice(0, 5)}
            currentUserId={user?.id}
            startingBalanceCents={competition.startingBalanceCents}
          />
        </View>
      ) : null}

      <View style={styles.actionSection}>
        {canJoin && (
          <Button onPress={handleJoin} disabled={isJoining} style={styles.actionButton}>
            {isJoining
              ? "Joining..."
              : `Join Competition - ${formatCurrency(competition.buyInCents)}`}
          </Button>
        )}
        {canEnter && (
          <Button onPress={handleEnterArena} style={styles.actionButton}>
            Enter Trading Arena
          </Button>
        )}
        {!isAuthenticated && (
          <Button onPress={() => navigation.navigate("Login")} style={styles.actionButton}>
            Sign In to Join
          </Button>
        )}
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
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  prizeSection: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.gold,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  prizeAmount: {
    fontSize: 40,
    fontWeight: "700",
    color: Colors.dark.gold,
  },
  prizeNote: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: Spacing.xs,
  },
  prizeDistribution: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.md,
  },
  prizeList: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  prizeItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  trophyIcon: {
    width: 32,
    height: 32,
    marginRight: Spacing.md,
  },
  prizeItemText: {
    flex: 1,
  },
  prizePlace: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  prizePercent: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  prizeValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: "monospace",
  },
  detailsSection: {
    marginBottom: Spacing.xl,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  detailItem: {
    width: "50%",
    backgroundColor: Colors.dark.backgroundDefault,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: Spacing.xs,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
    marginTop: Spacing.xs,
  },
  rulesSection: {
    marginBottom: Spacing.xl,
  },
  rulesList: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  ruleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  },
  pairsSection: {
    marginBottom: Spacing.xl,
  },
  pairsList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  pairTag: {
    backgroundColor: Colors.dark.backgroundSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  pairText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.accent,
  },
  leaderboardSection: {
    marginBottom: Spacing.xl,
  },
  actionSection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  actionButton: {
    marginBottom: Spacing.md,
  },
});

import React from "react";
import { View, StyleSheet, FlatList, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userEmail: string;
  equityCents: number;
  returnPct: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  startingBalanceCents: number;
  compact?: boolean;
}

const PRIZE_COLORS = {
  gold: "#FFD700",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
};

export function Leaderboard({
  entries,
  currentUserId,
  startingBalanceCents,
  compact = false,
}: LeaderboardProps) {
  const getRankColor = (rank: number) => {
    if (rank === 1) return PRIZE_COLORS.gold;
    if (rank === 2) return PRIZE_COLORS.silver;
    if (rank === 3) return PRIZE_COLORS.bronze;
    return Colors.dark.textSecondary;
  };

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const isCurrentUser = item.userId === currentUserId;
    const isPositive = item.returnPct >= 0;
    const isTopThree = item.rank <= 3;
    const rankColor = getRankColor(item.rank);

    return (
      <View
        style={[
          styles.row,
          compact && styles.rowCompact,
          isCurrentUser ? styles.currentUserRow : null,
        ]}
      >
        <View style={[styles.rankContainer, compact && styles.rankContainerCompact]}>
          {isTopThree ? (
            <View style={[styles.rankBadge, { backgroundColor: rankColor + "20" }]}>
              <Feather name="award" size={compact ? 12 : 14} color={rankColor} />
              <ThemedText style={[styles.rankNumber, { color: rankColor }]}>
                {item.rank}
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.rank}>{item.rank}</ThemedText>
          )}
        </View>
        <View style={styles.userInfo}>
          <ThemedText style={[styles.email, compact && styles.emailCompact]} numberOfLines={1}>
            {item.userEmail}
          </ThemedText>
        </View>
        <View style={styles.statsContainer}>
          {!compact ? (
            <ThemedText style={styles.equity}>
              ${(item.equityCents / 100).toLocaleString()}
            </ThemedText>
          ) : null}
          <ThemedText
            style={[
              styles.returnPct,
              compact && styles.returnPctCompact,
              { color: isPositive ? Colors.dark.success : Colors.dark.danger },
            ]}
          >
            {isPositive ? "+" : ""}
            {item.returnPct.toFixed(2)}%
          </ThemedText>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        <ThemedText style={styles.headerText}>Rank</ThemedText>
        <ThemedText style={[styles.headerText, styles.headerUser]}>
          Trader
        </ThemedText>
        <ThemedText style={[styles.headerText, styles.headerStats]}>
          Return
        </ThemedText>
      </View>
      <FlatList
        data={entries}
        renderItem={renderItem}
        keyExtractor={(item) => item.userId}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  containerCompact: {
    backgroundColor: "transparent",
    borderRadius: 0,
  },
  header: {
    flexDirection: "row",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerCompact: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  headerText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerUser: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  headerStats: {
    width: 70,
    textAlign: "right",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  rowCompact: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  currentUserRow: {
    backgroundColor: `${Colors.dark.accent}15`,
  },
  rankContainer: {
    width: 44,
    alignItems: "center",
  },
  rankContainerCompact: {
    width: 36,
  },
  rankBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  rankNumber: {
    fontSize: 12,
    fontWeight: "700",
  },
  rank: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  userInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  email: {
    fontSize: 14,
    color: Colors.dark.text,
  },
  emailCompact: {
    fontSize: 13,
  },
  statsContainer: {
    width: 70,
    alignItems: "flex-end",
  },
  equity: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  returnPct: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  returnPctCompact: {
    fontSize: 13,
  },
});

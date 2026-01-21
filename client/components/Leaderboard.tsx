import React from "react";
import { View, StyleSheet, FlatList, Image } from "react-native";
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
}

const trophyGold = require("../../attached_assets/generated_images/gold_trophy_first_place.png");
const trophySilver = require("../../attached_assets/generated_images/silver_trophy_second_place.png");
const trophyBronze = require("../../attached_assets/generated_images/bronze_trophy_third_place.png");

export function Leaderboard({
  entries,
  currentUserId,
  startingBalanceCents,
}: LeaderboardProps) {
  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const isCurrentUser = item.userId === currentUserId;
    const isPositive = item.returnPct >= 0;

    let trophy = null;
    if (item.rank === 1) trophy = trophyGold;
    else if (item.rank === 2) trophy = trophySilver;
    else if (item.rank === 3) trophy = trophyBronze;

    return (
      <View
        style={[
          styles.row,
          isCurrentUser ? styles.currentUserRow : null,
        ]}
      >
        <View style={styles.rankContainer}>
          {trophy ? (
            <Image source={trophy} style={styles.trophy} />
          ) : (
            <ThemedText style={styles.rank}>{item.rank}</ThemedText>
          )}
        </View>
        <View style={styles.userInfo}>
          <ThemedText style={styles.email} numberOfLines={1}>
            {item.userEmail}
          </ThemedText>
        </View>
        <View style={styles.statsContainer}>
          <ThemedText style={styles.equity}>
            ${(item.equityCents / 100).toLocaleString()}
          </ThemedText>
          <ThemedText
            style={[
              styles.returnPct,
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
    <View style={styles.container}>
      <View style={styles.header}>
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
  header: {
    flexDirection: "row",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
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
    width: 80,
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
  currentUserRow: {
    backgroundColor: `${Colors.dark.accent}15`,
  },
  rankContainer: {
    width: 32,
    alignItems: "center",
  },
  rank: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  trophy: {
    width: 24,
    height: 24,
  },
  userInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  email: {
    fontSize: 14,
    color: Colors.dark.text,
  },
  statsContainer: {
    width: 80,
    alignItems: "flex-end",
  },
  equity: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontFamily: "monospace",
  },
  returnPct: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "monospace",
  },
});

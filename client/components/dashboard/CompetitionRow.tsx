import React, { useState } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { TopCompetitorsTable } from "./TopCompetitorsTable";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface Competition {
  id: string;
  competitionId: string;
  title: string;
  status: string;
  equityCents: number;
  startingBalanceCents: number;
  rank?: number;
  totalEntrants?: number;
  buyInCents?: number;
  prizePotCents?: number;
  startAt?: string;
  endAt?: string;
}

interface Competitor {
  rank: number;
  userId: string;
  username: string;
  returnPct: number;
  equityCents: number;
  drawdownPct: number;
  winRate: number;
  tradesCount: number;
}

interface CompetitionRowProps {
  competition: Competition;
  onEnterArena: (competitionId: string) => void;
  onCompetitorClick?: (competitor: Competitor) => void;
}

const formatCurrency = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

export function CompetitionRow({
  competition,
  onEnterArena,
  onCompetitorClick,
}: CompetitionRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isActive = competition.status === "open" || competition.status === "running";

  const returnPct =
    ((competition.equityCents - competition.startingBalanceCents) /
      competition.startingBalanceCents) *
    100;

  const handleRowPress = () => {
    if (isActive) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.row, isExpanded && styles.rowExpanded]}
        onPress={handleRowPress}
      >
        <View style={styles.leftSection}>
          <View style={styles.titleRow}>
            <Feather
              name={isActive ? "zap" : "check-circle"}
              size={16}
              color={isActive ? Colors.dark.accent : Colors.dark.textMuted}
            />
            <ThemedText style={styles.title} numberOfLines={1}>
              {competition.title}
            </ThemedText>
            <StatusBadge status={competition.status} />
          </View>
        </View>

        <View style={styles.middleSection}>
          {competition.rank ? (
            <View style={styles.stat}>
              <ThemedText style={styles.statValue}>
                #{competition.rank}
                {competition.totalEntrants ? `/${competition.totalEntrants}` : ""}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Rank</ThemedText>
            </View>
          ) : null}
          <View style={styles.stat}>
            <ThemedText
              style={[
                styles.statValue,
                { color: returnPct >= 0 ? Colors.dark.success : Colors.dark.danger },
              ]}
            >
              {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
            </ThemedText>
            <ThemedText style={styles.statLabel}>Return</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={styles.statValue}>
              {formatCurrency(competition.equityCents)}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Equity</ThemedText>
          </View>
        </View>

        <View style={styles.rightSection}>
          {isActive ? (
            <Button
              onPress={() => onEnterArena(competition.competitionId)}
              style={styles.enterButton}
            >
              Enter Arena
            </Button>
          ) : null}
          {isActive ? (
            <Feather
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={Colors.dark.textSecondary}
              style={styles.chevron}
            />
          ) : null}
        </View>
      </Pressable>

      {isExpanded ? (
        <View style={styles.expandedPanel}>
          <View style={styles.panelHeader}>
            <ThemedText style={styles.panelTitle}>Competition Details</ThemedText>
          </View>

          <View style={styles.detailsGrid}>
            {competition.buyInCents !== undefined ? (
              <View style={styles.detailItem}>
                <ThemedText style={styles.detailLabel}>Buy-in</ThemedText>
                <ThemedText style={styles.detailValue}>
                  {competition.buyInCents === 0 ? "Free" : formatCurrency(competition.buyInCents)}
                </ThemedText>
              </View>
            ) : null}
            {competition.startAt ? (
              <View style={styles.detailItem}>
                <ThemedText style={styles.detailLabel}>Started</ThemedText>
                <ThemedText style={styles.detailValue}>
                  {new Date(competition.startAt).toLocaleDateString()}
                </ThemedText>
              </View>
            ) : null}
            {competition.endAt ? (
              <View style={styles.detailItem}>
                <ThemedText style={styles.detailLabel}>Ends</ThemedText>
                <ThemedText style={styles.detailValue}>
                  {new Date(competition.endAt).toLocaleDateString()}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.leaderboardSection}>
            <ThemedText style={styles.leaderboardTitle}>Top 25 Competitors</ThemedText>
            <TopCompetitorsTable
              competitionId={competition.competitionId}
              onCompetitorClick={onCompetitorClick}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: "hidden",
    ...(Platform.OS === "web" ? {
      boxShadow: "0 2px 4px -1px rgba(0, 0, 0, 0.2)",
    } : {}),
  } as any,
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  rowExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  leftSection: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.text,
    flex: 1,
  },
  middleSection: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
    fontFamily: "monospace",
  },
  statLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    textTransform: "uppercase",
    marginTop: 2,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  enterButton: {
    minWidth: 100,
  },
  chevron: {
    marginLeft: Spacing.xs,
  },
  expandedPanel: {
    padding: Spacing.lg,
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  panelHeader: {
    marginBottom: Spacing.md,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  detailItem: {},
  detailLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.dark.text,
  },
  leaderboardSection: {},
  leaderboardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.md,
  },
});

import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface Competitor {
  rank: number;
  oderId: string;
  username: string;
  returnPct: number;
  equityCents: number;
  drawdownPct: number;
  winRate: number;
  tradesCount: number;
}

interface TopCompetitorsTableProps {
  competitionId: string;
  onCompetitorClick?: (competitor: Competitor) => void;
}

const formatCurrency = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

export function TopCompetitorsTable({
  competitionId,
  onCompetitorClick,
}: TopCompetitorsTableProps) {
  const { data: competitors, isLoading } = useQuery<Competitor[]>({
    queryKey: [`/api/competitions/${competitionId}/top`],
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner />
      </View>
    );
  }

  if (!competitors || competitors.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Feather name="users" size={24} color={Colors.dark.textMuted} />
        <ThemedText style={styles.emptyText}>No competitors yet</ThemedText>
      </View>
    );
  }

  const isDesktop = Platform.OS === "web";

  return (
    <ScrollView
      style={styles.container}
      horizontal={false}
      showsVerticalScrollIndicator={false}
    >
      {isDesktop ? (
        <View style={styles.tableHeader}>
          <ThemedText style={[styles.headerCell, styles.rankCell]}>Rank</ThemedText>
          <ThemedText style={[styles.headerCell, styles.traderCell]}>Trader</ThemedText>
          <ThemedText style={[styles.headerCell, styles.returnCell]}>Return %</ThemedText>
          <ThemedText style={[styles.headerCell, styles.equityCell]}>Equity</ThemedText>
          <ThemedText style={[styles.headerCell, styles.ddCell]}>Max DD %</ThemedText>
          <ThemedText style={[styles.headerCell, styles.wrCell]}>Win Rate</ThemedText>
          <ThemedText style={[styles.headerCell, styles.tradesCell]}>Trades</ThemedText>
        </View>
      ) : null}

      {competitors.map((competitor, index) => (
        <Pressable
          key={competitor.oderId}
          style={[
            styles.tableRow,
            index % 2 === 0 && styles.tableRowAlt,
          ]}
          onPress={() => onCompetitorClick?.(competitor)}
        >
          {isDesktop ? (
            <>
              <View style={styles.rankCell}>
                <View
                  style={[
                    styles.rankBadge,
                    competitor.rank <= 3 && styles.rankBadgeTop3,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.rankText,
                      competitor.rank <= 3 && styles.rankTextTop3,
                    ]}
                  >
                    #{competitor.rank}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={[styles.cell, styles.traderCell]}>
                {competitor.username}
              </ThemedText>
              <ThemedText
                style={[
                  styles.cell,
                  styles.returnCell,
                  {
                    color:
                      competitor.returnPct >= 0
                        ? Colors.dark.success
                        : Colors.dark.danger,
                  },
                ]}
              >
                {competitor.returnPct >= 0 ? "+" : ""}{competitor.returnPct.toFixed(2)}%
              </ThemedText>
              <ThemedText style={[styles.cell, styles.equityCell, styles.monoText]}>
                {formatCurrency(competitor.equityCents)}
              </ThemedText>
              <ThemedText style={[styles.cell, styles.ddCell, { color: Colors.dark.danger }]}>
                {competitor.drawdownPct.toFixed(1)}%
              </ThemedText>
              <ThemedText style={[styles.cell, styles.wrCell]}>
                {competitor.winRate.toFixed(0)}%
              </ThemedText>
              <ThemedText style={[styles.cell, styles.tradesCell]}>
                {competitor.tradesCount}
              </ThemedText>
            </>
          ) : (
            <View style={styles.mobileRow}>
              <View style={styles.mobileLeft}>
                <View style={styles.mobileTop}>
                  <View
                    style={[
                      styles.rankBadge,
                      competitor.rank <= 3 && styles.rankBadgeTop3,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.rankText,
                        competitor.rank <= 3 && styles.rankTextTop3,
                      ]}
                    >
                      #{competitor.rank}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.mobileTrader}>
                    {competitor.username}
                  </ThemedText>
                </View>
                <View style={styles.mobileBottom}>
                  <ThemedText
                    style={[
                      styles.mobileReturn,
                      {
                        color:
                          competitor.returnPct >= 0
                            ? Colors.dark.success
                            : Colors.dark.danger,
                      },
                    ]}
                  >
                    {competitor.returnPct >= 0 ? "+" : ""}{competitor.returnPct.toFixed(2)}%
                  </ThemedText>
                  <ThemedText style={styles.mobileEquity}>
                    {formatCurrency(competitor.equityCents)}
                  </ThemedText>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color={Colors.dark.textMuted} />
            </View>
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 400,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  tableRowAlt: {
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  cell: {
    fontSize: 13,
    color: Colors.dark.text,
  },
  monoText: {
    fontFamily: "monospace",
  },
  rankCell: {
    width: 50,
  },
  traderCell: {
    flex: 1,
  },
  returnCell: {
    width: 80,
    textAlign: "right",
    fontFamily: "monospace",
  },
  equityCell: {
    width: 90,
    textAlign: "right",
  },
  ddCell: {
    width: 70,
    textAlign: "right",
    fontFamily: "monospace",
  },
  wrCell: {
    width: 70,
    textAlign: "right",
  },
  tradesCell: {
    width: 60,
    textAlign: "right",
  },
  rankBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.dark.backgroundTertiary,
  },
  rankBadgeTop3: {
    backgroundColor: Colors.dark.gold,
  },
  rankText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  rankTextTop3: {
    color: Colors.dark.backgroundRoot,
  },
  mobileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: Spacing.sm,
  },
  mobileLeft: {
    flex: 1,
  },
  mobileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 4,
  },
  mobileTrader: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.dark.text,
  },
  mobileBottom: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  mobileReturn: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  mobileEquity: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontFamily: "monospace",
  },
});

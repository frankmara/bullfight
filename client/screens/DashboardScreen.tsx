import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
  Pressable,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuthContext } from "@/context/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";

const emptyImage = require("../../attached_assets/generated_images/empty_dashboard_illustration.png");

interface UserStats {
  totalSpentCents: number;
  totalWonCents: number;
  activeCompetitions: number;
}

interface MyCompetition {
  id: string;
  competitionId: string;
  title: string;
  status: string;
  equityCents: number;
  startingBalanceCents: number;
  rank?: number;
  totalEntrants?: number;
  prizeWonCents?: number;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isAuthenticated } = useAuthContext();

  const {
    data: stats,
    isLoading: statsLoading,
  } = useQuery<UserStats>({
    queryKey: ["/api/user/stats"],
    enabled: isAuthenticated,
  });

  const {
    data: myCompetitions,
    isLoading: competitionsLoading,
    refetch,
    isRefetching,
  } = useQuery<MyCompetition[]>({
    queryKey: ["/api/user/competitions"],
    enabled: isAuthenticated,
  });

  const handleLogin = () => {
    navigation.navigate("Login");
  };

  const handleEnterArena = (competitionId: string) => {
    navigation.navigate("Arena", { id: competitionId });
  };

  if (!isAuthenticated) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: headerHeight + Spacing.xl },
        ]}
      >
        <EmptyState
          image={emptyImage}
          title="Sign In Required"
          message="Log in to view your dashboard and competitions"
          actionLabel="Sign In"
          onAction={handleLogin}
        />
      </View>
    );
  }

  const isLoading = statsLoading || competitionsLoading;

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.loadingContainer,
          { paddingTop: headerHeight + Spacing.xl },
        ]}
      >
        <LoadingSpinner />
      </View>
    );
  }

  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString()}`;

  const activeComps = myCompetitions?.filter(
    (c) => c.status === "open" || c.status === "running"
  ) || [];

  const pastComps = myCompetitions?.filter(
    (c) => c.status === "ended" || c.status === "paid"
  ) || [];

  const renderStatsCard = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <Feather name="trending-up" size={20} color={Colors.dark.success} />
        <ThemedText style={styles.statValue}>
          {formatCurrency(stats?.totalWonCents || 0)}
        </ThemedText>
        <ThemedText style={styles.statLabel}>Total Won</ThemedText>
      </View>
      <View style={styles.statCard}>
        <Feather name="dollar-sign" size={20} color={Colors.dark.warning} />
        <ThemedText style={styles.statValue}>
          {formatCurrency(stats?.totalSpentCents || 0)}
        </ThemedText>
        <ThemedText style={styles.statLabel}>Total Spent</ThemedText>
      </View>
      <View style={styles.statCard}>
        <Feather name="activity" size={20} color={Colors.dark.accent} />
        <ThemedText style={styles.statValue}>
          {stats?.activeCompetitions || 0}
        </ThemedText>
        <ThemedText style={styles.statLabel}>Active</ThemedText>
      </View>
    </View>
  );

  const renderCompetitionItem = ({ item }: { item: MyCompetition }) => {
    const returnPct =
      ((item.equityCents - item.startingBalanceCents) / item.startingBalanceCents) *
      100;
    const isActive = item.status === "open" || item.status === "running";

    return (
      <Pressable
        style={styles.competitionItem}
        onPress={() => isActive ? handleEnterArena(item.competitionId) : null}
      >
        <View style={styles.competitionHeader}>
          <ThemedText style={styles.competitionTitle} numberOfLines={1}>
            {item.title}
          </ThemedText>
          <StatusBadge status={item.status} />
        </View>
        <View style={styles.competitionStats}>
          {item.rank ? (
            <View style={styles.competitionStat}>
              <ThemedText style={styles.competitionStatLabel}>Rank</ThemedText>
              <ThemedText style={styles.competitionStatValue}>
                #{item.rank}
                {item.totalEntrants ? `/${item.totalEntrants}` : ""}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.competitionStat}>
            <ThemedText style={styles.competitionStatLabel}>Return</ThemedText>
            <ThemedText
              style={[
                styles.competitionStatValue,
                {
                  color: returnPct >= 0 ? Colors.dark.success : Colors.dark.danger,
                },
              ]}
            >
              {returnPct >= 0 ? "+" : ""}
              {returnPct.toFixed(2)}%
            </ThemedText>
          </View>
          {item.prizeWonCents ? (
            <View style={styles.competitionStat}>
              <ThemedText style={styles.competitionStatLabel}>Won</ThemedText>
              <ThemedText
                style={[styles.competitionStatValue, { color: Colors.dark.gold }]}
              >
                {formatCurrency(item.prizeWonCents)}
              </ThemedText>
            </View>
          ) : null}
        </View>
        {isActive && (
          <View style={styles.enterArena}>
            <ThemedText style={styles.enterArenaText}>Enter Arena</ThemedText>
            <Feather name="arrow-right" size={16} color={Colors.dark.accent} />
          </View>
        )}
      </Pressable>
    );
  };

  const renderHeader = () => (
    <View>
      <ThemedText style={styles.greeting}>
        Welcome back, {user?.email?.split("@")[0]}
      </ThemedText>
      {renderStatsCard()}

      <ThemedText style={styles.sectionTitle}>Active Competitions</ThemedText>
      {activeComps.length === 0 ? (
        <View style={styles.emptySection}>
          <ThemedText style={styles.emptyText}>
            No active competitions. Join one from the home screen!
          </ThemedText>
        </View>
      ) : (
        activeComps.map((comp) => (
          <View key={comp.id}>{renderCompetitionItem({ item: comp })}</View>
        ))
      )}

      {pastComps.length > 0 && (
        <ThemedText style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>
          Past Competitions
        </ThemedText>
      )}
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      ListHeaderComponent={renderHeader}
      data={pastComps}
      renderItem={renderCompetitionItem}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={Colors.dark.accent}
        />
      }
      showsVerticalScrollIndicator={false}
    />
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
  greeting: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: Spacing.lg,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing["2xl"],
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: "center",
    marginHorizontal: Spacing.xs,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.text,
    marginTop: Spacing.sm,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.md,
  },
  emptySection: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  competitionItem: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  competitionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  competitionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  competitionStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  competitionStat: {
    alignItems: "center",
  },
  competitionStatLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.xs,
  },
  competitionStatValue: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    fontFamily: "monospace",
  },
  enterArena: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  enterArenaText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.accent,
    marginRight: Spacing.xs,
  },
});

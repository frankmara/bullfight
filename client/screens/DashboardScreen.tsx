import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Platform,
  useWindowDimensions,
  Dimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/Button";
import { useAuthContext } from "@/context/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";

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

const DESKTOP_BREAKPOINT = 768;

function useSafeHeaderHeight() {
  try {
    return useHeaderHeight();
  } catch {
    return 0;
  }
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const rawHeaderHeight = useSafeHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isDesktop = Platform.OS === 'web' && Dimensions.get('window').width >= DESKTOP_BREAKPOINT;
  const headerHeight = isDesktop ? 0 : rawHeaderHeight;
  const { user, isAuthenticated } = useAuthContext();
  const { width } = useWindowDimensions();
  
  const isWeb = Platform.OS === "web";
  const maxWidth = 1000;
  const containerWidth = isWeb ? Math.min(width - Spacing.lg * 2, maxWidth) : width - Spacing.lg * 2;

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

  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString()}`;

  const calculateWinRate = () => {
    if (!myCompetitions || myCompetitions.length === 0) return 0;
    const completedComps = myCompetitions.filter(
      (c) => c.status === "ended" || c.status === "paid"
    );
    if (completedComps.length === 0) return 0;
    const wins = completedComps.filter((c) => c.prizeWonCents && c.prizeWonCents > 0).length;
    return Math.round((wins / completedComps.length) * 100);
  };

  if (!isAuthenticated) {
    return (
      <View
        style={[
          styles.container,
          styles.centerContent,
          { paddingTop: headerHeight + Spacing.xl },
        ]}
      >
        <View style={[styles.contentWrapper, { maxWidth: containerWidth }]}>
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="lock" size={48} color={Colors.dark.textMuted} />
            </View>
            <ThemedText style={styles.emptyTitle}>Sign In Required</ThemedText>
            <ThemedText style={styles.emptyMessage}>
              Log in to view your dashboard and competitions
            </ThemedText>
            <Button onPress={handleLogin} style={styles.emptyButton}>
              Sign In
            </Button>
          </View>
        </View>
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

  const activeComps = myCompetitions?.filter(
    (c) => c.status === "open" || c.status === "running"
  ) || [];

  const pastComps = myCompetitions?.filter(
    (c) => c.status === "ended" || c.status === "paid"
  ) || [];

  const renderStatsCard = () => (
    <View style={styles.statsGrid}>
      <View style={[styles.statCard, isWeb && styles.statCardWeb]}>
        <View style={styles.statIconContainer}>
          <Feather name="trending-up" size={24} color={Colors.dark.success} />
        </View>
        <ThemedText style={styles.statValue}>
          {formatCurrency(stats?.totalWonCents || 0)}
        </ThemedText>
        <ThemedText style={styles.statLabel}>Total Winnings</ThemedText>
      </View>
      <View style={[styles.statCard, isWeb && styles.statCardWeb]}>
        <View style={styles.statIconContainer}>
          <Feather name="activity" size={24} color={Colors.dark.accent} />
        </View>
        <ThemedText style={styles.statValue}>
          {stats?.activeCompetitions || 0}
        </ThemedText>
        <ThemedText style={styles.statLabel}>Active Competitions</ThemedText>
      </View>
      <View style={[styles.statCard, isWeb && styles.statCardWeb]}>
        <View style={styles.statIconContainer}>
          <Feather name="award" size={24} color={Colors.dark.gold} />
        </View>
        <ThemedText style={styles.statValue}>
          {calculateWinRate()}%
        </ThemedText>
        <ThemedText style={styles.statLabel}>Win Rate</ThemedText>
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
        style={[styles.competitionCard, isWeb && styles.competitionCardWeb]}
        onPress={() => isActive ? handleEnterArena(item.competitionId) : null}
      >
        <View style={styles.competitionHeader}>
          <View style={styles.competitionTitleRow}>
            <Feather 
              name={isActive ? "zap" : "check-circle"} 
              size={18} 
              color={isActive ? Colors.dark.accent : Colors.dark.textMuted} 
            />
            <ThemedText style={styles.competitionTitle} numberOfLines={1}>
              {item.title}
            </ThemedText>
          </View>
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
        {isActive ? (
          <View style={styles.enterArena}>
            <ThemedText style={styles.enterArenaText}>Enter Arena</ThemedText>
            <Feather name="arrow-right" size={16} color={Colors.dark.accent} />
          </View>
        ) : null}
      </Pressable>
    );
  };

  const renderEmptyCompetitions = () => (
    <View style={[styles.emptySection, isWeb && styles.emptySectionWeb]}>
      <Feather name="inbox" size={32} color={Colors.dark.textMuted} />
      <ThemedText style={styles.emptySectionText}>
        No active competitions. Join one from the home screen!
      </ThemedText>
    </View>
  );

  const renderHeader = () => (
    <View style={[styles.contentWrapper, { maxWidth: containerWidth, width: "100%" }]}>
      <ThemedText style={styles.greeting}>
        Welcome back, {user?.email?.split("@")[0]}
      </ThemedText>
      
      {renderStatsCard()}

      <View style={styles.sectionHeader}>
        <Feather name="zap" size={20} color={Colors.dark.accent} />
        <ThemedText style={styles.sectionTitle}>Active Competitions</ThemedText>
      </View>
      
      {activeComps.length === 0 ? (
        renderEmptyCompetitions()
      ) : (
        activeComps.map((comp) => (
          <View key={comp.id}>{renderCompetitionItem({ item: comp })}</View>
        ))
      )}

      {pastComps.length > 0 ? (
        <View style={[styles.sectionHeader, { marginTop: Spacing["2xl"] }]}>
          <Feather name="clock" size={20} color={Colors.dark.textSecondary} />
          <ThemedText style={styles.sectionTitle}>Recent Results</ThemedText>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: isDesktop ? Spacing.xl : 80,
            alignItems: isWeb ? "center" : "stretch",
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        ListHeaderComponent={renderHeader}
        data={pastComps}
        renderItem={({ item }) => (
          <View style={[styles.contentWrapper, { maxWidth: containerWidth, width: "100%" }]}>
            {renderCompetitionItem({ item })}
          </View>
        )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  list: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  contentWrapper: {
    alignSelf: "center",
    width: "100%",
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: Spacing.xl,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statCardWeb: {
    ...(Platform.OS === "web" ? {
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
    } : {}),
  } as any,
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: Spacing.xs,
    fontFamily: "monospace",
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  emptySection: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: Spacing.md,
  },
  emptySectionWeb: {
    ...(Platform.OS === "web" ? {
      boxShadow: "0 2px 4px -1px rgba(0, 0, 0, 0.2)",
    } : {}),
  } as any,
  emptySectionText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  competitionCard: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  competitionCardWeb: {
    ...(Platform.OS === "web" ? {
      boxShadow: "0 2px 4px -1px rgba(0, 0, 0, 0.2)",
    } : {}),
  } as any,
  competitionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  competitionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.sm,
    gap: Spacing.sm,
  },
  competitionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    flex: 1,
  },
  competitionStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  competitionStat: {
    alignItems: "center",
  },
  competitionStatLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing["3xl"],
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.backgroundDefault,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: Spacing.md,
  },
  emptyMessage: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  emptyButton: {
    minWidth: 160,
  },
});

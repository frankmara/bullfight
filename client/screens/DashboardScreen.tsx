import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/Button";
import {
  PerformanceSnapshot,
  CompetitionRow,
  CompetitorDrawer,
} from "@/components/dashboard";
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
  buyInCents?: number;
  startAt?: string;
  endAt?: string;
}

interface EquityData {
  points: { time: number; value: number }[];
  balance: number;
  equity: number;
  returnPct: number;
  drawdownPct: number;
}

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
  const { width } = useWindowDimensions();
  const { user, isAuthenticated } = useAuthContext();

  const isDesktop = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
  const headerHeight = isDesktop ? 0 : rawHeaderHeight;

  const [equityRange, setEquityRange] = useState("1W");
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>("");

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

  const {
    data: equityData,
    isLoading: equityLoading,
  } = useQuery<EquityData>({
    queryKey: ["/api/user/equity", equityRange],
    enabled: isAuthenticated,
  });

  const handleLogin = () => {
    navigation.navigate("Login");
  };

  const handleEnterArena = (competitionId: string) => {
    navigation.navigate("Arena", { id: competitionId });
  };

  const handleCompetitorClick = (competitor: Competitor, competitionId: string) => {
    setSelectedCompetitor(competitor);
    setSelectedCompetitionId(competitionId);
  };

  const handleCloseDrawer = () => {
    setSelectedCompetitor(null);
    setSelectedCompetitionId("");
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
    );
  }

  const isLoading = statsLoading || competitionsLoading || equityLoading;

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

  const activeComps =
    myCompetitions?.filter((c) => c.status === "open" || c.status === "running") || [];
  const pastComps =
    myCompetitions?.filter((c) => c.status === "ended" || c.status === "paid") || [];

  const renderMobileLayout = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.mobileContent,
        {
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + 80,
        },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={Colors.dark.accent}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <ThemedText style={styles.greeting}>
        Welcome back, {user?.email?.split("@")[0]}
      </ThemedText>

      <PerformanceSnapshot
        points={equityData?.points || []}
        balance={equityData?.balance || 0}
        equity={equityData?.equity || 0}
        returnPct={equityData?.returnPct || 0}
        drawdownPct={equityData?.drawdownPct || 0}
        selectedRange={equityRange}
        onRangeChange={setEquityRange}
      />

      <View style={styles.sectionHeader}>
        <Feather name="zap" size={20} color={Colors.dark.accent} />
        <ThemedText style={styles.sectionTitle}>Active Competitions</ThemedText>
      </View>

      {activeComps.length === 0 ? (
        <View style={styles.emptySection}>
          <Feather name="inbox" size={32} color={Colors.dark.textMuted} />
          <ThemedText style={styles.emptySectionText}>
            No active competitions. Join one from the home screen!
          </ThemedText>
        </View>
      ) : (
        activeComps.map((comp) => (
          <CompetitionRow
            key={comp.id}
            competition={comp}
            onEnterArena={handleEnterArena}
            onCompetitorClick={(competitor) =>
              handleCompetitorClick(competitor, comp.competitionId)
            }
          />
        ))
      )}

      {pastComps.length > 0 ? (
        <>
          <View style={[styles.sectionHeader, { marginTop: Spacing["2xl"] }]}>
            <Feather name="clock" size={20} color={Colors.dark.textSecondary} />
            <ThemedText style={styles.sectionTitle}>Recent Results</ThemedText>
          </View>
          {pastComps.map((comp) => (
            <CompetitionRow
              key={comp.id}
              competition={comp}
              onEnterArena={handleEnterArena}
            />
          ))}
        </>
      ) : null}
    </ScrollView>
  );

  const renderDesktopLayout = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.desktopContent,
        {
          paddingTop: Spacing.xl,
          paddingBottom: Spacing.xl,
        },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={Colors.dark.accent}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.desktopHeader}>
        <ThemedText style={styles.greeting}>
          Welcome back, {user?.email?.split("@")[0]}
        </ThemedText>
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Feather name="trending-up" size={16} color={Colors.dark.success} />
            <ThemedText style={styles.statPillText}>
              ${((stats?.totalWonCents || 0) / 100).toLocaleString()} won
            </ThemedText>
          </View>
          <View style={styles.statPill}>
            <Feather name="activity" size={16} color={Colors.dark.accent} />
            <ThemedText style={styles.statPillText}>
              {stats?.activeCompetitions || 0} active
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.desktopGrid}>
        <View style={styles.mainColumn}>
          <View style={styles.sectionHeader}>
            <Feather name="zap" size={20} color={Colors.dark.accent} />
            <ThemedText style={styles.sectionTitle}>Active Competitions</ThemedText>
          </View>

          {activeComps.length === 0 ? (
            <View style={styles.emptySection}>
              <Feather name="inbox" size={32} color={Colors.dark.textMuted} />
              <ThemedText style={styles.emptySectionText}>
                No active competitions. Join one from the home screen!
              </ThemedText>
            </View>
          ) : (
            activeComps.map((comp) => (
              <CompetitionRow
                key={comp.id}
                competition={comp}
                onEnterArena={handleEnterArena}
                onCompetitorClick={(competitor) =>
                  handleCompetitorClick(competitor, comp.competitionId)
                }
              />
            ))
          )}

          {pastComps.length > 0 ? (
            <>
              <View style={[styles.sectionHeader, { marginTop: Spacing["2xl"] }]}>
                <Feather name="clock" size={20} color={Colors.dark.textSecondary} />
                <ThemedText style={styles.sectionTitle}>Recent Results</ThemedText>
              </View>
              {pastComps.map((comp) => (
                <CompetitionRow
                  key={comp.id}
                  competition={comp}
                  onEnterArena={handleEnterArena}
                />
              ))}
            </>
          ) : null}
        </View>

        <View style={styles.sidebar}>
          <PerformanceSnapshot
            points={equityData?.points || []}
            balance={equityData?.balance || 0}
            equity={equityData?.equity || 0}
            returnPct={equityData?.returnPct || 0}
            drawdownPct={equityData?.drawdownPct || 0}
            selectedRange={equityRange}
            onRangeChange={setEquityRange}
          />
        </View>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {isDesktop ? renderDesktopLayout() : renderMobileLayout()}

      <CompetitorDrawer
        visible={!!selectedCompetitor}
        onClose={handleCloseDrawer}
        competitor={selectedCompetitor}
        competitionId={selectedCompetitionId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  scrollView: {
    flex: 1,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  mobileContent: {
    paddingHorizontal: Spacing.lg,
  },
  desktopContent: {
    paddingHorizontal: Spacing.xl,
    maxWidth: 1400,
    alignSelf: "center",
    width: "100%",
  },
  desktopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  desktopGrid: {
    flexDirection: "row",
    gap: Spacing.xl,
  },
  mainColumn: {
    flex: 1,
    minWidth: 0,
  },
  sidebar: {
    width: 360,
    flexShrink: 0,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.dark.backgroundDefault,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statPillText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.dark.text,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
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
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0 2px 4px -1px rgba(0, 0, 0, 0.2)",
        }
      : {}),
  } as any,
  emptySectionText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
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

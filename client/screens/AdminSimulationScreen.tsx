import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface SimulationStatus {
  isRunning: boolean;
  botCount: number;
  activeCompetitions: number;
  activePvpMatches: number;
  stats: {
    tradesExecuted: number;
    chatMessagesSent: number;
    betsPlaced: number;
    positionsClosed: number;
  };
}

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_NAV_HEIGHT = 64;

export default function AdminSimulationScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const rawHeaderHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isDesktop = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
  const headerHeight = isDesktop ? DESKTOP_NAV_HEIGHT : Math.max(rawHeaderHeight, insets.top);

  const { data: status, isLoading, refetch } = useQuery<SimulationStatus>({
    queryKey: ["/api/admin/simulation/status"],
    queryFn: async () => {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL("/api/admin/simulation/status", baseUrl).toString(), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch simulation status");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const handleStart = async () => {
    setActionLoading("start");
    try {
      await apiRequest("POST", "/api/admin/simulation/start");
      await refetch();
    } catch (error) {
      console.error("Failed to start simulation:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    setActionLoading("stop");
    try {
      await apiRequest("POST", "/api/admin/simulation/stop");
      await refetch();
    } catch (error) {
      console.error("Failed to stop simulation:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReset = async () => {
    setActionLoading("reset");
    try {
      await apiRequest("POST", "/api/admin/simulation/reset");
      await refetch();
    } catch (error) {
      console.error("Failed to reset simulation:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const StatCard = ({ label, value, icon }: { label: string; value: number; icon: keyof typeof Feather.glyphMap }) => (
    <View style={styles.statCard}>
      <View style={styles.statIconContainer}>
        <Feather name={icon} size={20} color={Colors.dark.accent} />
      </View>
      <ThemedText style={styles.statValue}>{value.toLocaleString()}</ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.accent} />
          <ThemedText style={styles.loadingText}>Loading simulation status...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, isDesktop && styles.contentDesktop]}>
          <View style={styles.statusSection}>
            <View style={styles.statusHeader}>
              <View style={styles.statusBadge}>
                <View style={[
                  styles.statusDot,
                  { backgroundColor: status?.isRunning ? Colors.dark.success : Colors.dark.textMuted }
                ]} />
                <ThemedText style={[
                  styles.statusText,
                  { color: status?.isRunning ? Colors.dark.success : Colors.dark.textMuted }
                ]}>
                  {status?.isRunning ? "RUNNING" : "STOPPED"}
                </ThemedText>
              </View>
            </View>

            <ThemedText style={styles.description}>
              The simulation engine creates 100 bot traders that automatically trade in competitions,
              place bets on PvP matches, and chat during live events. Use this to test the betting
              and odds systems with realistic activity.
            </ThemedText>
          </View>

          <View style={styles.controlsSection}>
            <ThemedText style={styles.sectionTitle}>Controls</ThemedText>
            <View style={styles.controlButtons}>
              {status?.isRunning ? (
                <Pressable
                  style={[styles.controlButton, styles.stopButton]}
                  onPress={handleStop}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "stop" ? (
                    <ActivityIndicator size="small" color={Colors.dark.text} />
                  ) : (
                    <>
                      <Feather name="square" size={18} color={Colors.dark.text} />
                      <ThemedText style={styles.controlButtonText}>Stop Simulation</ThemedText>
                    </>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.controlButton, styles.startButton]}
                  onPress={handleStart}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "start" ? (
                    <ActivityIndicator size="small" color={Colors.dark.text} />
                  ) : (
                    <>
                      <Feather name="play" size={18} color={Colors.dark.text} />
                      <ThemedText style={styles.controlButtonText}>Start Simulation</ThemedText>
                    </>
                  )}
                </Pressable>
              )}

              <Pressable
                style={[styles.controlButton, styles.resetButton]}
                onPress={handleReset}
                disabled={actionLoading !== null}
              >
                {actionLoading === "reset" ? (
                  <ActivityIndicator size="small" color={Colors.dark.text} />
                ) : (
                  <>
                    <Feather name="refresh-cw" size={18} color={Colors.dark.text} />
                    <ThemedText style={styles.controlButtonText}>Reset</ThemedText>
                  </>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.statsSection}>
            <ThemedText style={styles.sectionTitle}>Activity Statistics</ThemedText>
            <View style={styles.statsGrid}>
              <StatCard
                label="Trades Executed"
                value={status?.stats.tradesExecuted || 0}
                icon="trending-up"
              />
              <StatCard
                label="Positions Closed"
                value={status?.stats.positionsClosed || 0}
                icon="x-circle"
              />
              <StatCard
                label="Chat Messages"
                value={status?.stats.chatMessagesSent || 0}
                icon="message-circle"
              />
              <StatCard
                label="Bets Placed"
                value={status?.stats.betsPlaced || 0}
                icon="target"
              />
            </View>
          </View>

          <View style={styles.infoSection}>
            <ThemedText style={styles.sectionTitle}>Simulation Info</ThemedText>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Feather name="users" size={16} color={Colors.dark.textMuted} />
                <ThemedText style={styles.infoLabel}>Bot Users</ThemedText>
                <ThemedText style={styles.infoValue}>{status?.botCount || 0}</ThemedText>
              </View>
              <View style={styles.infoItem}>
                <Feather name="award" size={16} color={Colors.dark.textMuted} />
                <ThemedText style={styles.infoLabel}>Active Competitions</ThemedText>
                <ThemedText style={styles.infoValue}>{status?.activeCompetitions || 0}</ThemedText>
              </View>
              <View style={styles.infoItem}>
                <Feather name="zap" size={16} color={Colors.dark.textMuted} />
                <ThemedText style={styles.infoLabel}>Active PvP Matches</ThemedText>
                <ThemedText style={styles.infoValue}>{status?.activePvpMatches || 0}</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.helpSection}>
            <ThemedText style={styles.sectionTitle}>What the Simulation Does</ThemedText>
            <View style={styles.helpList}>
              <View style={styles.helpItem}>
                <View style={styles.helpBullet} />
                <ThemedText style={styles.helpText}>
                  Creates 100 bot traders with unique names and 10,000 tokens each
                </ThemedText>
              </View>
              <View style={styles.helpItem}>
                <View style={styles.helpBullet} />
                <ThemedText style={styles.helpText}>
                  Bots join competitions and execute random buy/sell trades every 5 seconds
                </ThemedText>
              </View>
              <View style={styles.helpItem}>
                <View style={styles.helpBullet} />
                <ThemedText style={styles.helpText}>
                  Creates PvP matches where one bot goes long and another goes short on the same pair
                </ThemedText>
              </View>
              <View style={styles.helpItem}>
                <View style={styles.helpBullet} />
                <ThemedText style={styles.helpText}>
                  Bots send chat messages during live PvP matches every 3 seconds
                </ThemedText>
              </View>
              <View style={styles.helpItem}>
                <View style={styles.helpBullet} />
                <ThemedText style={styles.helpText}>
                  Bots place bets on PvP match outcomes every 10 seconds to test the odds engine
                </ThemedText>
              </View>
              <View style={styles.helpItem}>
                <View style={styles.helpBullet} />
                <ThemedText style={styles.helpText}>
                  Positions are randomly closed every 15 seconds to generate P&L changes
                </ThemedText>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  content: {
    maxWidth: 800,
    alignSelf: "center",
    width: "100%",
  },
  contentDesktop: {
    paddingHorizontal: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.dark.textMuted,
  },
  statusSection: {
    marginBottom: Spacing.xl,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
  description: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.md,
  },
  controlsSection: {
    marginBottom: Spacing.xl,
  },
  controlButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    flexWrap: "wrap",
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    minWidth: 150,
  },
  startButton: {
    backgroundColor: Colors.dark.success,
  },
  stopButton: {
    backgroundColor: Colors.dark.danger,
  },
  resetButton: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  controlButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "600",
  },
  statsSection: {
    marginBottom: Spacing.xl,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: "center",
    gap: Spacing.xs,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 107, 53, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    textAlign: "center",
  },
  infoSection: {
    marginBottom: Spacing.xl,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  infoItem: {
    flex: 1,
    minWidth: 120,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  infoLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  helpSection: {
    marginBottom: Spacing.xl,
  },
  helpList: {
    gap: Spacing.sm,
  },
  helpItem: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "flex-start",
  },
  helpBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.accent,
    marginTop: 8,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 22,
  },
});

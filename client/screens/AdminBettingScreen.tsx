import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useAuthContext } from "@/context/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface PlatformSetting {
  key: string;
  value: string;
  updatedAt: string;
}

interface BetMarket {
  id: string;
  matchId: string;
  matchName: string;
  status: string;
  betCount: number;
  totalPool: number;
  createdAt: string;
}

interface SuspiciousActivity {
  bettorId: string;
  bettorUsername?: string;
  bettorEmail?: string;
  marketId: string;
  betCount: number;
  totalTokens: number;
}

export default function AdminBettingScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "markets" | "alerts">(
    "settings"
  );

  const { data: settings = [] } = useQuery<PlatformSetting[]>({
    queryKey: ["/api/admin/platform-settings"],
    enabled: isAdmin,
  });

  const { data: markets = [], refetch: refetchMarkets } = useQuery<BetMarket[]>({
    queryKey: ["/api/admin/betting/markets"],
    enabled: isAdmin,
  });

  const { data: suspicious = [], refetch: refetchSuspicious } = useQuery<
    SuspiciousActivity[]
  >({
    queryKey: ["/api/admin/betting/suspicious"],
    enabled: isAdmin,
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return apiRequest("PUT", `/api/admin/platform-settings/${key}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-settings"] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchMarkets(), refetchSuspicious()]);
    setRefreshing(false);
  }, [refetchMarkets, refetchSuspicious]);

  const getSetting = (key: string, defaultVal = "") => {
    const setting = settings.find((s) => s.key === key);
    return setting?.value || defaultVal;
  };

  const updateSetting = (key: string, value: string) => {
    updateSettingMutation.mutate({ key, value });
  };

  const toggleSetting = (key: string) => {
    const currentValue = getSetting(key, "false");
    const newValue = currentValue === "true" ? "false" : "true";
    updateSetting(key, newValue);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return Colors.dark.success;
      case "CLOSED":
        return Colors.dark.warning;
      case "SETTLED":
        return Colors.dark.info;
      case "VOID":
        return Colors.dark.danger;
      default:
        return Colors.dark.textMuted;
    }
  };

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ThemedText style={styles.errorText}>Access Denied</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 60,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <ThemedText style={styles.title}>Betting Controls</ThemedText>
      <ThemedText style={styles.subtitle}>
        Manage betting settings, markets, and risk monitoring
      </ThemedText>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === "settings" && styles.tabActive]}
          onPress={() => setActiveTab("settings")}
        >
          <ThemedText
            style={[
              styles.tabText,
              activeTab === "settings" && styles.tabTextActive,
            ]}
          >
            Settings
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "markets" && styles.tabActive]}
          onPress={() => setActiveTab("markets")}
        >
          <ThemedText
            style={[
              styles.tabText,
              activeTab === "markets" && styles.tabTextActive,
            ]}
          >
            Markets ({markets.length})
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "alerts" && styles.tabActive]}
          onPress={() => setActiveTab("alerts")}
        >
          <ThemedText
            style={[
              styles.tabText,
              activeTab === "alerts" && styles.tabTextActive,
            ]}
          >
            Alerts ({suspicious.length})
          </ThemedText>
        </Pressable>
      </View>

      {activeTab === "settings" ? (
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Betting Settings</ThemedText>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>Betting Enabled</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Master switch for bet-behind
              </ThemedText>
            </View>
            <Switch
              value={getSetting("ENABLE_BET_BEHIND", "false") === "true"}
              onValueChange={() => toggleSetting("ENABLE_BET_BEHIND")}
              trackColor={{ false: Colors.dark.border, true: Colors.dark.accent }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>Rake Rate (%)</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Platform fee on winnings
              </ThemedText>
            </View>
            <TextInput
              style={styles.settingInput}
              value={getSetting("RAKE_PERCENT", "5")}
              onChangeText={(v) => updateSetting("RAKE_PERCENT", v)}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>Min Bet (tokens)</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Minimum bet amount
              </ThemedText>
            </View>
            <TextInput
              style={styles.settingInput}
              value={getSetting("MIN_BET_TOKENS", "1")}
              onChangeText={(v) => updateSetting("MIN_BET_TOKENS", v)}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>Max Bet (tokens)</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Maximum per user per match
              </ThemedText>
            </View>
            <TextInput
              style={styles.settingInput}
              value={getSetting("MAX_BET_TOKENS_PER_USER", "500")}
              onChangeText={(v) => updateSetting("MAX_BET_TOKENS_PER_USER", v)}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>
                Max Bets Per Market
              </ThemedText>
              <ThemedText style={styles.settingDescription}>
                Limit bets per user per match
              </ThemedText>
            </View>
            <TextInput
              style={styles.settingInput}
              value={getSetting("MAX_BETS_PER_USER_PER_MARKET", "5")}
              onChangeText={(v) => updateSetting("MAX_BETS_PER_USER_PER_MARKET", v)}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>
                Rate Limit (seconds)
              </ThemedText>
              <ThemedText style={styles.settingDescription}>
                Cooldown between bets
              </ThemedText>
            </View>
            <TextInput
              style={styles.settingInput}
              value={getSetting("BET_RATE_LIMIT_SECONDS", "10")}
              onChangeText={(v) => updateSetting("BET_RATE_LIMIT_SECONDS", v)}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>
                Cutoff (% of match)
              </ThemedText>
              <ThemedText style={styles.settingDescription}>
                Betting closes after this % of match
              </ThemedText>
            </View>
            <TextInput
              style={styles.settingInput}
              value={getSetting("BET_CUTOFF_PERCENT", "20")}
              onChangeText={(v) => updateSetting("BET_CUTOFF_PERCENT", v)}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>
                Cutoff Max (minutes)
              </ThemedText>
              <ThemedText style={styles.settingDescription}>
                Max minutes after start for betting
              </ThemedText>
            </View>
            <TextInput
              style={styles.settingInput}
              value={getSetting("BET_CUTOFF_MAX_MINUTES", "5")}
              onChangeText={(v) => updateSetting("BET_CUTOFF_MAX_MINUTES", v)}
              keyboardType="numeric"
            />
          </View>
        </View>
      ) : null}

      {activeTab === "markets" ? (
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Betting Markets</ThemedText>

          {markets.length === 0 ? (
            <ThemedText style={styles.emptyText}>No betting markets</ThemedText>
          ) : (
            markets.map((market) => (
              <View key={market.id} style={styles.marketCard}>
                <View style={styles.marketHeader}>
                  <ThemedText style={styles.marketName}>
                    {market.matchName}
                  </ThemedText>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(market.status) + "30" },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.statusText,
                        { color: getStatusColor(market.status) },
                      ]}
                    >
                      {market.status}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.marketStats}>
                  <View style={styles.stat}>
                    <ThemedText style={styles.statValue}>
                      {market.betCount}
                    </ThemedText>
                    <ThemedText style={styles.statLabel}>Bets</ThemedText>
                  </View>
                  <View style={styles.stat}>
                    <ThemedText style={styles.statValue}>
                      {market.totalPool}
                    </ThemedText>
                    <ThemedText style={styles.statLabel}>Pool</ThemedText>
                  </View>
                  <View style={styles.stat}>
                    <ThemedText style={styles.statValue}>
                      {formatDate(market.createdAt)}
                    </ThemedText>
                    <ThemedText style={styles.statLabel}>Created</ThemedText>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}

      {activeTab === "alerts" ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              Suspicious Activity
            </ThemedText>
            <Feather name="alert-triangle" size={20} color={Colors.dark.warning} />
          </View>
          <ThemedText style={styles.alertDescription}>
            Users with more than 3 bets or 200 tokens on a single market
          </ThemedText>

          {suspicious.length === 0 ? (
            <ThemedText style={styles.emptyText}>
              No suspicious activity detected
            </ThemedText>
          ) : (
            suspicious.map((activity, index) => (
              <View key={`${activity.bettorId}-${activity.marketId}-${index}`} style={styles.alertCard}>
                <Feather
                  name="alert-circle"
                  size={20}
                  color={Colors.dark.warning}
                />
                <View style={styles.alertInfo}>
                  <ThemedText style={styles.alertUser}>
                    {activity.bettorUsername || activity.bettorEmail?.split("@")[0] || activity.bettorId.slice(0, 8)}
                  </ThemedText>
                  <ThemedText style={styles.alertDetails}>
                    {activity.betCount} bets | {activity.totalTokens} tokens on market
                  </ThemedText>
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 18,
    color: Colors.dark.danger,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.xl,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.md,
  },
  tabActive: {
    backgroundColor: Colors.dark.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.dark.textSecondary,
  },
  tabTextActive: {
    color: Colors.dark.text,
  },
  section: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.md,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.dark.text,
  },
  settingDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  settingInput: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    fontSize: 15,
    color: Colors.dark.text,
    minWidth: 60,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: "center",
    paddingVertical: Spacing.lg,
  },
  marketCard: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  marketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  marketName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  marketStats: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  alertDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.md,
  },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  alertInfo: {
    flex: 1,
  },
  alertUser: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  alertDetails: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
});

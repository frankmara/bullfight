import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
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

interface ArenaMatch {
  id: string;
  name: string;
  status: string;
  liveStatus: string;
  isFeatured: boolean;
  challengerUsername?: string;
  inviteeUsername?: string;
  bettingEnabled: boolean;
  createdAt: string;
}

export default function AdminArenaModeScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);

  const { data: settings = [] } = useQuery<PlatformSetting[]>({
    queryKey: ["/api/admin/platform-settings"],
    enabled: isAdmin,
  });

  const { data: matches = [], refetch } = useQuery<ArenaMatch[]>({
    queryKey: ["/api/admin/arena-matches"],
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

  const featureMatchMutation = useMutation({
    mutationFn: async ({
      matchId,
      featured,
    }: {
      matchId: string;
      featured: boolean;
    }) => {
      return apiRequest("POST", `/api/admin/arena-matches/${matchId}/feature`, {
        featured,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/arena-matches"] });
    },
  });

  const delistMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      return apiRequest("POST", `/api/admin/arena-matches/${matchId}/delist`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/arena-matches"] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const getSetting = (key: string, defaultVal = "false") => {
    const setting = settings.find((s) => s.key === key);
    return setting?.value || defaultVal;
  };

  const toggleSetting = (key: string) => {
    const currentValue = getSetting(key);
    const newValue = currentValue === "true" ? "false" : "true";
    updateSettingMutation.mutate({ key, value: newValue });
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
      <ThemedText style={styles.title}>Arena Mode</ThemedText>
      <ThemedText style={styles.subtitle}>
        Manage arena matches and platform settings
      </ThemedText>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Platform Settings</ThemedText>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <ThemedText style={styles.settingLabel}>Arena Mode Enabled</ThemedText>
            <ThemedText style={styles.settingDescription}>
              Allow public arena matches
            </ThemedText>
          </View>
          <Switch
            value={getSetting("ENABLE_ARENA_MODE") === "true"}
            onValueChange={() => toggleSetting("ENABLE_ARENA_MODE")}
            trackColor={{ false: Colors.dark.border, true: Colors.dark.accent }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <ThemedText style={styles.settingLabel}>Bet-Behind Enabled</ThemedText>
            <ThemedText style={styles.settingDescription}>
              Enable spectator betting
            </ThemedText>
          </View>
          <Switch
            value={getSetting("ENABLE_BET_BEHIND") === "true"}
            onValueChange={() => toggleSetting("ENABLE_BET_BEHIND")}
            trackColor={{ false: Colors.dark.border, true: Colors.dark.accent }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>
          Arena Matches ({matches.length})
        </ThemedText>

        {matches.length === 0 ? (
          <ThemedText style={styles.emptyText}>No arena matches found</ThemedText>
        ) : (
          matches.map((match) => (
            <View key={match.id} style={styles.matchCard}>
              <View style={styles.matchHeader}>
                <ThemedText style={styles.matchName}>{match.name}</ThemedText>
                {match.isFeatured ? (
                  <View style={styles.featuredBadge}>
                    <Feather name="star" size={12} color={Colors.dark.gold} />
                    <ThemedText style={styles.featuredText}>Featured</ThemedText>
                  </View>
                ) : null}
              </View>

              <ThemedText style={styles.matchDetails}>
                {match.challengerUsername} vs {match.inviteeUsername}
              </ThemedText>

              <View style={styles.matchStatus}>
                <View
                  style={[
                    styles.statusBadge,
                    match.liveStatus === "live" && styles.statusLive,
                    match.liveStatus === "scheduled" && styles.statusScheduled,
                    match.liveStatus === "ended" && styles.statusEnded,
                  ]}
                >
                  <ThemedText style={styles.statusText}>
                    {match.liveStatus?.toUpperCase() || "OFFLINE"}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.matchActions}>
                <Pressable
                  style={[
                    styles.actionButton,
                    match.isFeatured && styles.actionButtonActive,
                  ]}
                  onPress={() =>
                    featureMatchMutation.mutate({
                      matchId: match.id,
                      featured: !match.isFeatured,
                    })
                  }
                >
                  <Feather
                    name="star"
                    size={16}
                    color={
                      match.isFeatured ? Colors.dark.gold : Colors.dark.textMuted
                    }
                  />
                  <ThemedText
                    style={[
                      styles.actionText,
                      match.isFeatured && styles.actionTextActive,
                    ]}
                  >
                    {match.isFeatured ? "Unfeature" : "Feature"}
                  </ThemedText>
                </Pressable>

                <Pressable
                  style={styles.actionButton}
                  onPress={() => delistMatchMutation.mutate(match.id)}
                >
                  <Feather name="x" size={16} color={Colors.dark.danger} />
                  <ThemedText style={styles.actionTextDanger}>Delist</ThemedText>
                </Pressable>
              </View>
            </View>
          ))
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
    marginBottom: Spacing["2xl"],
  },
  section: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
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
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: "center",
    paddingVertical: Spacing.lg,
  },
  matchCard: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  matchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  matchName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.text,
    flex: 1,
  },
  featuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 193, 7, 0.15)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  featuredText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.gold,
  },
  matchDetails: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.sm,
  },
  matchStatus: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dark.border,
  },
  statusLive: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  statusScheduled: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  statusEnded: {
    backgroundColor: "rgba(107, 114, 128, 0.2)",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  matchActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  actionButtonActive: {
    borderColor: Colors.dark.gold,
  },
  actionText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  actionTextActive: {
    color: Colors.dark.gold,
  },
  actionTextDanger: {
    fontSize: 13,
    color: Colors.dark.danger,
  },
});

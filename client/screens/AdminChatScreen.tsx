import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useAuthContext } from "@/context/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface ChatMute {
  id: string;
  userId: string;
  username?: string;
  channelId?: string;
  reason?: string;
  expiresAt?: string;
  mutedAt: string;
}

interface ChatBan {
  id: string;
  userId: string;
  username?: string;
  channelId?: string;
  reason?: string;
  expiresAt?: string;
  bannedAt: string;
}

interface ChatChannel {
  id: string;
  matchId: string;
  createdAt: string;
}

export default function AdminChatScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"mutes" | "bans" | "channels">("mutes");
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("");

  const { data: mutes = [], refetch: refetchMutes } = useQuery<ChatMute[]>({
    queryKey: ["/api/admin/chat/mutes"],
    enabled: isAdmin,
  });

  const { data: bans = [], refetch: refetchBans } = useQuery<ChatBan[]>({
    queryKey: ["/api/admin/chat/bans"],
    enabled: isAdmin,
  });

  const { data: channels = [], refetch: refetchChannels } = useQuery<ChatChannel[]>({
    queryKey: ["/api/admin/chat/channels"],
    enabled: isAdmin,
  });

  const muteUserMutation = useMutation({
    mutationFn: async (data: {
      targetUserId: string;
      reason?: string;
      durationMinutes?: number;
    }) => {
      return apiRequest("POST", "/api/admin/chat/mutes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat/mutes"] });
      setShowMuteModal(false);
      resetForm();
    },
  });

  const unmuteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/admin/chat/mutes/${userId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat/mutes"] });
    },
  });

  const banUserMutation = useMutation({
    mutationFn: async (data: {
      targetUserId: string;
      reason?: string;
      durationDays?: number;
    }) => {
      return apiRequest("POST", "/api/admin/chat/bans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat/bans"] });
      setShowBanModal(false);
      resetForm();
    },
  });

  const unbanUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/admin/chat/bans/${userId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat/bans"] });
    },
  });

  const resetForm = () => {
    setTargetUserId("");
    setReason("");
    setDuration("");
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchMutes(), refetchBans(), refetchChannels()]);
    setRefreshing(false);
  }, [refetchMutes, refetchBans, refetchChannels]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
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
      <ThemedText style={styles.title}>Chat Moderation</ThemedText>
      <ThemedText style={styles.subtitle}>
        Manage user mutes, bans, and chat channels
      </ThemedText>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === "mutes" && styles.tabActive]}
          onPress={() => setActiveTab("mutes")}
        >
          <ThemedText
            style={[
              styles.tabText,
              activeTab === "mutes" && styles.tabTextActive,
            ]}
          >
            Mutes ({mutes.length})
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "bans" && styles.tabActive]}
          onPress={() => setActiveTab("bans")}
        >
          <ThemedText
            style={[
              styles.tabText,
              activeTab === "bans" && styles.tabTextActive,
            ]}
          >
            Bans ({bans.length})
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "channels" && styles.tabActive]}
          onPress={() => setActiveTab("channels")}
        >
          <ThemedText
            style={[
              styles.tabText,
              activeTab === "channels" && styles.tabTextActive,
            ]}
          >
            Channels ({channels.length})
          </ThemedText>
        </Pressable>
      </View>

      {activeTab === "mutes" ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Muted Users</ThemedText>
            <Pressable
              style={styles.addButton}
              onPress={() => setShowMuteModal(true)}
            >
              <Feather name="plus" size={16} color={Colors.dark.text} />
              <ThemedText style={styles.addButtonText}>Mute User</ThemedText>
            </Pressable>
          </View>

          {mutes.length === 0 ? (
            <ThemedText style={styles.emptyText}>No muted users</ThemedText>
          ) : (
            mutes.map((mute) => (
              <View key={mute.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <ThemedText style={styles.username}>
                    {mute.username || mute.userId.slice(0, 8)}
                  </ThemedText>
                  {mute.reason ? (
                    <ThemedText style={styles.reason}>{mute.reason}</ThemedText>
                  ) : null}
                  <ThemedText style={styles.meta}>
                    Muted: {formatDate(mute.mutedAt)}
                    {mute.expiresAt ? ` | Expires: ${formatDate(mute.expiresAt)}` : " | Permanent"}
                  </ThemedText>
                </View>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => unmuteUserMutation.mutate(mute.userId)}
                >
                  <Feather name="x" size={18} color={Colors.dark.danger} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      ) : null}

      {activeTab === "bans" ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Banned Users</ThemedText>
            <Pressable
              style={styles.addButton}
              onPress={() => setShowBanModal(true)}
            >
              <Feather name="plus" size={16} color={Colors.dark.text} />
              <ThemedText style={styles.addButtonText}>Ban User</ThemedText>
            </Pressable>
          </View>

          {bans.length === 0 ? (
            <ThemedText style={styles.emptyText}>No banned users</ThemedText>
          ) : (
            bans.map((ban) => (
              <View key={ban.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <ThemedText style={styles.username}>
                    {ban.username || ban.userId.slice(0, 8)}
                  </ThemedText>
                  {ban.reason ? (
                    <ThemedText style={styles.reason}>{ban.reason}</ThemedText>
                  ) : null}
                  <ThemedText style={styles.meta}>
                    Banned: {formatDate(ban.bannedAt)}
                    {ban.expiresAt ? ` | Expires: ${formatDate(ban.expiresAt)}` : " | Permanent"}
                  </ThemedText>
                </View>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => unbanUserMutation.mutate(ban.userId)}
                >
                  <Feather name="x" size={18} color={Colors.dark.danger} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      ) : null}

      {activeTab === "channels" ? (
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Chat Channels</ThemedText>

          {channels.length === 0 ? (
            <ThemedText style={styles.emptyText}>No chat channels</ThemedText>
          ) : (
            channels.map((channel) => (
              <View key={channel.id} style={styles.channelCard}>
                <Feather
                  name="message-circle"
                  size={18}
                  color={Colors.dark.accent}
                />
                <View style={styles.channelInfo}>
                  <ThemedText style={styles.channelId}>
                    {channel.id.slice(0, 8)}...
                  </ThemedText>
                  <ThemedText style={styles.meta}>
                    Match: {channel.matchId.slice(0, 8)}... | Created:{" "}
                    {formatDate(channel.createdAt)}
                  </ThemedText>
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}

      <Modal
        visible={showMuteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMuteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Mute User</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="User ID"
              placeholderTextColor={Colors.dark.textMuted}
              value={targetUserId}
              onChangeText={setTargetUserId}
            />
            <TextInput
              style={styles.input}
              placeholder="Reason (optional)"
              placeholderTextColor={Colors.dark.textMuted}
              value={reason}
              onChangeText={setReason}
            />
            <TextInput
              style={styles.input}
              placeholder="Duration in minutes (empty = permanent)"
              placeholderTextColor={Colors.dark.textMuted}
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => {
                  setShowMuteModal(false);
                  resetForm();
                }}
              >
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={styles.modalConfirm}
                onPress={() =>
                  muteUserMutation.mutate({
                    targetUserId,
                    reason: reason || undefined,
                    durationMinutes: duration ? parseInt(duration, 10) : undefined,
                  })
                }
              >
                <ThemedText style={styles.modalConfirmText}>Mute</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBanModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Ban User</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="User ID"
              placeholderTextColor={Colors.dark.textMuted}
              value={targetUserId}
              onChangeText={setTargetUserId}
            />
            <TextInput
              style={styles.input}
              placeholder="Reason (optional)"
              placeholderTextColor={Colors.dark.textMuted}
              value={reason}
              onChangeText={setReason}
            />
            <TextInput
              style={styles.input}
              placeholder="Duration in days (empty = permanent)"
              placeholderTextColor={Colors.dark.textMuted}
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => {
                  setShowBanModal(false);
                  resetForm();
                }}
              >
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, styles.modalConfirmDanger]}
                onPress={() =>
                  banUserMutation.mutate({
                    targetUserId,
                    reason: reason || undefined,
                    durationDays: duration ? parseInt(duration, 10) : undefined,
                  })
                }
              >
                <ThemedText style={styles.modalConfirmText}>Ban</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.dark.accent,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.dark.text,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: "center",
    paddingVertical: Spacing.lg,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  reason: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  removeButton: {
    padding: Spacing.sm,
  },
  channelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  channelInfo: {
    flex: 1,
  },
  channelId: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.dark.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.lg,
  },
  input: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    color: Colors.dark.text,
    marginBottom: Spacing.md,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  modalCancel: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  modalCancelText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  modalConfirm: {
    backgroundColor: Colors.dark.accent,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  modalConfirmDanger: {
    backgroundColor: Colors.dark.danger,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.text,
  },
});

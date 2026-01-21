import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";

interface Competition {
  id: string;
  title: string;
  status: string;
  entryCount: number;
  entryCap: number;
  prizePoolCents: number;
  startAt?: string;
  endAt?: string;
}

export default function AdminCompetitionsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();

  const {
    data: competitions,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Competition[]>({
    queryKey: ["/api/admin/competitions"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("POST", `/api/admin/competitions/${id}/status`, {
        status,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to update status");
    },
  });

  const handleStatusChange = (comp: Competition, newStatus: string) => {
    Alert.alert(
      "Update Status",
      `Change status from "${comp.status}" to "${newStatus}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => updateStatusMutation.mutate({ id: comp.id, status: newStatus }),
        },
      ]
    );
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString()}`;

  const renderItem = ({ item }: { item: Competition }) => {
    const statusActions = {
      draft: ["open"],
      open: ["running", "draft"],
      running: ["ended"],
      ended: ["paid"],
      paid: [],
    };

    const availableActions = statusActions[item.status as keyof typeof statusActions] || [];

    return (
      <View style={styles.competitionCard}>
        <View style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </ThemedText>
          <StatusBadge status={item.status} />
        </View>

        <View style={styles.cardStats}>
          <View style={styles.cardStat}>
            <ThemedText style={styles.statLabel}>Entries</ThemedText>
            <ThemedText style={styles.statValue}>
              {item.entryCount}/{item.entryCap}
            </ThemedText>
          </View>
          <View style={styles.cardStat}>
            <ThemedText style={styles.statLabel}>Prize Pool</ThemedText>
            <ThemedText style={styles.statValue}>
              {formatCurrency(item.prizePoolCents)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.cardActions}>
          {availableActions.map((action) => (
            <Pressable
              key={action}
              style={styles.actionButton}
              onPress={() => handleStatusChange(item, action)}
            >
              <ThemedText style={styles.actionButtonText}>
                {action === "open"
                  ? "Open"
                  : action === "running"
                  ? "Start"
                  : action === "ended"
                  ? "End"
                  : action === "paid"
                  ? "Mark Paid"
                  : action.charAt(0).toUpperCase() + action.slice(1)}
              </ThemedText>
            </Pressable>
          ))}
          <Pressable
            style={[styles.actionButton, styles.editButton]}
            onPress={() => navigation.navigate("EditCompetition", { id: item.id })}
          >
            <Feather name="edit-2" size={14} color={Colors.dark.primaryBlue} />
          </Pressable>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 60,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText style={styles.title}>Competitions</ThemedText>
            <Button
              onPress={() => navigation.navigate("CreateCompetition")}
              style={styles.createButton}
            >
              + New
            </Button>
          </View>
        }
        data={competitions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <EmptyState
            title="No Competitions"
            message="Create your first trading competition"
            actionLabel="Create Competition"
            onAction={() => navigation.navigate("CreateCompetition")}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.dark.primaryBlue}
          />
        }
      />
    </View>
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
  content: {
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  createButton: {
    paddingHorizontal: Spacing.lg,
  },
  competitionCard: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  cardStats: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  cardStat: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  cardActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingTop: Spacing.md,
  },
  actionButton: {
    backgroundColor: Colors.dark.backgroundSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  editButton: {
    marginLeft: "auto",
    marginRight: 0,
  },
});

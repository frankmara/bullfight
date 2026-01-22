import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Platform,
  Dimensions,
  useWindowDimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/Button";
import { useAuthContext } from "@/context/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";

function useSafeTabBarHeight() {
  try {
    return useBottomTabBarHeight();
  } catch {
    return 0;
  }
}

interface PvpChallenge {
  id: string;
  name: string | null;
  challengerId: string;
  inviteeId: string | null;
  inviteeEmail: string;
  status: string;
  stakeCents: number;
  startingBalanceCents: number;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  competitionId: string | null;
}

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_NAV_HEIGHT = 64;

function useSafeHeaderHeight() {
  try {
    return useHeaderHeight();
  } catch {
    return 0;
  }
}

export default function PvPListScreen() {
  const insets = useSafeAreaInsets();
  const rawHeaderHeight = useSafeHeaderHeight();
  const tabBarHeight = useSafeTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
  const headerHeight = isDesktop ? DESKTOP_NAV_HEIGHT : Math.max(rawHeaderHeight, insets.top);
  const bottomPadding = isDesktop ? Spacing.xl : tabBarHeight + Spacing.lg;
  const { user, isAuthenticated } = useAuthContext();

  const isWeb = Platform.OS === "web";
  const maxWidth = 1000;
  const containerWidth = isWeb ? Math.min(width - Spacing.lg * 2, maxWidth) : width - Spacing.lg * 2;

  const {
    data: challenges,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<PvpChallenge[]>({
    queryKey: ["/api/pvp/challenges"],
    enabled: isAuthenticated,
  });

  const handleLogin = () => {
    navigation.navigate("Login");
  };

  const handleCreateChallenge = () => {
    navigation.navigate("PvPNew" as any);
  };

  const handleViewChallenge = (id: string) => {
    navigation.navigate("PvPDetail" as any, { id });
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString()}`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return Colors.dark.success;
      case "pending":
      case "negotiating":
        return Colors.dark.warning;
      case "accepted":
      case "payment_pending":
        return Colors.dark.info;
      case "completed":
        return Colors.dark.gold;
      case "cancelled":
        return Colors.dark.danger;
      default:
        return Colors.dark.textMuted;
    }
  };

  const getRoleLabel = (challenge: PvpChallenge) => {
    if (challenge.challengerId === user?.id) return "Challenger";
    return "Invitee";
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
              Log in to view and create PvP challenges
            </ThemedText>
            <Button onPress={handleLogin} style={styles.emptyButton}>
              Sign In
            </Button>
          </View>
        </View>
      </View>
    );
  }

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

  const renderChallengeItem = ({ item }: { item: PvpChallenge }) => (
    <Pressable
      style={styles.challengeCard}
      onPress={() => handleViewChallenge(item.id)}
    >
      <View style={styles.challengeHeader}>
        <View style={styles.challengeHeaderLeft}>
          <ThemedText style={styles.challengeTitle}>
            {item.name || `vs ${item.inviteeEmail}`}
          </ThemedText>
          {item.name ? (
            <ThemedText style={styles.opponentText}>vs {item.inviteeEmail}</ThemedText>
          ) : null}
          <View style={styles.roleContainer}>
            <ThemedText style={styles.roleText}>{getRoleLabel(item)}</ThemedText>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
          <ThemedText style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.replace("_", " ").toUpperCase()}
          </ThemedText>
        </View>
      </View>

      <View style={styles.challengeDetails}>
        <View style={styles.detailItem}>
          <ThemedText style={styles.detailLabel}>Stake</ThemedText>
          <ThemedText style={styles.detailValue}>
            {formatCurrency(item.stakeCents)}
          </ThemedText>
        </View>
        <View style={styles.detailItem}>
          <ThemedText style={styles.detailLabel}>Balance</ThemedText>
          <ThemedText style={styles.detailValue}>
            {formatCurrency(item.startingBalanceCents)}
          </ThemedText>
        </View>
        <View style={styles.detailItem}>
          <ThemedText style={styles.detailLabel}>Created</ThemedText>
          <ThemedText style={styles.detailValue}>
            {new Date(item.createdAt).toLocaleDateString()}
          </ThemedText>
        </View>
      </View>

      <View style={styles.viewArrow}>
        <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      <View style={[styles.contentWrapper, isDesktop && { maxWidth: containerWidth }]}>
        <View style={[styles.header, !isDesktop && styles.headerMobile]}>
          <View style={styles.headerText}>
            <ThemedText style={styles.pageTitle}>PvP Challenges</ThemedText>
            <ThemedText style={styles.pageSubtitle}>
              One-on-one trading competitions
            </ThemedText>
          </View>
          <Button onPress={handleCreateChallenge} style={[styles.createButton, !isDesktop && styles.createButtonMobile]}>
            <Feather name="plus" size={16} color={Colors.dark.buttonText} />
            <ThemedText style={styles.createButtonText}>New Challenge</ThemedText>
          </Button>
        </View>

        <FlatList
          data={challenges}
          keyExtractor={(item) => item.id}
          renderItem={renderChallengeItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.dark.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Feather name="users" size={48} color={Colors.dark.textMuted} />
              </View>
              <ThemedText style={styles.emptyTitle}>No Challenges Yet</ThemedText>
              <ThemedText style={styles.emptyMessage}>
                Create your first PvP challenge to compete one-on-one
              </ThemedText>
              <Button onPress={handleCreateChallenge} style={styles.emptyButton}>
                Create Challenge
              </Button>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  contentWrapper: {
    flex: 1,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  createButtonMobile: {
    alignSelf: "stretch",
  },
  createButtonText: {
    color: Colors.dark.buttonText,
    fontWeight: "600",
  },
  listContent: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  challengeCard: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  challengeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  challengeHeaderLeft: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: 4,
  },
  opponentText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  roleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  challengeDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  viewArrow: {
    position: "absolute",
    right: Spacing.lg,
    top: "50%",
    marginTop: -10,
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptyMessage: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: "center",
    maxWidth: 300,
    marginBottom: Spacing.xl,
  },
  emptyButton: {
    minWidth: 150,
  },
});

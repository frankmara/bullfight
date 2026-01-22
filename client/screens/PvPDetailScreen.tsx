import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
  Dimensions,
  useWindowDimensions,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuthContext } from "@/context/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";
import { apiRequest } from "@/lib/query-client";

const DESKTOP_BREAKPOINT = 768;
const AVAILABLE_PAIRS = ["EUR-USD", "GBP-USD", "USD-JPY", "AUD-USD", "USD-CAD"];

interface PvpChallenge {
  id: string;
  challengerId: string;
  inviteeId: string | null;
  inviteeEmail: string;
  status: string;
  stakeCents: number;
  startingBalanceCents: number;
  allowedPairsJson: string[];
  startAt: string | null;
  endAt: string | null;
  rakeBps: number;
  proposedTermsJson: any;
  proposedBy: string | null;
  challengerAccepted: boolean;
  inviteeAccepted: boolean;
  challengerPaid: boolean;
  inviteePaid: boolean;
  competitionId: string | null;
  createdAt: string;
}

function useSafeHeaderHeight() {
  try {
    return useHeaderHeight();
  } catch {
    return 0;
  }
}

type PvPDetailRouteProp = RouteProp<{ PvPDetail: { id: string } }, "PvPDetail">;

export default function PvPDetailScreen() {
  const insets = useSafeAreaInsets();
  const rawHeaderHeight = useSafeHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<PvPDetailRouteProp>();
  const queryClient = useQueryClient();
  const isDesktop = Platform.OS === "web" && Dimensions.get("window").width >= DESKTOP_BREAKPOINT;
  const headerHeight = isDesktop ? 0 : rawHeaderHeight;
  const { user, isAuthenticated } = useAuthContext();
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === "web";
  const maxWidth = 700;
  const containerWidth = isWeb ? Math.min(width - Spacing.lg * 2, maxWidth) : width - Spacing.lg * 2;

  const { id } = route.params;

  const [editMode, setEditMode] = useState(false);
  const [stakeDollars, setStakeDollars] = useState("");
  const [startingBalanceDollars, setStartingBalanceDollars] = useState("");
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [durationHours, setDurationHours] = useState("");

  const { data: challenge, isLoading, refetch } = useQuery<PvpChallenge>({
    queryKey: [`/api/pvp/challenges/${id}`],
    enabled: isAuthenticated && !!id,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/pvp/challenges/${id}/accept`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pvp/challenges/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/pvp/challenges"] });
      refetch();
    },
  });

  const proposeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/pvp/challenges/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pvp/challenges/${id}`] });
      setEditMode(false);
      refetch();
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/pvp/challenges/${id}/pay`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pvp/challenges/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/pvp/challenges"] });
      refetch();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/pvp/challenges/${id}/cancel`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pvp/challenges"] });
      navigation.goBack();
    },
  });

  const handleEditMode = () => {
    if (challenge) {
      setStakeDollars((challenge.stakeCents / 100).toString());
      setStartingBalanceDollars((challenge.startingBalanceCents / 100).toString());
      setSelectedPairs(challenge.allowedPairsJson || AVAILABLE_PAIRS);
      if (challenge.startAt && challenge.endAt) {
        const start = new Date(challenge.startAt);
        const end = new Date(challenge.endAt);
        const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
        setDurationHours(hours.toString());
      } else {
        setDurationHours("24");
      }
      setEditMode(true);
    }
  };

  const handleTogglePair = (pair: string) => {
    if (selectedPairs.includes(pair)) {
      if (selectedPairs.length > 1) {
        setSelectedPairs(selectedPairs.filter((p) => p !== pair));
      }
    } else {
      setSelectedPairs([...selectedPairs, pair]);
    }
  };

  const handlePropose = () => {
    const stake = parseFloat(stakeDollars);
    const balance = parseFloat(startingBalanceDollars);
    const hours = parseInt(durationHours);

    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + hours * 60 * 60 * 1000);

    proposeMutation.mutate({
      stakeCents: Math.round(stake * 100),
      startingBalanceCents: Math.round(balance * 100),
      allowedPairsJson: selectedPairs,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    });
  };

  const handleEnterArena = () => {
    if (challenge?.competitionId) {
      navigation.navigate("Arena", { id: challenge.competitionId });
    }
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

  if (!isAuthenticated) {
    navigation.navigate("Login");
    return null;
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: headerHeight }]}>
        <LoadingSpinner />
      </View>
    );
  }

  if (!challenge) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: headerHeight }]}>
        <ThemedText style={styles.errorText}>Challenge not found</ThemedText>
      </View>
    );
  }

  const isChallenger = challenge.challengerId === user?.id;
  const isInvitee = challenge.inviteeId === user?.id || challenge.inviteeEmail === user?.email;
  const canEdit = (challenge.status === "pending" || challenge.status === "negotiating");
  const hasProposal = challenge.proposedTermsJson && challenge.proposedBy;
  const proposalFromOther = hasProposal && challenge.proposedBy !== user?.id;
  const needsAcceptance = canEdit && (
    (isChallenger && !challenge.challengerAccepted) ||
    (isInvitee && !challenge.inviteeAccepted)
  );
  const canPay = challenge.status === "accepted" || challenge.status === "payment_pending";
  const hasPaid = (isChallenger && challenge.challengerPaid) || (isInvitee && challenge.inviteePaid);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingTop: headerHeight + Spacing.xl },
      ]}
    >
      <View style={[styles.contentWrapper, { maxWidth: containerWidth }]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={20} color={Colors.dark.text} />
          </Pressable>
          <View style={styles.headerContent}>
            <ThemedText style={styles.pageTitle}>PvP Challenge</ThemedText>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(challenge.status) + "20" }]}>
              <ThemedText style={[styles.statusText, { color: getStatusColor(challenge.status) }]}>
                {challenge.status.replace("_", " ").toUpperCase()}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.participantsCard}>
          <View style={styles.participant}>
            <View style={styles.participantIcon}>
              <Feather name="user" size={20} color={Colors.dark.accent} />
            </View>
            <View>
              <ThemedText style={styles.participantRole}>Challenger</ThemedText>
              <ThemedText style={styles.participantEmail}>
                {isChallenger ? "You" : "Opponent"}
              </ThemedText>
            </View>
            {challenge.challengerAccepted ? (
              <Feather name="check-circle" size={18} color={Colors.dark.success} style={styles.participantStatus} />
            ) : null}
          </View>
          <View style={styles.vsContainer}>
            <ThemedText style={styles.vsText}>VS</ThemedText>
          </View>
          <View style={styles.participant}>
            <View style={styles.participantIcon}>
              <Feather name="user" size={20} color={Colors.dark.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.participantRole}>Invitee</ThemedText>
              <ThemedText style={styles.participantEmail} numberOfLines={1}>
                {isInvitee ? "You" : challenge.inviteeEmail}
              </ThemedText>
            </View>
            {challenge.inviteeAccepted ? (
              <Feather name="check-circle" size={18} color={Colors.dark.success} style={styles.participantStatus} />
            ) : null}
          </View>
        </View>

        {editMode ? (
          <View style={styles.editSection}>
            <ThemedText style={styles.sectionTitle}>Propose New Terms</ThemedText>
            
            <View style={styles.rowInputs}>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <ThemedText style={styles.inputLabel}>Stake ($)</ThemedText>
                <TextInput
                  style={styles.textInput}
                  value={stakeDollars}
                  onChangeText={setStakeDollars}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ width: Spacing.md }} />
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <ThemedText style={styles.inputLabel}>Balance ($)</ThemedText>
                <TextInput
                  style={styles.textInput}
                  value={startingBalanceDollars}
                  onChangeText={setStartingBalanceDollars}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Duration (hours)</ThemedText>
              <TextInput
                style={styles.textInput}
                value={durationHours}
                onChangeText={setDurationHours}
                keyboardType="number-pad"
              />
            </View>

            <ThemedText style={styles.inputLabel}>Trading Pairs</ThemedText>
            <View style={styles.pairsContainer}>
              {AVAILABLE_PAIRS.map((pair) => (
                <Pressable
                  key={pair}
                  style={[
                    styles.pairChip,
                    selectedPairs.includes(pair) && styles.pairChipSelected,
                  ]}
                  onPress={() => handleTogglePair(pair)}
                >
                  <ThemedText
                    style={[
                      styles.pairChipText,
                      selectedPairs.includes(pair) && styles.pairChipTextSelected,
                    ]}
                  >
                    {pair}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.editActions}>
              <Button
                variant="secondary"
                onPress={() => setEditMode(false)}
                style={styles.editButton}
              >
                Cancel
              </Button>
              <Button
                onPress={handlePropose}
                disabled={proposeMutation.isPending}
                style={styles.editButton}
              >
                {proposeMutation.isPending ? <LoadingSpinner size="small" /> : "Propose Changes"}
              </Button>
            </View>
          </View>
        ) : (
          <>
            {proposalFromOther ? (
              <View style={styles.proposalCard}>
                <View style={styles.proposalHeader}>
                  <Feather name="edit-3" size={18} color={Colors.dark.warning} />
                  <ThemedText style={styles.proposalTitle}>New Terms Proposed</ThemedText>
                </View>
                <ThemedText style={styles.proposalHint}>
                  Your opponent has proposed changes. Review and accept or counter.
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.termsSection}>
              <View style={styles.termsSectionHeader}>
                <ThemedText style={styles.sectionTitle}>Challenge Terms</ThemedText>
                {canEdit ? (
                  <Pressable onPress={handleEditMode} style={styles.editLink}>
                    <Feather name="edit-2" size={14} color={Colors.dark.accent} />
                    <ThemedText style={styles.editLinkText}>Propose Changes</ThemedText>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.termsCard}>
                <View style={styles.termRow}>
                  <ThemedText style={styles.termLabel}>Stake (each)</ThemedText>
                  <ThemedText style={styles.termValue}>
                    {formatCurrency(challenge.stakeCents)}
                  </ThemedText>
                </View>
                <View style={styles.termRow}>
                  <ThemedText style={styles.termLabel}>Total Prize Pool</ThemedText>
                  <ThemedText style={[styles.termValue, { color: Colors.dark.gold }]}>
                    {formatCurrency(challenge.stakeCents * 2)}
                  </ThemedText>
                </View>
                <View style={styles.termRow}>
                  <ThemedText style={styles.termLabel}>Winner Takes (after rake)</ThemedText>
                  <ThemedText style={[styles.termValue, { color: Colors.dark.success }]}>
                    {formatCurrency(Math.round(challenge.stakeCents * 2 * (1 - challenge.rakeBps / 10000)))}
                  </ThemedText>
                </View>
                <View style={styles.termDivider} />
                <View style={styles.termRow}>
                  <ThemedText style={styles.termLabel}>Starting Balance</ThemedText>
                  <ThemedText style={styles.termValue}>
                    {formatCurrency(challenge.startingBalanceCents)}
                  </ThemedText>
                </View>
                <View style={styles.termRow}>
                  <ThemedText style={styles.termLabel}>Trading Pairs</ThemedText>
                  <ThemedText style={styles.termValue}>
                    {challenge.allowedPairsJson?.length || 0} pairs
                  </ThemedText>
                </View>
                {challenge.startAt && challenge.endAt ? (
                  <View style={styles.termRow}>
                    <ThemedText style={styles.termLabel}>Duration</ThemedText>
                    <ThemedText style={styles.termValue}>
                      {Math.round((new Date(challenge.endAt).getTime() - new Date(challenge.startAt).getTime()) / (1000 * 60 * 60))}h
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </>
        )}

        {challenge.status === "active" && challenge.competitionId ? (
          <Button onPress={handleEnterArena} style={styles.actionButton}>
            <Feather name="activity" size={18} color={Colors.dark.buttonText} />
            <ThemedText style={styles.actionButtonText}>Enter Arena</ThemedText>
          </Button>
        ) : null}

        {needsAcceptance && !editMode ? (
          <Button
            onPress={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            style={styles.actionButton}
          >
            {acceptMutation.isPending ? (
              <LoadingSpinner size="small" />
            ) : (
              <>
                <Feather name="check" size={18} color={Colors.dark.buttonText} />
                <ThemedText style={styles.actionButtonText}>
                  {proposalFromOther ? "Accept Proposed Terms" : "Accept Terms"}
                </ThemedText>
              </>
            )}
          </Button>
        ) : null}

        {canPay && !hasPaid ? (
          <Button
            onPress={() => payMutation.mutate()}
            disabled={payMutation.isPending}
            style={styles.actionButton}
          >
            {payMutation.isPending ? (
              <LoadingSpinner size="small" />
            ) : (
              <>
                <Feather name="credit-card" size={18} color={Colors.dark.buttonText} />
                <ThemedText style={styles.actionButtonText}>
                  Pay {formatCurrency(challenge.stakeCents)}
                </ThemedText>
              </>
            )}
          </Button>
        ) : null}

        {hasPaid && challenge.status === "payment_pending" ? (
          <View style={styles.waitingCard}>
            <Feather name="clock" size={24} color={Colors.dark.warning} />
            <ThemedText style={styles.waitingText}>
              Waiting for opponent to pay...
            </ThemedText>
          </View>
        ) : null}

        {canEdit ? (
          <Button
            variant="secondary"
            onPress={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            style={styles.cancelButton}
          >
            {cancelMutation.isPending ? (
              <LoadingSpinner size="small" />
            ) : (
              <ThemedText style={styles.cancelButtonText}>Cancel Challenge</ThemedText>
            )}
          </Button>
        ) : null}

        <View style={{ height: insets.bottom + Spacing.xl }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    paddingBottom: Spacing.xl,
  },
  contentWrapper: {
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  participantsCard: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  participant: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  participantIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  participantRole: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  participantEmail: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  participantStatus: {
    marginLeft: "auto",
  },
  vsContainer: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  vsText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.dark.textMuted,
  },
  proposalCard: {
    backgroundColor: Colors.dark.warning + "20",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.warning,
  },
  proposalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  proposalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.warning,
  },
  proposalHint: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  termsSection: {
    marginBottom: Spacing.xl,
  },
  termsSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  editLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  editLinkText: {
    fontSize: 14,
    color: Colors.dark.accent,
  },
  termsCard: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  termRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  termLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  termValue: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  termDivider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: Spacing.sm,
  },
  editSection: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  rowInputs: {
    flexDirection: "row",
    marginTop: Spacing.md,
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.xs,
  },
  textInput: {
    backgroundColor: Colors.dark.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.dark.text,
  },
  pairsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  pairChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  pairChipSelected: {
    backgroundColor: Colors.dark.accent + "20",
    borderColor: Colors.dark.accent,
  },
  pairChipText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  pairChipTextSelected: {
    color: Colors.dark.accent,
    fontWeight: "600",
  },
  editActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  editButton: {
    flex: 1,
  },
  actionButton: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actionButtonText: {
    color: Colors.dark.buttonText,
    fontSize: 16,
    fontWeight: "600",
  },
  waitingCard: {
    backgroundColor: Colors.dark.warning + "20",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  waitingText: {
    fontSize: 16,
    color: Colors.dark.warning,
    fontWeight: "500",
  },
  cancelButton: {
    marginTop: Spacing.lg,
  },
  cancelButtonText: {
    color: Colors.dark.danger,
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 16,
    color: Colors.dark.danger,
  },
});

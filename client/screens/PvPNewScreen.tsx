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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

function useSafeHeaderHeight() {
  try {
    return useHeaderHeight();
  } catch {
    return 0;
  }
}

export default function PvPNewScreen() {
  const insets = useSafeAreaInsets();
  const rawHeaderHeight = useSafeHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const isDesktop = Platform.OS === "web" && Dimensions.get("window").width >= DESKTOP_BREAKPOINT;
  const headerHeight = isDesktop ? 0 : rawHeaderHeight;
  const { isAuthenticated } = useAuthContext();
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === "web";
  const maxWidth = 600;
  const containerWidth = isWeb ? Math.min(width - Spacing.lg * 2, maxWidth) : width - Spacing.lg * 2;

  const [challengeName, setChallengeName] = useState("");
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [stakeDollars, setStakeDollars] = useState("10");
  const [startingBalanceDollars, setStartingBalanceDollars] = useState("100000");
  const [selectedPairs, setSelectedPairs] = useState<string[]>(AVAILABLE_PAIRS);
  const [durationHours, setDurationHours] = useState("24");
  const [error, setError] = useState("");

  const createChallengeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/pvp/challenges", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pvp/challenges"] });
      navigation.navigate("PvP" as any);
    },
    onError: (err: any) => {
      setError(err.message || "Failed to create challenge");
    },
  });

  const handleTogglePair = (pair: string) => {
    if (selectedPairs.includes(pair)) {
      if (selectedPairs.length > 1) {
        setSelectedPairs(selectedPairs.filter((p) => p !== pair));
      }
    } else {
      setSelectedPairs([...selectedPairs, pair]);
    }
  };

  const handleCreate = () => {
    setError("");

    if (!inviteeEmail.trim()) {
      setError("Please enter opponent's email");
      return;
    }

    if (!inviteeEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    const stake = parseFloat(stakeDollars);
    if (isNaN(stake) || stake < 1) {
      setError("Stake must be at least $1");
      return;
    }

    const balance = parseFloat(startingBalanceDollars);
    if (isNaN(balance) || balance < 1000) {
      setError("Starting balance must be at least $1,000");
      return;
    }

    const hours = parseInt(durationHours);
    if (isNaN(hours) || hours < 1) {
      setError("Duration must be at least 1 hour");
      return;
    }

    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + hours * 60 * 60 * 1000);

    createChallengeMutation.mutate({
      name: challengeName.trim() || null,
      inviteeEmail: inviteeEmail.trim(),
      stakeCents: Math.round(stake * 100),
      startingBalanceCents: Math.round(balance * 100),
      allowedPairsJson: selectedPairs,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    });
  };

  if (!isAuthenticated) {
    navigation.navigate("Login");
    return null;
  }

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
          <View>
            <ThemedText style={styles.pageTitle}>Create PvP Challenge</ThemedText>
            <ThemedText style={styles.pageSubtitle}>
              Challenge another trader to a one-on-one competition
            </ThemedText>
          </View>
        </View>

        <View style={styles.formSection}>
          <ThemedText style={styles.sectionTitle}>Challenge Details</ThemedText>
          <View style={styles.inputContainer}>
            <ThemedText style={styles.inputLabel}>Challenge Name (Optional)</ThemedText>
            <TextInput
              style={styles.textInput}
              value={challengeName}
              onChangeText={setChallengeName}
              placeholder="e.g., Ultimate Forex Showdown"
              placeholderTextColor={Colors.dark.textMuted}
              autoCapitalize="words"
            />
          </View>
        </View>

        <View style={styles.formSection}>
          <ThemedText style={styles.sectionTitle}>Opponent</ThemedText>
          <View style={styles.inputContainer}>
            <ThemedText style={styles.inputLabel}>Email Address</ThemedText>
            <TextInput
              style={styles.textInput}
              value={inviteeEmail}
              onChangeText={setInviteeEmail}
              placeholder="opponent@email.com"
              placeholderTextColor={Colors.dark.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.formSection}>
          <ThemedText style={styles.sectionTitle}>Stakes & Balance</ThemedText>
          <View style={styles.rowInputs}>
            <View style={[styles.inputContainer, { flex: 1 }]}>
              <ThemedText style={styles.inputLabel}>Stake ($)</ThemedText>
              <TextInput
                style={styles.textInput}
                value={stakeDollars}
                onChangeText={setStakeDollars}
                placeholder="10"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardType="decimal-pad"
              />
              <ThemedText style={styles.inputHint}>
                Each player pays this to enter
              </ThemedText>
            </View>
            <View style={{ width: Spacing.md }} />
            <View style={[styles.inputContainer, { flex: 1 }]}>
              <ThemedText style={styles.inputLabel}>Starting Balance ($)</ThemedText>
              <TextInput
                style={styles.textInput}
                value={startingBalanceDollars}
                onChangeText={setStartingBalanceDollars}
                placeholder="100000"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardType="decimal-pad"
              />
              <ThemedText style={styles.inputHint}>
                Paper trading capital
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <ThemedText style={styles.sectionTitle}>Duration</ThemedText>
          <View style={styles.inputContainer}>
            <ThemedText style={styles.inputLabel}>Hours</ThemedText>
            <TextInput
              style={styles.textInput}
              value={durationHours}
              onChangeText={setDurationHours}
              placeholder="24"
              placeholderTextColor={Colors.dark.textMuted}
              keyboardType="number-pad"
            />
            <ThemedText style={styles.inputHint}>
              Competition starts immediately when both pay
            </ThemedText>
          </View>
        </View>

        <View style={styles.formSection}>
          <ThemedText style={styles.sectionTitle}>Trading Pairs</ThemedText>
          <ThemedText style={styles.sectionHint}>
            Select which pairs can be traded
          </ThemedText>
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
        </View>

        <View style={styles.summarySection}>
          <ThemedText style={styles.sectionTitle}>Challenge Summary</ThemedText>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Your Stake</ThemedText>
              <ThemedText style={styles.summaryValue}>
                ${parseFloat(stakeDollars) || 0}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Total Prize Pool</ThemedText>
              <ThemedText style={styles.summaryValueGold}>
                ${(parseFloat(stakeDollars) || 0) * 2}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Winner Takes (after 3% rake)</ThemedText>
              <ThemedText style={styles.summaryValueSuccess}>
                ${((parseFloat(stakeDollars) || 0) * 2 * 0.97).toFixed(2)}
              </ThemedText>
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={16} color={Colors.dark.danger} />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        ) : null}

        <Button
          onPress={handleCreate}
          disabled={createChallengeMutation.isPending}
          style={styles.submitButton}
        >
          {createChallengeMutation.isPending ? (
            <LoadingSpinner size="small" />
          ) : (
            <ThemedText style={styles.submitButtonText}>
              Send Challenge
            </ThemedText>
          )}
        </Button>

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
  contentContainer: {
    paddingBottom: Spacing.xl,
  },
  contentWrapper: {
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: Spacing.lg,
  },
  header: {
    paddingVertical: Spacing.xl,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  formSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
  },
  sectionHint: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.md,
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
    backgroundColor: Colors.dark.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.dark.text,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: Spacing.xs,
  },
  rowInputs: {
    flexDirection: "row",
  },
  pairsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  pairChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.backgroundSecondary,
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
  summarySection: {
    marginBottom: Spacing.xl,
  },
  summaryCard: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  summaryValueGold: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.gold,
  },
  summaryValueSuccess: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.success,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.dark.danger + "20",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: Colors.dark.danger,
    fontSize: 14,
  },
  submitButton: {
    height: 52,
    marginTop: Spacing.md,
  },
  submitButtonText: {
    color: Colors.dark.buttonText,
    fontSize: 16,
    fontWeight: "600",
  },
});

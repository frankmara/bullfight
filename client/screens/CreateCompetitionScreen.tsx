import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Alert, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

const AVAILABLE_PAIRS = ["EUR-USD", "GBP-USD", "USD-JPY", "AUD-USD", "USD-CAD"];

export default function CreateCompetitionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [buyIn, setBuyIn] = useState("100");
  const [entryCap, setEntryCap] = useState("1000");
  const [rake, setRake] = useState("30");
  const [startingBalance, setStartingBalance] = useState("100000");
  const [spreadMarkup, setSpreadMarkup] = useState("0.5");
  const [maxSlippage, setMaxSlippage] = useState("1.0");
  const [orderInterval, setOrderInterval] = useState("1000");
  const [selectedPairs, setSelectedPairs] = useState<string[]>(AVAILABLE_PAIRS);
  const [prizeSplits, setPrizeSplits] = useState("60,30,10");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/competitions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to create competition");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleCreate = () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }

    const splits = prizeSplits.split(",").map((s) => parseFloat(s.trim()));
    const splitsSum = splits.reduce((a, b) => a + b, 0);
    if (Math.abs(splitsSum - 100) > 0.01) {
      Alert.alert("Error", "Prize splits must sum to 100%");
      return;
    }

    const data = {
      title: title.trim(),
      theme: theme.trim() || null,
      description: description.trim() || null,
      buyInCents: Math.round(parseFloat(buyIn) * 100),
      entryCap: parseInt(entryCap, 10),
      rakeBps: Math.round(parseFloat(rake) * 100),
      startingBalanceCents: Math.round(parseFloat(startingBalance) * 100),
      spreadMarkupPips: parseFloat(spreadMarkup),
      maxSlippagePips: parseFloat(maxSlippage),
      minOrderIntervalMs: parseInt(orderInterval, 10),
      allowedPairsJson: selectedPairs,
      prizeSplitsJson: splits,
    };

    createMutation.mutate(data);
  };

  const togglePair = (pair: string) => {
    setSelectedPairs((prev) =>
      prev.includes(pair) ? prev.filter((p) => p !== pair) : [...prev, pair]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <ThemedText style={styles.sectionTitle}>Basic Info</ThemedText>
      <Input
        label="Title"
        placeholder="e.g., Weekly FX Challenge"
        value={title}
        onChangeText={setTitle}
      />
      <Input
        label="Theme (optional)"
        placeholder="e.g., Major Pairs Only"
        value={theme}
        onChangeText={setTheme}
      />
      <Input
        label="Description (optional)"
        placeholder="Competition details..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />

      <ThemedText style={styles.sectionTitle}>Financial Settings</ThemedText>
      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Input
            label="Buy-in ($)"
            placeholder="100"
            value={buyIn}
            onChangeText={setBuyIn}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.halfInput}>
          <Input
            label="Entry Cap"
            placeholder="1000"
            value={entryCap}
            onChangeText={setEntryCap}
            keyboardType="number-pad"
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Input
            label="Rake (%)"
            placeholder="30"
            value={rake}
            onChangeText={setRake}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.halfInput}>
          <Input
            label="Starting Balance ($)"
            placeholder="100000"
            value={startingBalance}
            onChangeText={setStartingBalance}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <ThemedText style={styles.sectionTitle}>Trading Rules</ThemedText>
      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Input
            label="Spread Markup (pips)"
            placeholder="0.5"
            value={spreadMarkup}
            onChangeText={setSpreadMarkup}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.halfInput}>
          <Input
            label="Max Slippage (pips)"
            placeholder="1.0"
            value={maxSlippage}
            onChangeText={setMaxSlippage}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
      <Input
        label="Min Order Interval (ms)"
        placeholder="1000"
        value={orderInterval}
        onChangeText={setOrderInterval}
        keyboardType="number-pad"
      />

      <ThemedText style={styles.sectionTitle}>Allowed Pairs</ThemedText>
      <View style={styles.pairsContainer}>
        {AVAILABLE_PAIRS.map((pair) => (
          <Pressable
            key={pair}
            style={[
              styles.pairChip,
              selectedPairs.includes(pair) ? styles.pairChipActive : null,
            ]}
            onPress={() => togglePair(pair)}
          >
            {selectedPairs.includes(pair) && (
              <Feather
                name="check"
                size={14}
                color={Colors.dark.text}
                style={styles.pairCheckIcon}
              />
            )}
            <ThemedText
              style={[
                styles.pairChipText,
                selectedPairs.includes(pair) ? styles.pairChipTextActive : null,
              ]}
            >
              {pair}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText style={styles.sectionTitle}>Prize Distribution</ThemedText>
      <Input
        label="Prize Splits (comma-separated %)"
        placeholder="60,30,10"
        value={prizeSplits}
        onChangeText={setPrizeSplits}
      />
      <ThemedText style={styles.helperText}>
        Example: "60,30,10" means 60% to 1st, 30% to 2nd, 10% to 3rd
      </ThemedText>

      <Button
        onPress={handleCreate}
        disabled={createMutation.isPending}
        style={styles.createButton}
      >
        {createMutation.isPending ? "Creating..." : "Create Competition"}
      </Button>

      {createMutation.isPending && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  row: {
    flexDirection: "row",
    marginHorizontal: -Spacing.xs,
  },
  halfInput: {
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  pairsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: Spacing.md,
  },
  pairChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  pairChipActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  pairCheckIcon: {
    marginRight: Spacing.xs,
  },
  pairChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  pairChipTextActive: {
    color: Colors.dark.text,
  },
  helperText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.lg,
  },
  createButton: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 10, 0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
});

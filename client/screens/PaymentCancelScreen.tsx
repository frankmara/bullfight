import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";

type PaymentCancelRouteProp = RouteProp<RootStackParamList, "PaymentCancel">;

export default function PaymentCancelScreen() {
  const route = useRoute<PaymentCancelRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const type = route.params?.type || "";
  const id = route.params?.id || "";

  const handleRetry = () => {
    if (type === "competition") {
      navigation.replace("CompetitionDetail", { id });
    } else if (type === "pvp") {
      navigation.replace("PvPDetail", { id });
    } else {
      navigation.replace("Main");
    }
  };

  const handleGoHome = () => {
    navigation.replace("Main");
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.iconContainer}>
        <Feather name="x-circle" size={64} color={Colors.dark.warning} />
      </View>
      <ThemedText style={styles.title}>Payment Cancelled</ThemedText>
      <ThemedText style={styles.message}>
        Your payment was cancelled. You can try again or return to the dashboard.
      </ThemedText>
      <View style={styles.buttonRow}>
        <Pressable style={styles.button} onPress={handleRetry}>
          <ThemedText style={styles.buttonText}>Try Again</ThemedText>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={handleGoHome}>
          <ThemedText style={styles.secondaryButtonText}>Go to Dashboard</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.xl,
    maxWidth: 400,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  button: {
    minWidth: 150,
    backgroundColor: Colors.dark.accent,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  buttonText: {
    color: Colors.dark.buttonText,
    fontWeight: "600",
    fontSize: 16,
  },
  secondaryButton: {
    minWidth: 150,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: Colors.dark.text,
    fontWeight: "600",
    fontSize: 16,
  },
});

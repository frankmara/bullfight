import React, { useEffect, useState } from "react";
import { View, StyleSheet, Platform, Pressable } from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";
import { Feather } from "@expo/vector-icons";

type PaymentSuccessRouteProp = RouteProp<RootStackParamList, "PaymentSuccess">;

export default function PaymentSuccessScreen() {
  const route = useRoute<PaymentSuccessRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const type = route.params?.type || "";
  const id = route.params?.id || "";
  const sessionId = route.params?.session_id || "";

  const confirmPaymentMutation = useMutation({
    mutationFn: async () => {
      const endpoint = type === "competition" 
        ? `/api/competitions/${id}/confirm-payment`
        : `/api/pvp/challenges/${id}/confirm-payment`;
      
      const res = await apiRequest("POST", endpoint, { sessionId });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Payment confirmation failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setStatus("success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pvp/challenges"] });
    },
    onError: (error: any) => {
      setStatus("error");
      setErrorMessage(error.message || "Payment confirmation failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  useEffect(() => {
    if (sessionId && id) {
      confirmPaymentMutation.mutate();
    } else {
      setStatus("error");
      setErrorMessage("Missing payment information");
    }
  }, [sessionId, id]);

  const handleContinue = () => {
    if (type === "competition") {
      navigation.replace("Arena", { id });
    } else if (type === "pvp") {
      navigation.replace("PvPDetail", { id });
    } else {
      navigation.replace("Main");
    }
  };

  const handleGoHome = () => {
    navigation.replace("Main");
  };

  if (status === "loading") {
    return (
      <ThemedView style={styles.container}>
        <LoadingSpinner />
        <ThemedText style={styles.loadingText}>
          Confirming your payment...
        </ThemedText>
      </ThemedView>
    );
  }

  if (status === "error") {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.iconContainer}>
          <Feather name="x-circle" size={64} color={Colors.dark.sell} />
        </View>
        <ThemedText style={styles.title}>Payment Issue</ThemedText>
        <ThemedText style={styles.message}>{errorMessage}</ThemedText>
        <Pressable style={styles.button} onPress={handleGoHome}>
          <ThemedText style={styles.buttonText}>Go to Dashboard</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.iconContainer}>
        <Feather name="check-circle" size={64} color={Colors.dark.success} />
      </View>
      <ThemedText style={styles.title}>Payment Successful!</ThemedText>
      <ThemedText style={styles.message}>
        {type === "competition" 
          ? "You have successfully joined the competition. Good luck trading!"
          : "Your stake has been submitted. Once both parties have paid, the challenge will begin."}
      </ThemedText>
      <Pressable style={styles.button} onPress={handleContinue}>
        <ThemedText style={styles.buttonText}>
          {type === "competition" ? "Enter Arena" : "View Challenge"}
        </ThemedText>
      </Pressable>
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
  loadingText: {
    marginTop: Spacing.lg,
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  button: {
    minWidth: 200,
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
});

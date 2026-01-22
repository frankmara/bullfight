import React, { useState } from "react";
import { View, StyleSheet, Image, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";
import { apiRequest } from "@/lib/query-client";

const bullLogo = require("../../attached_assets/generated_images/bullfight_app_icon_bull.png");

const isWeb = Platform.OS === "web";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.message || "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigation.navigate("Login");
  };

  return (
    <View style={styles.rootContainer}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { 
            paddingTop: isWeb ? Spacing["5xl"] : insets.top + 40, 
            paddingBottom: insets.bottom + Spacing.xl 
          },
        ]}
      >
        <View style={[styles.card, isWeb ? styles.cardWeb : null]}>
          <View style={styles.logoSection}>
            <Image source={bullLogo} style={styles.logo} resizeMode="contain" />
            <ThemedText style={styles.brandTitle}>BULLFIGHT</ThemedText>
            <ThemedText style={styles.subtitle}>
              Reset your password
            </ThemedText>
          </View>

          <View style={styles.form}>
            {success ? (
              <View style={styles.successContainer}>
                <ThemedText style={styles.successText}>
                  If an account exists with that email, we've sent password reset instructions.
                </ThemedText>
                <Button onPress={handleBackToLogin} style={styles.button}>
                  Back to Sign In
                </Button>
              </View>
            ) : (
              <>
                {error ? (
                  <View style={styles.errorContainer}>
                    <ThemedText style={styles.errorText}>{error}</ThemedText>
                  </View>
                ) : null}

                <ThemedText style={styles.instructions}>
                  Enter your email address and we'll send you a link to reset your password.
                </ThemedText>

                <View style={styles.inputGroup}>
                  <ThemedText style={styles.inputLabel}>Email</ThemedText>
                  <Input
                    placeholder="Enter your email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>

                <Button onPress={handleSubmit} disabled={isLoading} style={styles.button}>
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>

                <Button 
                  onPress={handleBackToLogin} 
                  variant="secondary" 
                  style={styles.secondaryButton}
                >
                  Back to Sign In
                </Button>
              </>
            )}
          </View>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardWeb: {
    boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.4)",
  } as any,
  logoSection: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: Spacing.md,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 4,
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  form: {
    width: "100%",
  },
  instructions: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.xl,
    textAlign: "center",
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: Colors.dark.backgroundRoot,
    borderColor: Colors.dark.border,
    height: 52,
  },
  errorContainer: {
    backgroundColor: `${Colors.dark.danger}15`,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: `${Colors.dark.danger}40`,
  },
  errorText: {
    color: Colors.dark.danger,
    fontSize: 14,
    textAlign: "center",
  },
  successContainer: {
    alignItems: "center",
  },
  successText: {
    fontSize: 15,
    color: Colors.dark.success,
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  button: {
    marginTop: Spacing.md,
    height: 52,
  },
  secondaryButton: {
    marginTop: Spacing.md,
    height: 52,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
});

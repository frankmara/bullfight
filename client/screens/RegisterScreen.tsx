import React, { useState } from "react";
import { View, StyleSheet, Pressable, Image, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuthContext } from "@/context/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";

const bullLogo = require("../../attached_assets/generated_images/bullfight_app_icon_bull.png");

const isWeb = Platform.OS === "web";

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { register } = useAuthContext();

  const [email, setEmail] = useState("");
  const [username, setUsernameValue] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !username || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (username.length < 3 || username.length > 20) {
      setError("Username must be 3-20 characters");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await register(email, password, username);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
      navigation.goBack();
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    navigation.goBack();
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
              Join the trading arena today
            </ThemedText>
          </View>

          <View style={styles.form}>
            {error ? (
              <View style={styles.errorContainer}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            ) : null}

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

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Username</ThemedText>
              <Input
                placeholder="Choose a username (3-20 characters)"
                value={username}
                onChangeText={setUsernameValue}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Password</ThemedText>
              <Input
                placeholder="Create a password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Confirm Password</ThemedText>
              <Input
                placeholder="Confirm your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                style={styles.input}
              />
            </View>

            <Button onPress={handleRegister} disabled={isLoading} style={styles.button}>
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <ThemedText style={styles.dividerText}>or</ThemedText>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.switchSection}>
              <ThemedText style={styles.switchText}>
                Already have an account?
              </ThemedText>
              <Pressable onPress={handleLogin} style={styles.switchButton}>
                <ThemedText style={styles.switchLink}>Sign In</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollViewCompat>

      {isLoading ? (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner />
        </View>
      ) : null}
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
    justifyContent: isWeb ? "center" : "flex-start",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing["2xl"],
    ...(isWeb ? {
      boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
    } : {}),
  },
  cardWeb: {
    padding: Spacing["4xl"],
  },
  logoSection: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: Spacing.lg,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.dark.text,
    letterSpacing: 4,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  form: {
    width: "100%",
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
  button: {
    marginTop: Spacing.md,
    height: 52,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing["2xl"],
    marginBottom: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  dividerText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginHorizontal: Spacing.md,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  switchSection: {
    alignItems: "center",
  },
  switchText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.sm,
  },
  switchButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  switchLink: {
    fontSize: 15,
    color: Colors.dark.accent,
    fontWeight: "600",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 10, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
});

import React, { useState } from "react";
import { View, StyleSheet, Modal, Pressable } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useAuthContext } from "@/context/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface UsernameSetupModalProps {
  visible: boolean;
  onComplete?: () => void;
}

export function UsernameSetupModal({ visible, onComplete }: UsernameSetupModalProps) {
  const { setUsername } = useAuthContext();
  const [usernameValue, setUsernameValue] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!usernameValue) {
      setError("Please enter a username");
      return;
    }

    if (usernameValue.length < 3 || usernameValue.length > 20) {
      setError("Username must be 3-20 characters");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(usernameValue)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await setUsername(usernameValue);
      onComplete?.();
    } catch (err: any) {
      setError(err.message || "Failed to set username");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ThemedText style={styles.title}>Choose Your Username</ThemedText>
          <ThemedText style={styles.subtitle}>
            Your username will be displayed on the leaderboard and competitions.
          </ThemedText>

          {error ? (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Username</ThemedText>
            <Input
              placeholder="Choose a username (3-20 characters)"
              value={usernameValue}
              onChangeText={setUsernameValue}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <ThemedText style={styles.hint}>
              Letters, numbers, and underscores only
            </ThemedText>
          </View>

          <Button
            onPress={handleSubmit}
            disabled={isLoading}
            style={styles.button}
          >
            {isLoading ? "Saving..." : "Set Username"}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.xl,
    textAlign: "center",
    lineHeight: 20,
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
  inputGroup: {
    marginBottom: Spacing.xl,
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
  hint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: Spacing.xs,
  },
  button: {
    height: 52,
  },
});

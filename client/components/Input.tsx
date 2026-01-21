import React, { forwardRef } from "react";
import { TextInput, View, StyleSheet, TextInputProps } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, style, ...props }, ref) => {
    return (
      <View style={styles.container}>
        {label ? (
          <ThemedText style={styles.label}>{label}</ThemedText>
        ) : null}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            error ? styles.inputError : null,
            style,
          ]}
          placeholderTextColor={Colors.dark.textMuted}
          {...props}
        />
        {error ? (
          <ThemedText style={styles.error}>{error}</ThemedText>
        ) : null}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.sm,
  },
  input: {
    height: Spacing.inputHeight,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  inputError: {
    borderColor: Colors.dark.danger,
  },
  error: {
    fontSize: 12,
    color: Colors.dark.danger,
    marginTop: Spacing.xs,
  },
});

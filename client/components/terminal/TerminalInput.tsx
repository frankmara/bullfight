import React from "react";
import { View, Text, TextInput, StyleSheet, ViewStyle, StyleProp, TextInputProps } from "react-native";
import { TerminalColors, TerminalSpacing, TerminalRadius, TerminalTypography } from "./theme";

interface TerminalInputProps extends TextInputProps {
  label?: string;
  suffix?: string;
  size?: "sm" | "md";
  containerStyle?: StyleProp<ViewStyle>;
  error?: boolean;
}

export function TerminalInput({
  label,
  suffix,
  size = "md",
  containerStyle,
  error = false,
  style,
  ...props
}: TerminalInputProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrapper, size === "sm" && styles.inputWrapperSm, error && styles.inputError]}>
        <TextInput
          style={[styles.input, size === "sm" && styles.inputSm, style]}
          placeholderTextColor={TerminalColors.textMuted}
          selectionColor={TerminalColors.accent}
          {...props}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: TerminalSpacing.xs,
  },
  label: {
    ...TerminalTypography.label,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TerminalColors.bgInput,
    borderWidth: 1,
    borderColor: TerminalColors.border,
    borderRadius: TerminalRadius.sm,
    height: 36,
    paddingHorizontal: TerminalSpacing.md,
  },
  inputWrapperSm: {
    height: 28,
    paddingHorizontal: TerminalSpacing.sm,
  },
  inputError: {
    borderColor: TerminalColors.negative,
  },
  input: {
    flex: 1,
    ...TerminalTypography.price,
    color: TerminalColors.textPrimary,
    padding: 0,
  },
  inputSm: {
    fontSize: 11,
  },
  suffix: {
    ...TerminalTypography.bodySmall,
    color: TerminalColors.textMuted,
    marginLeft: TerminalSpacing.xs,
  },
});

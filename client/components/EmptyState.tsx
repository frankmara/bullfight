import React from "react";
import { View, StyleSheet, Image, ImageSourcePropType } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Colors, Spacing } from "@/constants/theme";

interface EmptyStateProps {
  image?: ImageSourcePropType;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  image,
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {image ? (
        <Image source={image} style={styles.image} resizeMode="contain" />
      ) : null}
      <ThemedText style={styles.title}>{title}</ThemedText>
      <ThemedText style={styles.message}>{message}</ThemedText>
      {actionLabel && onAction ? (
        <Button onPress={onAction} style={styles.button}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing["3xl"],
  },
  image: {
    width: 200,
    height: 200,
    marginBottom: Spacing["2xl"],
    opacity: 0.8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.dark.text,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  button: {
    minWidth: 160,
  },
});

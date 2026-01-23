import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Colors, Spacing } from "@/constants/theme";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

interface WalletData {
  balanceTokens: number;
  lockedTokens: number;
  availableTokens: number;
  updatedAt: string;
}

interface WalletBadgeProps {
  compact?: boolean;
  onPress?: () => void;
}

export function WalletBadge({ compact = false, onPress }: WalletBadgeProps) {
  const { user } = useAuth();

  const { data: wallet, isLoading } = useQuery<WalletData>({
    queryKey: ["/api/wallet"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  if (!user) return null;

  if (isLoading) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <ActivityIndicator size="small" color={Colors.dark.accent} />
      </View>
    );
  }

  const balance = wallet?.availableTokens ?? 0;

  const formatBalance = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  const content = (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.iconContainer}>
        <Feather name="circle" size={compact ? 14 : 16} color={Colors.dark.accent} />
      </View>
      <Text style={[styles.balanceText, compact && styles.balanceTextCompact]}>
        {formatBalance(balance)}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  containerCompact: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  iconContainer: {
    marginRight: Spacing.xs,
  },
  balanceText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  balanceTextCompact: {
    fontSize: 12,
  },
  pressed: {
    opacity: 0.7,
  },
});

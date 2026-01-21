import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface CompetitionCardProps {
  id: string;
  title: string;
  theme?: string;
  status: string;
  buyInCents: number;
  entryCap: number;
  entryCount: number;
  prizePoolCents: number;
  startAt?: string;
  endAt?: string;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CompetitionCard({
  title,
  theme,
  status,
  buyInCents,
  entryCap,
  entryCount,
  prizePoolCents,
  startAt,
  endAt,
  onPress,
}: CompetitionCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString()}`;
  };

  const formatCountdown = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff < 0) return "Started";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const countdown =
    status === "open" ? formatCountdown(startAt) : formatCountdown(endAt);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.card, animatedStyle]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
          <StatusBadge status={status} />
        </View>
        {theme ? (
          <ThemedText style={styles.theme}>{theme}</ThemedText>
        ) : null}
      </View>

      <View style={styles.prizeSection}>
        <ThemedText style={styles.prizeLabel}>Prize Pool</ThemedText>
        <ThemedText style={styles.prizeAmount}>
          {formatCurrency(prizePoolCents)}
        </ThemedText>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Feather name="dollar-sign" size={14} color={Colors.dark.textSecondary} />
          <ThemedText style={styles.statValue}>
            {formatCurrency(buyInCents)}
          </ThemedText>
          <ThemedText style={styles.statLabel}>Buy-in</ThemedText>
        </View>
        <View style={styles.stat}>
          <Feather name="users" size={14} color={Colors.dark.textSecondary} />
          <ThemedText style={styles.statValue}>
            {entryCount}/{entryCap}
          </ThemedText>
          <ThemedText style={styles.statLabel}>Entries</ThemedText>
        </View>
        {countdown ? (
          <View style={styles.stat}>
            <Feather name="clock" size={14} color={Colors.dark.textSecondary} />
            <ThemedText style={styles.statValue}>{countdown}</ThemedText>
            <ThemedText style={styles.statLabel}>
              {status === "open" ? "Starts" : "Ends"}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <ThemedText style={styles.viewDetails}>View Details</ThemedText>
        <Feather name="chevron-right" size={18} color={Colors.dark.accent} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  theme: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  prizeSection: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  prizeLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  prizeAmount: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.dark.gold,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  stat: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
    marginTop: Spacing.xs,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  viewDetails: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.accent,
    marginRight: Spacing.xs,
  },
});

import React, { useEffect } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { Colors, BorderRadius } from "@/constants/theme";

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({
  width = "100%",
  height = 20,
  borderRadius = BorderRadius.sm,
  style,
}: SkeletonLoaderProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function CompetitionCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <SkeletonLoader width="60%" height={24} />
        <SkeletonLoader width={60} height={24} />
      </View>
      <View style={styles.cardPrize}>
        <SkeletonLoader width="40%" height={40} />
      </View>
      <View style={styles.cardStats}>
        <SkeletonLoader width={60} height={40} />
        <SkeletonLoader width={60} height={40} />
        <SkeletonLoader width={60} height={40} />
      </View>
      <SkeletonLoader width="100%" height={40} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  card: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cardPrize: {
    alignItems: "center",
    marginBottom: 16,
  },
  cardStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
});

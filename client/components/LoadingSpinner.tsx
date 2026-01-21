import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Colors, Spacing } from "@/constants/theme";

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
}

export function LoadingSpinner({
  size = 40,
  color = Colors.dark.accent,
}: LoadingSpinnerProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.spinner,
          { width: size, height: size, borderColor: color },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  spinner: {
    borderWidth: 3,
    borderRadius: 999,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
  },
});

import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useAuthContext } from "@/context/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAdmin } = useAuthContext();

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ThemedText style={styles.errorText}>Access Denied</ThemedText>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 60, paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      <ThemedText style={styles.title}>Admin Panel</ThemedText>
      <ThemedText style={styles.subtitle}>Manage your trading platform</ThemedText>

      <View style={styles.menuSection}>
        <Pressable
          style={styles.menuItem}
          onPress={() => navigation.navigate("AdminCompetitions")}
        >
          <View style={styles.menuItemIcon}>
            <Feather name="award" size={24} color={Colors.dark.accent} />
          </View>
          <View style={styles.menuItemContent}>
            <ThemedText style={styles.menuItemTitle}>Competitions</ThemedText>
            <ThemedText style={styles.menuItemDescription}>
              Create and manage trading competitions
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
        </Pressable>

        <Pressable style={styles.menuItem}>
          <View style={styles.menuItemIcon}>
            <Feather name="users" size={24} color={Colors.dark.success} />
          </View>
          <View style={styles.menuItemContent}>
            <ThemedText style={styles.menuItemTitle}>Users</ThemedText>
            <ThemedText style={styles.menuItemDescription}>
              View and manage user accounts
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
        </Pressable>

        <Pressable style={styles.menuItem}>
          <View style={styles.menuItemIcon}>
            <Feather name="credit-card" size={24} color={Colors.dark.gold} />
          </View>
          <View style={styles.menuItemContent}>
            <ThemedText style={styles.menuItemTitle}>Payouts</ThemedText>
            <ThemedText style={styles.menuItemDescription}>
              Manage competition payouts
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
        </Pressable>

        <Pressable style={styles.menuItem}>
          <View style={styles.menuItemIcon}>
            <Feather name="activity" size={24} color={Colors.dark.purple} />
          </View>
          <View style={styles.menuItemContent}>
            <ThemedText style={styles.menuItemTitle}>Analytics</ThemedText>
            <ThemedText style={styles.menuItemDescription}>
              View platform statistics
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
    paddingHorizontal: Spacing.lg,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 18,
    color: Colors.dark.danger,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing["2xl"],
  },
  menuSection: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  menuItemIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.xs,
  },
  menuItemDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
});

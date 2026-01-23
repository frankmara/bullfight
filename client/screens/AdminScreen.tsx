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

        <Pressable
          style={styles.menuItem}
          onPress={() => navigation.navigate("AdminEmail")}
        >
          <View style={styles.menuItemIcon}>
            <Feather name="mail" size={24} color={Colors.dark.info} />
          </View>
          <View style={styles.menuItemContent}>
            <ThemedText style={styles.menuItemTitle}>Email Templates</ThemedText>
            <ThemedText style={styles.menuItemDescription}>
              Configure email notifications
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
        </Pressable>

        <Pressable
          style={styles.menuItem}
          onPress={() => navigation.navigate("AdminArenaMode")}
        >
          <View style={styles.menuItemIcon}>
            <Feather name="play-circle" size={24} color={Colors.dark.danger} />
          </View>
          <View style={styles.menuItemContent}>
            <ThemedText style={styles.menuItemTitle}>Arena Mode</ThemedText>
            <ThemedText style={styles.menuItemDescription}>
              Manage arena matches and featured events
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
        </Pressable>

        <Pressable
          style={styles.menuItem}
          onPress={() => navigation.navigate("AdminChat")}
        >
          <View style={styles.menuItemIcon}>
            <Feather name="message-circle" size={24} color={Colors.dark.warning} />
          </View>
          <View style={styles.menuItemContent}>
            <ThemedText style={styles.menuItemTitle}>Chat Moderation</ThemedText>
            <ThemedText style={styles.menuItemDescription}>
              Manage mutes, bans and messages
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
        </Pressable>

        <Pressable
          style={styles.menuItem}
          onPress={() => navigation.navigate("AdminBetting")}
        >
          <View style={styles.menuItemIcon}>
            <Feather name="dollar-sign" size={24} color={Colors.dark.gold} />
          </View>
          <View style={styles.menuItemContent}>
            <ThemedText style={styles.menuItemTitle}>Betting Controls</ThemedText>
            <ThemedText style={styles.menuItemDescription}>
              Settings, markets, and risk monitoring
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
        </Pressable>

        <Pressable
          style={styles.menuItem}
          onPress={() => navigation.navigate("AdminSimulation")}
        >
          <View style={styles.menuItemIcon}>
            <Feather name="cpu" size={24} color={Colors.dark.warning} />
          </View>
          <View style={styles.menuItemContent}>
            <ThemedText style={styles.menuItemTitle}>Simulation Engine</ThemedText>
            <ThemedText style={styles.menuItemDescription}>
              Run bot traders, chat, and betting simulations
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

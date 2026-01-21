import React from "react";
import { View, StyleSheet, Pressable, Image, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useAuthContext } from "@/context/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";

const logoImage = require("../../assets/images/icon.png");

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isAuthenticated, isAdmin, logout } = useAuthContext();

  const handleLogin = () => {
    navigation.navigate("Login");
  };

  const handleLogout = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleAdminPress = () => {
    navigation.navigate("Admin");
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          <Image source={logoImage} style={styles.avatar} resizeMode="contain" />
        </View>
        {isAuthenticated ? (
          <>
            <ThemedText style={styles.email}>{user?.email}</ThemedText>
            {isAdmin && (
              <View style={styles.adminBadge}>
                <Feather name="shield" size={12} color={Colors.dark.gold} />
                <ThemedText style={styles.adminBadgeText}>Admin</ThemedText>
              </View>
            )}
          </>
        ) : (
          <ThemedText style={styles.guestText}>Guest User</ThemedText>
        )}
      </View>

      <View style={styles.menuSection}>
        {isAuthenticated ? (
          <>
            {isAdmin && (
              <Pressable style={styles.menuItem} onPress={handleAdminPress}>
                <View style={styles.menuItemLeft}>
                  <Feather name="settings" size={20} color={Colors.dark.textSecondary} />
                  <ThemedText style={styles.menuItemText}>Admin Panel</ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
              </Pressable>
            )}

            <Pressable style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Feather name="help-circle" size={20} color={Colors.dark.textSecondary} />
                <ThemedText style={styles.menuItemText}>Help & Support</ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
            </Pressable>

            <Pressable style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Feather name="file-text" size={20} color={Colors.dark.textSecondary} />
                <ThemedText style={styles.menuItemText}>Terms of Service</ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
            </Pressable>

            <Pressable style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Feather name="lock" size={20} color={Colors.dark.textSecondary} />
                <ThemedText style={styles.menuItemText}>Privacy Policy</ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
            </Pressable>

            <Pressable style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
              <View style={styles.menuItemLeft}>
                <Feather name="log-out" size={20} color={Colors.dark.danger} />
                <ThemedText style={[styles.menuItemText, { color: Colors.dark.danger }]}>
                  Sign Out
                </ThemedText>
              </View>
            </Pressable>
          </>
        ) : (
          <>
            <Button onPress={handleLogin} style={styles.loginButton}>
              Sign In
            </Button>
            <ThemedText style={styles.signInHint}>
              Sign in to join competitions and track your progress
            </ThemedText>
          </>
        )}
      </View>

      <View style={styles.footer}>
        <ThemedText style={styles.footerText}>Bullfight v1.0.0</ThemedText>
        <ThemedText style={styles.footerSubtext}>The Trading Arena</ThemedText>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  profileSection: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.dark.backgroundDefault,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.dark.accent,
  },
  avatar: {
    width: 60,
    height: 60,
  },
  email: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
  },
  guestText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${Colors.dark.gold}20`,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.gold,
    marginLeft: Spacing.xs,
  },
  menuSection: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing["2xl"],
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuItemText: {
    fontSize: 16,
    color: Colors.dark.text,
    marginLeft: Spacing.md,
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  loginButton: {
    margin: Spacing.lg,
  },
  signInHint: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  footer: {
    alignItems: "center",
    paddingTop: Spacing.xl,
  },
  footerText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  footerSubtext: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: Spacing.xs,
  },
});

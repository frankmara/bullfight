import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  useWindowDimensions,
  ScrollView,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useAuthContext } from "@/context/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";

interface UserStats {
  totalSpentCents: number;
  totalWonCents: number;
  activeCompetitions: number;
}

interface MyCompetition {
  id: string;
  competitionId: string;
  title: string;
  status: string;
  equityCents: number;
  startingBalanceCents: number;
  rank?: number;
  totalEntrants?: number;
  prizeWonCents?: number;
}

const DESKTOP_BREAKPOINT = 768;

function useSafeHeaderHeight() {
  try {
    return useHeaderHeight();
  } catch {
    return 0;
  }
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const rawHeaderHeight = useSafeHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isDesktop = Platform.OS === 'web' && Dimensions.get('window').width >= DESKTOP_BREAKPOINT;
  const headerHeight = isDesktop ? 0 : rawHeaderHeight;
  const { user, isAuthenticated, isAdmin, logout } = useAuthContext();
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === "web";
  const maxWidth = 1000;
  const containerWidth = isWeb ? Math.min(width - Spacing.lg * 2, maxWidth) : width - Spacing.lg * 2;

  const { data: stats } = useQuery<UserStats>({
    queryKey: ["/api/user/stats"],
    enabled: isAuthenticated,
  });

  const { data: myCompetitions } = useQuery<MyCompetition[]>({
    queryKey: ["/api/user/competitions"],
    enabled: isAuthenticated,
  });

  const handleLogin = () => {
    navigation.navigate("Login");
  };

  const handleLogout = async () => {
    const performLogout = async () => {
      await logout();
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to sign out?")) {
        await performLogout();
      }
    } else {
      Alert.alert("Sign Out", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: performLogout,
        },
      ]);
    }
  };

  const handleAdminPress = () => {
    navigation.navigate("Admin");
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString()}`;

  const calculatePnL = () => {
    const won = stats?.totalWonCents || 0;
    const spent = stats?.totalSpentCents || 0;
    return won - spent;
  };

  const totalCompetitionsEntered = myCompetitions?.length || 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: isDesktop ? Spacing.xl : 80,
          alignItems: isWeb ? "center" : "stretch",
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.contentWrapper, { maxWidth: containerWidth, width: "100%" }]}>
        <View style={[styles.profileSection, isWeb && styles.profileSectionWeb]}>
          <View style={styles.avatarContainer}>
            <Feather 
              name={isAuthenticated ? "user" : "user-x"} 
              size={40} 
              color={isAuthenticated ? Colors.dark.accent : Colors.dark.textMuted} 
            />
          </View>
          {isAuthenticated ? (
            <>
              <ThemedText style={styles.email}>{user?.email}</ThemedText>
              {isAdmin ? (
                <View style={styles.adminBadge}>
                  <Feather name="shield" size={12} color={Colors.dark.gold} />
                  <ThemedText style={styles.adminBadgeText}>Admin</ThemedText>
                </View>
              ) : null}
            </>
          ) : (
            <ThemedText style={styles.guestText}>Guest User</ThemedText>
          )}
        </View>

        {isAuthenticated ? (
          <>
            <View style={styles.sectionHeader}>
              <Feather name="bar-chart-2" size={20} color={Colors.dark.accent} />
              <ThemedText style={styles.sectionTitle}>Your Stats</ThemedText>
            </View>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, isWeb && styles.statCardWeb]}>
                <View style={styles.statIconContainer}>
                  <Feather name="list" size={24} color={Colors.dark.textSecondary} />
                </View>
                <ThemedText style={styles.statValue}>{totalCompetitionsEntered}</ThemedText>
                <ThemedText style={styles.statLabel}>Competitions Entered</ThemedText>
              </View>
              <View style={[styles.statCard, isWeb && styles.statCardWeb]}>
                <View style={styles.statIconContainer}>
                  <Feather 
                    name={calculatePnL() >= 0 ? "trending-up" : "trending-down"} 
                    size={24} 
                    color={calculatePnL() >= 0 ? Colors.dark.success : Colors.dark.danger} 
                  />
                </View>
                <ThemedText 
                  style={[
                    styles.statValue, 
                    { color: calculatePnL() >= 0 ? Colors.dark.success : Colors.dark.danger }
                  ]}
                >
                  {calculatePnL() >= 0 ? "+" : ""}{formatCurrency(calculatePnL())}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Total P&L</ThemedText>
              </View>
            </View>

            <View style={[styles.menuSection, isWeb && styles.menuSectionWeb]}>
              {isAdmin ? (
                <Pressable style={styles.menuItem} onPress={handleAdminPress}>
                  <View style={styles.menuItemLeft}>
                    <View style={styles.menuIconContainer}>
                      <Feather name="settings" size={20} color={Colors.dark.textSecondary} />
                    </View>
                    <ThemedText style={styles.menuItemText}>Admin Panel</ThemedText>
                  </View>
                  <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
                </Pressable>
              ) : null}

              <Pressable style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIconContainer}>
                    <Feather name="help-circle" size={20} color={Colors.dark.textSecondary} />
                  </View>
                  <ThemedText style={styles.menuItemText}>Help & Support</ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
              </Pressable>

              <Pressable style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIconContainer}>
                    <Feather name="file-text" size={20} color={Colors.dark.textSecondary} />
                  </View>
                  <ThemedText style={styles.menuItemText}>Terms of Service</ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
              </Pressable>

              <Pressable style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIconContainer}>
                    <Feather name="lock" size={20} color={Colors.dark.textSecondary} />
                  </View>
                  <ThemedText style={styles.menuItemText}>Privacy Policy</ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={Colors.dark.textMuted} />
              </Pressable>
            </View>

            <Pressable 
              style={[styles.logoutButton, isWeb && styles.logoutButtonWeb]} 
              onPress={handleLogout}
            >
              <Feather name="log-out" size={20} color={Colors.dark.danger} />
              <ThemedText style={styles.logoutText}>Sign Out</ThemedText>
            </Pressable>
          </>
        ) : (
          <View style={[styles.guestSection, isWeb && styles.guestSectionWeb]}>
            <View style={styles.guestIconContainer}>
              <Feather name="log-in" size={32} color={Colors.dark.textMuted} />
            </View>
            <ThemedText style={styles.guestTitle}>Join the Arena</ThemedText>
            <ThemedText style={styles.guestMessage}>
              Sign in to join competitions, track your progress, and compete for prizes
            </ThemedText>
            <Button onPress={handleLogin} style={styles.loginButton}>
              Sign In
            </Button>
          </View>
        )}

        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>Bullfight v1.0.0</ThemedText>
          <ThemedText style={styles.footerSubtext}>The Trading Arena</ThemedText>
        </View>
      </View>
    </ScrollView>
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
  contentWrapper: {
    alignSelf: "center",
    width: "100%",
  },
  profileSection: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  profileSectionWeb: {
    ...(Platform.OS === "web" ? {
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
    } : {}),
  } as any,
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.dark.accent,
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statCardWeb: {
    ...(Platform.OS === "web" ? {
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
    } : {}),
  } as any,
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: Spacing.xs,
    fontFamily: "monospace",
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  menuSection: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing["2xl"],
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  menuSectionWeb: {
    ...(Platform.OS === "web" ? {
      boxShadow: "0 2px 4px -1px rgba(0, 0, 0, 0.2)",
    } : {}),
  } as any,
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
    gap: Spacing.md,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  menuItemText: {
    fontSize: 16,
    color: Colors.dark.text,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing["2xl"],
    borderWidth: 1,
    borderColor: Colors.dark.danger,
    gap: Spacing.sm,
  },
  logoutButtonWeb: {
    ...(Platform.OS === "web" ? {
      boxShadow: "0 2px 4px -1px rgba(0, 0, 0, 0.2)",
    } : {}),
  } as any,
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.danger,
  },
  guestSection: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing["2xl"],
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  guestSectionWeb: {
    ...(Platform.OS === "web" ? {
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
    } : {}),
  } as any,
  guestIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
  },
  guestMessage: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  loginButton: {
    minWidth: 160,
  },
  footer: {
    alignItems: "center",
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
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

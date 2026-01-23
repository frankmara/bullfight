import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useAuthContext } from "@/context/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";
import { apiRequest } from "@/lib/query-client";

interface WalletData {
  balanceTokens: number;
  lockedTokens: number;
  availableTokens: number;
  updatedAt: string;
}

interface TokenPackage {
  tokens: number;
  amountCents: number;
}

interface PurchaseIntentResponse {
  mode: "stripe" | "simulate";
  purchaseId: string;
  tokens: number;
  amountCents: number;
  clientSecret?: string;
  publishableKey?: string;
}

const DESKTOP_BREAKPOINT = 768;

function useSafeHeaderHeight() {
  try {
    return useHeaderHeight();
  } catch {
    return 0;
  }
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const rawHeaderHeight = useSafeHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const isDesktop = Platform.OS === "web" && Dimensions.get("window").width >= DESKTOP_BREAKPOINT;
  const headerHeight = isDesktop ? 0 : rawHeaderHeight;
  const { user, isAuthenticated } = useAuthContext();
  const [selectedPackage, setSelectedPackage] = useState<TokenPackage | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);

  const isDev = process.env.NODE_ENV !== "production";

  const { data: wallet, isLoading: walletLoading } = useQuery<WalletData>({
    queryKey: ["/api/wallet"],
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  const { data: packagesData } = useQuery<{ packages: TokenPackage[] }>({
    queryKey: ["/api/tokens/packages"],
    enabled: isAuthenticated,
  });

  const packages = packagesData?.packages || [
    { tokens: 25, amountCents: 2500 },
    { tokens: 50, amountCents: 5000 },
    { tokens: 100, amountCents: 10000 },
    { tokens: 250, amountCents: 25000 },
    { tokens: 500, amountCents: 50000 },
    { tokens: 1000, amountCents: 100000 },
  ];

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: TokenPackage) => {
      const intentResponse = await apiRequest(
        "POST",
        "/api/tokens/purchase-intent",
        { tokens: pkg.tokens }
      );
      const intentRes: PurchaseIntentResponse = await intentResponse.json();

      if (intentRes.mode === "simulate") {
        const confirmResponse = await apiRequest(
          "POST",
          "/api/tokens/purchase-confirm",
          { purchaseId: intentRes.purchaseId }
        );
        const confirmRes: { success: boolean; tokens: number; newBalance: number } = await confirmResponse.json();
        return { ...confirmRes, mode: "simulate" as const };
      }

      return intentRes;
    },
    onSuccess: (data) => {
      if ("success" in data && data.success) {
        setPurchaseSuccess(`Successfully purchased ${(data as any).tokens} tokens!`);
        queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
        setSelectedPackage(null);
      }
      setIsPurchasing(false);
    },
    onError: (error: any) => {
      setPurchaseError(error.message || "Purchase failed");
      setIsPurchasing(false);
    },
  });

  const handlePurchase = async (pkg: TokenPackage) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setPurchaseError(null);
    setPurchaseSuccess(null);
    setSelectedPackage(pkg);
    setIsPurchasing(true);
    purchaseMutation.mutate(pkg);
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: headerHeight + Spacing.xl }]}>
        <View style={styles.centerContent}>
          <Feather name="lock" size={48} color={Colors.dark.textMuted} />
          <ThemedText style={styles.emptyTitle}>Sign In Required</ThemedText>
          <ThemedText style={styles.emptyText}>
            Please sign in to access your wallet
          </ThemedText>
          <Button onPress={() => navigation.navigate("Login")}>Sign In</Button>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <View style={styles.content}>
        <ThemedText style={styles.pageTitle}>Wallet</ThemedText>

        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Feather name="circle" size={32} color={Colors.dark.accent} />
            <ThemedText style={styles.balanceLabel}>Token Balance</ThemedText>
          </View>
          {walletLoading ? (
            <ActivityIndicator size="large" color={Colors.dark.accent} />
          ) : (
            <>
              <ThemedText style={styles.balanceAmount}>
                {(wallet?.availableTokens ?? 0).toLocaleString()}
              </ThemedText>
              {(wallet?.lockedTokens ?? 0) > 0 && (
                <ThemedText style={styles.lockedText}>
                  ({wallet?.lockedTokens.toLocaleString()} locked)
                </ThemedText>
              )}
            </>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Purchase Tokens</ThemedText>
          <ThemedText style={styles.sectionSubtitle}>
            Select a token package to purchase
          </ThemedText>

          {purchaseError ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color={Colors.dark.sell} />
              <ThemedText style={styles.errorText}>{purchaseError}</ThemedText>
            </View>
          ) : null}

          {purchaseSuccess ? (
            <View style={styles.successBanner}>
              <Feather name="check-circle" size={16} color={Colors.dark.buy} />
              <ThemedText style={styles.successText}>{purchaseSuccess}</ThemedText>
            </View>
          ) : null}

          <View style={styles.packagesGrid}>
            {packages.map((pkg) => (
              <Pressable
                key={pkg.tokens}
                style={({ pressed }) => [
                  styles.packageCard,
                  selectedPackage?.tokens === pkg.tokens && styles.packageCardSelected,
                  pressed && styles.packageCardPressed,
                ]}
                onPress={() => handlePurchase(pkg)}
                disabled={isPurchasing}
              >
                {isPurchasing && selectedPackage?.tokens === pkg.tokens ? (
                  <ActivityIndicator size="small" color={Colors.dark.accent} />
                ) : (
                  <>
                    <View style={styles.tokenBadge}>
                      <Feather name="circle" size={18} color={Colors.dark.accent} />
                      <ThemedText style={styles.tokenCount}>{pkg.tokens}</ThemedText>
                    </View>
                    <ThemedText style={styles.packagePrice}>
                      {formatCurrency(pkg.amountCents)}
                    </ThemedText>
                  </>
                )}
              </Pressable>
            ))}
          </View>

          {isDev ? (
            <View style={styles.devNote}>
              <Feather name="info" size={14} color={Colors.dark.textMuted} />
              <ThemedText style={styles.devNoteText}>
                Development mode: Purchases are simulated
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>How Tokens Work</ThemedText>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Feather name="zap" size={16} color={Colors.dark.accent} />
              <ThemedText style={styles.infoText}>
                Use tokens to enter competitions
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <Feather name="users" size={16} color={Colors.dark.accent} />
              <ThemedText style={styles.infoText}>
                Stake tokens in PvP challenges
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <Feather name="trending-up" size={16} color={Colors.dark.accent} />
              <ThemedText style={styles.infoText}>
                Place bets on other traders
              </ThemedText>
            </View>
          </View>
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
  contentContainer: {
    flexGrow: 1,
  },
  content: {
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: Spacing.lg,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: Spacing.xl,
  },
  balanceCard: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  balanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  balanceLabel: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginLeft: Spacing.sm,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  lockedText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginTop: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.lg,
  },
  packagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -Spacing.xs,
  },
  packageCard: {
    width: "31%",
    marginHorizontal: "1%",
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: "center",
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    minHeight: 90,
    justifyContent: "center",
  },
  packageCardSelected: {
    borderColor: Colors.dark.accent,
    backgroundColor: Colors.dark.backgroundDefault,
  },
  packageCardPressed: {
    opacity: 0.7,
  },
  tokenBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  tokenCount: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.dark.text,
    marginLeft: Spacing.xs,
  },
  packagePrice: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  devNote: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.sm,
  },
  devNoteText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginLeft: Spacing.xs,
  },
  infoCard: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  infoText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginLeft: Spacing.md,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 59, 59, 0.1)",
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: 14,
    color: Colors.dark.sell,
    marginLeft: Spacing.sm,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(46, 204, 113, 0.1)",
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  successText: {
    fontSize: 14,
    color: Colors.dark.buy,
    marginLeft: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.dark.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
});

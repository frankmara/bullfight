import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
  Dimensions,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { CompetitionCard } from "@/components/CompetitionCard";
import { CompetitionCardSkeleton } from "@/components/SkeletonLoader";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";

const bullLogo = require("../../attached_assets/generated_images/bullfight_app_icon_bull.png");

interface Competition {
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
}

const getNumColumns = () => {
  const width = Dimensions.get("window").width;
  if (Platform.OS === "web") {
    if (width >= 1200) return 3;
    if (width >= 768) return 2;
  }
  return 1;
};

const DESKTOP_BREAKPOINT = 768;

function useSafeHeaderHeight() {
  try {
    return useHeaderHeight();
  } catch {
    return 0;
  }
}

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const rawHeaderHeight = useSafeHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isDesktop = Platform.OS === 'web' && Dimensions.get('window').width >= DESKTOP_BREAKPOINT;
  const headerHeight = isDesktop ? 0 : rawHeaderHeight;
  const [numColumns, setNumColumns] = React.useState(getNumColumns());
  const [windowWidth, setWindowWidth] = React.useState(Dimensions.get("window").width);

  React.useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setNumColumns(getNumColumns());
      setWindowWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  const {
    data: competitions,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Competition[]>({
    queryKey: ["/api/competitions"],
    staleTime: 30000,
  });

  const activeCompetitions = competitions?.filter(
    (c) => c.status === "open" || c.status === "running"
  );

  const handleCompetitionPress = (id: string) => {
    navigation.navigate("CompetitionDetail", { id });
  };

  const isLargeDesktop = Platform.OS === "web" && windowWidth >= 1200;
  const logoSize = isLargeDesktop ? 120 : 80;
  const titleSize = isLargeDesktop ? 56 : 40;
  const maxContentWidth = isLargeDesktop ? 1200 : windowWidth;

  const renderHeader = () => (
    <View style={styles.heroContainer}>
      <LinearGradient
        colors={["#0A0A0A", "#1A0A0A", "#0A0A0A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
      >
        <View style={styles.heroContent}>
          <View style={styles.logoContainer}>
            <View style={styles.logoGlow} />
            <Image
              source={bullLogo}
              style={[styles.logo, { width: logoSize, height: logoSize }]}
              resizeMode="contain"
            />
          </View>
          
          <ThemedText style={[styles.heroTitle, { fontSize: titleSize }]}>
            BULLFIGHT
          </ThemedText>
          
          <ThemedText style={styles.heroSubtitle}>
            THE TRADING ARENA
          </ThemedText>
          
          <ThemedText style={styles.heroTagline}>
            Compete in paper-trading tournaments for real prize pools
          </ThemedText>
          
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <ThemedText style={styles.heroStatValue}>$50K+</ThemedText>
              <ThemedText style={styles.heroStatLabel}>Prize Pools</ThemedText>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <ThemedText style={styles.heroStatValue}>1000+</ThemedText>
              <ThemedText style={styles.heroStatLabel}>Traders</ThemedText>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <ThemedText style={styles.heroStatValue}>24/7</ThemedText>
              <ThemedText style={styles.heroStatLabel}>Markets</ThemedText>
            </View>
          </View>
        </View>
      </LinearGradient>
      
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.sectionAccent} />
          <ThemedText style={styles.sectionTitle}>Active Competitions</ThemedText>
        </View>
        <ThemedText style={styles.sectionSubtitle}>
          {activeCompetitions?.length || 0} tournaments available
        </ThemedText>
      </View>
    </View>
  );

  const renderCompetition = ({
    item,
    index,
  }: {
    item: Competition;
    index: number;
  }) => {
    const cardWidth = numColumns > 1 
      ? (Math.min(maxContentWidth, windowWidth) - Spacing.lg * 2 - Spacing.md * (numColumns - 1)) / numColumns
      : undefined;

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 100).springify()}
        style={[
          styles.cardWrapper,
          numColumns > 1 ? {
            width: cardWidth,
            marginRight: (index + 1) % numColumns === 0 ? 0 : Spacing.md,
          } : null,
        ]}
      >
        <CompetitionCard
          {...item}
          onPress={() => handleCompetitionPress(item.id)}
        />
      </Animated.View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.skeletonContainer}>
          <CompetitionCardSkeleton />
          <View style={{ height: Spacing.lg }} />
          <CompetitionCardSkeleton />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <ThemedText style={styles.emptyTitle}>No Active Competitions</ThemedText>
        <ThemedText style={styles.emptyMessage}>
          Check back soon for upcoming trading tournaments!
        </ThemedText>
      </View>
    );
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight,
          paddingBottom: isDesktop ? Spacing.xl : 80,
          maxWidth: maxContentWidth,
          alignSelf: "center",
          width: "100%",
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      ListHeaderComponent={renderHeader}
      data={activeCompetitions}
      renderItem={renderCompetition}
      keyExtractor={(item) => item.id}
      key={numColumns}
      numColumns={numColumns}
      ListEmptyComponent={renderEmpty}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={Colors.dark.accent}
        />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  heroContainer: {
    marginBottom: Spacing["2xl"],
  },
  heroGradient: {
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.lg,
    overflow: "hidden",
  },
  heroContent: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    position: "relative",
    marginBottom: Spacing.xl,
  },
  logoGlow: {
    position: "absolute",
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    backgroundColor: Colors.dark.accent,
    opacity: 0.15,
    borderRadius: BorderRadius.full,
  },
  logo: {
    borderRadius: BorderRadius.lg,
  },
  heroTitle: {
    fontWeight: "800",
    color: Colors.dark.text,
    letterSpacing: 8,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.accent,
    letterSpacing: 4,
    marginTop: Spacing.sm,
    textTransform: "uppercase",
  },
  heroTagline: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginTop: Spacing.lg,
    maxWidth: 300,
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing["2xl"],
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  heroStat: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  heroStatLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.dark.border,
  },
  sectionHeader: {
    marginTop: Spacing["2xl"],
    marginBottom: Spacing.lg,
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  sectionAccent: {
    width: 4,
    height: 20,
    backgroundColor: Colors.dark.accent,
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginLeft: Spacing.md + 4,
  },
  cardWrapper: {
    marginBottom: Spacing.lg,
  },
  skeletonContainer: {
    marginTop: Spacing.lg,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
  },
  emptyMessage: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
});

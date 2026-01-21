import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { CompetitionCard } from "@/components/CompetitionCard";
import { EmptyState } from "@/components/EmptyState";
import { CompetitionCardSkeleton } from "@/components/SkeletonLoader";
import { Colors, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";

const heroImage = require("../../attached_assets/generated_images/hero_trading_arena_illustration.png");
const emptyImage = require("../../attached_assets/generated_images/empty_competitions_state_illustration.png");

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

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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

  const renderHeader = () => (
    <View style={styles.heroSection}>
      <Image source={heroImage} style={styles.heroImage} resizeMode="cover" />
      <View style={styles.heroOverlay}>
        <ThemedText style={styles.heroTitle}>BULLFIGHT</ThemedText>
        <ThemedText style={styles.heroSubtitle}>
          The Trading Arena
        </ThemedText>
        <ThemedText style={styles.heroDescription}>
          Compete in paper-trading tournaments for real prize pools
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
  }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 100).springify()}
      style={styles.cardWrapper}
    >
      <CompetitionCard
        {...item}
        onPress={() => handleCompetitionPress(item.id)}
      />
    </Animated.View>
  );

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
      <EmptyState
        image={emptyImage}
        title="No Active Competitions"
        message="Check back soon for upcoming trading tournaments!"
      />
    );
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      ListHeaderComponent={renderHeader}
      data={activeCompetitions}
      renderItem={renderCompetition}
      keyExtractor={(item) => item.id}
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
  heroSection: {
    marginBottom: Spacing["2xl"],
    marginTop: Spacing.lg,
    borderRadius: 16,
    overflow: "hidden",
    height: 200,
  },
  heroImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 10, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: "800",
    color: Colors.dark.text,
    letterSpacing: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.accent,
    letterSpacing: 3,
    marginTop: Spacing.xs,
  },
  heroDescription: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  cardWrapper: {
    marginBottom: Spacing.lg,
  },
  skeletonContainer: {
    marginTop: Spacing.lg,
  },
});

import React from "react";
import { View, Text, Pressable, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { TerminalColors, TerminalSpacing, TerminalRadius, TerminalTypography } from "./theme";

interface Tab {
  key: string;
  label: string;
  badge?: number;
}

interface TerminalTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "pills" | "underline";
}

export function TerminalTabs({
  tabs,
  activeTab,
  onTabChange,
  style,
  variant = "default",
}: TerminalTabsProps) {
  return (
    <View style={[styles.container, variant === "underline" && styles.containerUnderline, style]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              variant === "pills" && styles.tabPill,
              variant === "underline" && styles.tabUnderline,
              isActive && styles.tabActive,
              isActive && variant === "pills" && styles.tabPillActive,
              isActive && variant === "underline" && styles.tabUnderlineActive,
            ]}
            onPress={() => onTabChange(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                isActive && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
            {tab.badge !== undefined && tab.badge > 0 ? (
              <View style={[styles.badge, isActive && styles.badgeActive]}>
                <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
                  {tab.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: TerminalSpacing.xs,
    backgroundColor: TerminalColors.bgBase,
    padding: TerminalSpacing.xs,
    borderRadius: TerminalRadius.sm,
  },
  containerUnderline: {
    backgroundColor: "transparent",
    padding: 0,
    gap: 0,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: TerminalSpacing.xs,
    paddingVertical: TerminalSpacing.sm,
    paddingHorizontal: TerminalSpacing.md,
    borderRadius: TerminalRadius.sm,
  },
  tabPill: {
    borderRadius: TerminalRadius.md,
  },
  tabUnderline: {
    borderRadius: 0,
    paddingHorizontal: TerminalSpacing.lg,
    marginBottom: -1,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    backgroundColor: TerminalColors.bgSurface,
  },
  tabPillActive: {
    backgroundColor: TerminalColors.bgElevated,
  },
  tabUnderlineActive: {
    backgroundColor: "transparent",
    borderBottomColor: TerminalColors.accent,
  },
  tabText: {
    ...TerminalTypography.tab,
  },
  tabTextActive: {
    ...TerminalTypography.tabActive,
  },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: TerminalColors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: TerminalSpacing.xs,
  },
  badgeActive: {
    backgroundColor: TerminalColors.accent,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: TerminalColors.textMuted,
  },
  badgeTextActive: {
    color: TerminalColors.textPrimary,
  },
});

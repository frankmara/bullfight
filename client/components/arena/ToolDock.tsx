import React from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { TerminalColors } from "@/components/terminal";

interface ToolDockProps {
  onToolSelect?: (tool: string) => void;
  selectedTool?: string;
}

const TOOLS = [
  { id: "cursor", icon: "mouse-pointer" as const, label: "Cursor" },
  { id: "crosshair", icon: "crosshair" as const, label: "Crosshair" },
  { id: "trend", icon: "trending-up" as const, label: "Trend Line" },
  { id: "horizontal", icon: "minus" as const, label: "Horizontal Line" },
  { id: "fibonacci", icon: "git-branch" as const, label: "Fibonacci" },
  { id: "rectangle", icon: "square" as const, label: "Rectangle" },
  { id: "text", icon: "type" as const, label: "Text" },
  { id: "measure", icon: "maximize-2" as const, label: "Measure" },
];

export function ToolDock({ onToolSelect, selectedTool = "cursor" }: ToolDockProps) {
  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollArea} 
        contentContainerStyle={styles.toolList}
        showsVerticalScrollIndicator={false}
      >
        {TOOLS.map((tool, index) => (
          <React.Fragment key={tool.id}>
            <Pressable
              style={[styles.toolButton, selectedTool === tool.id && styles.toolButtonActive]}
              onPress={() => onToolSelect?.(tool.id)}
            >
              <Feather 
                name={tool.icon} 
                size={16} 
                color={selectedTool === tool.id ? TerminalColors.accent : TerminalColors.textMuted} 
              />
            </Pressable>
            {index === 1 || index === 4 ? <View style={styles.separator} /> : null}
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 48,
    backgroundColor: TerminalColors.bgPanel,
    borderRightWidth: 1,
    borderRightColor: TerminalColors.border,
  },
  scrollArea: {
    flex: 1,
  },
  toolList: {
    paddingVertical: 8,
    alignItems: "center",
    gap: 4,
  },
  toolButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  toolButtonActive: {
    backgroundColor: "rgba(209, 75, 58, 0.15)",
  },
  separator: {
    width: 28,
    height: 1,
    backgroundColor: TerminalColors.border,
    marginVertical: 6,
  },
});

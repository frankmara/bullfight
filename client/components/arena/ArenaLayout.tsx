import React, { useState } from "react";
import { View, StyleSheet, Platform, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { TerminalColors } from "@/components/terminal";

interface ArenaLayoutProps {
  header: React.ReactNode;
  toolDock: React.ReactNode;
  chartToolbar: React.ReactNode;
  chart: React.ReactNode | ((isBlotterCollapsed: boolean) => React.ReactNode);
  marketWatch: React.ReactNode;
  orderTicket: React.ReactNode;
  blotter: React.ReactNode;
  blotterDockButton?: React.ReactNode;
  overlays?: React.ReactNode;
  isFullscreen?: boolean;
}

const TOOL_DOCK_WIDTH = 48;
const RIGHT_PANEL_WIDTH = 400;
const BLOTTER_HEIGHT = 280;
const BLOTTER_COLLAPSED_HEIGHT = 32;
const TOOLBAR_HEIGHT = 44;

export function ArenaLayout({
  header,
  toolDock,
  chartToolbar,
  chart,
  marketWatch,
  orderTicket,
  blotter,
  blotterDockButton,
  overlays,
  isFullscreen = false,
}: ArenaLayoutProps) {
  const [isBlotterCollapsed, setIsBlotterCollapsed] = useState(false);

  if (Platform.OS !== "web") {
    return null;
  }

  const toggleBlotter = () => {
    setIsBlotterCollapsed(!isBlotterCollapsed);
  };

  return (
    <View style={styles.container}>
      {header}
      
      <View style={styles.mainGrid}>
        <View style={styles.toolDockColumn}>
          {toolDock}
        </View>
        
        <View style={styles.centerColumn}>
          <View style={styles.chartToolbar}>
            {chartToolbar}
          </View>
          <View style={styles.chartArea}>
            {typeof chart === 'function' ? chart(isBlotterCollapsed) : chart}
          </View>
        </View>
        
        {!isFullscreen && (
          <View style={styles.rightColumn}>
            <View style={styles.marketWatchSection}>
              {marketWatch}
            </View>
            <View style={styles.orderTicketSection}>
              {orderTicket}
            </View>
          </View>
        )}
      </View>
      
      {!isFullscreen && (
        <View style={[
          styles.blotterRow,
          isBlotterCollapsed && styles.blotterRowCollapsed
        ]}>
          <View style={styles.blotterDockSpacer}>
            <Pressable style={styles.collapseBtn} onPress={toggleBlotter}>
              <Feather 
                name={isBlotterCollapsed ? "chevron-up" : "chevron-down"} 
                size={16} 
                color={TerminalColors.textMuted} 
              />
            </Pressable>
            {!isBlotterCollapsed && blotterDockButton && (
              <View style={styles.dockButtonWrapper}>
                {blotterDockButton}
              </View>
            )}
          </View>
          <View style={styles.blotterContent}>
            {isBlotterCollapsed ? null : blotter}
          </View>
        </View>
      )}
      
      {overlays}
    </View>
  );
}

export const LAYOUT_CONSTANTS = {
  TOOL_DOCK_WIDTH,
  RIGHT_PANEL_WIDTH,
  BLOTTER_HEIGHT,
  TOOLBAR_HEIGHT,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TerminalColors.bgBase,
  },
  
  mainGrid: {
    flex: 1,
    flexDirection: "row",
  },
  
  toolDockColumn: {
    width: TOOL_DOCK_WIDTH,
    backgroundColor: TerminalColors.bgPanel,
    borderRightWidth: 1,
    borderRightColor: TerminalColors.border,
  },
  
  centerColumn: {
    flex: 1,
    flexDirection: "column",
  },
  
  chartToolbar: {
    height: TOOLBAR_HEIGHT,
    backgroundColor: TerminalColors.bgPanel,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  
  chartArea: {
    flex: 1,
    backgroundColor: TerminalColors.bgBase,
  },
  
  rightColumn: {
    width: RIGHT_PANEL_WIDTH,
    backgroundColor: TerminalColors.bgPanel,
    borderLeftWidth: 1,
    borderLeftColor: TerminalColors.border,
    flexDirection: "column",
  },
  
  marketWatchSection: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  
  orderTicketSection: {
    flexShrink: 0,
  },
  
  blotterRow: {
    height: BLOTTER_HEIGHT,
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: TerminalColors.border,
    backgroundColor: TerminalColors.bgPanel,
  },
  
  blotterRowCollapsed: {
    height: BLOTTER_COLLAPSED_HEIGHT,
  },
  
  blotterDockSpacer: {
    width: TOOL_DOCK_WIDTH,
    backgroundColor: TerminalColors.bgPanel,
    borderRightWidth: 1,
    borderRightColor: TerminalColors.border,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  
  collapseBtn: {
    width: 28,
    height: 20,
    borderRadius: 4,
    backgroundColor: TerminalColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  
  dockButtonWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  
  blotterContent: {
    flex: 1,
  },
});

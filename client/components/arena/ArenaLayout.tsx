import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { TerminalColors } from "@/components/terminal";

interface ArenaLayoutProps {
  header: React.ReactNode;
  toolDock: React.ReactNode;
  chartToolbar: React.ReactNode;
  chart: React.ReactNode;
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
  if (Platform.OS !== "web") {
    return null;
  }

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
            {chart}
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
        <View style={styles.blotterRow}>
          <View style={styles.blotterDockSpacer}>
            {blotterDockButton}
          </View>
          <View style={styles.blotterContent}>
            {blotter}
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
    height: 180,
    flexShrink: 0,
  },
  
  blotterRow: {
    height: BLOTTER_HEIGHT,
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: TerminalColors.border,
    backgroundColor: TerminalColors.bgPanel,
  },
  
  blotterDockSpacer: {
    width: TOOL_DOCK_WIDTH,
    backgroundColor: TerminalColors.bgPanel,
    borderRightWidth: 1,
    borderRightColor: TerminalColors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  
  blotterContent: {
    flex: 1,
  },
});

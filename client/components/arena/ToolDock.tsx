import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { TerminalColors } from "@/components/terminal";

export type DrawingTool = 
  | "cursor" 
  | "crosshair" 
  | "horizontal" 
  | "vertical" 
  | "trend" 
  | "ray" 
  | "fibonacci" 
  | "rectangle" 
  | "text" 
  | "measure";

export interface DrawnLine {
  id: string;
  type: "horizontal" | "trend" | "vertical" | "ray";
  price?: number;
  startPrice?: number;
  startTime?: number;
  endPrice?: number;
  endTime?: number;
  color: string;
}

interface ToolDockProps {
  selectedTool: DrawingTool;
  onToolSelect: (tool: DrawingTool) => void;
  onShowToast?: (message: string) => void;
  drawnLines?: DrawnLine[];
  onDeleteLine?: (lineId: string) => void;
}

interface ToolItem {
  id: DrawingTool;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  shortcut?: string;
  group: number;
  hasSubmenu?: boolean;
  submenuItems?: { id: DrawingTool; label: string; shortcut?: string }[];
}

const TOOLS: ToolItem[] = [
  { id: "cursor", icon: "mouse-pointer", label: "Cursor", shortcut: "V", group: 0 },
  { id: "crosshair", icon: "crosshair", label: "Crosshair", shortcut: "C", group: 0 },
  { 
    id: "trend", 
    icon: "trending-up", 
    label: "Lines", 
    shortcut: "", 
    group: 1,
    hasSubmenu: true,
    submenuItems: [
      { id: "trend", label: "Trend Line", shortcut: "Alt+T" },
      { id: "ray", label: "Ray", shortcut: "Alt+R" },
      { id: "horizontal", label: "Horizontal Line", shortcut: "Alt+H" },
      { id: "vertical", label: "Vertical Line", shortcut: "Alt+V" },
    ]
  },
  { id: "fibonacci", icon: "git-branch", label: "Fibonacci", shortcut: "F", group: 2 },
  { id: "rectangle", icon: "square", label: "Rectangle", shortcut: "R", group: 2 },
  { id: "text", icon: "type", label: "Text", shortcut: "T", group: 3 },
  { id: "measure", icon: "maximize-2", label: "Measure", shortcut: "M", group: 3 },
];

const LINE_TOOLS: DrawingTool[] = ["trend", "ray", "horizontal", "vertical"];

function Tooltip({ children, label, shortcut, visible }: { children: React.ReactNode; label: string; shortcut?: string; visible: boolean }) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return React.createElement('div', {
    style: { position: 'relative', display: 'inline-block' },
  }, [
    children,
    visible && React.createElement('div', {
      key: 'tooltip',
      style: {
        position: 'absolute',
        left: 44,
        top: '50%',
        transform: 'translateY(-50%)',
        backgroundColor: TerminalColors.bgElevated,
        border: `1px solid ${TerminalColors.border}`,
        borderRadius: 4,
        padding: '6px 10px',
        whiteSpace: 'nowrap',
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      },
    }, [
      React.createElement('span', {
        key: 'label',
        style: {
          color: TerminalColors.textPrimary,
          fontSize: 12,
          fontWeight: 500,
        },
      }, label),
      shortcut && React.createElement('span', {
        key: 'shortcut',
        style: {
          color: TerminalColors.textMuted,
          fontSize: 10,
          backgroundColor: TerminalColors.bgBase,
          padding: '2px 5px',
          borderRadius: 3,
          fontFamily: 'monospace',
        },
      }, shortcut),
    ]),
  ]);
}

function LinesFlyout({ 
  visible, 
  selectedTool,
  onSelect, 
  onClose,
  items,
}: { 
  visible: boolean; 
  selectedTool: DrawingTool;
  onSelect: (tool: DrawingTool) => void; 
  onClose: () => void;
  items: { id: DrawingTool; label: string; shortcut?: string }[];
}) {
  if (!visible || Platform.OS !== 'web') return null;

  return React.createElement('div', {
    style: {
      position: 'absolute',
      left: 48,
      top: 0,
      backgroundColor: TerminalColors.bgPanel,
      border: `1px solid ${TerminalColors.border}`,
      borderRadius: 6,
      padding: '4px 0',
      minWidth: 180,
      zIndex: 9999,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    },
    onClick: (e: any) => e.stopPropagation(),
  }, [
    React.createElement('div', {
      key: 'header',
      style: {
        padding: '6px 12px 8px',
        borderBottom: `1px solid ${TerminalColors.border}`,
        marginBottom: 4,
      },
    }, React.createElement('span', {
      style: {
        color: TerminalColors.textMuted,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      },
    }, 'Lines')),
    ...items.map((item) => 
      React.createElement('div', {
        key: item.id,
        style: {
          padding: '8px 12px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: selectedTool === item.id ? 'rgba(209, 75, 58, 0.15)' : 'transparent',
        },
        onClick: () => {
          onSelect(item.id);
          onClose();
        },
        onMouseEnter: (e: any) => {
          if (selectedTool !== item.id) {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
          }
        },
        onMouseLeave: (e: any) => {
          if (selectedTool !== item.id) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        },
      }, [
        React.createElement('span', {
          key: 'label',
          style: {
            color: selectedTool === item.id ? TerminalColors.accent : TerminalColors.textPrimary,
            fontSize: 12,
          },
        }, item.label),
        item.shortcut && React.createElement('span', {
          key: 'shortcut',
          style: {
            color: TerminalColors.textMuted,
            fontSize: 10,
            fontFamily: 'monospace',
            backgroundColor: TerminalColors.bgBase,
            padding: '2px 6px',
            borderRadius: 3,
          },
        }, item.shortcut),
      ])
    ),
  ]);
}

export function ToolDock({ 
  selectedTool = "cursor", 
  onToolSelect,
  onShowToast,
  drawnLines = [],
  onDeleteLine,
}: ToolDockProps) {
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [linesListOpen, setLinesListOpen] = useState(false);
  const flyoutRef = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleClickOutside = () => {
        setFlyoutOpen(false);
        setLinesListOpen(false);
      };
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, []);

  const handleToolClick = (tool: ToolItem) => {
    if (tool.hasSubmenu) {
      setFlyoutOpen(!flyoutOpen);
      return;
    }

    if (tool.id === "crosshair") {
      onShowToast?.("Crosshair always on");
      return;
    }

    if (["fibonacci", "rectangle", "text", "measure", "ray", "vertical"].includes(tool.id)) {
      onShowToast?.(`${tool.label} - Coming soon`);
      return;
    }

    onToolSelect(tool.id);
  };

  const handleSubmenuSelect = (toolId: DrawingTool) => {
    if (["ray", "vertical"].includes(toolId)) {
      onShowToast?.(`${toolId === 'ray' ? 'Ray' : 'Vertical Line'} - Coming soon`);
      return;
    }
    onToolSelect(toolId);
  };

  const getActiveLineTool = (): ToolItem | null => {
    const lineToolItem = TOOLS.find(t => t.hasSubmenu);
    if (!lineToolItem) return null;
    const isLineTool = LINE_TOOLS.includes(selectedTool);
    return isLineTool ? lineToolItem : null;
  };

  const activeLineTool = getActiveLineTool();

  let currentGroup = -1;

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollArea} 
        contentContainerStyle={styles.toolList}
        showsVerticalScrollIndicator={false}
      >
        {TOOLS.map((tool) => {
          const showSeparator = tool.group !== currentGroup && currentGroup !== -1;
          currentGroup = tool.group;

          const isActive = tool.id === selectedTool || 
            (tool.hasSubmenu && LINE_TOOLS.includes(selectedTool));
          const displayIcon = tool.hasSubmenu && LINE_TOOLS.includes(selectedTool)
            ? (selectedTool === 'horizontal' ? 'minus' : selectedTool === 'vertical' ? 'more-vertical' : 'trending-up')
            : tool.icon;

          const button = (
            <Pressable
              key={tool.id}
              style={[styles.toolButton, isActive && styles.toolButtonActive]}
              onPress={() => handleToolClick(tool)}
              onHoverIn={() => setHoveredTool(tool.id)}
              onHoverOut={() => setHoveredTool(null)}
            >
              <Feather 
                name={displayIcon as any} 
                size={16} 
                color={isActive ? TerminalColors.accent : TerminalColors.textMuted} 
              />
              {tool.hasSubmenu && (
                <View style={styles.submenuIndicator}>
                  <Feather name="chevron-right" size={8} color={TerminalColors.textMuted} />
                </View>
              )}
            </Pressable>
          );

          return (
            <React.Fragment key={tool.id}>
              {showSeparator && <View style={styles.separator} />}
              {Platform.OS === 'web' ? (
                <View style={{ position: 'relative' as any }}>
                  <Tooltip 
                    label={tool.hasSubmenu && LINE_TOOLS.includes(selectedTool) 
                      ? `Lines (${selectedTool})` 
                      : tool.label
                    } 
                    shortcut={tool.shortcut} 
                    visible={hoveredTool === tool.id && !flyoutOpen}
                  >
                    {button}
                  </Tooltip>
                  {tool.hasSubmenu && tool.submenuItems && (
                    <LinesFlyout
                      visible={flyoutOpen}
                      selectedTool={selectedTool}
                      items={tool.submenuItems}
                      onSelect={handleSubmenuSelect}
                      onClose={() => setFlyoutOpen(false)}
                    />
                  )}
                </View>
              ) : button}
            </React.Fragment>
          );
        })}

        <View style={styles.separator} />
        
        <Pressable
          style={[styles.toolButton, linesListOpen && styles.toolButtonActive]}
          onPress={() => setLinesListOpen(!linesListOpen)}
          onHoverIn={() => setHoveredTool('lines-list')}
          onHoverOut={() => setHoveredTool(null)}
        >
          <Feather 
            name="list" 
            size={16} 
            color={linesListOpen ? TerminalColors.accent : TerminalColors.textMuted} 
          />
          {drawnLines.length > 0 && (
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>{drawnLines.length}</ThemedText>
            </View>
          )}
        </Pressable>

        {Platform.OS === 'web' && linesListOpen && drawnLines.length > 0 && (
          React.createElement('div', {
            style: {
              position: 'absolute',
              left: 48,
              bottom: 8,
              backgroundColor: TerminalColors.bgPanel,
              border: `1px solid ${TerminalColors.border}`,
              borderRadius: 6,
              padding: '8px 0',
              minWidth: 200,
              maxHeight: 300,
              overflowY: 'auto',
              zIndex: 9999,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            },
            onClick: (e: any) => e.stopPropagation(),
          }, [
            React.createElement('div', {
              key: 'header',
              style: {
                padding: '4px 12px 8px',
                borderBottom: `1px solid ${TerminalColors.border}`,
                marginBottom: 4,
              },
            }, React.createElement('span', {
              style: {
                color: TerminalColors.textMuted,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              },
            }, `Drawn Objects (${drawnLines.length})`)),
            ...drawnLines.map((line) => 
              React.createElement('div', {
                key: line.id,
                style: {
                  padding: '6px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                },
                onMouseEnter: (e: any) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                },
                onMouseLeave: (e: any) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                },
              }, [
                React.createElement('div', {
                  key: 'info',
                  style: { display: 'flex', alignItems: 'center', gap: 8 },
                }, [
                  React.createElement('div', {
                    key: 'color',
                    style: {
                      width: 12,
                      height: 3,
                      backgroundColor: line.color,
                      borderRadius: 2,
                    },
                  }),
                  React.createElement('span', {
                    key: 'type',
                    style: {
                      color: TerminalColors.textSecondary,
                      fontSize: 11,
                    },
                  }, line.type === 'horizontal' ? `H-Line @ ${line.price?.toFixed(5)}` : 'Trend Line'),
                ]),
                React.createElement('div', {
                  key: 'delete',
                  style: {
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 4,
                    cursor: 'pointer',
                  },
                  onClick: (e: any) => {
                    e.stopPropagation();
                    onDeleteLine?.(line.id);
                  },
                  onMouseEnter: (e: any) => {
                    e.currentTarget.style.backgroundColor = 'rgba(209, 75, 58, 0.2)';
                  },
                  onMouseLeave: (e: any) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  },
                }, React.createElement('span', {
                  style: { color: TerminalColors.negative, fontSize: 14 },
                }, '\u00D7')),
              ])
            ),
          ])
        )}
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
    gap: 2,
  },
  toolButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  toolButtonActive: {
    backgroundColor: "rgba(209, 75, 58, 0.15)",
  },
  submenuIndicator: {
    position: "absolute",
    right: 2,
    bottom: 2,
  },
  separator: {
    width: 28,
    height: 1,
    backgroundColor: TerminalColors.border,
    marginVertical: 6,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: TerminalColors.accent,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
  },
});

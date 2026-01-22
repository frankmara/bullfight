import React, { ReactNode } from "react";
import { View, Text, StyleSheet, ViewStyle, StyleProp, ScrollView } from "react-native";
import { TerminalColors, TerminalSpacing, TerminalTypography } from "./theme";

interface Column<T> {
  key: string;
  header: string;
  width?: number | string;
  align?: "left" | "center" | "right";
  render?: (item: T, index: number) => ReactNode;
}

interface TerminalTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  style?: StyleProp<ViewStyle>;
  emptyMessage?: string;
  rowHeight?: number;
  stickyHeader?: boolean;
  onRowPress?: (item: T, index: number) => void;
}

export function TerminalTable<T>({
  columns,
  data,
  keyExtractor,
  style,
  emptyMessage = "No data",
  rowHeight = 32,
  stickyHeader = true,
}: TerminalTableProps<T>) {
  const getAlignment = (align?: "left" | "center" | "right") => {
    switch (align) {
      case "center":
        return "center";
      case "right":
        return "flex-end";
      default:
        return "flex-start";
    }
  };

  const renderHeader = () => (
    <View style={styles.headerRow}>
      {columns.map((col) => (
        <View
          key={col.key}
          style={[
            styles.headerCell,
            col.width ? { width: col.width as any, flex: undefined } : { flex: 1 },
            { alignItems: getAlignment(col.align) },
          ]}
        >
          <Text style={styles.headerText}>{col.header}</Text>
        </View>
      ))}
    </View>
  );

  const renderRow = (item: T, index: number) => (
    <View
      key={keyExtractor(item, index)}
      style={[
        styles.row,
        { minHeight: rowHeight },
        index % 2 === 0 && styles.rowEven,
      ]}
    >
      {columns.map((col) => (
        <View
          key={col.key}
          style={[
            styles.cell,
            col.width ? { width: col.width as any, flex: undefined } : { flex: 1 },
            { alignItems: getAlignment(col.align) },
          ]}
        >
          {col.render ? (
            col.render(item, index)
          ) : (
            <Text style={styles.cellText}>
              {String((item as any)[col.key] ?? "")}
            </Text>
          )}
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, style]}>
      {stickyHeader ? renderHeader() : null}
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {!stickyHeader ? renderHeader() : null}
        {data.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        ) : (
          data.map((item, index) => renderRow(item, index))
        )}
      </ScrollView>
    </View>
  );
}

export function TerminalTableCell({
  children,
  variant,
}: {
  children: ReactNode;
  variant?: "positive" | "negative" | "muted";
}) {
  return (
    <Text
      style={[
        styles.cellText,
        variant === "positive" && styles.cellPositive,
        variant === "negative" && styles.cellNegative,
        variant === "muted" && styles.cellMuted,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: TerminalSpacing.sm,
    paddingHorizontal: TerminalSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
    backgroundColor: TerminalColors.bgPanel,
  },
  headerCell: {
    paddingHorizontal: TerminalSpacing.xs,
  },
  headerText: {
    ...TerminalTypography.tableHeader,
  },
  body: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: TerminalSpacing.sm,
    paddingHorizontal: TerminalSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  rowEven: {
    backgroundColor: TerminalColors.bgSurface + "40",
  },
  cell: {
    paddingHorizontal: TerminalSpacing.xs,
  },
  cellText: {
    ...TerminalTypography.tableCell,
  },
  cellPositive: {
    color: TerminalColors.positive,
  },
  cellNegative: {
    color: TerminalColors.negative,
  },
  cellMuted: {
    color: TerminalColors.textMuted,
  },
  empty: {
    paddingVertical: TerminalSpacing.xxxl,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    ...TerminalTypography.bodySmall,
    color: TerminalColors.textMuted,
  },
});

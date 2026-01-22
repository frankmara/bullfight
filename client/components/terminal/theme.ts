import { Platform, TextStyle, ViewStyle } from "react-native";

export const TerminalColors = {
  bgBase: "#070A0F",
  bgPanel: "#0B0F14",
  bgSurface: "#0E141C",
  bgElevated: "#101924",
  bgInput: "#0A0E14",
  bgHover: "#141C28",

  border: "#1C2533",
  borderLight: "#243040",
  borderFocus: "#2A3A50",

  textPrimary: "#E6EDF3",
  textSecondary: "#9AA4B2",
  textMuted: "#5C6673",
  textDisabled: "#3D4654",

  accent: "#D14B3A",
  accentHover: "#E05545",
  accentGlow: "rgba(209, 75, 58, 0.25)",

  positive: "#16C784",
  positiveGlow: "rgba(22, 199, 132, 0.15)",
  positiveBg: "rgba(22, 199, 132, 0.08)",

  negative: "#D14B3A",
  negativeGlow: "rgba(209, 75, 58, 0.15)",
  negativeBg: "rgba(209, 75, 58, 0.08)",

  warning: "#F0B90B",
  warningBg: "rgba(240, 185, 11, 0.1)",

  info: "#3B82F6",
  infoBg: "rgba(59, 130, 246, 0.1)",
};

export const TerminalSpacing = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
};

export const TerminalRadius = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
};

export const TerminalTypography = {
  header: {
    fontSize: 12,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    color: TerminalColors.textSecondary,
  } as TextStyle,

  subheader: {
    fontSize: 11,
    fontWeight: "500" as const,
    letterSpacing: 0.3,
    color: TerminalColors.textMuted,
  } as TextStyle,

  label: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 0.4,
    textTransform: "uppercase" as const,
    color: TerminalColors.textMuted,
  } as TextStyle,

  body: {
    fontSize: 12,
    fontWeight: "400" as const,
    color: TerminalColors.textPrimary,
  } as TextStyle,

  bodySmall: {
    fontSize: 11,
    fontWeight: "400" as const,
    color: TerminalColors.textSecondary,
  } as TextStyle,

  price: {
    fontSize: 12,
    fontWeight: "500" as const,
    fontVariant: ["tabular-nums"] as any,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      web: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
    }),
    color: TerminalColors.textPrimary,
  } as TextStyle,

  priceLarge: {
    fontSize: 14,
    fontWeight: "600" as const,
    fontVariant: ["tabular-nums"] as any,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      web: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
    }),
    color: TerminalColors.textPrimary,
  } as TextStyle,

  tableCell: {
    fontSize: 11,
    fontWeight: "400" as const,
    fontVariant: ["tabular-nums"] as any,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      web: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
    }),
    color: TerminalColors.textPrimary,
  } as TextStyle,

  tableHeader: {
    fontSize: 10,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    color: TerminalColors.textMuted,
  } as TextStyle,

  button: {
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.3,
    color: TerminalColors.textPrimary,
  } as TextStyle,

  tab: {
    fontSize: 11,
    fontWeight: "500" as const,
    color: TerminalColors.textMuted,
  } as TextStyle,

  tabActive: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: TerminalColors.textPrimary,
  } as TextStyle,
};

export const TerminalShadows = {
  panel: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  } as ViewStyle,
};

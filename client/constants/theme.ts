import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#FFFFFF",
    textSecondary: "#B0B0B0",
    textMuted: "#666666",
    buttonText: "#FFFFFF",
    tabIconDefault: "#666666",
    tabIconSelected: "#FF3B3B",
    link: "#FF3B3B",
    backgroundRoot: "#0A0A0A",
    backgroundDefault: "#121212",
    backgroundSecondary: "#1A1A1A",
    backgroundTertiary: "#252525",
    border: "#252525",
    success: "#00C853",
    danger: "#FF3B3B",
    warning: "#FF9500",
    info: "#B0B0B0",
    gold: "#FFD700",
    accent: "#FF3B3B",
    accentHover: "#FF5252",
    buy: "#00C853",
    sell: "#FF3B3B",
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "#B0B0B0",
    textMuted: "#666666",
    buttonText: "#FFFFFF",
    tabIconDefault: "#666666",
    tabIconSelected: "#FF3B3B",
    link: "#FF3B3B",
    backgroundRoot: "#0A0A0A",
    backgroundDefault: "#121212",
    backgroundSecondary: "#1A1A1A",
    backgroundTertiary: "#252525",
    border: "#252525",
    success: "#00C853",
    danger: "#FF3B3B",
    warning: "#FF9500",
    info: "#B0B0B0",
    gold: "#FFD700",
    accent: "#FF3B3B",
    accentHover: "#FF5252",
    buy: "#00C853",
    sell: "#FF3B3B",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  "2xl": 16,
  "3xl": 20,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  tiny: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  mono: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "'Space Grotesk', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono: "'JetBrains Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

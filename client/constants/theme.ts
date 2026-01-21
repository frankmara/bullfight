import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",
    textMuted: "#6B7280",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#00D4FF",
    link: "#00D4FF",
    backgroundRoot: "#0A0E14",
    backgroundDefault: "#151B23",
    backgroundSecondary: "#1C242E",
    backgroundTertiary: "#2D3748",
    border: "#2D3748",
    success: "#10B981",
    danger: "#EF4444",
    warning: "#F59E0B",
    info: "#3B82F6",
    gold: "#FBBF24",
    purple: "#A78BFA",
    primaryBlue: "#00D4FF",
    primaryBlueHover: "#00B8E6",
  },
  dark: {
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",
    textMuted: "#6B7280",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#00D4FF",
    link: "#00D4FF",
    backgroundRoot: "#0A0E14",
    backgroundDefault: "#151B23",
    backgroundSecondary: "#1C242E",
    backgroundTertiary: "#2D3748",
    border: "#2D3748",
    success: "#10B981",
    danger: "#EF4444",
    warning: "#F59E0B",
    info: "#3B82F6",
    gold: "#FBBF24",
    purple: "#A78BFA",
    primaryBlue: "#00D4FF",
    primaryBlueHover: "#00B8E6",
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
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

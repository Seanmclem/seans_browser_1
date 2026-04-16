import { browserTheme } from "./tokens";

export const browserTailwindTheme = {
  colors: {
    "bg-base": "var(--browser-color-bg-base)",
    "bg-chrome": "var(--browser-color-bg-chrome)",
    "bg-surface": "var(--browser-color-bg-surface)",
    "tab-border-active": "var(--browser-color-tab-border-active)",
    border: "var(--browser-color-border)",
    "text-primary": "var(--browser-color-text-primary)",
    "text-muted": "var(--browser-color-text-muted)",
    accent: "var(--browser-color-accent)",
    "accent-subtle": "var(--browser-color-accent-subtle)"
  },
  tokens: browserTheme
} as const;

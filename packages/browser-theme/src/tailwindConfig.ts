import { browserTheme } from "./tokens";

export const browserTailwindTheme = {
  colors: {
    "bg-base": "var(--color-bg-base)",
    "bg-chrome": "var(--color-bg-chrome)",
    "bg-surface": "var(--color-bg-surface)",
    "tab-border-active": "var(--color-tab-border-active)",
    border: "var(--color-border)",
    "text-primary": "var(--color-text-primary)",
    "text-muted": "var(--color-text-muted)",
    accent: "var(--color-accent)",
    "accent-subtle": "var(--color-accent-subtle)"
  },
  tokens: browserTheme
} as const;

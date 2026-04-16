export const browserTheme = {
  light: {
    "bg-base": "#f9f9fb",
    "bg-chrome": "#d8d8dc",
    "bg-surface": "#ffffff",
    "tab-border-active": "#0060df",
    border: "#cfcfd8",
    "text-primary": "#15141a",
    "text-muted": "#5b5b66",
    accent: "#0060df",
    "accent-subtle": "#deeafc"
  },
  dark: {
    "bg-base": "#1c1b22",
    "bg-chrome": "#2b2a33",
    "bg-surface": "#46454f",
    "tab-border-active": "#00b3f4",
    border: "#4a4950",
    "text-primary": "#fbfbfe",
    "text-muted": "#9e9ea7",
    accent: "#00b3f4",
    "accent-subtle": "#003050"
  }
} as const;

export type BrowserThemeMode = keyof typeof browserTheme;
export type BrowserThemeTokens = (typeof browserTheme)[BrowserThemeMode];
export type BrowserThemeColor = keyof BrowserThemeTokens;

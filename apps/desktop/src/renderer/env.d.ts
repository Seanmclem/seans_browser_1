import type { SerializedTab, TabId } from "@seans-browser/browser-core";

type TabDropPlacement = "before" | "after" | "end";
type FavoritesBarVisibility = "always" | "never";
type TabStripPlacement = "top" | "left" | "right";
type ThemePreference = "system" | "light" | "dark";
type ThemeState = { preference: ThemePreference; resolvedTheme: "light" | "dark" };

interface HistoryEntry {
  url: string;
  title: string;
  visitedAt: number;
}

interface FavoriteFolderOption {
  id: string;
  label: string;
  parentFolderId: string | null;
  title: string;
}

interface FavoritesBarItem {
  favicon?: string | null;
  id: string;
  title: string;
  type: "favorite" | "folder";
  url: string;
}

interface DownloadEntry {
  filename: string;
  id: string;
  receivedBytes: number;
  savePath: string;
  startedAt: string;
  state: "in-progress" | "completed" | "cancelled" | "interrupted";
  totalBytes: number;
  url: string;
}

interface BrowserAPI {
  tab: {
    create: (url?: string) => Promise<TabId>;
    close: (id: TabId) => Promise<void>;
    activate: (id: TabId) => Promise<void>;
    list: () => Promise<SerializedTab[]>;
    beginDrag: (token: string, id: TabId) => Promise<void>;
    dropDragged: (
      token: string,
      targetId: TabId | null,
      placement: TabDropPlacement
    ) => Promise<void>;
    endDrag: (token: string) => Promise<void>;
    move: (id: TabId, targetId: TabId | null, placement: TabDropPlacement) => Promise<void>;
    moveToNewWindow: (id: TabId) => Promise<void>;
    showContextMenu: (id: TabId, position: { x: number; y: number }) => Promise<void>;
    sleep: (id: TabId) => Promise<void>;
    setPinned: (id: TabId, pinned: boolean) => Promise<void>;
  };
  nav: {
    back: (id: TabId) => Promise<void>;
    forward: (id: TabId) => Promise<void>;
    reload: (id: TabId) => Promise<void>;
    stop: (id: TabId) => Promise<void>;
    loadURL: (id: TabId, url: string) => Promise<void>;
  };
  history: {
    search: (query: string) => Promise<HistoryEntry[]>;
  };
  browser: {
    addFavorite: (input: {
      favicon?: string | null;
      parentFolderId?: string | null;
      title: string;
      url: string;
    }) => Promise<string | null>;
    getFavoriteStatus: (url: string) => Promise<{ favoriteId: string | null; isFavorited: boolean }>;
    closeActiveTab: () => Promise<void>;
    createFavoriteFolder: (input: {
      parentFolderId?: string | null;
      title: string;
    }) => Promise<FavoriteFolderOption | null>;
    listFavoriteFolders: () => Promise<FavoriteFolderOption[]>;
    listFavoritesBarItems: () => Promise<FavoritesBarItem[]>;
    listDownloads: () => Promise<DownloadEntry[]>;
    moveActiveTabToNewWindow: () => Promise<void>;
    hasRestorableSession: () => Promise<boolean>;
    openDownloads: () => Promise<void>;
    openFavorites: () => Promise<void>;
    openHistory: () => Promise<void>;
    openSettings: () => Promise<void>;
    restoreLastSession: () => Promise<number>;
    sleepActiveTab: () => Promise<void>;
    toggleFavorite: (input: {
      favicon?: string | null;
      parentFolderId?: string | null;
      title: string;
      url: string;
    }) => Promise<{ favoriteId: string | null; isFavorited: boolean }>;
  };
  layout: {
    getFavoritesBarVisibility: () => Promise<FavoritesBarVisibility>;
    getTabStripPlacement: () => Promise<TabStripPlacement>;
    setChromeHeight: (height: number) => Promise<void>;
    setChromeOverlayHeight: (height: number) => Promise<void>;
    setFavoritesBarVisibility: (visibility: FavoritesBarVisibility) => Promise<FavoritesBarVisibility>;
    setTabStripPlacement: (placement: TabStripPlacement) => Promise<void>;
  };
  theme: {
    getState: () => Promise<ThemeState>;
    setPreference: (preference: ThemePreference) => Promise<ThemeState>;
  };
  on: (channel: string, cb: (...args: unknown[]) => void) => void;
  off: (channel: string, cb: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    browserAPI: BrowserAPI;
  }
}

export {};

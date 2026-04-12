import type { SerializedTab, TabId } from "@seans-browser/browser-core";

type TabDropPlacement = "before" | "after" | "end";
type TabStripPlacement = "top" | "left" | "right";

interface HistoryEntry {
  url: string;
  title: string;
  visitedAt: number;
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
  };
  nav: {
    back: (id: TabId) => Promise<void>;
    forward: (id: TabId) => Promise<void>;
    reload: (id: TabId) => Promise<void>;
    loadURL: (id: TabId, url: string) => Promise<void>;
  };
  history: {
    search: (query: string) => Promise<HistoryEntry[]>;
  };
  browser: {
    closeActiveTab: () => Promise<void>;
    moveActiveTabToNewWindow: () => Promise<void>;
    sleepActiveTab: () => Promise<void>;
  };
  layout: {
    getTabStripPlacement: () => Promise<TabStripPlacement>;
    setChromeHeight: (height: number) => Promise<void>;
    setChromeOverlayHeight: (height: number) => Promise<void>;
    setTabStripPlacement: (placement: TabStripPlacement) => Promise<void>;
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

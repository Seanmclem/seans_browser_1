import { create } from "zustand";
import type { TabId, TabState } from "@seans-browser/browser-core";

export interface MobileTab {
  id: TabId;
  url: string;
  title: string;
  favicon: string | null;
  state: TabState;
  lastActive: number;
  snapshot: string | null;
  savedScrollY: number;
  pinned: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  reloadToken: number;
}

interface BrowserStore {
  tabs: MobileTab[];
  activeTabId: TabId | null;
  draftAddress: string;
  createTab: (url?: string) => TabId;
  closeTab: (id: TabId) => void;
  setActiveTab: (id: TabId) => void;
  updateTab: (id: TabId, patch: Partial<MobileTab>) => void;
  setDraftAddress: (value: string) => void;
  setSleepState: (id: TabId, state: TabState) => void;
}

const DEFAULT_URL = "https://duckduckgo.com/";

function createId(): string {
  return `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createTabRecord(url = DEFAULT_URL): MobileTab {
  return {
    id: createId(),
    url,
    title: "New Tab",
    favicon: null,
    state: "awake" as TabState,
    lastActive: Date.now(),
    snapshot: null,
    savedScrollY: 0,
    pinned: false,
    canGoBack: false,
    canGoForward: false,
    isLoading: true,
    reloadToken: 0
  };
}

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  draftAddress: DEFAULT_URL,
  createTab: (url = DEFAULT_URL) => {
    const tab = createTabRecord(url);
    set((state) => ({
      tabs: state.tabs.map((candidate) =>
        candidate.id === state.activeTabId && candidate.state !== "hard-sleeping"
          ? { ...candidate, state: "awake" as TabState }
          : candidate
      ).concat({ ...tab, state: "active" as TabState }),
      activeTabId: tab.id,
      draftAddress: url
    }));
    return tab.id;
  },
  closeTab: (id) =>
    set((state) => {
      const tabs = state.tabs.filter((tab) => tab.id !== id);
      if (state.activeTabId !== id) {
        return { tabs };
      }

      const next = tabs[tabs.length - 1] ?? null;
      const nextTabs = next
        ? tabs.map((tab) =>
            tab.id === next.id
              ? { ...tab, state: "active" as TabState, lastActive: Date.now() }
              : tab
          )
        : tabs;

      return {
        tabs: nextTabs,
        activeTabId: next?.id ?? null,
        draftAddress: next?.url ?? DEFAULT_URL
      };
    }),
  setActiveTab: (id) =>
    set((state) => {
      const tabs = state.tabs.map((tab) => {
        if (tab.id === state.activeTabId && tab.id !== id && tab.state !== "hard-sleeping") {
          return { ...tab, state: "awake" as TabState };
        }

        if (tab.id === id) {
          return {
            ...tab,
            state: "active" as TabState,
            lastActive: Date.now(),
            reloadToken: tab.state === "hard-sleeping" ? tab.reloadToken + 1 : tab.reloadToken
          };
        }

        return tab;
      });
      const next = tabs.find((tab) => tab.id === id);
      return {
        tabs,
        activeTabId: id,
        draftAddress: next?.url ?? state.draftAddress
      };
    }),
  updateTab: (id, patch) =>
    set((state) => {
      const tabs = state.tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab));
      const active = tabs.find((tab) => tab.id === state.activeTabId);
      return {
        tabs,
        draftAddress: active?.url ?? state.draftAddress
      };
    }),
  setDraftAddress: (value) =>
    set(() => ({
      draftAddress: value
    })),
  setSleepState: (id, stateValue) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id
          ? {
              ...tab,
              state: stateValue,
              reloadToken: stateValue === "hard-sleeping" ? tab.reloadToken + 1 : tab.reloadToken
            }
          : tab
      )
    }))
}));

export function getActiveTab() {
  const store = useBrowserStore.getState();
  return store.tabs.find((tab) => tab.id === store.activeTabId) ?? null;
}

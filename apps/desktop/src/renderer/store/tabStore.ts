import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { SerializedTab, TabId } from "@seans-browser/browser-core";

interface TabStore {
  tabs: SerializedTab[];
  activeTabId: TabId | null;
  setTabs: (tabs: SerializedTab[]) => void;
  setActiveTabId: (id: TabId | null) => void;
  addTab: (tab: SerializedTab) => void;
  removeTab: (id: TabId) => void;
  updateTab: (id: TabId, patch: Partial<SerializedTab>) => void;
}

export const useTabStore = create<TabStore>()(
  immer((set) => ({
    tabs: [],
    activeTabId: null,
    setTabs: (tabs) =>
      set((state) => {
        state.tabs = tabs;
        state.activeTabId = tabs.find((tab) => tab.state === "active")?.id ?? state.activeTabId;
      }),
    setActiveTabId: (id) =>
      set((state) => {
        state.activeTabId = id;
      }),
    addTab: (tab) =>
      set((state) => {
        const existing = state.tabs.find((candidate) => candidate.id === tab.id);
        if (existing) {
          Object.assign(existing, tab);
          return;
        }
        state.tabs.push(tab);
      }),
    removeTab: (id) =>
      set((state) => {
        state.tabs = state.tabs.filter((tab) => tab.id !== id);
        if (state.activeTabId === id) {
          state.activeTabId = state.tabs.find((tab) => tab.state === "active")?.id ?? null;
        }
      }),
    updateTab: (id, patch) =>
      set((state) => {
        const tab = state.tabs.find((candidate) => candidate.id === id);
        if (tab) {
          Object.assign(tab, patch);
          if (patch.state === "active") {
            state.activeTabId = id;
          }
        }
      })
  }))
);


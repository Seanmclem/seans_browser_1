import { startTransition, useEffect } from "react";
import type { SerializedTab } from "@seans-browser/browser-core";
import { useIPC } from "./useIPC";
import { useTabStore } from "../store/tabStore";
import { useUIStore } from "../store/uiStore";

export function useTabManager(): void {
  useEffect(() => {
    void window.browserAPI.tab.list().then((tabs) => {
      startTransition(() => {
        useTabStore.getState().setTabs(tabs);
      });
    });
  }, []);

  useIPC("tab:added", (tab) => {
    startTransition(() => {
      useTabStore.getState().addTab(tab as SerializedTab);
    });
  });

  useIPC("tab:updated", (tab) => {
    const typedTab = tab as SerializedTab;
    startTransition(() => {
      useTabStore.getState().updateTab(typedTab.id, typedTab);
    });
  });

  useIPC("tab:removed", (id) => {
    startTransition(() => {
      useTabStore.getState().removeTab(id as string);
    });
  });

  useIPC("tab:activated", (id) => {
    startTransition(() => {
      useTabStore.getState().setActiveTabId(id as string);
    });
  });

  useIPC("ui:focus-address-bar", () => {
    useUIStore.getState().focusAddressBar();
  });
}


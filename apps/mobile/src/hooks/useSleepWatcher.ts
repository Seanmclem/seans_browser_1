import { useEffect } from "react";
import { evaluateSleepState } from "@seans-browser/browser-core";
import { useBrowserStore } from "../store/browserStore";

const INTERVAL_MS = 60_000;

export function useSleepWatcher(): void {
  useEffect(() => {
    const run = () => {
      const store = useBrowserStore.getState();
      const totalTabCount = store.tabs.length;

      for (const tab of store.tabs) {
        if (tab.id === store.activeTabId || tab.pinned || tab.state === "crashed") {
          continue;
        }

        const decision = evaluateSleepState({
          isActive: false,
          isPinned: tab.pinned,
          totalTabCount,
          lastActive: tab.lastActive
        });

        if (decision.nextState && decision.nextState !== tab.state) {
          store.setSleepState(tab.id, decision.nextState);
        }
      }
    };

    run();
    const timer = setInterval(run, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
}


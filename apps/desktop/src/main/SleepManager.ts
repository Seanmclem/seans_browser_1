import { evaluateSleepState } from "@seans-browser/browser-core";
import { TabManager } from "./TabManager";

const WATCHER_INTERVAL_MS = 60_000;

export class SleepManager {
  private watcherTimer: NodeJS.Timeout | null = null;

  constructor(private readonly tabManager: TabManager) {}

  start(): void {
    this.stop();
    this.watcherTimer = setInterval(() => {
      void this.evaluate();
    }, WATCHER_INTERVAL_MS);
  }

  stop(): void {
    if (this.watcherTimer) {
      clearInterval(this.watcherTimer);
      this.watcherTimer = null;
    }
  }

  async evaluate(): Promise<void> {
    const tabs = this.tabManager.getTabs();
    const activeTabId = this.tabManager.getActiveTabId();
    const totalTabCount = tabs.length;

    for (const tab of tabs) {
      if (tab.id === activeTabId || tab.pinned || tab.state === "crashed") {
        continue;
      }

      const decision = evaluateSleepState({
        isActive: tab.id === activeTabId,
        isPinned: tab.pinned,
        totalTabCount,
        lastActive: tab.lastActive
      });

      if (decision.nextState === "hard-sleeping") {
        await this.tabManager.hardSleepTab(tab.id);
      } else if (decision.nextState === "soft-sleeping" && tab.state !== "soft-sleeping") {
        await this.tabManager.softSleepTab(tab.id);
      }
    }
  }

  async softSleep(id: string): Promise<void> {
    await this.tabManager.softSleepTab(id);
  }

  async hardSleep(id: string): Promise<void> {
    await this.tabManager.hardSleepTab(id);
  }

  async forceEscalateSoftSleepingTabs(): Promise<void> {
    for (const tab of this.tabManager.getTabs()) {
      if (tab.state === "soft-sleeping") {
        await this.tabManager.hardSleepTab(tab.id);
      }
    }
  }
}


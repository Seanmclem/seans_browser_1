import { BrowserWindow, WebContents } from "electron";
import type { OpenTabRecord, OpenTabsWindowRecord, ThemeState } from "@seans-browser/browser-core";
import type { BrowserDataManager } from "./BrowserDataManager";
import { HistoryManager } from "./HistoryManager";
import { HISTORY_PAGE_URL } from "./InternalPages";
import { SessionManager } from "./SessionManager";
import { SleepManager } from "./SleepManager";
import { TabManager } from "./TabManager";
import { WindowManager } from "./WindowManager";
import type { DetachedTab, TabStripPlacement } from "./types";

interface BrowserWindowControllerOptions {
  dataManager: BrowserDataManager;
  historyManager: HistoryManager;
  initialTabStripPlacement: TabStripPlacement;
  onClosed: (controller: BrowserWindowController) => void;
  onMoveTabToNewWindow: (controller: BrowserWindowController, tabId: string) => Promise<void>;
  sessionManager: SessionManager;
}

export class BrowserWindowController {
  readonly dataManager: BrowserDataManager;
  readonly historyManager: HistoryManager;
  readonly window: BrowserWindow;
  readonly windowManager: WindowManager;
  readonly tabManager: TabManager;
  readonly sleepManager: SleepManager;
  readonly chromeWebContents: WebContents;
  readonly chromeWebContentses: WebContents[];
  private readonly openTabsWindowRecord: OpenTabsWindowRecord;
  private isDisposed = false;
  private openTabsPersistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: BrowserWindowControllerOptions) {
    this.dataManager = options.dataManager;
    this.windowManager = new WindowManager(options.initialTabStripPlacement);
    this.openTabsWindowRecord = options.dataManager.openTabs.createOpenTabsWindow({
      placement: options.initialTabStripPlacement
    });
    this.historyManager = options.historyManager;
    this.window = this.windowManager.createMainWindow();
    this.chromeWebContents = this.windowManager.getChromeWebContents();
    this.chromeWebContentses = this.windowManager.getChromeWebContentses();
    this.tabManager = new TabManager(
      this.window,
      options.sessionManager,
      options.historyManager,
      () => {
        this.windowManager.bringChromeToFront();
      }
    );
    this.sleepManager = new SleepManager(this.tabManager);
    this.syncPageInsets();

    this.forwardTabEvents();
    this.registerWindowEvents();
    this.registerWindowShortcuts();
    this.sleepManager.start();
  }

  createInitialTab(): void {
    this.tabManager.createTab();
  }

  async adoptDetachedTab(detachedTab: DetachedTab): Promise<void> {
    await this.tabManager.adoptDetachedTab(detachedTab);
    this.window.focus();
  }

  async moveTabToNewWindow(tabId: string): Promise<void> {
    await this.options.onMoveTabToNewWindow(this, tabId);
  }

  setChromeHeight(height: number): void {
    this.windowManager.setChromeHeight(height);
    this.syncPageInsets();
  }

  setChromeOverlayHeight(height: number): void {
    this.windowManager.setChromeOverlayHeight(height);
  }

  setTabStripPlacement(placement: TabStripPlacement): void {
    this.windowManager.setTabStripPlacement(placement);
    this.syncPageInsets();
    void this.options.dataManager.setTabStripPlacement(placement);
    this.scheduleOpenTabsPersistence();
    this.sendToChrome("layout:tabStripPlacementChanged", placement);
  }

  getTabStripPlacement(): TabStripPlacement {
    return this.windowManager.getTabStripPlacement();
  }

  sendThemeState(themeState: ThemeState): void {
    this.sendToChrome("theme:changed", themeState);
  }

  private sendToChrome(channel: string, ...args: unknown[]): void {
    for (const contents of this.chromeWebContentses) {
      if (!contents.isDestroyed()) {
        contents.send(channel, ...args);
      }
    }
  }

  private syncPageInsets(): void {
    this.tabManager.setPageInsets(this.windowManager.getPageInsets());
  }

  private forwardTabEvents(): void {
    this.tabManager.on("tab:added", (tab) => {
      this.sendToChrome("tab:added", tab);
      this.scheduleOpenTabsPersistence();
    });
    this.tabManager.on("tab:updated", (tab) => {
      this.sendToChrome("tab:updated", tab);
      this.scheduleOpenTabsPersistence();
    });
    this.tabManager.on("tab:removed", (id) => {
      this.sendToChrome("tab:removed", id);
      this.scheduleOpenTabsPersistence();
    });
    this.tabManager.on("tab:activated", (id) => {
      this.sendToChrome("tab:activated", id);
      this.scheduleOpenTabsPersistence();
    });
    this.tabManager.on("tab:reordered", (tabs) => {
      this.sendToChrome("tab:reordered", tabs);
      this.scheduleOpenTabsPersistence();
    });
  }

  private registerWindowEvents(): void {
    this.window.on("resize", () => {
      this.windowManager.reflowViews();
      this.syncPageInsets();
    });
    this.window.on("close", () => {
      this.dispose();
    });
    this.window.on("closed", () => {
      this.dispose();
      this.options.onClosed(this);
    });
  }

  private dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    if (this.openTabsPersistTimer) {
      clearTimeout(this.openTabsPersistTimer);
      this.openTabsPersistTimer = null;
    }
    void this.persistOpenTabsSnapshot().catch((error: unknown) => {
      console.warn("[OpenTabs] Failed to persist final tab snapshot.", error);
    });
    this.sleepManager.stop();
    this.tabManager.destroyAllTabs();
  }

  private scheduleOpenTabsPersistence(): void {
    if (this.isDisposed) {
      return;
    }

    if (this.openTabsPersistTimer) {
      clearTimeout(this.openTabsPersistTimer);
    }

    this.openTabsPersistTimer = setTimeout(() => {
      this.openTabsPersistTimer = null;
      void this.persistOpenTabsSnapshot().catch((error: unknown) => {
        console.warn("[OpenTabs] Failed to persist tab snapshot.", error);
      });
    }, 150);
  }

  private async persistOpenTabsSnapshot(): Promise<void> {
    const now = new Date().toISOString();
    const tabs = this.tabManager.getSerializedTabs();
    const activeTabId = this.tabManager.getActiveTabId();
    const windowRecord: OpenTabsWindowRecord = {
      ...this.openTabsWindowRecord,
      activeTabId,
      placement: this.windowManager.getTabStripPlacement(),
      title: tabs.find((tab) => tab.id === activeTabId)?.title ?? null,
      sync: {
        ...this.openTabsWindowRecord.sync,
        deletedAt: null,
        updatedAt: now
      }
    };

    await this.options.dataManager.openTabs.upsertOpenTabsWindow(windowRecord);

    const existingTabs = new Map(
      (await this.options.dataManager.openTabs.listOpenTabs(this.openTabsWindowRecord.sync.id)).map(
        (tab) => [tab.sync.id, tab]
      )
    );
    const currentTabIds = new Set(tabs.map((tab) => tab.id));

    for (const [position, tab] of tabs.entries()) {
      const existing = existingTabs.get(tab.id);
      const record: OpenTabRecord = existing
        ? {
            ...existing,
            favicon: tab.favicon,
            lastActiveAt: new Date(tab.lastActive).toISOString(),
            pinned: tab.pinned,
            position,
            savedScrollY: tab.savedScrollY,
            state: tab.state,
            title: tab.title,
            url: tab.url,
            sync: {
              ...existing.sync,
              deletedAt: null,
              updatedAt: now
            }
          }
        : this.options.dataManager.openTabs.createOpenTab({
            favicon: tab.favicon,
            id: tab.id,
            lastActiveAt: new Date(tab.lastActive).toISOString(),
            pinned: tab.pinned,
            position,
            savedScrollY: tab.savedScrollY,
            state: tab.state,
            title: tab.title,
            url: tab.url,
            windowId: this.openTabsWindowRecord.sync.id
          });

      await this.options.dataManager.openTabs.upsertOpenTab(record);
    }

    for (const existing of existingTabs.values()) {
      if (!currentTabIds.has(existing.sync.id)) {
        await this.options.dataManager.openTabs.tombstoneOpenTab(existing.sync.id, now);
      }
    }
  }

  private registerWindowShortcuts(): void {
    for (const contents of this.chromeWebContentses) {
      contents.on("before-input-event", (event, input) => {
        if (input.type !== "keyDown") {
          return;
        }

        const isCommand = process.platform === "darwin" ? input.meta : input.control;
        const key = input.key.toLowerCase();

        if (!isCommand) {
          return;
        }

        if (key === "t") {
          event.preventDefault();
          this.tabManager.createTab();
          return;
        }

        if (key === "w") {
          event.preventDefault();
          void this.tabManager.closeActiveTab();
          return;
        }

        if (key === "l") {
          event.preventDefault();
          this.sendToChrome("ui:focus-address-bar");
          return;
        }

        if (key === "r") {
          event.preventDefault();
          const active = this.tabManager.getActiveTabId();
          if (active) {
            void this.tabManager.reload(active);
          }
          return;
        }

        if (key === "y") {
          event.preventDefault();
          this.tabManager.createTab(HISTORY_PAGE_URL);
          return;
        }

        if (key === "[") {
          event.preventDefault();
          const active = this.tabManager.getActiveTabId();
          if (active) {
            void this.tabManager.goBack(active);
          }
          return;
        }

        if (key === "]") {
          event.preventDefault();
          const active = this.tabManager.getActiveTabId();
          if (active) {
            void this.tabManager.goForward(active);
          }
          return;
        }

        if (key === "n") {
          event.preventDefault();
          const active = this.tabManager.getActiveTabId();
          if (active) {
            void this.options.onMoveTabToNewWindow(this, active);
          }
          return;
        }

        if (/^[1-9]$/.test(key)) {
          event.preventDefault();
          void this.tabManager.switchToTabAtIndex(Number(key) - 1);
        }
      });
    }
  }
}

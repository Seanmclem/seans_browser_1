import { BrowserWindow, WebContents } from "electron";
import { HistoryManager } from "./HistoryManager";
import { SessionManager } from "./SessionManager";
import { SleepManager } from "./SleepManager";
import { TabManager } from "./TabManager";
import { WindowManager } from "./WindowManager";
import type { DetachedTab } from "./types";

interface BrowserWindowControllerOptions {
  historyManager: HistoryManager;
  onClosed: (controller: BrowserWindowController) => void;
  onMoveTabToNewWindow: (controller: BrowserWindowController, tabId: string) => Promise<void>;
  sessionManager: SessionManager;
}

export class BrowserWindowController {
  readonly historyManager: HistoryManager;
  readonly window: BrowserWindow;
  readonly windowManager = new WindowManager();
  readonly tabManager: TabManager;
  readonly sleepManager: SleepManager;
  readonly chromeWebContents: WebContents;

  constructor(private readonly options: BrowserWindowControllerOptions) {
    this.historyManager = options.historyManager;
    this.window = this.windowManager.createMainWindow();
    this.chromeWebContents = this.windowManager.getChromeWebContents();
    this.tabManager = new TabManager(
      this.window,
      options.sessionManager,
      options.historyManager,
      () => {
        this.windowManager.bringChromeToFront();
      }
    );
    this.sleepManager = new SleepManager(this.tabManager);

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
    this.tabManager.setChromeHeight(height);
  }

  private sendToChrome(channel: string, ...args: unknown[]): void {
    if (!this.chromeWebContents.isDestroyed()) {
      this.chromeWebContents.send(channel, ...args);
    }
  }

  private forwardTabEvents(): void {
    this.tabManager.on("tab:added", (tab) => {
      this.sendToChrome("tab:added", tab);
    });
    this.tabManager.on("tab:updated", (tab) => {
      this.sendToChrome("tab:updated", tab);
    });
    this.tabManager.on("tab:removed", (id) => {
      this.sendToChrome("tab:removed", id);
    });
    this.tabManager.on("tab:activated", (id) => {
      this.sendToChrome("tab:activated", id);
    });
  }

  private registerWindowEvents(): void {
    this.window.on("resize", () => {
      this.windowManager.reflowViews();
      this.tabManager.reflowViews();
    });
    this.window.on("closed", () => {
      this.sleepManager.stop();
      this.options.onClosed(this);
    });
  }

  private registerWindowShortcuts(): void {
    this.chromeWebContents.on("before-input-event", (event, input) => {
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

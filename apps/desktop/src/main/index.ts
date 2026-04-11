import { app, BrowserWindow, WebContents } from "electron";
import { DownloadManager } from "./DownloadManager";
import { HistoryManager } from "./HistoryManager";
import { registerIPCHandlers } from "./IPCHandler";
import { SessionManager } from "./SessionManager";
import { SleepManager } from "./SleepManager";
import { TabManager } from "./TabManager";
import { WindowManager } from "./WindowManager";

let mainWindow: BrowserWindow | null = null;
let sleepManager: SleepManager | null = null;
let tabManager: TabManager | null = null;

app.commandLine.appendSwitch("js-flags", "--max-old-space-size=512");

async function createMainWindow(): Promise<void> {
  const windowManager = new WindowManager();
  const sessionManager = new SessionManager();
  const historyManager = new HistoryManager();

  new DownloadManager(sessionManager.getSession());

  mainWindow = windowManager.createMainWindow();
  const chromeWebContents = windowManager.getChromeWebContents();
  tabManager = new TabManager(mainWindow, sessionManager, historyManager, () => {
    windowManager.bringChromeToFront();
  });
  sleepManager = new SleepManager(tabManager);

  registerIPCHandlers(chromeWebContents, tabManager, sleepManager, historyManager, (height) => {
    windowManager.setChromeHeight(height);
  });

  mainWindow.on("resize", () => {
    windowManager.reflowViews();
    tabManager?.reflowViews();
  });
  mainWindow.on("closed", () => {
    sleepManager?.stop();
    mainWindow = null;
  });

  registerWindowShortcuts(chromeWebContents, tabManager);
  sleepManager.start();
  tabManager.createTab();
}

function registerWindowShortcuts(chromeWebContents: WebContents, tabs: TabManager): void {
  chromeWebContents.on("before-input-event", (event, input) => {
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
      tabs.createTab();
      return;
    }

    if (key === "w") {
      event.preventDefault();
      void tabs.closeActiveTab();
      return;
    }

    if (key === "l") {
      event.preventDefault();
      chromeWebContents.send("ui:focus-address-bar");
      return;
    }

    if (key === "r") {
      event.preventDefault();
      const active = tabs.getActiveTabId();
      if (active) {
        void tabs.reload(active);
      }
      return;
    }

    if (key === "[") {
      event.preventDefault();
      const active = tabs.getActiveTabId();
      if (active) {
        void tabs.goBack(active);
      }
      return;
    }

    if (key === "]") {
      event.preventDefault();
      const active = tabs.getActiveTabId();
      if (active) {
        void tabs.goForward(active);
      }
      return;
    }

    if (/^[1-9]$/.test(key)) {
      event.preventDefault();
      void tabs.switchToTabAtIndex(Number(key) - 1);
    }
  });
}

app.whenReady().then(() => {
  void createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on("render-process-gone", (_event, contents, details) => {
  console.warn(`[Electron] Renderer crashed: ${details.reason}`);
  tabManager?.markCrashedByWebContents(contents);
});

setInterval(() => {
  const heapUsedMb = process.memoryUsage().heapUsed / 1024 / 1024;
  if (heapUsedMb > 1500) {
    console.warn("[Memory] High pressure detected, escalating sleeping tabs.");
    void sleepManager?.forceEscalateSoftSleepingTabs();
  }
}, 30_000);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

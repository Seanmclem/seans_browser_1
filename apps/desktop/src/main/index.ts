import { app, BrowserWindow } from "electron";
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

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=512");
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");

async function createMainWindow(): Promise<void> {
  const windowManager = new WindowManager();
  const sessionManager = new SessionManager();
  const historyManager = new HistoryManager();

  new DownloadManager(sessionManager.getSession());

  mainWindow = windowManager.createMainWindow();
  tabManager = new TabManager(mainWindow, sessionManager, historyManager);
  sleepManager = new SleepManager(tabManager);

  registerIPCHandlers(mainWindow, tabManager, sleepManager, historyManager);

  mainWindow.on("resize", () => {
    tabManager?.reflowViews();
  });
  mainWindow.on("closed", () => {
    sleepManager?.stop();
    mainWindow = null;
  });

  registerWindowShortcuts(mainWindow, tabManager);
  sleepManager.start();
}

function registerWindowShortcuts(win: BrowserWindow, tabs: TabManager): void {
  win.webContents.on("before-input-event", (event, input) => {
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
      win.webContents.send("shortcut:new-tab");
      return;
    }

    if (key === "w") {
      event.preventDefault();
      win.webContents.send("shortcut:close-tab");
      return;
    }

    if (key === "l") {
      event.preventDefault();
      win.webContents.send("ui:focus-address-bar");
      return;
    }

    if (key === "r") {
      event.preventDefault();
      win.webContents.send("shortcut:reload");
      return;
    }

    if (key === "[") {
      event.preventDefault();
      win.webContents.send("shortcut:back");
      return;
    }

    if (key === "]") {
      event.preventDefault();
      win.webContents.send("shortcut:forward");
      return;
    }

    if (/^[1-9]$/.test(key)) {
      event.preventDefault();
      win.webContents.send("shortcut:switch-tab", Number(key) - 1);
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

import { app, BrowserWindow, WebContents } from "electron";
import { BrowserWindowController } from "./BrowserWindowController";
import { DownloadManager } from "./DownloadManager";
import { HistoryManager } from "./HistoryManager";
import { registerIPCHandlers } from "./IPCHandler";
import { SessionManager } from "./SessionManager";

app.commandLine.appendSwitch("js-flags", "--max-old-space-size=512");

const WINDOW_CASCADE_OFFSET = 32;
const windowControllers = new Map<number, BrowserWindowController>();
const windowControllersByWindowId = new Map<number, BrowserWindowController>();
let sessionManager: SessionManager;
let historyManager: HistoryManager;

interface CreateMainWindowOptions {
  createDefaultTab?: boolean;
}

function createMainWindow(options: CreateMainWindowOptions = {}): BrowserWindowController {
  const controller = new BrowserWindowController({
    historyManager,
    sessionManager,
    onClosed: (closedController) => {
      for (const contents of closedController.chromeWebContentses) {
        windowControllers.delete(contents.id);
      }
      windowControllersByWindowId.delete(closedController.window.id);
    },
    onMoveTabToNewWindow: moveTabToNewWindow
  });
  for (const contents of controller.chromeWebContentses) {
    windowControllers.set(contents.id, controller);
  }
  windowControllersByWindowId.set(controller.window.id, controller);

  if (options.createDefaultTab !== false) {
    controller.createInitialTab();
  }

  return controller;
}

async function moveTabToNewWindow(
  sourceController: BrowserWindowController,
  tabId: string
): Promise<void> {
  const detachedTab = await sourceController.tabManager.detachTab(tabId);
  if (!detachedTab) {
    return;
  }

  const targetController = createMainWindow({ createDefaultTab: false });
  const [sourceX, sourceY] = sourceController.window.getPosition();
  targetController.window.setPosition(
    sourceX + WINDOW_CASCADE_OFFSET,
    sourceY + WINDOW_CASCADE_OFFSET
  );
  await targetController.adoptDetachedTab(detachedTab);

  if (sourceController.tabManager.getTabs().length === 0) {
    sourceController.window.close();
  }

  targetController.window.focus();
}

function getControllerForSender(sender: WebContents): BrowserWindowController | undefined {
  const controller = windowControllers.get(sender.id);
  if (controller) {
    return controller;
  }

  const win = BrowserWindow.fromWebContents(sender);
  return win ? windowControllersByWindowId.get(win.id) : undefined;
}

function getUniqueControllers(): BrowserWindowController[] {
  return Array.from(new Set(windowControllers.values()));
}

app.whenReady().then(() => {
  sessionManager = new SessionManager();
  historyManager = new HistoryManager();
  new DownloadManager(sessionManager.getSession());
  registerIPCHandlers(getControllerForSender);
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("render-process-gone", (_event, contents, details) => {
  console.warn(`[Electron] Renderer crashed: ${details.reason}`);
  for (const controller of getUniqueControllers()) {
    controller.tabManager.markCrashedByWebContents(contents);
  }
});

setInterval(() => {
  const heapUsedMb = process.memoryUsage().heapUsed / 1024 / 1024;
  if (heapUsedMb > 1500) {
    console.warn("[Memory] High pressure detected, escalating sleeping tabs.");
    for (const controller of getUniqueControllers()) {
      void controller.sleepManager.forceEscalateSoftSleepingTabs();
    }
  }
}, 30_000);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

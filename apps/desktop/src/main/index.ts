import { app, BrowserWindow, nativeTheme, protocol, WebContents } from "electron";
import type { ResolvedTheme, ThemePreference, ThemeState } from "@seans-browser/browser-core";
import { BrowserDataManager } from "./BrowserDataManager";
import { BrowserWindowController } from "./BrowserWindowController";
import { DownloadManager } from "./DownloadManager";
import { INTERNAL_PAGE_SCHEME, registerInternalPages } from "./InternalPages";
import { registerIPCHandlers } from "./IPCHandler";
import { SessionManager } from "./SessionManager";

app.commandLine.appendSwitch("js-flags", "--max-old-space-size=512");
protocol.registerSchemesAsPrivileged([
  {
    scheme: INTERNAL_PAGE_SCHEME,
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true
    }
  }
]);

const WINDOW_CASCADE_OFFSET = 32;
const windowControllers = new Map<number, BrowserWindowController>();
const windowControllersByWindowId = new Map<number, BrowserWindowController>();
let dataManager: BrowserDataManager;
let sessionManager: SessionManager;

interface CreateMainWindowOptions {
  createDefaultTab?: boolean;
}

async function createMainWindow(
  options: CreateMainWindowOptions = {}
): Promise<BrowserWindowController> {
  const controller = new BrowserWindowController({
    dataManager,
    historyManager: dataManager.history,
    initialTabStripPlacement: await dataManager.getTabStripPlacement(),
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

  void getThemeState().then((themeState) => controller.sendThemeState(themeState));

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

  const targetController = await createMainWindow({ createDefaultTab: false });
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

async function getThemeState(): Promise<ThemeState> {
  const preference = await dataManager.getThemePreference();
  return {
    preference,
    resolvedTheme: resolveTheme(preference)
  };
}

async function setThemePreference(preference: ThemePreference): Promise<ThemeState> {
  await dataManager.setThemePreference(preference);
  const themeState = await getThemeState();
  broadcastThemeState(themeState);
  return themeState;
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "light" || preference === "dark") {
    return preference;
  }

  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

function broadcastThemeState(themeState: ThemeState): void {
  for (const controller of getUniqueControllers()) {
    controller.sendThemeState(themeState);
  }
}

app.whenReady().then(() => {
  sessionManager = new SessionManager();
  dataManager = new BrowserDataManager();
  registerInternalPages(sessionManager.getSession(), dataManager, {
    onThemePreferenceChanged: () => {
      void getThemeState().then(broadcastThemeState);
    }
  });
  new DownloadManager(sessionManager.getSession());
  registerIPCHandlers(getControllerForSender, {
    getThemeState,
    setThemePreference
  });
  void createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

nativeTheme.on("updated", () => {
  if (!dataManager) {
    return;
  }

  void getThemeState().then(broadcastThemeState);
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

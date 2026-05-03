import { app, BrowserWindow, nativeTheme, protocol, WebContents } from "electron";
import type {
  OpenTabsWindowRecord,
  ResolvedTheme,
  ThemePreference,
  ThemeState
} from "@seans-browser/browser-core";
import { BrowserDataManager } from "./BrowserDataManager";
import { BrowserWindowController } from "./BrowserWindowController";
import { DownloadManager } from "./DownloadManager";
import { DOWNLOADS_PAGE_URL, INTERNAL_PAGE_SCHEME, registerInternalPages } from "./InternalPages";
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
let downloadManager: DownloadManager;
let sessionManager: SessionManager;
let preserveSessionOnClose = false;

interface CreateMainWindowOptions {
  createDefaultTab?: boolean;
  existingOpenTabsWindowRecord?: OpenTabsWindowRecord;
  initialTabStripPlacement?: "top" | "left" | "right";
}

async function createMainWindow(
  options: CreateMainWindowOptions = {}
): Promise<BrowserWindowController> {
  const controller = new BrowserWindowController({
    dataManager,
    existingOpenTabsWindowRecord: options.existingOpenTabsWindowRecord,
    historyManager: dataManager.history,
    initialTabStripPlacement:
      options.initialTabStripPlacement ?? (await dataManager.getTabStripPlacement()),
    sessionManager,
    onClosed: (closedController) => {
      for (const contents of closedController.chromeWebContentses) {
        windowControllers.delete(contents.id);
      }
      windowControllersByWindowId.delete(closedController.window.id);
    },
    onMoveTabToNewWindow: moveTabToNewWindow,
    preserveSessionOnClose: () => preserveSessionOnClose
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
  downloadManager = new DownloadManager(sessionManager.getSession(), () => {
    for (const controller of getUniqueControllers()) {
      controller.tabManager.reloadDownloadsPages();
      controller.notifyDownloadsChanged();
    }
  });
  registerInternalPages(sessionManager.getSession(), dataManager, downloadManager, {
    onFavoritesBarVisibilityChanged: (visibility) => {
      for (const controller of getUniqueControllers()) {
        controller.notifyFavoritesBarVisibilityChanged(visibility);
      }
    },
    onThemePreferenceChanged: () => {
      void getThemeState().then(broadcastThemeState);
    }
  });
  registerIPCHandlers(getControllerForSender, {
    getDownloadEntries: () => downloadManager.listDownloads(),
    getFavoritesBarVisibility: () => dataManager.getFavoritesBarVisibility(),
    hasRestorableSession: hasRestorableSession,
    openDownloadsPage: () => {
      for (const controller of getUniqueControllers()) {
        if (controller.window.isFocused()) {
          controller.tabManager.createTab(DOWNLOADS_PAGE_URL);
          return;
        }
      }

      const [controller] = getUniqueControllers();
      controller?.tabManager.createTab(DOWNLOADS_PAGE_URL);
    },
    restoreLastSession: restoreLastSession,
    setFavoritesBarVisibility: async (visibility) => {
      await dataManager.setFavoritesBarVisibility(visibility);
      for (const controller of getUniqueControllers()) {
        controller.notifyFavoritesBarVisibilityChanged(visibility);
      }
      return visibility;
    },
    getThemeState,
    setThemePreference
  });
  void restoreSessionOnLaunch();

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

app.on("before-quit", () => {
  preserveSessionOnClose = BrowserWindow.getAllWindows().length > 0;
  dataManager?.setRestoreSessionOnNextLaunch(preserveSessionOnClose);
});

async function restoreSessionOnLaunch(): Promise<void> {
  if (await hasRestorableSession()) {
    const restored = await restoreLastSession();
    if (restored > 0) {
      dataManager.setRestoreSessionOnNextLaunch(false);
      preserveSessionOnClose = false;
      return;
    }
  }

  await createMainWindow();
  dataManager.setRestoreSessionOnNextLaunch(false);
  preserveSessionOnClose = false;
}

async function hasRestorableSession(): Promise<boolean> {
  if (!dataManager.shouldRestoreSessionOnNextLaunch()) {
    return false;
  }

  const windows = await dataManager.openTabs.listOpenTabsWindows();
  for (const windowRecord of windows) {
    const tabs = await dataManager.openTabs.listOpenTabs(windowRecord.sync.id);
    if (tabs.length > 0) {
      return true;
    }
  }

  return false;
}

async function restoreLastSession(): Promise<number> {
  const windows = await dataManager.openTabs.listOpenTabsWindows();
  if (windows.length === 0) {
    return 0;
  }

  let restoredWindows = 0;

  for (const windowRecord of windows) {
    const tabs = await dataManager.openTabs.listOpenTabs(windowRecord.sync.id);
    if (tabs.length === 0) {
      continue;
    }

    const controller = await createMainWindow({
      createDefaultTab: false,
      existingOpenTabsWindowRecord: windowRecord,
      initialTabStripPlacement: windowRecord.placement
    });
    const restored = await controller.restoreOpenTabsWindow(tabs, windowRecord.activeTabId);
    if (restored) {
      restoredWindows += 1;
    }
  }

  return restoredWindows;
}

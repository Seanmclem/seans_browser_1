import { IpcMainInvokeEvent, Menu, WebContents, ipcMain } from "electron";
import { normalizeURL, type ThemePreference, type ThemeState } from "@seans-browser/browser-core";
import { BrowserWindowController } from "./BrowserWindowController";
import type { FavoritesBarVisibility } from "./BrowserDataManager";
import type { DownloadEntry } from "./DownloadManager";
import type { SqliteFavoritesRepository } from "./data/SqliteFavoritesRepository";
import {
  FAVORITES_PAGE_URL,
  HISTORY_PAGE_URL,
  SETTINGS_PAGE_URL,
  isInternalPageUrl
} from "./InternalPages";
import type { TabDropPlacement, TabStripPlacement } from "./types";

type ControllerResolver = (sender: WebContents) => BrowserWindowController | undefined;
interface IPCHandlerOptions {
  getDownloadEntries: () => DownloadEntry[];
  getFavoritesBarVisibility: () => Promise<FavoritesBarVisibility>;
  hasRestorableSession: () => Promise<boolean>;
  openDownloadsPage: () => void;
  restoreLastSession: () => Promise<number>;
  setFavoritesBarVisibility: (visibility: FavoritesBarVisibility) => Promise<FavoritesBarVisibility>;
  getThemeState: () => Promise<ThemeState>;
  setThemePreference: (preference: ThemePreference) => Promise<ThemeState>;
}
interface ContextMenuPosition {
  x: number;
  y: number;
}

interface AddFavoriteInput {
  favicon?: string | null;
  parentFolderId?: string | null;
  title: string;
  url: string;
}

interface CreateFavoriteFolderInput {
  parentFolderId?: string | null;
  title: string;
}

export function registerIPCHandlers(
  resolveController: ControllerResolver,
  options: IPCHandlerOptions
): void {
  const tabDragSessions = new Map<
    string,
    {
      consumed: boolean;
      sourceController: BrowserWindowController;
      tabId: string;
    }
  >();

  const getController = (event: IpcMainInvokeEvent): BrowserWindowController => {
    const controller = resolveController(event.sender);
    if (!controller) {
      throw new Error(`No browser window controller for WebContents ${event.sender.id}`);
    }
    return controller;
  };

  ipcMain.handle("browser:moveActiveTabToNewWindow", async (event) => {
    const controller = getController(event);
    const activeTabId = controller.tabManager.getActiveTabId();
    if (activeTabId) {
      await controller.moveTabToNewWindow(activeTabId);
    }
  });
  ipcMain.handle("browser:sleepActiveTab", async (event) => {
    const controller = getController(event);
    const activeTabId = controller.tabManager.getActiveTabId();
    if (activeTabId) {
      await controller.sleepManager.softSleep(activeTabId);
    }
  });
  ipcMain.handle("browser:closeActiveTab", async (event) => {
    await getController(event).tabManager.closeActiveTab();
  });
  ipcMain.handle("browser:getFavoriteStatus", async (event, url: string) => {
    if (!url || url.startsWith("about:") || isInternalPageUrl(url)) {
      return { favoriteId: null, isFavorited: false };
    }

    const favorite = await getController(event).dataManager.favorites.getFavoriteByNormalizedUrl(
      normalizeURL(url)
    );
    return {
      favoriteId: favorite?.sync.id ?? null,
      isFavorited: Boolean(favorite)
    };
  });
  ipcMain.handle("browser:addFavorite", async (event, input: AddFavoriteInput) => {
    const controller = getController(event);
    const title = input.title.trim();
    const url = input.url.trim();

    if (!title || !url || url.startsWith("about:") || isInternalPageUrl(url)) {
      return null;
    }

    const favorite = controller.dataManager.favorites.createFavorite({
      favicon: input.favicon ?? null,
      parentFolderId: input.parentFolderId ?? null,
      sortOrder: Date.now(),
      title,
      url
    });
    await controller.dataManager.favorites.upsertFavorite(favorite);
    controller.tabManager.reloadFavoritesPages();
    controller.notifyFavoritesChanged();
    return favorite.sync.id;
  });
  ipcMain.handle("browser:toggleFavorite", async (event, input: AddFavoriteInput) => {
    const controller = getController(event);
    const url = input.url.trim();
    const normalizedUrl = normalizeURL(url);
    const existing = await controller.dataManager.favorites.getFavoriteByNormalizedUrl(normalizedUrl);

    if (existing) {
      await controller.dataManager.favorites.tombstoneFavorite(
        existing.sync.id,
        new Date().toISOString()
      );
      controller.tabManager.reloadFavoritesPages();
      controller.notifyFavoritesChanged();
      return { favoriteId: null, isFavorited: false };
    }

    const favorite = controller.dataManager.favorites.createFavorite({
      favicon: input.favicon ?? null,
      parentFolderId: input.parentFolderId ?? null,
      sortOrder: Date.now(),
      title: input.title.trim() || url,
      url
    });
    await controller.dataManager.favorites.upsertFavorite(favorite);
    controller.tabManager.reloadFavoritesPages();
    controller.notifyFavoritesChanged();
    return { favoriteId: favorite.sync.id, isFavorited: true };
  });
  ipcMain.handle("browser:createFavoriteFolder", async (event, input: CreateFavoriteFolderInput) => {
    const title = input.title.trim();
    if (!title) {
      return null;
    }

    const controller = getController(event);
    const folder = controller.dataManager.favorites.createFavoriteFolder({
      parentFolderId: input.parentFolderId ?? null,
      sortOrder: Date.now(),
      title
    });
    await controller.dataManager.favorites.upsertFavoriteFolder(folder);
    controller.tabManager.reloadFavoritesPages();
    controller.notifyFavoritesChanged();
    return {
      id: folder.sync.id,
      label: folder.title,
      parentFolderId: folder.parentFolderId,
      title: folder.title
    };
  });
  ipcMain.handle("browser:listFavoriteFolders", async (event) => {
    const folders = await listFavoriteFolderOptions(getController(event).dataManager.favorites);
    return folders.map((folder) => ({
      id: folder.sync.id,
      label: folder.label,
      parentFolderId: folder.parentFolderId,
      title: folder.title
    }));
  });
  ipcMain.handle("browser:listFavoritesBarItems", async (event) => {
    const controller = getController(event);
    const [folders, favorites] = await Promise.all([
      controller.dataManager.favorites.listFavoriteFolders(null),
      controller.dataManager.favorites.listFavorites(null)
    ]);
    return [
      ...folders.map((folder) => ({
        id: folder.sync.id,
        title: folder.title,
        type: "folder" as const,
        url: `${FAVORITES_PAGE_URL}?folder=${encodeURIComponent(folder.sync.id)}`
      })),
      ...favorites.map((favorite) => ({
        favicon: favorite.favicon,
        id: favorite.sync.id,
        title: favorite.title || favorite.url,
        type: "favorite" as const,
        url: favorite.url
      }))
    ];
  });
  ipcMain.handle("browser:openFavorites", (event) => {
    getController(event).tabManager.createTab(FAVORITES_PAGE_URL);
  });
  ipcMain.handle("browser:openDownloads", () => {
    options.openDownloadsPage();
  });
  ipcMain.handle("browser:openHistory", (event) => {
    getController(event).tabManager.createTab(HISTORY_PAGE_URL);
  });
  ipcMain.handle("browser:openSettings", (event) => {
    getController(event).tabManager.createTab(SETTINGS_PAGE_URL);
  });
  ipcMain.handle("browser:listDownloads", () => options.getDownloadEntries());
  ipcMain.handle("browser:hasRestorableSession", () => options.hasRestorableSession());
  ipcMain.handle("browser:restoreLastSession", () => options.restoreLastSession());

  ipcMain.handle("tab:create", async (event, url?: string) => {
    return getController(event).tabManager.createTab(url);
  });
  ipcMain.handle("tab:close", async (event, id: string) => {
    await getController(event).tabManager.closeTab(id);
  });
  ipcMain.handle("tab:activate", async (event, id: string) => {
    await getController(event).tabManager.setActiveTab(id);
  });
  ipcMain.handle("tab:list", (event) => getController(event).tabManager.getSerializedTabs());
  ipcMain.handle("tab:sleep", async (event, id: string) => {
    await getController(event).sleepManager.softSleep(id);
  });
  ipcMain.handle("tab:setPinned", (event, id: string, pinned: boolean) => {
    getController(event).tabManager.setPinned(id, pinned);
  });
  ipcMain.handle("tab:moveToNewWindow", async (event, id: string) => {
    await getController(event).moveTabToNewWindow(id);
  });
  ipcMain.handle(
    "tab:move",
    (event, id: string, targetId: string | null, placement: TabDropPlacement) => {
      getController(event).tabManager.moveTab(id, targetId, placement);
    }
  );
  ipcMain.handle("tab:beginDrag", (event, token: string, id: string) => {
    tabDragSessions.set(token, {
      consumed: false,
      sourceController: getController(event),
      tabId: id
    });
  });
  ipcMain.handle(
    "tab:dropDragged",
    async (event, token: string, targetId: string | null, placement: TabDropPlacement) => {
      const dragSession = tabDragSessions.get(token);
      if (!dragSession) {
        return;
      }

      dragSession.consumed = true;
      const targetController = getController(event);

      if (dragSession.sourceController === targetController) {
        targetController.tabManager.moveTab(dragSession.tabId, targetId, placement);
        return;
      }

      const detachedTab = await dragSession.sourceController.tabManager.detachTab(
        dragSession.tabId
      );
      if (!detachedTab) {
        return;
      }

      await targetController.tabManager.adoptDetachedTab(detachedTab, targetId, placement);
      targetController.window.focus();

      if (dragSession.sourceController.tabManager.getTabs().length === 0) {
        dragSession.sourceController.window.close();
      }
    }
  );
  ipcMain.handle("tab:endDrag", async (_event, token: string) => {
    const dragSession = tabDragSessions.get(token);
    if (!dragSession) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 80));
    tabDragSessions.delete(token);

    if (!dragSession.consumed) {
      await dragSession.sourceController.moveTabToNewWindow(dragSession.tabId);
    }
  });
  ipcMain.handle(
    "tab:showContextMenu",
    (event, id: string, position: ContextMenuPosition) => {
      const controller = getController(event);
      const tab = controller.tabManager.getTab(id);
      if (!tab) {
        return;
      }

      const menu = Menu.buildFromTemplate([
        {
          label: tab.pinned ? "Unpin Tab" : "Pin Tab",
          click: () => {
            controller.tabManager.setPinned(id, !tab.pinned);
          }
        },
        {
          label: "Move Tab to New Window",
          click: () => {
            void controller.moveTabToNewWindow(id);
          }
        },
        {
          label: "Reload Tab",
          click: () => {
            void controller.tabManager.reload(id);
          }
        },
        {
          enabled:
            tab.state !== "soft-sleeping" &&
            tab.state !== "hard-sleeping" &&
            tab.state !== "crashed" &&
            (controller.tabManager.getActiveTabId() !== id ||
              controller.tabManager.getTabs().length > 1),
          label: "Sleep Tab",
          click: () => {
            void controller.tabManager.userSleepTab(id);
          }
        },
        { type: "separator" },
        {
          label: "Close Tab",
          click: () => {
            void controller.tabManager.closeTab(id);
          }
        }
      ]);

      menu.popup({
        window: controller.window,
        x: Math.round(position.x),
        y: Math.round(position.y)
      });
    }
  );

  ipcMain.handle("nav:back", async (event, id: string) => {
    await getController(event).tabManager.goBack(id);
  });
  ipcMain.handle("nav:forward", async (event, id: string) => {
    await getController(event).tabManager.goForward(id);
  });
  ipcMain.handle("nav:reload", async (event, id: string) => {
    await getController(event).tabManager.reload(id);
  });
  ipcMain.handle("nav:stop", async (event, id: string) => {
    await getController(event).tabManager.stopLoading(id);
  });
  ipcMain.handle("nav:loadURL", async (event, id: string, url: string) => {
    await getController(event).tabManager.navigateTo(id, url);
  });

  ipcMain.handle("history:search", (event, query: string) =>
    getController(event).historyManager.search(query)
  );
  ipcMain.handle("layout:setChromeHeight", (event, height: number) => {
    getController(event).setChromeHeight(height);
  });
  ipcMain.handle("layout:setChromeOverlayHeight", (event, height: number) => {
    getController(event).setChromeOverlayHeight(height);
  });
  ipcMain.handle("layout:getTabStripPlacement", (event) =>
    getController(event).getTabStripPlacement()
  );
  ipcMain.handle("layout:setTabStripPlacement", (event, placement: TabStripPlacement) => {
    if (!["top", "left", "right"].includes(placement)) {
      return;
    }
    getController(event).setTabStripPlacement(placement);
  });
  ipcMain.handle("layout:getFavoritesBarVisibility", () => options.getFavoritesBarVisibility());
  ipcMain.handle("layout:setFavoritesBarVisibility", (_event, visibility: FavoritesBarVisibility) => {
    if (!["always", "never"].includes(visibility)) {
      return options.getFavoritesBarVisibility();
    }

    return options.setFavoritesBarVisibility(visibility);
  });
  ipcMain.handle("theme:getState", () => options.getThemeState());
  ipcMain.handle("theme:setPreference", (_event, preference: ThemePreference) => {
    if (!["system", "light", "dark"].includes(preference)) {
      return options.getThemeState();
    }
    return options.setThemePreference(preference);
  });
}

interface FavoriteFolderOption {
  label: string;
  parentFolderId: string | null;
  sync: { id: string };
  title: string;
}

async function listFavoriteFolderOptions(
  repository: SqliteFavoritesRepository,
  parentFolderId: string | null = null,
  prefix = ""
): Promise<FavoriteFolderOption[]> {
  const folders = await repository.listFavoriteFolders(parentFolderId);
  const options: FavoriteFolderOption[] = [];

  for (const folder of folders) {
    const label = `${prefix}${folder.title}`;
    options.push({
      label,
      parentFolderId: folder.parentFolderId,
      sync: folder.sync,
      title: folder.title
    });
    options.push(...(await listFavoriteFolderOptions(repository, folder.sync.id, `${label} / `)));
  }

  return options;
}

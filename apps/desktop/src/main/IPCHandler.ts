import { IpcMainInvokeEvent, Menu, WebContents, ipcMain } from "electron";
import { BrowserWindowController } from "./BrowserWindowController";
import { FAVORITES_PAGE_URL, HISTORY_PAGE_URL, isInternalPageUrl } from "./InternalPages";
import type { TabDropPlacement, TabStripPlacement } from "./types";

type ControllerResolver = (sender: WebContents) => BrowserWindowController | undefined;
interface ContextMenuPosition {
  x: number;
  y: number;
}

export function registerIPCHandlers(resolveController: ControllerResolver): void {
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
  ipcMain.handle("browser:addActiveTabToFavorites", async (event) => {
    const controller = getController(event);
    const activeTab = controller.tabManager.getActiveTab();
    if (!activeTab || activeTab.url.startsWith("about:") || isInternalPageUrl(activeTab.url)) {
      return null;
    }

    const favorite = controller.dataManager.favorites.createFavorite({
      favicon: activeTab.favicon,
      sortOrder: Date.now(),
      title: activeTab.title,
      url: activeTab.url
    });
    await controller.dataManager.favorites.upsertFavorite(favorite);
    return favorite.sync.id;
  });
  ipcMain.handle("browser:openFavorites", (event) => {
    getController(event).tabManager.createTab(FAVORITES_PAGE_URL);
  });
  ipcMain.handle("browser:openHistory", (event) => {
    getController(event).tabManager.createTab(HISTORY_PAGE_URL);
  });

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
          enabled: controller.tabManager.getActiveTabId() !== id,
          label: "Sleep Tab",
          click: () => {
            void controller.sleepManager.softSleep(id);
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
}

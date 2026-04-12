import { IpcMainInvokeEvent, Menu, WebContents, ipcMain } from "electron";
import { BrowserWindowController } from "./BrowserWindowController";

type ControllerResolver = (sender: WebContents) => BrowserWindowController | undefined;
interface ContextMenuPosition {
  x: number;
  y: number;
}

export function registerIPCHandlers(resolveController: ControllerResolver): void {
  const getController = (event: IpcMainInvokeEvent): BrowserWindowController => {
    const controller = resolveController(event.sender);
    if (!controller) {
      throw new Error(`No browser window controller for WebContents ${event.sender.id}`);
    }
    return controller;
  };

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
}

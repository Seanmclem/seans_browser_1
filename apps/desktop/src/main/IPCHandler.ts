import { BrowserWindow, ipcMain } from "electron";
import { HistoryManager } from "./HistoryManager";
import { SleepManager } from "./SleepManager";
import { TabManager } from "./TabManager";

export function registerIPCHandlers(
  win: BrowserWindow,
  tabManager: TabManager,
  sleepManager: SleepManager,
  historyManager: HistoryManager
): void {
  tabManager.on("tab:added", (tab) => {
    win.webContents.send("tab:added", tab);
  });
  tabManager.on("tab:updated", (tab) => {
    win.webContents.send("tab:updated", tab);
  });
  tabManager.on("tab:removed", (id) => {
    win.webContents.send("tab:removed", id);
  });
  tabManager.on("tab:activated", (id) => {
    win.webContents.send("tab:activated", id);
  });

  ipcMain.handle("tab:create", async (_event, url?: string) => {
    return tabManager.createTab(url);
  });
  ipcMain.handle("tab:close", async (_event, id: string) => {
    await tabManager.closeTab(id);
  });
  ipcMain.handle("tab:activate", async (_event, id: string) => {
    await tabManager.setActiveTab(id);
  });
  ipcMain.handle("tab:list", () => tabManager.getSerializedTabs());
  ipcMain.handle("tab:sleep", async (_event, id: string) => {
    await sleepManager.softSleep(id);
  });

  ipcMain.handle("nav:back", async (_event, id: string) => {
    await tabManager.goBack(id);
  });
  ipcMain.handle("nav:forward", async (_event, id: string) => {
    await tabManager.goForward(id);
  });
  ipcMain.handle("nav:reload", async (_event, id: string) => {
    await tabManager.reload(id);
  });
  ipcMain.handle("nav:loadURL", async (_event, id: string, url: string) => {
    await tabManager.navigateTo(id, url);
  });

  ipcMain.handle("history:search", (_event, query: string) => historyManager.search(query));
  ipcMain.handle("layout:setChromeHeight", (_event, height: number) => {
    tabManager.setChromeHeight(height);
  });
}

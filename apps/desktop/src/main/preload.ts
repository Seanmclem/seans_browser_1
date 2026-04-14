import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import type { SerializedTab, TabId } from "@seans-browser/browser-core";

type Listener = (...args: unknown[]) => void;
type TabStripPlacement = "top" | "left" | "right";

const subscriptions = new Map<Listener, (event: IpcRendererEvent, ...args: unknown[]) => void>();

contextBridge.exposeInMainWorld("browserAPI", {
  tab: {
    create: (url?: string): Promise<TabId> => ipcRenderer.invoke("tab:create", url),
    close: (id: TabId): Promise<void> => ipcRenderer.invoke("tab:close", id),
    activate: (id: TabId): Promise<void> => ipcRenderer.invoke("tab:activate", id),
    list: (): Promise<SerializedTab[]> => ipcRenderer.invoke("tab:list"),
    beginDrag: (token: string, id: TabId): Promise<void> =>
      ipcRenderer.invoke("tab:beginDrag", token, id),
    dropDragged: (
      token: string,
      targetId: TabId | null,
      placement: "before" | "after" | "end"
    ): Promise<void> => ipcRenderer.invoke("tab:dropDragged", token, targetId, placement),
    endDrag: (token: string): Promise<void> => ipcRenderer.invoke("tab:endDrag", token),
    move: (
      id: TabId,
      targetId: TabId | null,
      placement: "before" | "after" | "end"
    ): Promise<void> => ipcRenderer.invoke("tab:move", id, targetId, placement),
    moveToNewWindow: (id: TabId): Promise<void> => ipcRenderer.invoke("tab:moveToNewWindow", id),
    showContextMenu: (id: TabId, position: { x: number; y: number }): Promise<void> =>
      ipcRenderer.invoke("tab:showContextMenu", id, position),
    sleep: (id: TabId): Promise<void> => ipcRenderer.invoke("tab:sleep", id)
  },
  nav: {
    back: (id: TabId): Promise<void> => ipcRenderer.invoke("nav:back", id),
    forward: (id: TabId): Promise<void> => ipcRenderer.invoke("nav:forward", id),
    reload: (id: TabId): Promise<void> => ipcRenderer.invoke("nav:reload", id),
    loadURL: (id: TabId, url: string): Promise<void> => ipcRenderer.invoke("nav:loadURL", id, url)
  },
  history: {
    search: (query: string) => ipcRenderer.invoke("history:search", query)
  },
  browser: {
    addActiveTabToFavorites: (): Promise<string | null> =>
      ipcRenderer.invoke("browser:addActiveTabToFavorites"),
    closeActiveTab: (): Promise<void> => ipcRenderer.invoke("browser:closeActiveTab"),
    moveActiveTabToNewWindow: (): Promise<void> =>
      ipcRenderer.invoke("browser:moveActiveTabToNewWindow"),
    openFavorites: (): Promise<void> => ipcRenderer.invoke("browser:openFavorites"),
    openHistory: (): Promise<void> => ipcRenderer.invoke("browser:openHistory"),
    sleepActiveTab: (): Promise<void> => ipcRenderer.invoke("browser:sleepActiveTab")
  },
  layout: {
    getTabStripPlacement: (): Promise<TabStripPlacement> =>
      ipcRenderer.invoke("layout:getTabStripPlacement"),
    setChromeHeight: (height: number): Promise<void> =>
      ipcRenderer.invoke("layout:setChromeHeight", height),
    setChromeOverlayHeight: (height: number): Promise<void> =>
      ipcRenderer.invoke("layout:setChromeOverlayHeight", height),
    setTabStripPlacement: (placement: TabStripPlacement): Promise<void> =>
      ipcRenderer.invoke("layout:setTabStripPlacement", placement)
  },
  on: (channel: string, callback: Listener): void => {
    const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => callback(...args);
    subscriptions.set(callback, wrapped);
    ipcRenderer.on(channel, wrapped);
  },
  off: (channel: string, callback: Listener): void => {
    const wrapped = subscriptions.get(callback);
    if (wrapped) {
      ipcRenderer.removeListener(channel, wrapped);
      subscriptions.delete(callback);
    }
  }
});

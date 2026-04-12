import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import type { SerializedTab, TabId } from "@seans-browser/browser-core";

type Listener = (...args: unknown[]) => void;

const subscriptions = new Map<Listener, (event: IpcRendererEvent, ...args: unknown[]) => void>();

contextBridge.exposeInMainWorld("browserAPI", {
  tab: {
    create: (url?: string): Promise<TabId> => ipcRenderer.invoke("tab:create", url),
    close: (id: TabId): Promise<void> => ipcRenderer.invoke("tab:close", id),
    activate: (id: TabId): Promise<void> => ipcRenderer.invoke("tab:activate", id),
    list: (): Promise<SerializedTab[]> => ipcRenderer.invoke("tab:list"),
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
  layout: {
    setChromeHeight: (height: number): Promise<void> =>
      ipcRenderer.invoke("layout:setChromeHeight", height)
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

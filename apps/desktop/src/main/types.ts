import type { NativeImage, WebContentsView } from "electron";
import type { SerializedTab, TabId, TabState } from "@seans-browser/browser-core";

export interface TabRecord
  extends Omit<SerializedTab, "snapshot" | "canGoBack" | "canGoForward" | "isLoading"> {
  snapshot: NativeImage | null;
  view: WebContentsView | null;
  state: TabState;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
}

export interface SerializedDesktopTab extends SerializedTab {
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
}

export type TabEventPayload = SerializedDesktopTab | TabId;


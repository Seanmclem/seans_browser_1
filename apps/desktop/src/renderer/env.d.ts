import type { SerializedTab, TabId } from "@seans-browser/browser-core";
import type React from "react";

interface HistoryEntry {
  url: string;
  title: string;
  visitedAt: number;
}

interface BrowserAPI {
  tab: {
    create: (url?: string) => Promise<TabId>;
    close: (id: TabId) => Promise<void>;
    activate: (id: TabId) => Promise<void>;
    list: () => Promise<SerializedTab[]>;
    sleep: (id: TabId) => Promise<void>;
  };
  nav: {
    back: (id: TabId) => Promise<void>;
    forward: (id: TabId) => Promise<void>;
    reload: (id: TabId) => Promise<void>;
    loadURL: (id: TabId, url: string) => Promise<void>;
  };
  history: {
    search: (query: string) => Promise<HistoryEntry[]>;
  };
  layout: {
    setChromeHeight: (height: number) => Promise<void>;
  };
  on: (channel: string, cb: (...args: unknown[]) => void) => void;
  off: (channel: string, cb: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    browserAPI: BrowserAPI;
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        allowpopups?: string;
        className?: string;
        partition?: string;
        src?: string;
        onDidFailLoad?: (event: unknown) => void;
        onDidNavigate?: (event: unknown) => void;
        onDidNavigateInPage?: (event: unknown) => void;
        onDidStartLoading?: (event: unknown) => void;
        onDidStopLoading?: (event: unknown) => void;
        onPageFaviconUpdated?: (event: { favicons?: string[] }) => void;
        onPageTitleUpdated?: (event: { title: string }) => void;
      };
    }
  }
}

export {};

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { normalizeURL } from "@seans-browser/browser-core";
import styles from "./App.module.css";

interface BrowserTab {
  id: string;
  url: string;
  title: string;
  favicon: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
}

type WebviewElement = HTMLElement & {
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  getTitle: () => string;
  getURL: () => string;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  loadURL: (url: string) => Promise<void>;
};

const DEFAULT_URL = "https://duckduckgo.com/";

function createId(): string {
  return `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createTab(url = DEFAULT_URL): BrowserTab {
  return {
    id: createId(),
    url,
    title: "New Tab",
    favicon: null,
    canGoBack: false,
    canGoForward: false,
    isLoading: true
  };
}

export default function App() {
  const [tabs, setTabs] = useState<BrowserTab[]>(() => [createTab()]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
  const [addressValue, setAddressValue] = useState(() => tabs[0].url);
  const attachedWebviews = useRef(new WeakSet<HTMLElement>());
  const webviewRefs = useRef<Record<string, WebviewElement | null>>({});

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, tabs]
  );

  useEffect(() => {
    if (activeTab) {
      setAddressValue(activeTab.url);
    }
  }, [activeTab?.id, activeTab?.url]);

  useEffect(() => {
    const handlers: Array<[string, (...args: unknown[]) => void]> = [
      ["shortcut:new-tab", () => addTab()],
      ["shortcut:close-tab", () => closeTab(activeTabId)],
      ["shortcut:reload", () => invokeActiveWebview("reload")],
      ["shortcut:back", () => invokeActiveWebview("back")],
      ["shortcut:forward", () => invokeActiveWebview("forward")],
      [
        "shortcut:switch-tab",
        (index) => {
          const tab = tabs[Number(index)];
          if (tab) {
            setActiveTabId(tab.id);
          }
        }
      ],
      [
        "ui:focus-address-bar",
        () => {
          document.querySelector<HTMLInputElement>("[data-address-input]")?.select();
        }
      ]
    ];

    for (const [channel, handler] of handlers) {
      window.browserAPI.on(channel, handler);
    }

    return () => {
      for (const [channel, handler] of handlers) {
        window.browserAPI.off(channel, handler);
      }
    };
  }, [activeTabId, tabs]);

  useEffect(() => {
    for (const tab of tabs) {
      const webview = webviewRefs.current[tab.id];
      if (!webview || attachedWebviews.current.has(webview)) {
        continue;
      }

      attachedWebviews.current.add(webview);
      webview.addEventListener("did-start-loading", () => patchTab(tab.id, { isLoading: true }));
      webview.addEventListener("did-stop-loading", () => syncWebviewState(tab.id));
      webview.addEventListener("did-navigate", () => syncWebviewState(tab.id));
      webview.addEventListener("did-navigate-in-page", () => syncWebviewState(tab.id));
      webview.addEventListener("did-fail-load", (event) => {
        console.warn("webview failed load", event);
        patchTab(tab.id, { isLoading: false });
      });
      webview.addEventListener("page-title-updated", (event) => {
        const typedEvent = event as CustomEvent<{ title?: string }> & { title?: string };
        const title = typedEvent.title ?? typedEvent.detail?.title;
        if (title) {
          patchTab(tab.id, { title });
        }
      });
      webview.addEventListener("page-favicon-updated", (event) => {
        const typedEvent = event as CustomEvent<{ favicons?: string[] }> & { favicons?: string[] };
        const favicons = typedEvent.favicons ?? typedEvent.detail?.favicons;
        patchTab(tab.id, { favicon: favicons?.[0] ?? null });
      });
    }
  }, [tabs]);

  function addTab(url = DEFAULT_URL): void {
    const tab = createTab(url);
    setTabs((current) => current.concat(tab));
    setActiveTabId(tab.id);
  }

  function closeTab(id: string): void {
    setTabs((current) => {
      const index = current.findIndex((tab) => tab.id === id);
      const nextTabs = current.filter((tab) => tab.id !== id);

      if (id === activeTabId) {
        const nextActive = nextTabs[Math.max(index - 1, 0)] ?? nextTabs[0] ?? null;
        if (nextActive) {
          setActiveTabId(nextActive.id);
        } else {
          const replacement = createTab();
          setActiveTabId(replacement.id);
          return [replacement];
        }
      }

      return nextTabs;
    });
  }

  function patchTab(id: string, patch: Partial<BrowserTab>): void {
    setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)));
  }

  function getActiveWebview(): WebviewElement | null {
    return activeTabId ? webviewRefs.current[activeTabId] : null;
  }

  function invokeActiveWebview(action: "back" | "forward" | "reload"): void {
    const webview = getActiveWebview();
    if (!webview) {
      return;
    }

    if (action === "back" && webview.canGoBack()) {
      webview.goBack();
      return;
    }

    if (action === "forward" && webview.canGoForward()) {
      webview.goForward();
      return;
    }

    if (action === "reload") {
      webview.reload();
    }
  }

  function handleNavigate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!activeTab) {
      return;
    }

    const nextUrl = normalizeURL(addressValue);
    patchTab(activeTab.id, { url: nextUrl, isLoading: true });
    void getActiveWebview()?.loadURL(nextUrl);
  }

  function syncWebviewState(tabId: string): void {
    const webview = webviewRefs.current[tabId];
    if (!webview) {
      return;
    }

    patchTab(tabId, {
      url: webview.getURL(),
      title: webview.getTitle() || webview.getURL(),
      canGoBack: webview.canGoBack(),
      canGoForward: webview.canGoForward(),
      isLoading: false
    });
  }

  return (
    <div className={styles.shell}>
      <header className={styles.chrome}>
        <div className={styles.tabBar}>
          <div className={styles.windowControls} />
          <div className={styles.tabList}>
            {tabs.map((tab) => (
              <button
                className={`${styles.tab} ${tab.id === activeTabId ? styles.active : ""}`}
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                type="button"
              >
                {tab.favicon ? <img className={styles.favicon} src={tab.favicon} alt="" /> : null}
                <span className={styles.tabTitle}>{tab.title}</span>
                <span
                  className={styles.close}
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  x
                </span>
              </button>
            ))}
          </div>
          <button className={styles.newTab} onClick={() => addTab()} type="button">
            +
          </button>
        </div>

        <div className={styles.controls}>
          <button
            className={styles.tool}
            disabled={!activeTab?.canGoBack}
            onClick={() => invokeActiveWebview("back")}
            type="button"
          >
            Back
          </button>
          <button
            className={styles.tool}
            disabled={!activeTab?.canGoForward}
            onClick={() => invokeActiveWebview("forward")}
            type="button"
          >
            Forward
          </button>
          <button className={styles.tool} onClick={() => invokeActiveWebview("reload")} type="button">
            {activeTab?.isLoading ? "Loading" : "Reload"}
          </button>
          <form className={styles.addressBar} onSubmit={handleNavigate}>
            <span className={styles.security}>
              {activeTab?.url.startsWith("https://") ? "Secure" : "Web"}
            </span>
            <input
              className={styles.addressInput}
              data-address-input
              onChange={(event) => setAddressValue(event.target.value)}
              spellCheck={false}
              value={addressValue}
            />
          </form>
        </div>
      </header>

      <main className={styles.viewport}>
        {tabs.map((tab) => (
          <webview
            className={`${styles.webview} ${tab.id === activeTabId ? styles.visible : ""}`}
            key={tab.id}
            partition="persist:default"
            ref={(element) => {
              webviewRefs.current[tab.id] = element as WebviewElement | null;
            }}
            src={tab.url}
          />
        ))}
      </main>
    </div>
  );
}

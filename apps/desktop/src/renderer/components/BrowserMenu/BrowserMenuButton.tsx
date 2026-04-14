import { useEffect, useState, type MouseEvent } from "react";
import { useTabStore } from "../../store/tabStore";
import { useUIStore, type TabStripPlacement } from "../../store/uiStore";

const BROWSER_MENU_WIDTH = 260;
const BROWSER_MENU_OVERLAY_HEIGHT = 360;

interface BrowserMenuState {
  x: number;
  y: number;
}

interface BrowserMenuButtonProps {
  className?: string;
}

export function BrowserMenuButton({ className = "" }: BrowserMenuButtonProps) {
  const { activeTabId, setActiveTabId, tabs } = useTabStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const tabStripPlacement = useUIStore((state) => state.tabStripPlacement);
  const setTabStripPlacement = useUIStore((state) => state.setTabStripPlacement);
  const [browserMenu, setBrowserMenu] = useState<BrowserMenuState | null>(null);

  useEffect(() => {
    void window.browserAPI.layout.setChromeOverlayHeight(
      browserMenu ? BROWSER_MENU_OVERLAY_HEIGHT : 0
    );

    if (!browserMenu) {
      return;
    }

    const closeBrowserMenu = () => setBrowserMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeBrowserMenu();
      }
    };

    window.addEventListener("click", closeBrowserMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeBrowserMenu);
      window.removeEventListener("keydown", closeOnEscape);
      void window.browserAPI.layout.setChromeOverlayHeight(0);
    };
  }, [browserMenu]);

  const handleNewTab = async () => {
    const id = await window.browserAPI.tab.create();
    setActiveTabId(id);
  };

  const handleOpenMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.blur();
    const menuX = bounds.right - BROWSER_MENU_WIDTH;
    void window.browserAPI.layout.setChromeOverlayHeight(BROWSER_MENU_OVERLAY_HEIGHT);
    setBrowserMenu({
      x: Math.max(12, Math.min(menuX, window.innerWidth - BROWSER_MENU_WIDTH - 12)),
      y: bounds.bottom + 8
    });
  };

  const runBrowserMenuAction = (action: () => Promise<void> | void) => {
    setBrowserMenu(null);
    void action();
  };

  const changeTabPlacement = async (placement: TabStripPlacement) => {
    setTabStripPlacement(placement);
    await window.browserAPI.layout.setTabStripPlacement(placement);
  };

  return (
    <>
      <button
        aria-label="Open browser menu"
        className={`app-region-no-drag relative inline-flex h-10 w-10 cursor-pointer flex-col items-center justify-center gap-[4px] rounded-[14px] border border-slate-400/30 bg-slate-800/90 text-white transition-colors duration-150 hover:bg-slate-700 active:bg-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${className}`}
        onClick={handleOpenMenu}
        onMouseLeave={(event) => event.currentTarget.blur()}
        type="button"
      >
        <span className="block h-[2px] w-4 rounded-full bg-current" />
        <span className="block h-[2px] w-4 rounded-full bg-current" />
        <span className="block h-[2px] w-4 rounded-full bg-current" />
      </button>

      {browserMenu ? (
        <div
          className="app-region-no-drag fixed z-[300] w-[260px] overflow-hidden rounded-2xl border border-slate-500/40 bg-slate-950 p-1.5 text-[13px] text-slate-100 shadow-[0_18px_46px_rgba(2,6,23,0.48)]"
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
          style={{
            left: browserMenu.x,
            top: browserMenu.y
          }}
        >
          <BrowserMenuItem
            label="New Tab"
            shortcut="⌘T"
            onClick={() => runBrowserMenuAction(handleNewTab)}
          />
          <BrowserMenuItem
            label="History"
            shortcut="⌘Y"
            onClick={() => runBrowserMenuAction(() => window.browserAPI.browser.openHistory())}
          />
          <BrowserMenuItem
            disabled={!activeTabId || isInternalOrBlankPage(activeTab?.url)}
            label="Bookmark This Page"
            onClick={() =>
              runBrowserMenuAction(() => window.browserAPI.browser.addActiveTabToFavorites())
            }
          />
          <BrowserMenuItem
            label="Favorites"
            onClick={() => runBrowserMenuAction(() => window.browserAPI.browser.openFavorites())}
          />
          <div className="my-1 h-px bg-slate-700/80" />
          <BrowserMenuItem
            disabled={!activeTab?.canGoBack || !activeTabId}
            label="Back"
            onClick={() =>
              runBrowserMenuAction(() => {
                if (activeTabId) {
                  return window.browserAPI.nav.back(activeTabId);
                }
              })
            }
          />
          <BrowserMenuItem
            disabled={!activeTab?.canGoForward || !activeTabId}
            label="Forward"
            onClick={() =>
              runBrowserMenuAction(() => {
                if (activeTabId) {
                  return window.browserAPI.nav.forward(activeTabId);
                }
              })
            }
          />
          <BrowserMenuItem
            disabled={!activeTabId}
            label="Reload"
            shortcut="⌘R"
            onClick={() =>
              runBrowserMenuAction(() => {
                if (activeTabId) {
                  return window.browserAPI.nav.reload(activeTabId);
                }
              })
            }
          />
          <div className="my-1 h-px bg-slate-700/80" />
          <BrowserMenuItem
            checked={tabStripPlacement === "top"}
            label="Tabs on Top"
            onClick={() => runBrowserMenuAction(() => changeTabPlacement("top"))}
          />
          <BrowserMenuItem
            checked={tabStripPlacement === "left"}
            label="Tabs on Left"
            onClick={() => runBrowserMenuAction(() => changeTabPlacement("left"))}
          />
          <BrowserMenuItem
            checked={tabStripPlacement === "right"}
            label="Tabs on Right"
            onClick={() => runBrowserMenuAction(() => changeTabPlacement("right"))}
          />
          <div className="my-1 h-px bg-slate-700/80" />
          <BrowserMenuItem
            disabled={!activeTabId}
            label="Move Active Tab to New Window"
            onClick={() =>
              runBrowserMenuAction(() => window.browserAPI.browser.moveActiveTabToNewWindow())
            }
          />
          <BrowserMenuItem
            disabled={!activeTabId}
            label="Sleep Active Tab"
            onClick={() => runBrowserMenuAction(() => window.browserAPI.browser.sleepActiveTab())}
          />
          <BrowserMenuItem
            disabled={!activeTabId}
            label="Close Active Tab"
            shortcut="⌘W"
            tone="danger"
            onClick={() => runBrowserMenuAction(() => window.browserAPI.browser.closeActiveTab())}
          />
        </div>
      ) : null}
    </>
  );
}

function isInternalOrBlankPage(url?: string): boolean {
  return !url || url.startsWith("about:") || url.startsWith("seans-browser://");
}

interface BrowserMenuItemProps {
  checked?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  shortcut?: string;
  tone?: "default" | "danger";
}

function BrowserMenuItem({
  checked = false,
  disabled = false,
  label,
  onClick,
  shortcut,
  tone = "default"
}: BrowserMenuItemProps) {
  const toneClass =
    tone === "danger"
      ? "text-red-200 enabled:hover:bg-red-950/80"
      : "text-slate-100 enabled:hover:bg-sky-700";

  return (
    <button
      className={`grid w-full grid-cols-[18px_1fr_auto] items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors duration-150 disabled:cursor-default disabled:opacity-45 ${toneClass}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="text-[12px] text-cyan-200">{checked ? "*" : ""}</span>
      <span>{label}</span>
      {shortcut ? <span className="text-[11px] text-slate-400">{shortcut}</span> : null}
    </button>
  );
}

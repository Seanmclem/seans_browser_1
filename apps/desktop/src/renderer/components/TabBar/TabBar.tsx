import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent
} from "react";
import { useTabStore } from "../../store/tabStore";
import { useUIStore, type TabStripPlacement } from "../../store/uiStore";
import { Tab } from "./Tab";

type AppRegionStyle = CSSProperties & { WebkitAppRegion?: "drag" | "no-drag" };
type TabDropPlacement = "before" | "after";

const DRAG_REGION_STYLE: AppRegionStyle = { WebkitAppRegion: "drag" };
const NO_DRAG_REGION_STYLE: AppRegionStyle = { WebkitAppRegion: "no-drag" };
const TAB_DRAG_MIME = "application/x-seans-browser-tab-token";
const BROWSER_MENU_WIDTH = 260;
const BROWSER_MENU_OVERLAY_HEIGHT = 320;

interface BrowserMenuState {
  x: number;
  y: number;
}

export function TabBar() {
  const { activeTabId, setActiveTabId, removeTab, tabs } = useTabStore();
  const tabStripPlacement = useUIStore((state) => state.tabStripPlacement);
  const activeDragTokenRef = useRef<string | null>(null);
  const [browserMenu, setBrowserMenu] = useState<BrowserMenuState | null>(null);
  const tabStripDirection = tabStripPlacement === "top" ? "horizontal" : "vertical";
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

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
    window.addEventListener("blur", closeBrowserMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeBrowserMenu);
      window.removeEventListener("blur", closeBrowserMenu);
      window.removeEventListener("keydown", closeOnEscape);
      void window.browserAPI.layout.setChromeOverlayHeight(0);
    };
  }, [browserMenu]);

  const handleNewTab = async () => {
    const id = await window.browserAPI.tab.create();
    setActiveTabId(id);
  };

  const handleActivate = async (id: string) => {
    await window.browserAPI.tab.activate(id);
    setActiveTabId(id);
  };

  const handleClose = async (id: string) => {
    await window.browserAPI.tab.close(id);
    removeTab(id);
  };

  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>, tabId: string) => {
    event.preventDefault();
    void window.browserAPI.tab.showContextMenu(tabId, {
      x: event.clientX,
      y: event.clientY
    });
  };

  const handleBrowserMenu = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.blur();
    const menuX = bounds.right - BROWSER_MENU_WIDTH;
    setBrowserMenu({
      x: Math.max(12, Math.min(menuX, window.innerWidth - BROWSER_MENU_WIDTH - 12)),
      y: bounds.bottom + 8
    });
  };

  const runBrowserMenuAction = (action: () => Promise<void> | void) => {
    setBrowserMenu(null);
    void action();
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, tabId: string) => {
    const token = crypto.randomUUID();
    activeDragTokenRef.current = token;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(TAB_DRAG_MIME, token);
    event.dataTransfer.setData("text/plain", token);
    void window.browserAPI.tab.beginDrag(token, tabId);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>, targetTabId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const token =
      event.dataTransfer.getData(TAB_DRAG_MIME) || event.dataTransfer.getData("text/plain");

    if (!token) {
      return;
    }

    const placement = getTabDropPlacement(event, tabStripDirection);
    void window.browserAPI.tab.dropDragged(token, targetTabId, placement);
  };

  const handleDragEnd = () => {
    const token = activeDragTokenRef.current;
    activeDragTokenRef.current = null;
    if (token) {
      void window.browserAPI.tab.endDrag(token);
    }
  };

  return (
    <div
      className="relative flex items-center gap-3 py-3 pb-[6px] pl-[84px] pr-[18px]"
      style={DRAG_REGION_STYLE}
    >
      <div
        className="relative flex max-w-[calc(100%-120px)] shrink gap-[10px] overflow-x-auto pb-0.5"
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onActivate={() => {
              void handleActivate(tab.id);
            }}
            onClose={() => {
              void handleClose(tab.id);
            }}
            onContextMenu={(event) => handleContextMenu(event, tab.id)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragStart={(event) => handleDragStart(event, tab.id)}
            onDrop={(event) => handleDrop(event, tab.id)}
          />
        ))}
      </div>

      <button
        aria-label="Open a new tab"
        className="relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-[14px] border border-cyan-300/35 bg-sky-800/90 text-[24px] leading-none text-white transition-colors duration-150 hover:bg-sky-700 active:bg-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
        onClick={(event) => {
          event.currentTarget.blur();
          void handleNewTab();
        }}
        onMouseLeave={(event) => event.currentTarget.blur()}
        style={NO_DRAG_REGION_STYLE}
        type="button"
      >
        +
      </button>
      <div className="min-w-4 flex-1 self-stretch" />
      <button
        aria-label="Open browser menu"
        className="relative inline-flex h-10 w-10 cursor-pointer flex-col items-center justify-center gap-[4px] rounded-[14px] border border-slate-400/30 bg-slate-800/90 text-white transition-colors duration-150 hover:bg-slate-700 active:bg-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
        onClick={handleBrowserMenu}
        onMouseLeave={(event) => event.currentTarget.blur()}
        style={NO_DRAG_REGION_STYLE}
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
          <BrowserMenuButton
            label="New Tab"
            shortcut="⌘T"
            onClick={() => runBrowserMenuAction(handleNewTab)}
          />
          <div className="my-1 h-px bg-slate-700/80" />
          <BrowserMenuButton
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
          <BrowserMenuButton
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
          <BrowserMenuButton
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
          <BrowserMenuButton
            disabled={!activeTabId}
            label="Move Active Tab to New Window"
            onClick={() =>
              runBrowserMenuAction(() => window.browserAPI.browser.moveActiveTabToNewWindow())
            }
          />
          <BrowserMenuButton
            disabled={!activeTabId}
            label="Sleep Active Tab"
            onClick={() => runBrowserMenuAction(() => window.browserAPI.browser.sleepActiveTab())}
          />
          <BrowserMenuButton
            disabled={!activeTabId}
            label="Close Active Tab"
            shortcut="⌘W"
            tone="danger"
            onClick={() => runBrowserMenuAction(() => window.browserAPI.browser.closeActiveTab())}
          />
        </div>
      ) : null}
    </div>
  );
}

interface BrowserMenuButtonProps {
  disabled?: boolean;
  label: string;
  onClick: () => void;
  shortcut?: string;
  tone?: "default" | "danger";
}

function BrowserMenuButton({
  disabled = false,
  label,
  onClick,
  shortcut,
  tone = "default"
}: BrowserMenuButtonProps) {
  const toneClass =
    tone === "danger"
      ? "text-red-200 enabled:hover:bg-red-950/80"
      : "text-slate-100 enabled:hover:bg-sky-700";

  return (
    <button
      className={`grid w-full grid-cols-[1fr_auto] items-center gap-4 rounded-xl px-3 py-2 text-left transition-colors duration-150 disabled:cursor-default disabled:opacity-45 ${toneClass}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      {shortcut ? <span className="text-[11px] text-slate-400">{shortcut}</span> : null}
    </button>
  );
}

function getTabDropPlacement(
  event: DragEvent<HTMLButtonElement>,
  direction: "horizontal" | "vertical"
): TabDropPlacement {
  const bounds = event.currentTarget.getBoundingClientRect();

  if (direction === "vertical") {
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  }

  return event.clientX < bounds.left + bounds.width / 2 ? "before" : "after";
}

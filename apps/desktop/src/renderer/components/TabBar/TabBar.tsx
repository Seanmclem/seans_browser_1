import { useRef, type CSSProperties, type DragEvent, type MouseEvent } from "react";
import { useTabStore } from "../../store/tabStore";
import { useUIStore, type TabStripPlacement } from "../../store/uiStore";
import { BrowserMenuButton } from "../BrowserMenu/BrowserMenuButton";
import { Tab } from "./Tab";

type AppRegionStyle = CSSProperties & { WebkitAppRegion?: "drag" | "no-drag" };
type TabDropPlacement = "before" | "after";

const DRAG_REGION_STYLE: AppRegionStyle = { WebkitAppRegion: "drag" };
const NO_DRAG_REGION_STYLE: AppRegionStyle = { WebkitAppRegion: "no-drag" };
const TAB_DRAG_MIME = "application/x-seans-browser-tab-token";

interface TabBarProps {
  orientation?: "horizontal" | "vertical";
  showBrowserMenu?: boolean;
}

export function TabBar({ orientation, showBrowserMenu }: TabBarProps = {}) {
  const { activeTabId, setActiveTabId, removeTab, tabs } = useTabStore();
  const tabStripPlacement = useUIStore((state) => state.tabStripPlacement);
  const activeDragTokenRef = useRef<string | null>(null);
  const tabStripDirection =
    orientation ?? (tabStripPlacement === "top" ? "horizontal" : "vertical");
  const shouldShowBrowserMenu = showBrowserMenu ?? tabStripDirection === "horizontal";

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

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, tabId: string) => {
    const token = crypto.randomUUID();
    activeDragTokenRef.current = token;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(TAB_DRAG_MIME, token);
    event.dataTransfer.setData("text/plain", token);
    void window.browserAPI.tab.beginDrag(token, tabId);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
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

  const handleStripDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const token =
      event.dataTransfer.getData(TAB_DRAG_MIME) || event.dataTransfer.getData("text/plain");

    if (token) {
      void window.browserAPI.tab.dropDragged(token, null, "end");
    }
  };

  const handleDragEnd = () => {
    const token = activeDragTokenRef.current;
    activeDragTokenRef.current = null;
    if (token) {
      void window.browserAPI.tab.endDrag(token);
    }
  };

  const containerClassName =
    tabStripDirection === "vertical"
      ? "relative flex h-full min-h-0 flex-col gap-3 p-3"
      : "relative flex items-center gap-3 py-3 pb-[6px] pl-[84px] pr-[18px]";
  const tabListClassName =
    tabStripDirection === "vertical"
      ? "relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1"
      : "relative flex max-w-[calc(100%-120px)] shrink gap-[10px] overflow-x-auto pb-0.5";
  const newTabButtonClassName =
    tabStripDirection === "vertical"
      ? "relative inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-[14px] border border-tab-border-active bg-accent text-[22px] leading-none text-bg-base transition-colors duration-150 hover:bg-accent/85 active:bg-accent-subtle active:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tab-border-active"
      : "relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-[14px] border border-tab-border-active bg-accent text-[24px] leading-none text-bg-base transition-colors duration-150 hover:bg-accent/85 active:bg-accent-subtle active:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tab-border-active";

  return (
    <div className={containerClassName} style={DRAG_REGION_STYLE}>
      <div
        className={tabListClassName}
        onDragOver={handleDragOver}
        onDrop={handleStripDrop}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            orientation={tabStripDirection}
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
        className={newTabButtonClassName}
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
      {tabStripDirection === "horizontal" ? <div className="min-w-4 flex-1 self-stretch" /> : null}
      {shouldShowBrowserMenu ? <BrowserMenuButton /> : null}
    </div>
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

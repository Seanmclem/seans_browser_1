import { useRef, type CSSProperties, type DragEvent, type MouseEvent } from "react";
import { useTabStore } from "../../store/tabStore";
import { useUIStore, type TabStripPlacement } from "../../store/uiStore";
import { Tab } from "./Tab";

type AppRegionStyle = CSSProperties & { WebkitAppRegion?: "drag" | "no-drag" };
type TabDropPlacement = "before" | "after";

const DRAG_REGION_STYLE: AppRegionStyle = { WebkitAppRegion: "drag" };
const NO_DRAG_REGION_STYLE: AppRegionStyle = { WebkitAppRegion: "no-drag" };
const TAB_DRAG_MIME = "application/x-seans-browser-tab-token";

export function TabBar() {
  const { activeTabId, setActiveTabId, removeTab, tabs } = useTabStore();
  const tabStripPlacement = useUIStore((state) => state.tabStripPlacement);
  const activeDragTokenRef = useRef<string | null>(null);
  const tabStripDirection = tabStripPlacement === "top" ? "horizontal" : "vertical";

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
      className="relative grid grid-cols-[1fr_auto] items-center gap-3 py-3 pb-[6px] pl-[84px] pr-[18px]"
      style={DRAG_REGION_STYLE}
    >
      <div
        className="relative flex gap-[10px] overflow-x-auto pb-0.5"
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

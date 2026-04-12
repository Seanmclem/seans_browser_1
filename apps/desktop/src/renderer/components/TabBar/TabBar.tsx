import type { CSSProperties } from "react";
import { useTabStore } from "../../store/tabStore";
import { Tab } from "./Tab";

type AppRegionStyle = CSSProperties & { WebkitAppRegion?: "drag" | "no-drag" };

const DRAG_REGION_STYLE: AppRegionStyle = { WebkitAppRegion: "drag" };
const NO_DRAG_REGION_STYLE: AppRegionStyle = { WebkitAppRegion: "no-drag" };

export function TabBar() {
  const { activeTabId, setActiveTabId, removeTab, tabs } = useTabStore();

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

  return (
    <div
      className="relative grid grid-cols-[1fr_auto] items-center gap-3 py-3 pb-[6px] pl-[84px] pr-[18px]"
      style={DRAG_REGION_STYLE}
    >
      <div
        className="relative flex gap-[10px] overflow-x-auto pb-0.5"
        style={NO_DRAG_REGION_STYLE}
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

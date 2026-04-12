import { useTabStore } from "../../store/tabStore";

const TOOL_CLASS =
  "cursor-pointer rounded-[14px] border-0 bg-slate-700/85 px-[14px] py-[10px] text-[13px] text-slate-50 transition-[background,opacity,transform] duration-150 hover:-translate-y-px disabled:cursor-default disabled:opacity-45";

const SECONDARY_TOOL_CLASS =
  "cursor-pointer rounded-[14px] border-0 bg-orange-500/20 px-[14px] py-[10px] text-[13px] text-orange-300 transition-[background,opacity,transform] duration-150 hover:-translate-y-px";

export function Toolbar() {
  const { activeTabId, tabs } = useTabStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const run = (action: "back" | "forward" | "reload" | "sleep") => {
    if (!activeTabId) {
      return;
    }

    if (action === "back") {
      void window.browserAPI.nav.back(activeTabId);
      return;
    }

    if (action === "forward") {
      void window.browserAPI.nav.forward(activeTabId);
      return;
    }

    if (action === "reload") {
      void window.browserAPI.nav.reload(activeTabId);
      return;
    }

    void window.browserAPI.tab.sleep(activeTabId);
  };

  return (
    <div className="flex gap-[10px]">
      <button
        className={TOOL_CLASS}
        disabled={!activeTab?.canGoBack}
        onClick={() => run("back")}
        type="button"
      >
        Back
      </button>
      <button
        className={TOOL_CLASS}
        disabled={!activeTab?.canGoForward}
        onClick={() => run("forward")}
        type="button"
      >
        Forward
      </button>
      <button className={TOOL_CLASS} onClick={() => run("reload")} type="button">
        {activeTab?.isLoading ? "Stop?" : "Reload"}
      </button>
      <button className={SECONDARY_TOOL_CLASS} onClick={() => run("sleep")} type="button">
        Sleep Tab
      </button>
    </div>
  );
}

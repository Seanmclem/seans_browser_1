import { useTabStore } from "../../store/tabStore";

const TOOL_CLASS =
  "inline-flex h-10 min-w-10 cursor-pointer items-center justify-center rounded-[14px] border-0 bg-slate-700/85 px-[14px] py-[10px] text-[18px] leading-none text-slate-50 transition-[background,opacity] duration-150 hover:bg-slate-600 disabled:cursor-default disabled:opacity-45 disabled:hover:bg-slate-700/85";

const SECONDARY_TOOL_CLASS =
  "cursor-pointer rounded-[14px] border-0 bg-orange-500/20 px-[14px] py-[10px] text-[13px] text-orange-300 transition-[background,opacity] duration-150 hover:bg-orange-500/30";

export function Toolbar() {
  const { activeTabId, tabs } = useTabStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const run = (action: "back" | "forward" | "reload" | "sleep" | "stop") => {
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

    if (action === "stop") {
      void window.browserAPI.nav.stop(activeTabId);
      return;
    }

    void window.browserAPI.tab.sleep(activeTabId);
  };

  return (
    <div className="app-region-no-drag flex gap-[10px]">
      <button
        aria-label="Go back"
        title="Back"
        className={TOOL_CLASS}
        disabled={!activeTab?.canGoBack}
        onClick={() => run("back")}
        type="button"
      >
        ←
      </button>
      {activeTab?.canGoForward ? (
        <button
          aria-label="Go forward"
          className={TOOL_CLASS}
          onClick={() => run("forward")}
          title="Forward"
          type="button"
        >
          →
        </button>
      ) : null}
      <button
        aria-label={activeTab?.isLoading ? "Stop loading" : "Reload page"}
        className={TOOL_CLASS}
        onClick={() => run(activeTab?.isLoading ? "stop" : "reload")}
        title={activeTab?.isLoading ? "Stop" : "Reload"}
        type="button"
      >
        {activeTab?.isLoading ? "×" : "↻"}
      </button>
      <button className={SECONDARY_TOOL_CLASS} onClick={() => run("sleep")} type="button">
        Sleep Tab
      </button>
    </div>
  );
}

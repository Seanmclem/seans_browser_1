import { useTabStore } from "../../store/tabStore";

const TOOL_CLASS =
  "inline-flex h-10 min-w-10 cursor-pointer items-center justify-center rounded-[14px] border-0 bg-bg-surface px-[14px] py-[10px] text-[18px] leading-none text-text-primary transition-[background,opacity] duration-150 hover:bg-accent-subtle disabled:cursor-default disabled:opacity-45 disabled:hover:bg-bg-surface";

export function Toolbar() {
  const { activeTabId, tabs } = useTabStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const run = (action: "back" | "forward" | "reload" | "stop") => {
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
    }
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
    </div>
  );
}

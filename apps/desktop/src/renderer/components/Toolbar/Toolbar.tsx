import { useTabStore } from "../../store/tabStore";
import styles from "./Toolbar.module.css";

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
    <div className={styles.toolbar}>
      <button
        className={styles.tool}
        disabled={!activeTab?.canGoBack}
        onClick={() => run("back")}
        type="button"
      >
        Back
      </button>
      <button
        className={styles.tool}
        disabled={!activeTab?.canGoForward}
        onClick={() => run("forward")}
        type="button"
      >
        Forward
      </button>
      <button className={styles.tool} onClick={() => run("reload")} type="button">
        {activeTab?.isLoading ? "Stop?" : "Reload"}
      </button>
      <button className={styles.secondary} onClick={() => run("sleep")} type="button">
        Sleep Tab
      </button>
    </div>
  );
}


import { useTabStore } from "../../store/tabStore";
import { Tab } from "./Tab";
import styles from "./TabBar.module.css";

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
    <div className={styles.tabBar}>
      <div className={styles.dragStrip} />
      <div className={styles.tabList}>
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

      <button className={styles.newTabBtn} onClick={() => void handleNewTab()} type="button">
        +
      </button>
    </div>
  );
}


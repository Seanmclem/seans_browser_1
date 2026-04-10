import type { SerializedTab } from "@seans-browser/browser-core";
import { SleepOverlay } from "../SleepOverlay/SleepOverlay";
import styles from "./TabBar.module.css";

interface TabProps {
  tab: SerializedTab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}

const sleepIcons: Record<string, string> = {
  "soft-sleeping": "ZZ",
  "hard-sleeping": "HZ",
  crashed: "!"
};

export function Tab({ tab, isActive, onActivate, onClose }: TabProps) {
  const sleepIcon = sleepIcons[tab.state];

  return (
    <button
      className={`${styles.tab} ${isActive ? styles.active : ""} ${
        sleepIcon ? styles.sleeping : ""
      }`}
      onClick={onActivate}
      title={tab.title}
      type="button"
    >
      <div className={styles.tabIcon}>
        {tab.favicon ? (
          <img className={styles.favicon} src={tab.favicon} width={16} height={16} alt="" />
        ) : (
          <div className={styles.defaultFavicon} />
        )}
        {sleepIcon ? <span className={styles.sleepBadge}>{sleepIcon}</span> : null}
      </div>

      <span className={styles.tabTitle}>{tab.title || tab.url}</span>

      <span
        className={styles.closeBtn}
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        x
      </span>

      {tab.snapshot && !isActive ? (
        <div className={styles.preview}>
          <SleepOverlay snapshot={tab.snapshot} state={tab.state} />
        </div>
      ) : null}
    </button>
  );
}


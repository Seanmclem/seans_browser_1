import { useLayoutEffect, useRef } from "react";
import { AddressBar } from "./components/AddressBar/AddressBar";
import { TabBar } from "./components/TabBar/TabBar";
import { Toolbar } from "./components/Toolbar/Toolbar";
import { useTabManager } from "./hooks/useTabManager";
import styles from "./App.module.css";

export default function App() {
  useTabManager();
  const chromeRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const chrome = chromeRef.current;
    if (!chrome) {
      return;
    }

    const syncChromeHeight = () => {
      void window.browserAPI.layout.setChromeHeight(chrome.getBoundingClientRect().height);
    };

    syncChromeHeight();
    const observer = new ResizeObserver(syncChromeHeight);
    observer.observe(chrome);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className={styles.shell}>
      <header ref={chromeRef} className={styles.chrome}>
        <TabBar />
        <div className={styles.controls}>
          <Toolbar />
          <AddressBar />
        </div>
      </header>
    </div>
  );
}

import { useLayoutEffect, useRef } from "react";
import { AddressBar } from "./components/AddressBar/AddressBar";
import { TabBar } from "./components/TabBar/TabBar";
import { Toolbar } from "./components/Toolbar/Toolbar";
import { useTabManager } from "./hooks/useTabManager";

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
    <div className="min-h-screen bg-transparent text-slate-50">
      <header
        ref={chromeRef}
        className="fixed inset-x-0 top-0 z-[100] border-b border-slate-400/10 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_30%),linear-gradient(180deg,rgb(15,23,42),rgb(15,23,42))]"
      >
        <TabBar />
        <div className="grid grid-cols-[auto_1fr] items-center gap-[14px] px-[18px] pb-3">
          <Toolbar />
          <AddressBar />
        </div>
      </header>
    </div>
  );
}

import { useEffect, useLayoutEffect, useRef } from "react";
import { AddressBar } from "./components/AddressBar/AddressBar";
import { BrowserMenuButton } from "./components/BrowserMenu/BrowserMenuButton";
import { TabBar } from "./components/TabBar/TabBar";
import { Toolbar } from "./components/Toolbar/Toolbar";
import { useTabManager } from "./hooks/useTabManager";
import { useUIStore, type TabStripPlacement } from "./store/uiStore";

type ChromeSurface = "main" | "side-tabs";

const LEGACY_TAB_PLACEMENT_STORAGE_KEY = "seans-browser:tabStripPlacement";

export default function App() {
  useTabManager();
  const surface = getChromeSurface();
  const isMainSurface = surface === "main";
  const tabStripPlacement = useUIStore((state) => state.tabStripPlacement);
  useTabStripPlacementSync(isMainSurface);
  const chromeRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!isMainSurface) {
      return;
    }

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
  }, [isMainSurface]);

  if (surface === "side-tabs") {
    return (
      <div
        className={`theme-dark h-screen bg-bg-chrome text-text-primary ${
          tabStripPlacement === "right" ? "border-l" : "border-r"
        } border-border`}
      >
        <TabBar orientation="vertical" showBrowserMenu={false} />
      </div>
    );
  }

  return (
    <div className="theme-dark min-h-screen bg-transparent text-text-primary">
      <header
        ref={chromeRef}
        className="app-region-drag fixed inset-x-0 top-0 z-[100] border-b border-border bg-bg-chrome"
      >
        {tabStripPlacement === "top" ? (
          <TabBar orientation="horizontal" showBrowserMenu />
        ) : (
          <SideTabTopBar placement={tabStripPlacement} />
        )}
        <div className="grid grid-cols-[auto_1fr] items-center gap-[14px] px-[18px] pb-3">
          <Toolbar />
          <AddressBar />
        </div>
      </header>
    </div>
  );
}

function SideTabTopBar({ placement }: { placement: Exclude<TabStripPlacement, "top"> }) {
  return (
    <div className="relative flex items-center gap-3 py-3 pb-[6px] pl-[84px] pr-[18px]">
      <span className="rounded-full border border-border bg-bg-surface px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        Tabs on {placement}
      </span>
      <div className="min-w-4 flex-1 self-stretch" />
      <BrowserMenuButton />
    </div>
  );
}

function useTabStripPlacementSync(isMainSurface: boolean): void {
  const setTabStripPlacement = useUIStore((state) => state.setTabStripPlacement);

  useEffect(() => {
    const applyPlacement = (placement: unknown) => {
      if (!isTabStripPlacement(placement)) {
        return;
      }

      setTabStripPlacement(placement);
    };

    void window.browserAPI.layout.getTabStripPlacement().then(async (placement) => {
      const legacyPlacement = isMainSurface
        ? window.localStorage.getItem(LEGACY_TAB_PLACEMENT_STORAGE_KEY)
        : null;

      if (isTabStripPlacement(legacyPlacement)) {
        window.localStorage.removeItem(LEGACY_TAB_PLACEMENT_STORAGE_KEY);
        await window.browserAPI.layout.setTabStripPlacement(legacyPlacement);
        applyPlacement(legacyPlacement);
        return;
      }

      applyPlacement(placement);
    });

    window.browserAPI.on("layout:tabStripPlacementChanged", applyPlacement);
    return () => {
      window.browserAPI.off("layout:tabStripPlacementChanged", applyPlacement);
    };
  }, [isMainSurface, setTabStripPlacement]);
}

function getChromeSurface(): ChromeSurface {
  return new URLSearchParams(window.location.search).get("surface") === "side-tabs"
    ? "side-tabs"
    : "main";
}

function isTabStripPlacement(value: unknown): value is TabStripPlacement {
  return value === "top" || value === "left" || value === "right";
}

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AddressBar } from "./components/AddressBar/AddressBar";
import { BrowserMenuButton } from "./components/BrowserMenu/BrowserMenuButton";
import { FavoritesBar } from "./components/FavoritesBar/FavoritesBar";
import { TabBar } from "./components/TabBar/TabBar";
import { Toolbar } from "./components/Toolbar/Toolbar";
import { useTabManager } from "./hooks/useTabManager";
import {
  useUIStore,
  type FavoritesBarVisibility,
  type TabStripPlacement
} from "./store/uiStore";

type ChromeSurface = "main" | "side-tabs";

const LEGACY_TAB_PLACEMENT_STORAGE_KEY = "seans-browser:tabStripPlacement";

export default function App() {
  useTabManager();
  const surface = getChromeSurface();
  const isMainSurface = surface === "main";
  const tabStripPlacement = useUIStore((state) => state.tabStripPlacement);
  const favoritesBarVisibility = useUIStore((state) => state.favoritesBarVisibility);
  useTabStripPlacementSync(isMainSurface);
  useFavoritesBarVisibilitySync(isMainSurface);
  const chromeRef = useRef<HTMLElement>(null);
  const resolvedTheme = useResolvedTheme();
  const themeClassName = resolvedTheme === "light" ? "theme-light" : "theme-dark";

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
        className={`${themeClassName} h-screen bg-bg-chrome text-text-primary ${
          tabStripPlacement === "right" ? "border-l" : "border-r"
        } border-border`}
      >
        <TabBar orientation="vertical" />
      </div>
    );
  }

  return (
    <div className={`${themeClassName} min-h-screen bg-transparent text-text-primary`}>
      <header
        ref={chromeRef}
        className="app-region-drag fixed inset-x-0 top-0 z-[100] border-b border-border bg-bg-chrome"
      >
        {tabStripPlacement === "top" ? <TabBar orientation="horizontal" /> : <SideTabTopBar />}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-[14px] px-[18px] pb-3">
          <Toolbar />
          <AddressBar />
          <BrowserMenuButton />
        </div>
        {favoritesBarVisibility === "always" ? <FavoritesBar /> : null}
      </header>
    </div>
  );
}

function useResolvedTheme(): "light" | "dark" {
  const getSystemTheme = () =>
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(getSystemTheme);

  useEffect(() => {
    void window.browserAPI.theme.getState().then((themeState) => {
      setResolvedTheme(themeState.resolvedTheme);
    });

    const handleThemeChanged = (themeState: unknown) => {
      if (
        typeof themeState === "object" &&
        themeState !== null &&
        "resolvedTheme" in themeState &&
        (themeState.resolvedTheme === "light" || themeState.resolvedTheme === "dark")
      ) {
        setResolvedTheme(themeState.resolvedTheme);
      }
    };

    window.browserAPI.on("theme:changed", handleThemeChanged);
    return () => {
      window.browserAPI.off("theme:changed", handleThemeChanged);
    };
  }, []);

  return resolvedTheme;
}

function SideTabTopBar() {
  return <div className="min-h-[58px] py-3 pb-[6px] pl-[84px] pr-[18px]" />;
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

function useFavoritesBarVisibilitySync(isMainSurface: boolean): void {
  const setFavoritesBarVisibility = useUIStore((state) => state.setFavoritesBarVisibility);

  useEffect(() => {
    const applyVisibility = (visibility: unknown) => {
      if (!isFavoritesBarVisibility(visibility)) {
        return;
      }

      setFavoritesBarVisibility(visibility);
    };

    void window.browserAPI.layout.getFavoritesBarVisibility().then((visibility) => {
      if (isMainSurface) {
        applyVisibility(visibility);
      }
    });

    window.browserAPI.on("layout:favoritesBarVisibilityChanged", applyVisibility);
    return () => {
      window.browserAPI.off("layout:favoritesBarVisibilityChanged", applyVisibility);
    };
  }, [isMainSurface, setFavoritesBarVisibility]);
}

function getChromeSurface(): ChromeSurface {
  return new URLSearchParams(window.location.search).get("surface") === "side-tabs"
    ? "side-tabs"
    : "main";
}

function isTabStripPlacement(value: unknown): value is TabStripPlacement {
  return value === "top" || value === "left" || value === "right";
}

function isFavoritesBarVisibility(value: unknown): value is FavoritesBarVisibility {
  return value === "always" || value === "never";
}

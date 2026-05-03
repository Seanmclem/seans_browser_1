import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Download, Lock, LockOpen, Shield, Star } from "lucide-react";
import { useTabStore } from "../../store/tabStore";
import { useUIStore } from "../../store/uiStore";

const ACTION_BUTTON_CLASS =
  "inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors duration-150 hover:bg-accent-subtle hover:text-text-primary";

export function AddressBar() {
  const { activeTabId, tabs } = useTabStore();
  const focusNonce = useUIStore((state) => state.addressBarFocusNonce);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const inputRef = useRef<HTMLInputElement>(null);
  const pageInfoRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPageInfoOpen, setIsPageInfoOpen] = useState(false);
  const isSecure = activeTab?.url.startsWith("https://") ?? false;
  const canFavorite = Boolean(activeTab && !isInternalOrBlankPage(activeTab.url));
  const pageInfo = useMemo(() => buildPageInfo(activeTab?.url), [activeTab?.url]);

  useEffect(() => {
    if (!isFocused) {
      setInputValue(activeTab?.url ?? "");
    }
  }, [activeTab?.url, isFocused]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusNonce]);

  useEffect(() => {
    if (!canFavorite || !activeTab?.url) {
      setIsFavorite(false);
      return;
    }

    void window.browserAPI.browser
      .getFavoriteStatus(activeTab.url)
      .then((favoriteStatus) => setIsFavorite(favoriteStatus.isFavorited));
  }, [activeTab?.url, canFavorite]);

  useEffect(() => {
    if (!isPageInfoOpen) {
      return;
    }

    const closeIfOutside = (event: MouseEvent) => {
      if (!pageInfoRef.current?.contains(event.target as Node)) {
        setIsPageInfoOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPageInfoOpen(false);
      }
    };

    window.addEventListener("mousedown", closeIfOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeIfOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isPageInfoOpen]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTabId) {
      return;
    }
    void window.browserAPI.nav.loadURL(activeTabId, inputValue);
  };

  const toggleFavorite = async () => {
    if (!activeTab || !canFavorite) {
      return;
    }

    const nextState = await window.browserAPI.browser.toggleFavorite({
      favicon: activeTab.favicon,
      title: activeTab.title || activeTab.url,
      url: activeTab.url
    });
    setIsFavorite(nextState.isFavorited);
  };

  return (
    <form
      className="app-region-no-drag relative grid w-full grid-cols-[auto_1fr_auto] items-center gap-[10px] rounded-[18px] border border-border bg-bg-base px-[14px] py-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      onSubmit={handleSubmit}
    >
      <button
        aria-label={isSecure ? "Secure connection" : "Page information"}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
          isSecure ? "bg-emerald-500 text-white" : "bg-red-200 text-red-800"
        }`}
        onClick={() => setIsPageInfoOpen((value) => !value)}
        title={isSecure ? "Secure connection" : "Page information"}
        type="button"
      >
        {isSecure ? (
          <Lock aria-hidden size={15} strokeWidth={2.6} />
        ) : (
          <LockOpen aria-hidden size={15} strokeWidth={2.6} />
        )}
      </button>
      <input
        ref={inputRef}
        className="w-full border-0 bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-muted"
        value={isFocused ? inputValue : activeTab?.url ?? ""}
        onBlur={() => setIsFocused(false)}
        onChange={(event) => setInputValue(event.target.value)}
        onFocus={(event) => {
          const input = event.currentTarget;
          setIsFocused(true);
          setInputValue(activeTab?.url ?? "");
          requestAnimationFrame(() => input.select());
        }}
        placeholder="Search or enter URL"
        spellCheck={false}
      />
      <div className="flex items-center gap-1">
        <button
          aria-label="Open downloads"
          className={ACTION_BUTTON_CLASS}
          onClick={() => {
            void window.browserAPI.browser.openDownloads();
          }}
          title="Downloads"
          type="button"
        >
          <Download aria-hidden size={16} strokeWidth={2.3} />
        </button>
        <button
          aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
          className={`${ACTION_BUTTON_CLASS} ${isFavorite ? "text-amber-400" : ""}`}
          disabled={!canFavorite}
          onClick={() => {
            void toggleFavorite();
          }}
          title={isFavorite ? "Remove favorite" : "Add favorite"}
          type="button"
        >
          <Star
            aria-hidden
            fill={isFavorite ? "currentColor" : "none"}
            size={16}
            strokeWidth={2.3}
          />
        </button>
      </div>

      {isPageInfoOpen ? (
        <div
          ref={pageInfoRef}
          className="absolute left-0 top-[58px] z-[310] w-[320px] rounded-3xl border border-border bg-bg-base p-4 text-text-primary shadow-[0_22px_60px_rgba(2,6,23,0.58)]"
        >
          <div className="mb-3 flex items-start gap-3">
            <span
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                isSecure ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/15 text-red-200"
              }`}
            >
              <Shield aria-hidden size={18} strokeWidth={2.2} />
            </span>
            <div className="grid gap-1">
              <strong className="text-[15px]">
                {pageInfo.label}
              </strong>
              <span className="text-sm text-text-muted">{pageInfo.supportingText}</span>
            </div>
          </div>
          <div className="grid gap-2 rounded-2xl border border-border bg-bg-chrome p-3 text-sm">
            <div>
              <strong className="block text-[12px] uppercase tracking-[0.12em] text-text-muted">
                Host
              </strong>
              <span>{pageInfo.host}</span>
            </div>
            <div>
              <strong className="block text-[12px] uppercase tracking-[0.12em] text-text-muted">
                URL
              </strong>
              <span className="break-all">{activeTab?.url ?? "No page loaded"}</span>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function isInternalOrBlankPage(url?: string): boolean {
  return !url || url.startsWith("about:") || url.startsWith("seans-browser://");
}

function buildPageInfo(url?: string): {
  host: string;
  label: string;
  supportingText: string;
} {
  if (!url) {
    return {
      host: "No page",
      label: "No active page",
      supportingText: "Open a page to inspect its connection and URL."
    };
  }

  if (url.startsWith("seans-browser://")) {
    return {
      host: "Internal page",
      label: "Internal browser page",
      supportingText: "This page is rendered locally by the browser itself."
    };
  }

  try {
    const parsed = new URL(url);
    return {
      host: parsed.host,
      label: parsed.protocol === "https:" ? "Secure connection" : "Standard web page",
      supportingText:
        parsed.protocol === "https:"
          ? "This page is using HTTPS."
          : "This page is not using HTTPS."
    };
  } catch {
    return {
      host: "Unknown",
      label: "Page information",
      supportingText: "The current address could not be parsed cleanly."
    };
  }
}

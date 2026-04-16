import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent
} from "react";
import { useTabStore } from "../../store/tabStore";
import { useUIStore, type TabStripPlacement } from "../../store/uiStore";

const BROWSER_MENU_WIDTH = 260;
const BROWSER_MENU_OVERLAY_PADDING = 16;

interface BrowserMenuState {
  x: number;
  y: number;
}

interface AddFavoriteModalState {
  favicon: string | null;
  title: string;
  url: string;
}

interface BrowserMenuButtonProps {
  className?: string;
}

export function BrowserMenuButton({ className = "" }: BrowserMenuButtonProps) {
  const { activeTabId, setActiveTabId, tabs } = useTabStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const tabStripPlacement = useUIStore((state) => state.tabStripPlacement);
  const setTabStripPlacement = useUIStore((state) => state.setTabStripPlacement);
  const [browserMenu, setBrowserMenu] = useState<BrowserMenuState | null>(null);
  const [favoriteFolders, setFavoriteFolders] = useState<FavoriteFolderOption[]>([]);
  const [favoriteFolderId, setFavoriteFolderId] = useState<string>("");
  const [favoriteModal, setFavoriteModal] = useState<AddFavoriteModalState | null>(null);
  const [favoriteTitle, setFavoriteTitle] = useState("");
  const [favoriteUrl, setFavoriteUrl] = useState("");
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const activeTabCanBeFavorited = activeTab ? !isInternalOrBlankPage(activeTab.url) : false;

  useEffect(() => {
    if (!browserMenu && !favoriteModal) {
      void window.browserAPI.layout.setChromeOverlayHeight(0);
    }

    if (!browserMenu && !favoriteModal) {
      return;
    }

    const closeFloatingUi = () => {
      setBrowserMenu(null);
      setFavoriteModal(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeFloatingUi();
      }
    };

    window.addEventListener("click", closeFloatingUi);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeFloatingUi);
      window.removeEventListener("keydown", closeOnEscape);
      void window.browserAPI.layout.setChromeOverlayHeight(0);
    };
  }, [browserMenu, favoriteModal]);

  useLayoutEffect(() => {
    const floatingElement = favoriteModal ? modalRef.current : menuRef.current;
    if ((!browserMenu && !favoriteModal) || !floatingElement) {
      return;
    }

    const syncOverlayHeight = () => {
      const bounds = floatingElement.getBoundingClientRect();
      if (!bounds) {
        return;
      }

      void window.browserAPI.layout.setChromeOverlayHeight(
        bounds.bottom + BROWSER_MENU_OVERLAY_PADDING
      );
    };

    syncOverlayHeight();
    const observer = new ResizeObserver(syncOverlayHeight);
    observer.observe(floatingElement);
    return () => observer.disconnect();
  }, [browserMenu, favoriteModal]);

  const handleNewTab = async () => {
    const id = await window.browserAPI.tab.create();
    setActiveTabId(id);
  };

  const handleOpenMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.blur();
    const menuX = bounds.right - BROWSER_MENU_WIDTH;
    void window.browserAPI.layout.setChromeOverlayHeight(bounds.bottom + 80);
    setBrowserMenu({
      x: Math.max(12, Math.min(menuX, window.innerWidth - BROWSER_MENU_WIDTH - 12)),
      y: bounds.bottom + 8
    });
  };

  const runBrowserMenuAction = (action: () => Promise<void> | void) => {
    setBrowserMenu(null);
    void action();
  };

  const openAddFavoriteModal = async () => {
    if (!activeTab || !activeTabCanBeFavorited) {
      return;
    }

    setBrowserMenu(null);
    setFavoriteModal({
      favicon: activeTab.favicon,
      title: activeTab.title,
      url: activeTab.url
    });
    setFavoriteTitle(activeTab.title);
    setFavoriteUrl(activeTab.url);
    setFavoriteFolderId("");
    setNewFolderTitle("");
    setFavoriteError(null);
    try {
      setFavoriteFolders(await window.browserAPI.browser.listFavoriteFolders());
    } catch {
      setFavoriteError("Could not load favorite folders. Try closing and reopening the browser.");
    }
    void window.browserAPI.layout.setChromeOverlayHeight(window.innerHeight);
  };

  const createFavoriteFolder = async () => {
    const title = newFolderTitle.trim();
    if (!title) {
      return;
    }

    try {
      const folder = await window.browserAPI.browser.createFavoriteFolder({
        parentFolderId: favoriteFolderId || null,
        title
      });
      if (!folder) {
        setFavoriteError("Folder needs a name before it can be added.");
        return;
      }

      setFavoriteFolders(await window.browserAPI.browser.listFavoriteFolders());
      setFavoriteFolderId(folder.id);
      setNewFolderTitle("");
      setFavoriteError(null);
    } catch {
      setFavoriteError("Could not create that folder. Try again after restarting the browser.");
    }
  };

  const saveFavorite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!favoriteModal) {
      return;
    }

    try {
      const savedId = await window.browserAPI.browser.addFavorite({
        favicon: favoriteModal.favicon,
        parentFolderId: favoriteFolderId || null,
        title: favoriteTitle,
        url: favoriteUrl
      });

      if (savedId) {
        setFavoriteModal(null);
        setFavoriteError(null);
        return;
      }

      setFavoriteError("That page cannot be saved as a favorite.");
    } catch {
      setFavoriteError("Could not save the favorite. Try again after restarting the browser.");
    }
  };

  const changeTabPlacement = async (placement: TabStripPlacement) => {
    setTabStripPlacement(placement);
    await window.browserAPI.layout.setTabStripPlacement(placement);
  };

  return (
    <>
      <button
        aria-label="Open browser menu"
        className={`app-region-no-drag relative inline-flex h-10 w-10 cursor-pointer flex-col items-center justify-center gap-[4px] rounded-[14px] border border-border bg-bg-surface text-text-primary transition-colors duration-150 hover:bg-accent-subtle active:bg-accent-subtle/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tab-border-active ${className}`}
        onClick={handleOpenMenu}
        onMouseLeave={(event) => event.currentTarget.blur()}
        type="button"
      >
        <span className="block h-[2px] w-4 rounded-full bg-current" />
        <span className="block h-[2px] w-4 rounded-full bg-current" />
        <span className="block h-[2px] w-4 rounded-full bg-current" />
      </button>

      {browserMenu ? (
        <div
          ref={menuRef}
          className="app-region-no-drag fixed z-[300] w-[260px] overflow-hidden rounded-2xl border border-border bg-bg-base p-1.5 text-[13px] text-text-primary shadow-[0_18px_46px_rgba(2,6,23,0.48)]"
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
          style={{
            left: browserMenu.x,
            top: browserMenu.y
          }}
        >
          <BrowserMenuItem
            label="New Tab"
            shortcut="⌘T"
            onClick={() => runBrowserMenuAction(handleNewTab)}
          />
          <BrowserMenuItem
            label="History"
            shortcut="⌘Y"
            onClick={() => runBrowserMenuAction(() => window.browserAPI.browser.openHistory())}
          />
          {activeTabCanBeFavorited ? (
            <BrowserMenuItem
              label="Add Favorite..."
              onClick={() => runBrowserMenuAction(openAddFavoriteModal)}
            />
          ) : null}
          <BrowserMenuItem
            label="Favorites"
            onClick={() => runBrowserMenuAction(() => window.browserAPI.browser.openFavorites())}
          />
          <div className="my-1 h-px bg-border" />
          <BrowserMenuItem
            disabled={!activeTab?.canGoBack || !activeTabId}
            label="Back"
            onClick={() =>
              runBrowserMenuAction(() => {
                if (activeTabId) {
                  return window.browserAPI.nav.back(activeTabId);
                }
              })
            }
          />
          <BrowserMenuItem
            disabled={!activeTab?.canGoForward || !activeTabId}
            label="Forward"
            onClick={() =>
              runBrowserMenuAction(() => {
                if (activeTabId) {
                  return window.browserAPI.nav.forward(activeTabId);
                }
              })
            }
          />
          <BrowserMenuItem
            disabled={!activeTabId}
            label="Reload"
            shortcut="⌘R"
            onClick={() =>
              runBrowserMenuAction(() => {
                if (activeTabId) {
                  return window.browserAPI.nav.reload(activeTabId);
                }
              })
            }
          />
          <div className="my-1 h-px bg-border" />
          <BrowserMenuItem
            checked={tabStripPlacement === "top"}
            label="Tabs on Top"
            onClick={() => runBrowserMenuAction(() => changeTabPlacement("top"))}
          />
          <BrowserMenuItem
            checked={tabStripPlacement === "left"}
            label="Tabs on Left"
            onClick={() => runBrowserMenuAction(() => changeTabPlacement("left"))}
          />
          <BrowserMenuItem
            checked={tabStripPlacement === "right"}
            label="Tabs on Right"
            onClick={() => runBrowserMenuAction(() => changeTabPlacement("right"))}
          />
          <div className="my-1 h-px bg-border" />
          <BrowserMenuItem
            disabled={!activeTabId}
            label="Move Active Tab to New Window"
            onClick={() =>
              runBrowserMenuAction(() => window.browserAPI.browser.moveActiveTabToNewWindow())
            }
          />
          <BrowserMenuItem
            disabled={!activeTabId}
            label="Sleep Active Tab"
            onClick={() => runBrowserMenuAction(() => window.browserAPI.browser.sleepActiveTab())}
          />
          <BrowserMenuItem
            disabled={!activeTabId}
            label="Close Active Tab"
            shortcut="⌘W"
            tone="danger"
            onClick={() => runBrowserMenuAction(() => window.browserAPI.browser.closeActiveTab())}
          />
        </div>
      ) : null}

      {favoriteModal ? (
        <div
          ref={modalRef}
          className="app-region-no-drag fixed right-4 top-[72px] z-[320] w-[380px] rounded-3xl border border-border bg-bg-base p-4 text-[13px] text-text-primary shadow-[0_22px_60px_rgba(2,6,23,0.58)]"
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <form className="grid gap-3" onSubmit={saveFavorite}>
            <div>
              <h2 className="m-0 text-lg font-bold tracking-[-0.02em]">Add Favorite</h2>
              <p className="mt-1 text-xs text-text-muted">
                Save this page locally. You can edit the title, URL, and virtual folder first.
              </p>
            </div>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                Title
              </span>
              <input
                className="rounded-2xl border border-border bg-bg-chrome px-3 py-2 text-sm text-text-primary outline-none focus:border-tab-border-active"
                value={favoriteTitle}
                onChange={(event) => setFavoriteTitle(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                URL
              </span>
              <input
                className="rounded-2xl border border-border bg-bg-chrome px-3 py-2 text-sm text-text-primary outline-none focus:border-tab-border-active"
                value={favoriteUrl}
                onChange={(event) => setFavoriteUrl(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                Folder
              </span>
              <select
                className="rounded-2xl border border-border bg-bg-chrome px-3 py-2 text-sm text-text-primary outline-none focus:border-tab-border-active"
                value={favoriteFolderId}
                onChange={(event) => setFavoriteFolderId(event.target.value)}
              >
                <option value="">Top level</option>
                {favoriteFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                className="rounded-2xl border border-border bg-bg-chrome px-3 py-2 text-sm text-text-primary outline-none focus:border-tab-border-active"
                value={newFolderTitle}
                onChange={(event) => setNewFolderTitle(event.target.value)}
                placeholder={favoriteFolderId ? "New nested folder" : "New top-level folder"}
              />
              <button
                className="rounded-2xl border border-border bg-bg-surface px-3 py-2 font-semibold text-text-primary transition-colors hover:bg-accent-subtle disabled:opacity-40"
                disabled={!newFolderTitle.trim()}
                onClick={createFavoriteFolder}
                type="button"
              >
                Add Folder
              </button>
            </div>
            {favoriteError ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-950/40 px-3 py-2 text-xs text-red-100">
                {favoriteError}
              </div>
            ) : null}
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                className="rounded-2xl border border-border bg-bg-chrome px-3 py-2 font-semibold text-text-primary transition-colors hover:bg-bg-surface"
                onClick={() => setFavoriteModal(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-2xl border border-tab-border-active bg-accent px-3 py-2 font-bold text-bg-base transition-colors hover:bg-accent/85"
                type="submit"
              >
                Save Favorite
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function isInternalOrBlankPage(url?: string): boolean {
  return !url || url.startsWith("about:") || url.startsWith("seans-browser://");
}

interface BrowserMenuItemProps {
  checked?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  shortcut?: string;
  tone?: "default" | "danger";
}

function BrowserMenuItem({
  checked = false,
  disabled = false,
  label,
  onClick,
  shortcut,
  tone = "default"
}: BrowserMenuItemProps) {
  const toneClass =
    tone === "danger"
      ? "text-red-200 enabled:hover:bg-red-950/80"
      : "text-text-primary enabled:hover:bg-accent-subtle";

  return (
    <button
      className={`grid w-full grid-cols-[18px_1fr_auto] items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors duration-150 disabled:cursor-default disabled:opacity-45 ${toneClass}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="text-[12px] text-accent">{checked ? "*" : ""}</span>
      <span>{label}</span>
      {shortcut ? <span className="text-[11px] text-text-muted">{shortcut}</span> : null}
    </button>
  );
}

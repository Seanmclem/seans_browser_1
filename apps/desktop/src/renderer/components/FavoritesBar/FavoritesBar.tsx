import { useEffect, useState } from "react";
import { Folder, Star } from "lucide-react";
import { useTabStore } from "../../store/tabStore";

interface FavoritesBarItem {
  favicon?: string | null;
  id: string;
  title: string;
  type: "favorite" | "folder";
  url: string;
}

export function FavoritesBar() {
  const { activeTabId } = useTabStore();
  const [items, setItems] = useState<FavoritesBarItem[]>([]);

  useEffect(() => {
    const syncItems = () => {
      void window.browserAPI.browser.listFavoritesBarItems().then(setItems);
    };

    syncItems();
    window.browserAPI.on("favorites:changed", syncItems);
    return () => {
      window.browserAPI.off("favorites:changed", syncItems);
    };
  }, []);

  const openItem = async (item: FavoritesBarItem) => {
    if (activeTabId && item.type === "favorite") {
      await window.browserAPI.nav.loadURL(activeTabId, item.url);
      return;
    }

    await window.browserAPI.tab.create(item.url);
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="app-region-no-drag flex items-center gap-2 overflow-x-auto px-[18px] pb-3">
      {items.map((item) => (
        <button
          key={item.id}
          className="inline-flex h-9 max-w-[220px] shrink-0 items-center gap-2 rounded-xl border border-border bg-bg-surface px-3 text-[13px] text-text-primary transition-colors duration-150 hover:bg-accent-subtle"
          onClick={() => {
            void openItem(item);
          }}
          title={item.title}
          type="button"
        >
          {item.type === "folder" ? (
            <Folder aria-hidden size={15} strokeWidth={2.2} />
          ) : item.favicon ? (
            <img alt="" className="h-4 w-4 rounded" src={item.favicon} />
          ) : (
            <Star aria-hidden size={15} strokeWidth={2.2} />
          )}
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{item.title}</span>
        </button>
      ))}
    </div>
  );
}

import Store from "electron-store";

interface HistoryEntry {
  url: string;
  title: string;
  visitedAt: number;
}

interface StoreSchema {
  history: HistoryEntry[];
  bookmarks: HistoryEntry[];
  settings: Record<string, unknown>;
}

const store = new Store<StoreSchema>({
  defaults: {
    history: [],
    bookmarks: [],
    settings: {}
  }
});

export class HistoryManager {
  addEntry(url: string, title: string): void {
    const history = store.get("history");
    history.unshift({
      url,
      title,
      visitedAt: Date.now()
    });
    store.set("history", history.slice(0, 10_000));
  }

  search(query: string): HistoryEntry[] {
    const normalized = query.trim().toLowerCase();
    return store
      .get("history")
      .filter((entry) => {
        return (
          entry.url.toLowerCase().includes(normalized) ||
          entry.title.toLowerCase().includes(normalized)
        );
      })
      .slice(0, 50);
  }

  clear(): void {
    store.set("history", []);
  }
}


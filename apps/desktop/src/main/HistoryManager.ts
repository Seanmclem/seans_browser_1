import Store from "electron-store";
import { LocalBrowserDatabase } from "./data/LocalBrowserDatabase";
import { SqliteHistoryRepository } from "./data/SqliteHistoryRepository";
import { isInternalPageUrl } from "./InternalPages";

const LEGACY_HISTORY_MIGRATED_META_KEY = "legacyElectronStoreHistoryMigratedAt";

export interface HistoryEntry {
  url: string;
  title: string;
  visitedAt: number;
}

interface LegacyStoreSchema {
  history: HistoryEntry[];
  bookmarks: HistoryEntry[];
  settings: Record<string, unknown>;
}

const legacyStore = new Store<LegacyStoreSchema>({
  defaults: {
    history: [],
    bookmarks: [],
    settings: {}
  }
});

export class HistoryManager {
  private readonly repository: SqliteHistoryRepository;

  constructor(private readonly database = new LocalBrowserDatabase()) {
    this.repository = new SqliteHistoryRepository(database);
    void this.migrateLegacyHistory();
  }

  async addEntry(url: string, title: string): Promise<void> {
    if (!shouldRecordHistoryUrl(url)) {
      return;
    }

    await this.repository.addVisit(
      this.repository.createVisit({
        title,
        transitionType: "unknown",
        url
      })
    );
  }

  async search(query: string, limit = 50): Promise<HistoryEntry[]> {
    const visits = await this.repository.searchVisits({ limit, query });
    return visits.map((visit) => ({
      url: visit.url,
      title: visit.title,
      visitedAt: new Date(visit.visitedAt).getTime()
    }));
  }

  async clear(): Promise<void> {
    const now = new Date().toISOString();
    const visits = await this.repository.searchVisits({
      includeDeleted: false,
      limit: 10_000,
      query: ""
    });

    for (const visit of visits) {
      await this.repository.tombstoneVisit(visit.sync.id, now);
    }
  }

  private async migrateLegacyHistory(): Promise<void> {
    if (this.database.getMeta(LEGACY_HISTORY_MIGRATED_META_KEY)) {
      return;
    }

    const legacyHistory = legacyStore.get("history");
    if (legacyHistory.length > 0) {
      await this.repository.addVisits(
        legacyHistory.map((entry) =>
          this.repository.createVisit({
            title: entry.title,
            transitionType: "restore",
            url: entry.url,
            visitedAt: new Date(entry.visitedAt).toISOString()
          })
        )
      );
    }

    this.database.setMeta(LEGACY_HISTORY_MIGRATED_META_KEY, new Date().toISOString());
  }
}

function shouldRecordHistoryUrl(url: string): boolean {
  return Boolean(url) && !url.startsWith("about:") && !isInternalPageUrl(url);
}

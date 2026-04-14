import {
  normalizeURL,
  type OpenTabRecord,
  type OpenTabsPlacement,
  type OpenTabsRepository,
  type OpenTabsWindowRecord,
  type TabState
} from "@seans-browser/browser-core";
import type { LocalBrowserDatabase } from "./LocalBrowserDatabase";
import {
  appendLocalChange,
  createSyncMetadata,
  syncMetadataFromRow,
  syncStatementParams,
  type SyncColumns
} from "./SqliteSyncHelpers";

interface OpenTabsWindowRow extends SyncColumns {
  active_tab_id: string | null;
  placement: OpenTabsPlacement;
  sort_order: number;
  title: string | null;
}

interface OpenTabRow extends SyncColumns {
  favicon: string | null;
  history_visit_id: string | null;
  last_active_at: string;
  normalized_url: string;
  pinned: 0 | 1;
  position: number;
  saved_scroll_y: number;
  state: TabState;
  title: string;
  url: string;
  window_id: string;
}

export interface CreateOpenTabsWindowInput {
  activeTabId?: string | null;
  id?: string;
  placement?: OpenTabsPlacement;
  sortOrder?: number;
  title?: string | null;
}

export interface CreateOpenTabInput {
  favicon?: string | null;
  historyVisitId?: string | null;
  id?: string;
  lastActiveAt?: string;
  pinned?: boolean;
  position: number;
  savedScrollY?: number;
  state?: TabState;
  title: string;
  url: string;
  windowId: string;
}

export class SqliteOpenTabsRepository implements OpenTabsRepository {
  constructor(private readonly database: LocalBrowserDatabase) {}

  async clearDeletedBefore(before: string): Promise<void> {
    this.database.db
      .prepare("delete from open_tabs where deleted_at is not null and deleted_at < ?")
      .run(before);
    this.database.db
      .prepare("delete from open_tabs_windows where deleted_at is not null and deleted_at < ?")
      .run(before);
  }

  async listOpenTabs(windowId?: string): Promise<OpenTabRecord[]> {
    const rows = this.database.db
      .prepare(
        `select *
         from open_tabs
         where deleted_at is null
           and (@windowId is null or window_id = @windowId)
         order by window_id asc, position asc`
      )
      .all({ windowId: windowId ?? null }) as OpenTabRow[];
    return rows.map(toTabRecord);
  }

  async listOpenTabsWindows(): Promise<OpenTabsWindowRecord[]> {
    const rows = this.database.db
      .prepare(
        `select *
         from open_tabs_windows
         where deleted_at is null
         order by sort_order asc, updated_at asc`
      )
      .all() as OpenTabsWindowRow[];
    return rows.map(toWindowRecord);
  }

  async tombstoneOpenTab(id: string, deletedAt: string): Promise<void> {
    const write = this.database.db.transaction(() => {
      this.database.db
        .prepare(
          `update open_tabs
           set deleted_at = ?, updated_at = ?, local_version = local_version + 1
           where id = ?`
        )
        .run(deletedAt, deletedAt, id);
      appendLocalChange(this.database, "open-tab", id, "delete", deletedAt);
    });
    write();
  }

  async tombstoneOpenTabsWindow(id: string, deletedAt: string): Promise<void> {
    const write = this.database.db.transaction(() => {
      this.database.db
        .prepare(
          `update open_tabs_windows
           set deleted_at = ?, updated_at = ?, local_version = local_version + 1
           where id = ?`
        )
        .run(deletedAt, deletedAt, id);
      appendLocalChange(this.database, "open-tabs-window", id, "delete", deletedAt);
    });
    write();
  }

  async upsertOpenTab(tab: OpenTabRecord): Promise<void> {
    const write = this.database.db.transaction(() => {
      this.database.db
        .prepare(
          `insert into open_tabs (
            id,
            schema_version,
            created_at,
            updated_at,
            deleted_at,
            device_id,
            profile_id,
            local_version,
            remote_version,
            window_id,
            url,
            normalized_url,
            title,
            favicon,
            position,
            pinned,
            state,
            last_active_at,
            saved_scroll_y,
            history_visit_id
          ) values (
            @id,
            @schemaVersion,
            @createdAt,
            @updatedAt,
            @deletedAt,
            @deviceId,
            @profileId,
            @localVersion,
            @remoteVersion,
            @windowId,
            @url,
            @normalizedUrl,
            @title,
            @favicon,
            @position,
            @pinned,
            @state,
            @lastActiveAt,
            @savedScrollY,
            @historyVisitId
          )
          on conflict(id) do update set
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at,
            device_id = excluded.device_id,
            profile_id = excluded.profile_id,
            local_version = open_tabs.local_version + 1,
            remote_version = excluded.remote_version,
            window_id = excluded.window_id,
            url = excluded.url,
            normalized_url = excluded.normalized_url,
            title = excluded.title,
            favicon = excluded.favicon,
            position = excluded.position,
            pinned = excluded.pinned,
            state = excluded.state,
            last_active_at = excluded.last_active_at,
            saved_scroll_y = excluded.saved_scroll_y,
            history_visit_id = excluded.history_visit_id`
        )
        .run(toTabStatementParams(tab));
      appendLocalChange(this.database, "open-tab", tab.sync.id, "upsert", tab.sync.updatedAt);
    });
    write();
  }

  async upsertOpenTabsWindow(window: OpenTabsWindowRecord): Promise<void> {
    const write = this.database.db.transaction(() => {
      this.database.db
        .prepare(
          `insert into open_tabs_windows (
            id,
            schema_version,
            created_at,
            updated_at,
            deleted_at,
            device_id,
            profile_id,
            local_version,
            remote_version,
            active_tab_id,
            placement,
            sort_order,
            title
          ) values (
            @id,
            @schemaVersion,
            @createdAt,
            @updatedAt,
            @deletedAt,
            @deviceId,
            @profileId,
            @localVersion,
            @remoteVersion,
            @activeTabId,
            @placement,
            @sortOrder,
            @title
          )
          on conflict(id) do update set
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at,
            device_id = excluded.device_id,
            profile_id = excluded.profile_id,
            local_version = open_tabs_windows.local_version + 1,
            remote_version = excluded.remote_version,
            active_tab_id = excluded.active_tab_id,
            placement = excluded.placement,
            sort_order = excluded.sort_order,
            title = excluded.title`
        )
        .run(toWindowStatementParams(window));
      appendLocalChange(
        this.database,
        "open-tabs-window",
        window.sync.id,
        "upsert",
        window.sync.updatedAt
      );
    });
    write();
  }

  createOpenTab(input: CreateOpenTabInput): OpenTabRecord {
    const sync = createSyncMetadata(this.database);
    return {
      entityType: "open-tab",
      favicon: input.favicon ?? null,
      historyVisitId: input.historyVisitId ?? null,
      lastActiveAt: input.lastActiveAt ?? new Date().toISOString(),
      normalizedUrl: normalizeURL(input.url),
      pinned: input.pinned ?? false,
      position: input.position,
      savedScrollY: input.savedScrollY ?? 0,
      state: input.state ?? "awake",
      title: input.title,
      url: input.url,
      windowId: input.windowId,
      sync: {
        ...sync,
        id: input.id ?? sync.id
      }
    };
  }

  createOpenTabsWindow(input: CreateOpenTabsWindowInput = {}): OpenTabsWindowRecord {
    const sync = createSyncMetadata(this.database);
    return {
      entityType: "open-tabs-window",
      activeTabId: input.activeTabId ?? null,
      placement: input.placement ?? "top",
      sortOrder: input.sortOrder ?? 0,
      title: input.title ?? null,
      sync: {
        ...sync,
        id: input.id ?? sync.id
      }
    };
  }
}

function toTabStatementParams(tab: OpenTabRecord) {
  return {
    ...syncStatementParams(tab.sync),
    favicon: tab.favicon,
    historyVisitId: tab.historyVisitId,
    lastActiveAt: tab.lastActiveAt,
    normalizedUrl: tab.normalizedUrl,
    pinned: tab.pinned ? 1 : 0,
    position: tab.position,
    savedScrollY: tab.savedScrollY,
    state: tab.state,
    title: tab.title,
    url: tab.url,
    windowId: tab.windowId
  };
}

function toWindowStatementParams(window: OpenTabsWindowRecord) {
  return {
    ...syncStatementParams(window.sync),
    activeTabId: window.activeTabId,
    placement: window.placement,
    sortOrder: window.sortOrder,
    title: window.title
  };
}

function toTabRecord(row: OpenTabRow): OpenTabRecord {
  return {
    entityType: "open-tab",
    favicon: row.favicon,
    historyVisitId: row.history_visit_id,
    lastActiveAt: row.last_active_at,
    normalizedUrl: row.normalized_url,
    pinned: row.pinned === 1,
    position: row.position,
    savedScrollY: row.saved_scroll_y,
    state: row.state,
    title: row.title,
    url: row.url,
    windowId: row.window_id,
    sync: syncMetadataFromRow(row)
  };
}

function toWindowRecord(row: OpenTabsWindowRow): OpenTabsWindowRecord {
  return {
    entityType: "open-tabs-window",
    activeTabId: row.active_tab_id,
    placement: row.placement,
    sortOrder: row.sort_order,
    title: row.title,
    sync: syncMetadataFromRow(row)
  };
}

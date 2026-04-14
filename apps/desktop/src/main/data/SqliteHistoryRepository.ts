import { randomUUID } from "node:crypto";
import {
  normalizeURL,
  type HistoryRepository,
  type HistorySearchOptions,
  type HistoryTransitionType,
  type HistoryVisitRecord,
  type ISODateTime,
  type SyncChangeOperation
} from "@seans-browser/browser-core";
import type { LocalBrowserDatabase } from "./LocalBrowserDatabase";

interface HistoryVisitRow {
  id: string;
  schema_version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
  profile_id: string;
  local_version: number;
  remote_version: string | null;
  url: string;
  normalized_url: string;
  title: string;
  visited_at: string;
  transition_type: HistoryTransitionType;
  tab_id: string | null;
  window_id: string | null;
  favicon: string | null;
}

export interface CreateHistoryVisitInput {
  favicon?: string | null;
  tabId?: string | null;
  title: string;
  transitionType?: HistoryTransitionType;
  url: string;
  visitedAt?: ISODateTime;
  windowId?: string | null;
}

export class SqliteHistoryRepository implements HistoryRepository {
  private readonly deviceId: string;
  private readonly profileId: string;

  constructor(private readonly database: LocalBrowserDatabase) {
    this.deviceId = database.getDeviceId();
    this.profileId = database.getProfileId();
  }

  async addVisit(visit: HistoryVisitRecord): Promise<void> {
    const write = this.database.db.transaction(() => {
      this.database.db
        .prepare(
          `insert into history_visits (
            id,
            schema_version,
            created_at,
            updated_at,
            deleted_at,
            device_id,
            profile_id,
            local_version,
            remote_version,
            url,
            normalized_url,
            title,
            visited_at,
            transition_type,
            tab_id,
            window_id,
            favicon
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
            @url,
            @normalizedUrl,
            @title,
            @visitedAt,
            @transitionType,
            @tabId,
            @windowId,
            @favicon
          )`
        )
        .run(toStatementParams(visit));
      this.appendLocalChange("upsert", visit.sync.id, visit.sync.updatedAt);
    });
    write();
  }

  async addVisits(visits: HistoryVisitRecord[]): Promise<void> {
    const write = this.database.db.transaction(() => {
      const insert = this.database.db.prepare(
        `insert into history_visits (
          id,
          schema_version,
          created_at,
          updated_at,
          deleted_at,
          device_id,
          profile_id,
          local_version,
          remote_version,
          url,
          normalized_url,
          title,
          visited_at,
          transition_type,
          tab_id,
          window_id,
          favicon
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
          @url,
          @normalizedUrl,
          @title,
          @visitedAt,
          @transitionType,
          @tabId,
          @windowId,
          @favicon
        )`
      );

      for (const visit of visits) {
        insert.run(toStatementParams(visit));
        this.appendLocalChange("upsert", visit.sync.id, visit.sync.updatedAt);
      }
    });
    write();
  }

  async clearDeletedBefore(before: ISODateTime): Promise<void> {
    this.database.db
      .prepare("delete from history_visits where deleted_at is not null and deleted_at < ?")
      .run(before);
  }

  async getVisit(id: string): Promise<HistoryVisitRecord | null> {
    const row = this.database.db
      .prepare("select * from history_visits where id = ?")
      .get(id) as HistoryVisitRow | undefined;
    return row ? toRecord(row) : null;
  }

  async searchVisits(options: HistorySearchOptions): Promise<HistoryVisitRecord[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
    const query = `%${options.query.trim().toLowerCase()}%`;
    const includeDeleted = options.includeDeleted === true;
    const rows = this.database.db
      .prepare(
        `select *
         from history_visits
         where
           (@includeDeleted = 1 or deleted_at is null)
           and (@query = '%%' or lower(url) like @query or lower(title) like @query)
         order by visited_at desc
         limit @limit`
      )
      .all({ includeDeleted: includeDeleted ? 1 : 0, limit, query }) as HistoryVisitRow[];
    return rows.map(toRecord);
  }

  async tombstoneVisit(id: string, deletedAt: ISODateTime): Promise<void> {
    const write = this.database.db.transaction(() => {
      this.database.db
        .prepare(
          `update history_visits
           set deleted_at = ?, updated_at = ?, local_version = local_version + 1
           where id = ?`
        )
        .run(deletedAt, deletedAt, id);
      this.appendLocalChange("delete", id, deletedAt);
    });
    write();
  }

  createVisit(input: CreateHistoryVisitInput): HistoryVisitRecord {
    const now = new Date().toISOString();
    const visitedAt = input.visitedAt ?? now;
    return {
      entityType: "history-visit",
      favicon: input.favicon ?? null,
      normalizedUrl: normalizeURL(input.url),
      tabId: input.tabId ?? null,
      title: input.title,
      transitionType: input.transitionType ?? "unknown",
      url: input.url,
      visitedAt,
      windowId: input.windowId ?? null,
      sync: {
        id: randomUUID(),
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        deviceId: this.deviceId,
        profileId: this.profileId,
        localVersion: 1,
        remoteVersion: null
      }
    };
  }

  private appendLocalChange(
    operation: SyncChangeOperation,
    targetEntityId: string,
    changedAt: ISODateTime
  ): void {
    const id = randomUUID();
    this.database.db
      .prepare(
        `insert into local_changes (
          id,
          schema_version,
          created_at,
          updated_at,
          deleted_at,
          device_id,
          profile_id,
          local_version,
          remote_version,
          target_entity_type,
          target_entity_id,
          operation,
          changed_at,
          payload_version
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        1,
        changedAt,
        changedAt,
        null,
        this.deviceId,
        this.profileId,
        1,
        null,
        "history-visit",
        targetEntityId,
        operation,
        changedAt,
        1
      );
  }
}

function toStatementParams(visit: HistoryVisitRecord) {
  return {
    id: visit.sync.id,
    schemaVersion: visit.sync.schemaVersion,
    createdAt: visit.sync.createdAt,
    updatedAt: visit.sync.updatedAt,
    deletedAt: visit.sync.deletedAt,
    deviceId: visit.sync.deviceId,
    profileId: visit.sync.profileId,
    localVersion: visit.sync.localVersion,
    remoteVersion: visit.sync.remoteVersion,
    url: visit.url,
    normalizedUrl: visit.normalizedUrl,
    title: visit.title,
    visitedAt: visit.visitedAt,
    transitionType: visit.transitionType,
    tabId: visit.tabId,
    windowId: visit.windowId,
    favicon: visit.favicon
  };
}

function toRecord(row: HistoryVisitRow): HistoryVisitRecord {
  return {
    entityType: "history-visit",
    favicon: row.favicon,
    normalizedUrl: row.normalized_url,
    tabId: row.tab_id,
    title: row.title,
    transitionType: row.transition_type,
    url: row.url,
    visitedAt: row.visited_at,
    windowId: row.window_id,
    sync: {
      id: row.id,
      schemaVersion: row.schema_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      deviceId: row.device_id,
      profileId: row.profile_id,
      localVersion: row.local_version,
      remoteVersion: row.remote_version
    }
  };
}

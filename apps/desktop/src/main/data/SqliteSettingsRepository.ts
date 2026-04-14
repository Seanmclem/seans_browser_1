import {
  type BrowserPlatform,
  type BrowserSettingRecord,
  type BrowserSettingScope,
  type JsonValue,
  type SettingsRepository
} from "@seans-browser/browser-core";
import type { LocalBrowserDatabase } from "./LocalBrowserDatabase";
import {
  appendLocalChange,
  createSyncMetadata,
  syncMetadataFromRow,
  syncStatementParams,
  type SyncColumns
} from "./SqliteSyncHelpers";

interface BrowserSettingRow extends SyncColumns {
  key: string;
  value_json: string;
  scope: BrowserSettingScope;
  platform: BrowserPlatform | "all";
}

export interface CreateBrowserSettingInput {
  key: string;
  platform?: BrowserPlatform | "all";
  scope?: BrowserSettingScope;
  value: JsonValue;
}

export class SqliteSettingsRepository implements SettingsRepository {
  constructor(private readonly database: LocalBrowserDatabase) {}

  async getSetting(
    key: string,
    platform: BrowserPlatform | "all" = "all"
  ): Promise<BrowserSettingRecord | null> {
    const row = this.database.db
      .prepare(
        `select *
         from browser_settings
         where key = ?
           and deleted_at is null
           and (platform = ? or platform = 'all')
         order by case when platform = ? then 0 else 1 end
         limit 1`
      )
      .get(key, platform, platform) as BrowserSettingRow | undefined;

    return row ? toRecord(row) : null;
  }

  async listSettings(scope?: BrowserSettingScope): Promise<BrowserSettingRecord[]> {
    const rows = this.database.db
      .prepare(
        `select *
         from browser_settings
         where deleted_at is null
           and (@scope is null or scope = @scope)
         order by key asc, platform asc`
      )
      .all({ scope: scope ?? null }) as BrowserSettingRow[];

    return rows.map(toRecord);
  }

  async tombstoneSetting(id: string, deletedAt: string): Promise<void> {
    const write = this.database.db.transaction(() => {
      this.database.db
        .prepare(
          `update browser_settings
           set deleted_at = ?, updated_at = ?, local_version = local_version + 1
           where id = ?`
        )
        .run(deletedAt, deletedAt, id);
      appendLocalChange(this.database, "browser-setting", id, "delete", deletedAt);
    });
    write();
  }

  async upsertSetting(setting: BrowserSettingRecord): Promise<void> {
    const write = this.database.db.transaction(() => {
      this.database.db
        .prepare(
          `insert into browser_settings (
            id,
            schema_version,
            created_at,
            updated_at,
            deleted_at,
            device_id,
            profile_id,
            local_version,
            remote_version,
            key,
            value_json,
            scope,
            platform
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
            @key,
            @valueJson,
            @scope,
            @platform
          )
          on conflict(key, scope, platform) do update set
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at,
            device_id = excluded.device_id,
            profile_id = excluded.profile_id,
            local_version = browser_settings.local_version + 1,
            remote_version = excluded.remote_version,
            value_json = excluded.value_json`
        )
        .run(toStatementParams(setting));
      appendLocalChange(this.database, "browser-setting", setting.sync.id, "upsert", setting.sync.updatedAt);
    });
    write();
  }

  createSetting(input: CreateBrowserSettingInput): BrowserSettingRecord {
    return {
      entityType: "browser-setting",
      key: input.key,
      platform: input.platform ?? "all",
      scope: input.scope ?? "profile",
      value: input.value,
      sync: createSyncMetadata(this.database)
    };
  }
}

function toStatementParams(setting: BrowserSettingRecord) {
  return {
    ...syncStatementParams(setting.sync),
    key: setting.key,
    valueJson: JSON.stringify(setting.value),
    scope: setting.scope,
    platform: setting.platform
  };
}

function toRecord(row: BrowserSettingRow): BrowserSettingRecord {
  return {
    entityType: "browser-setting",
    key: row.key,
    platform: row.platform,
    scope: row.scope,
    value: JSON.parse(row.value_json) as JsonValue,
    sync: syncMetadataFromRow(row)
  };
}

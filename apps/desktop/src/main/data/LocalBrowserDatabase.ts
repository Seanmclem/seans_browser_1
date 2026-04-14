import Database from "better-sqlite3";
import { app } from "electron";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const DATABASE_FILE_NAME = "browser-data.sqlite3";
const DATABASE_SCHEMA_VERSION = 1;

export class LocalBrowserDatabase {
  readonly db: Database.Database;

  constructor(databasePath = getDefaultDatabasePath()) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  getDeviceId(): string {
    return this.getOrCreateMeta("deviceId", () => randomUUID());
  }

  getProfileId(): string {
    return this.getOrCreateMeta("profileId", () => "default");
  }

  getMeta(key: string): string | null {
    const row = this.db
      .prepare("select value from app_meta where key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare(
        `insert into app_meta (key, value)
         values (?, ?)
         on conflict(key) do update set value = excluded.value`
      )
      .run(key, value);
  }

  private getOrCreateMeta(key: string, createValue: () => string): string {
    const existing = this.getMeta(key);
    if (existing) {
      return existing;
    }

    const value = createValue();
    this.setMeta(key, value);
    return value;
  }

  private migrate(): void {
    const currentVersion = this.db.pragma("user_version", { simple: true }) as number;
    if (currentVersion >= DATABASE_SCHEMA_VERSION) {
      return;
    }

    const runMigration = this.db.transaction(() => {
      this.db.exec(`
        create table if not exists schema_migrations (
          version integer primary key,
          applied_at text not null
        );

        create table if not exists app_meta (
          key text primary key,
          value text not null
        );

        create table if not exists history_visits (
          id text primary key,
          schema_version integer not null,
          created_at text not null,
          updated_at text not null,
          deleted_at text,
          device_id text not null,
          profile_id text not null,
          local_version integer not null,
          remote_version text,
          url text not null,
          normalized_url text not null,
          title text not null,
          visited_at text not null,
          transition_type text not null,
          tab_id text,
          window_id text,
          favicon text
        );

        create index if not exists idx_history_visits_visited_at
          on history_visits (visited_at desc);

        create index if not exists idx_history_visits_normalized_url
          on history_visits (normalized_url);

        create table if not exists local_changes (
          id text primary key,
          schema_version integer not null,
          created_at text not null,
          updated_at text not null,
          deleted_at text,
          device_id text not null,
          profile_id text not null,
          local_version integer not null,
          remote_version text,
          target_entity_type text not null,
          target_entity_id text not null,
          operation text not null,
          changed_at text not null,
          payload_version integer not null
        );

        create index if not exists idx_local_changes_changed_at
          on local_changes (changed_at asc);
      `);

      this.db
        .prepare(
          `insert or ignore into schema_migrations (version, applied_at)
           values (?, ?)`
        )
        .run(DATABASE_SCHEMA_VERSION, new Date().toISOString());
      this.db.pragma(`user_version = ${DATABASE_SCHEMA_VERSION}`);
    });

    runMigration();
  }
}

function getDefaultDatabasePath(): string {
  return join(app.getPath("userData"), DATABASE_FILE_NAME);
}

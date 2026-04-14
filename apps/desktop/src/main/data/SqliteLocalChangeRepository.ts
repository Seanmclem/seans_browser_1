import type {
  LocalChangeRecord,
  LocalChangeRepository,
  SyncChangeOperation,
  SyncEntityType
} from "@seans-browser/browser-core";
import type { LocalBrowserDatabase } from "./LocalBrowserDatabase";
import {
  syncMetadataFromRow,
  syncStatementParams,
  type SyncColumns
} from "./SqliteSyncHelpers";

interface LocalChangeRow extends SyncColumns {
  changed_at: string;
  operation: SyncChangeOperation;
  payload_version: number;
  target_entity_id: string;
  target_entity_type: SyncEntityType;
}

export class SqliteLocalChangeRepository implements LocalChangeRepository {
  constructor(private readonly database: LocalBrowserDatabase) {}

  async appendChange(change: LocalChangeRecord): Promise<void> {
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
          @targetEntityType,
          @targetEntityId,
          @operation,
          @changedAt,
          @payloadVersion
        )`
      )
      .run({
        ...syncStatementParams(change.sync),
        changedAt: change.changedAt,
        operation: change.operation,
        payloadVersion: change.payloadVersion,
        targetEntityId: change.targetEntityId,
        targetEntityType: change.targetEntityType
      });
  }

  async deleteChange(id: string): Promise<void> {
    this.database.db.prepare("delete from local_changes where id = ?").run(id);
  }

  async listPendingChanges(limit = 100): Promise<LocalChangeRecord[]> {
    const rows = this.database.db
      .prepare(
        `select *
         from local_changes
         where deleted_at is null
         order by changed_at asc
         limit ?`
      )
      .all(Math.min(Math.max(limit, 1), 1_000)) as LocalChangeRow[];

    return rows.map(toRecord);
  }
}

function toRecord(row: LocalChangeRow): LocalChangeRecord {
  return {
    entityType: "local-change",
    changedAt: row.changed_at,
    operation: row.operation,
    payloadVersion: row.payload_version,
    targetEntityId: row.target_entity_id,
    targetEntityType: row.target_entity_type,
    sync: syncMetadataFromRow(row)
  };
}

import { randomUUID } from "node:crypto";
import type {
  EntityId,
  ISODateTime,
  SyncChangeOperation,
  SyncEntityType,
  SyncMetadata
} from "@seans-browser/browser-core";
import type { LocalBrowserDatabase } from "./LocalBrowserDatabase";

export interface SyncColumns {
  id: string;
  schema_version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
  profile_id: string;
  local_version: number;
  remote_version: string | null;
}

export function createSyncMetadata(database: LocalBrowserDatabase): SyncMetadata {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deviceId: database.getDeviceId(),
    profileId: database.getProfileId(),
    localVersion: 1,
    remoteVersion: null
  };
}

export function syncMetadataFromRow(row: SyncColumns): SyncMetadata {
  return {
    id: row.id,
    schemaVersion: row.schema_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
    profileId: row.profile_id,
    localVersion: row.local_version,
    remoteVersion: row.remote_version
  };
}

export function syncStatementParams(sync: SyncMetadata) {
  return {
    id: sync.id,
    schemaVersion: sync.schemaVersion,
    createdAt: sync.createdAt,
    updatedAt: sync.updatedAt,
    deletedAt: sync.deletedAt,
    deviceId: sync.deviceId,
    profileId: sync.profileId,
    localVersion: sync.localVersion,
    remoteVersion: sync.remoteVersion
  };
}

export function appendLocalChange(
  database: LocalBrowserDatabase,
  targetEntityType: SyncEntityType,
  targetEntityId: EntityId,
  operation: SyncChangeOperation,
  changedAt: ISODateTime
): void {
  database.db
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
      randomUUID(),
      1,
      changedAt,
      changedAt,
      null,
      database.getDeviceId(),
      database.getProfileId(),
      1,
      null,
      targetEntityType,
      targetEntityId,
      operation,
      changedAt,
      1
    );
}

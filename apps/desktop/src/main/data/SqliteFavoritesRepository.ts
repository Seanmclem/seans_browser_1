import {
  normalizeURL,
  type FavoriteFolderRecord,
  type FavoriteRecord,
  type FavoritesRepository
} from "@seans-browser/browser-core";
import type { LocalBrowserDatabase } from "./LocalBrowserDatabase";
import {
  appendLocalChange,
  createSyncMetadata,
  syncMetadataFromRow,
  syncStatementParams,
  type SyncColumns
} from "./SqliteSyncHelpers";

interface FavoriteRow extends SyncColumns {
  favicon: string | null;
  normalized_url: string;
  notes: string | null;
  parent_folder_id: string | null;
  sort_order: number;
  tags_json: string;
  title: string;
  url: string;
}

interface FavoriteFolderRow extends SyncColumns {
  parent_folder_id: string | null;
  sort_order: number;
  title: string;
}

export interface CreateFavoriteInput {
  favicon?: string | null;
  notes?: string | null;
  parentFolderId?: string | null;
  sortOrder?: number;
  tags?: string[];
  title: string;
  url: string;
}

export interface CreateFavoriteFolderInput {
  parentFolderId?: string | null;
  sortOrder?: number;
  title: string;
}

export class SqliteFavoritesRepository implements FavoritesRepository {
  constructor(private readonly database: LocalBrowserDatabase) {}

  async listFavoriteFolders(parentFolderId: string | null = null): Promise<FavoriteFolderRecord[]> {
    const rows = this.database.db
      .prepare(
        `select *
         from favorite_folders
         where deleted_at is null
           and ((@parentFolderId is null and parent_folder_id is null)
             or parent_folder_id = @parentFolderId)
         order by sort_order asc, title asc`
      )
      .all({ parentFolderId }) as FavoriteFolderRow[];
    return rows.map(toFolderRecord);
  }

  async getFavoriteFolder(id: string): Promise<FavoriteFolderRecord | null> {
    const row = this.database.db
      .prepare("select * from favorite_folders where id = ? and deleted_at is null")
      .get(id) as FavoriteFolderRow | undefined;
    return row ? toFolderRecord(row) : null;
  }

  async listFavorites(parentFolderId: string | null = null): Promise<FavoriteRecord[]> {
    const rows = this.database.db
      .prepare(
        `select *
         from favorites
         where deleted_at is null
           and ((@parentFolderId is null and parent_folder_id is null)
             or parent_folder_id = @parentFolderId)
         order by sort_order asc, title asc`
      )
      .all({ parentFolderId }) as FavoriteRow[];
    return rows.map(toFavoriteRecord);
  }

  async tombstoneFavorite(id: string, deletedAt: string): Promise<void> {
    const write = this.database.db.transaction(() => {
      this.database.db
        .prepare(
          `update favorites
           set deleted_at = ?, updated_at = ?, local_version = local_version + 1
           where id = ?`
        )
        .run(deletedAt, deletedAt, id);
      appendLocalChange(this.database, "favorite", id, "delete", deletedAt);
    });
    write();
  }

  async tombstoneFavoriteFolder(id: string, deletedAt: string): Promise<void> {
    const write = this.database.db.transaction(() => {
      this.database.db
        .prepare(
          `update favorite_folders
           set deleted_at = ?, updated_at = ?, local_version = local_version + 1
           where id = ?`
        )
        .run(deletedAt, deletedAt, id);
      appendLocalChange(this.database, "favorite-folder", id, "delete", deletedAt);
    });
    write();
  }

  async upsertFavorite(favorite: FavoriteRecord): Promise<void> {
    const write = this.database.db.transaction(() => {
      this.database.db
        .prepare(
          `insert into favorites (
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
            favicon,
            parent_folder_id,
            sort_order,
            tags_json,
            notes
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
            @favicon,
            @parentFolderId,
            @sortOrder,
            @tagsJson,
            @notes
          )
          on conflict(id) do update set
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at,
            device_id = excluded.device_id,
            profile_id = excluded.profile_id,
            local_version = favorites.local_version + 1,
            remote_version = excluded.remote_version,
            url = excluded.url,
            normalized_url = excluded.normalized_url,
            title = excluded.title,
            favicon = excluded.favicon,
            parent_folder_id = excluded.parent_folder_id,
            sort_order = excluded.sort_order,
            tags_json = excluded.tags_json,
            notes = excluded.notes`
        )
        .run(toFavoriteStatementParams(favorite));
      appendLocalChange(this.database, "favorite", favorite.sync.id, "upsert", favorite.sync.updatedAt);
    });
    write();
  }

  async upsertFavoriteFolder(folder: FavoriteFolderRecord): Promise<void> {
    const write = this.database.db.transaction(() => {
      this.database.db
        .prepare(
          `insert into favorite_folders (
            id,
            schema_version,
            created_at,
            updated_at,
            deleted_at,
            device_id,
            profile_id,
            local_version,
            remote_version,
            title,
            parent_folder_id,
            sort_order
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
            @title,
            @parentFolderId,
            @sortOrder
          )
          on conflict(id) do update set
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at,
            device_id = excluded.device_id,
            profile_id = excluded.profile_id,
            local_version = favorite_folders.local_version + 1,
            remote_version = excluded.remote_version,
            title = excluded.title,
            parent_folder_id = excluded.parent_folder_id,
            sort_order = excluded.sort_order`
        )
        .run(toFolderStatementParams(folder));
      appendLocalChange(
        this.database,
        "favorite-folder",
        folder.sync.id,
        "upsert",
        folder.sync.updatedAt
      );
    });
    write();
  }

  createFavorite(input: CreateFavoriteInput): FavoriteRecord {
    return {
      entityType: "favorite",
      favicon: input.favicon ?? null,
      normalizedUrl: normalizeURL(input.url),
      notes: input.notes ?? null,
      parentFolderId: input.parentFolderId ?? null,
      sortOrder: input.sortOrder ?? 0,
      tags: input.tags ?? [],
      title: input.title,
      url: input.url,
      sync: createSyncMetadata(this.database)
    };
  }

  createFavoriteFolder(input: CreateFavoriteFolderInput): FavoriteFolderRecord {
    return {
      entityType: "favorite-folder",
      parentFolderId: input.parentFolderId ?? null,
      sortOrder: input.sortOrder ?? 0,
      title: input.title,
      sync: createSyncMetadata(this.database)
    };
  }
}

function toFavoriteStatementParams(favorite: FavoriteRecord) {
  return {
    ...syncStatementParams(favorite.sync),
    favicon: favorite.favicon,
    normalizedUrl: favorite.normalizedUrl,
    notes: favorite.notes,
    parentFolderId: favorite.parentFolderId,
    sortOrder: favorite.sortOrder,
    tagsJson: JSON.stringify(favorite.tags),
    title: favorite.title,
    url: favorite.url
  };
}

function toFolderStatementParams(folder: FavoriteFolderRecord) {
  return {
    ...syncStatementParams(folder.sync),
    parentFolderId: folder.parentFolderId,
    sortOrder: folder.sortOrder,
    title: folder.title
  };
}

function toFavoriteRecord(row: FavoriteRow): FavoriteRecord {
  return {
    entityType: "favorite",
    favicon: row.favicon,
    normalizedUrl: row.normalized_url,
    notes: row.notes,
    parentFolderId: row.parent_folder_id,
    sortOrder: row.sort_order,
    tags: JSON.parse(row.tags_json) as string[],
    title: row.title,
    url: row.url,
    sync: syncMetadataFromRow(row)
  };
}

function toFolderRecord(row: FavoriteFolderRow): FavoriteFolderRecord {
  return {
    entityType: "favorite-folder",
    parentFolderId: row.parent_folder_id,
    sortOrder: row.sort_order,
    title: row.title,
    sync: syncMetadataFromRow(row)
  };
}

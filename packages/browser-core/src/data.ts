import type { TabId, TabState } from "./types";

export type EntityId = string;
export type ISODateTime = string;
export type ProfileId = string;
export type DeviceId = string;
export type RemoteVersion = string;

export type BrowserPlatform = "desktop" | "mobile";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface SyncMetadata {
  id: EntityId;
  schemaVersion: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt: ISODateTime | null;
  deviceId: DeviceId;
  profileId: ProfileId;
  localVersion: number;
  remoteVersion: RemoteVersion | null;
}

export interface SyncableRecord {
  sync: SyncMetadata;
}

export type HistoryTransitionType =
  | "typed"
  | "link"
  | "reload"
  | "form-submit"
  | "redirect"
  | "restore"
  | "unknown";

export interface HistoryVisitRecord extends SyncableRecord {
  entityType: "history-visit";
  url: string;
  normalizedUrl: string;
  title: string;
  visitedAt: ISODateTime;
  transitionType: HistoryTransitionType;
  tabId: TabId | null;
  windowId: EntityId | null;
  favicon: string | null;
}

export interface FavoriteRecord extends SyncableRecord {
  entityType: "favorite";
  url: string;
  normalizedUrl: string;
  title: string;
  favicon: string | null;
  parentFolderId: EntityId | null;
  sortOrder: number;
  tags: string[];
  notes: string | null;
}

export interface FavoriteFolderRecord extends SyncableRecord {
  entityType: "favorite-folder";
  title: string;
  parentFolderId: EntityId | null;
  sortOrder: number;
}

export type OpenTabsPlacement = "top" | "left" | "right";

export interface OpenTabsWindowRecord extends SyncableRecord {
  entityType: "open-tabs-window";
  activeTabId: TabId | null;
  placement: OpenTabsPlacement;
  sortOrder: number;
  title: string | null;
}

export interface OpenTabRecord extends SyncableRecord {
  entityType: "open-tab";
  windowId: EntityId;
  url: string;
  normalizedUrl: string;
  title: string;
  favicon: string | null;
  position: number;
  pinned: boolean;
  state: TabState;
  lastActiveAt: ISODateTime;
  savedScrollY: number;
  historyVisitId: EntityId | null;
}

export type BrowserSettingScope = "profile" | "device";
export type BrowserSettingKey =
  | "browser.defaultSearchEngine"
  | "browser.homepageUrl"
  | "privacy.blockTrackers"
  | "privacy.blockAutoplayFullscreenAds"
  | "desktop.tabStripPlacement"
  | "mobile.mediaPlaybackPolicy";

export interface BrowserSettingRecord extends SyncableRecord {
  entityType: "browser-setting";
  key: BrowserSettingKey | (string & {});
  value: JsonValue;
  scope: BrowserSettingScope;
  platform: BrowserPlatform | "all";
}

export type SyncEntityType =
  | HistoryVisitRecord["entityType"]
  | FavoriteRecord["entityType"]
  | FavoriteFolderRecord["entityType"]
  | OpenTabsWindowRecord["entityType"]
  | OpenTabRecord["entityType"]
  | BrowserSettingRecord["entityType"];

export type SyncChangeOperation = "upsert" | "delete";

export interface LocalChangeRecord extends SyncableRecord {
  entityType: "local-change";
  targetEntityType: SyncEntityType;
  targetEntityId: EntityId;
  operation: SyncChangeOperation;
  changedAt: ISODateTime;
  payloadVersion: number;
}

export interface HistorySearchOptions {
  includeDeleted?: boolean;
  limit?: number;
  query: string;
}

export interface HistoryRepository {
  addVisit(visit: HistoryVisitRecord): Promise<void>;
  clearDeletedBefore(before: ISODateTime): Promise<void>;
  getVisit(id: EntityId): Promise<HistoryVisitRecord | null>;
  searchVisits(options: HistorySearchOptions): Promise<HistoryVisitRecord[]>;
  tombstoneVisit(id: EntityId, deletedAt: ISODateTime): Promise<void>;
}

export interface FavoritesRepository {
  listFavoriteFolders(parentFolderId?: EntityId | null): Promise<FavoriteFolderRecord[]>;
  listFavorites(parentFolderId?: EntityId | null): Promise<FavoriteRecord[]>;
  tombstoneFavorite(id: EntityId, deletedAt: ISODateTime): Promise<void>;
  tombstoneFavoriteFolder(id: EntityId, deletedAt: ISODateTime): Promise<void>;
  upsertFavorite(favorite: FavoriteRecord): Promise<void>;
  upsertFavoriteFolder(folder: FavoriteFolderRecord): Promise<void>;
}

export interface OpenTabsRepository {
  clearDeletedBefore(before: ISODateTime): Promise<void>;
  listOpenTabs(windowId?: EntityId): Promise<OpenTabRecord[]>;
  listOpenTabsWindows(): Promise<OpenTabsWindowRecord[]>;
  tombstoneOpenTab(id: TabId, deletedAt: ISODateTime): Promise<void>;
  tombstoneOpenTabsWindow(id: EntityId, deletedAt: ISODateTime): Promise<void>;
  upsertOpenTab(tab: OpenTabRecord): Promise<void>;
  upsertOpenTabsWindow(window: OpenTabsWindowRecord): Promise<void>;
}

export interface SettingsRepository {
  getSetting(key: string, platform?: BrowserPlatform | "all"): Promise<BrowserSettingRecord | null>;
  listSettings(scope?: BrowserSettingScope): Promise<BrowserSettingRecord[]>;
  tombstoneSetting(id: EntityId, deletedAt: ISODateTime): Promise<void>;
  upsertSetting(setting: BrowserSettingRecord): Promise<void>;
}

export interface LocalChangeRepository {
  appendChange(change: LocalChangeRecord): Promise<void>;
  deleteChange(id: EntityId): Promise<void>;
  listPendingChanges(limit?: number): Promise<LocalChangeRecord[]>;
}

# Local-First Browser Data

The browser should treat local platform storage as the source of truth for day-to-day use. Desktop and mobile can use different native storage engines, but they should share data shapes and repository contracts from `packages/browser-core`.

## Goals

- Keep browser data available offline and fast on each device.
- Use native-feeling local storage per platform.
- Make future remote sync possible without changing record formats.
- Keep conflict rules and record schemas shared between Electron and Expo.
- Avoid coupling app UI code to a specific database library.

## Platform Storage

Desktop should store core browser data in an app-local database, preferably SQLite under Electron's app data directory. `electron-store` is fine for small temporary flags, but history, favorites, settings, and open tabs should move to the shared repository model.

Mobile should store the same records in a native local database, preferably Expo SQLite. We should not rely on in-memory Zustand as durable storage for user browser data.

Both platforms should expose adapters that implement shared repository interfaces:

- `HistoryRepository`
- `FavoritesRepository`
- `OpenTabsRepository`
- `SettingsRepository`
- `LocalChangeRepository`

The UI should call app services/repositories, not database-specific APIs.

## Shared Records

Shared data contracts live in `packages/browser-core/src/data.ts`.

Every syncable record includes `SyncMetadata`:

- `id`: stable globally unique id.
- `schemaVersion`: record schema version.
- `createdAt`: ISO timestamp.
- `updatedAt`: ISO timestamp.
- `deletedAt`: ISO timestamp for tombstones, or `null`.
- `deviceId`: local device that created or last owns the record.
- `profileId`: browser profile/user namespace.
- `localVersion`: monotonically increasing local version.
- `remoteVersion`: remote sync cursor/version, initially `null`.

Deletes should generally be tombstones. Physical cleanup can happen later with repository methods such as `clearDeletedBefore(...)`, after sync has had a chance to propagate deletes.

## Data Areas

- History: `HistoryVisitRecord` is append-oriented. Sync should merge visits rather than overwrite them.
- Favorites: `FavoriteRecord` and `FavoriteFolderRecord` represent saved pages and folders. Initial conflict handling can be last-writer-wins by `updatedAt`, with folder/order handling refined later.
- OpenTabs: `OpenTabsWindowRecord` and `OpenTabRecord` represent currently open tabs and their containing window/group. The feature and repository are intentionally plural: `OpenTabsRepository`. Individual DB rows are `OpenTabRecord`.
- Settings: `BrowserSettingRecord` stores typed key/value settings with `profile` or `device` scope. Device-scoped settings should not automatically overwrite another device.
- Local changes: `LocalChangeRecord` is an outbox entry. Future remote sync can push pending local changes without changing primary record shapes.

## Sync Readiness

Remote sync is not implemented yet, but the data model assumes it will exist.

Future sync should work like this:

- Local writes update the primary record and append a `LocalChangeRecord`.
- A sync worker pushes pending local changes to a remote data source.
- The worker pulls remote changes and applies conflict rules from shared code.
- Successful pushes remove outbox records or mark them acknowledged.
- Tombstones remain long enough for all devices to observe deletes.

OpenTabs should be scoped by `deviceId` so one device can show "tabs from another device" without blindly replacing its own active session. A later UX can decide whether to restore remote tabs into the local session.

## Migration Plan

1. Keep `packages/browser-core/src/data.ts` as the canonical schema and repository contract layer.
2. Add SQLite-backed desktop repositories under `apps/desktop/src/main/data`.
3. Add Expo SQLite-backed mobile repositories under `apps/mobile/src/data`.
4. Migrate desktop history from `electron-store` to `HistoryRepository`.
5. Persist desktop tab placement through `SettingsRepository`.
6. Persist desktop open-tabs snapshots through `OpenTabsRepository`.
7. Persist mobile tab state with `OpenTabsRepository`.
8. Add favorites/bookmark UI on top of `FavoritesRepository`.
9. Move media/autoplay preferences into `SettingsRepository`.
10. Add remote sync workers after local repositories are stable.

## Current Desktop Implementation

Desktop now uses `LocalBrowserDatabase` as a shared SQLite connection for browser data.
`BrowserDataManager` owns the desktop repositories and exposes higher-level helpers for app code.

Implemented repositories:

- `SqliteHistoryRepository`
- `SqliteFavoritesRepository`
- `SqliteOpenTabsRepository`
- `SqliteSettingsRepository`
- `SqliteLocalChangeRepository`

Live desktop integrations:

- Page visits are written to SQLite history from `TabManager` after normal page loads.
- The hamburger menu can open a local `seans-browser://history/` tab backed by SQLite history search.
- The hamburger menu can save the active page to favorites and open a local `seans-browser://favorites/` page.
- The hamburger menu can open a local `seans-browser://settings/` page backed by SQLite settings.
- Tab-strip placement is stored in SQLite settings under `desktop.tabStripPlacement`.
- Appearance theme preference is stored in SQLite settings under `appearance.themePreference` as `system`, `light`, or `dark`.
- Legacy renderer `localStorage` tab placement is migrated into SQLite once and then removed.
- Open tab/window snapshots are written to SQLite when tabs are added, updated, removed, activated, reordered, or when tab placement changes.

Open-tabs restore is intentionally not automatic yet. Restoring after app quit and not restoring after a user intentionally closes a window need a deliberate product rule before we turn the snapshots back into windows.

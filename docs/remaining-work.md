# Remaining Work

This is the current high-level backlog after the desktop local-first persistence pass.

## Session And Tabs

- Implement open-tabs restore from persisted snapshots.
- Decide the restore rule first: restore after full app quit, but do not resurrect a window the user intentionally closed.
- Add UI for restoring tabs from other devices once remote sync exists.
- Persist and restore more tab state, including scroll position and sleeping/crashed state behavior.

## Favorites

- Add edit/delete actions for favorites.
- Add favorite folders and reordering UI.
- Add a bookmark/star affordance near the address bar.
- Add duplicate handling for bookmarking the same normalized URL.

## Settings

- Expand the current `seans-browser://settings/` page beyond appearance settings.
- Wire homepage/default search engine settings.
- Wire tracker/ad-blocking toggles.
- Wire media/autoplay/fullscreen-ad behavior settings.
- Wire sleep threshold settings.
- Add settings search/grouping once the page has more than a few controls.

## Mobile Persistence

- Add Expo SQLite adapters for the shared repository contracts.
- Persist mobile history, favorites, settings, and open-tabs locally.
- Keep native builds on EAS only; do not add local native build workflows.

## Sync

- Implement a remote sync worker around the `local_changes` outbox.
- Add push/pull conflict handling for each shared entity type.
- Add tombstone cleanup rules after sync acknowledgements.
- Add account/profile identity once the remote source exists.

## Desktop Polish

- Replace simple generated internal pages with richer React-rendered local pages if needed.
- Add history/favorites search refinements and empty/error states.
- Add packaging-time checks for native module rebuilds.
- Add automated smoke tests for the internal `seans-browser://` pages.

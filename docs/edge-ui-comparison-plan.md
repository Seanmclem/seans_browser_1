# Edge UI Comparison And Browser Chrome Roadmap

Last reviewed: 2026-05-03

## Scope

This document compares:

- The current desktop Sean Browser UI as rendered by the Electron app on 2026-05-03.
- The current Microsoft Edge desktop browser chrome as observed locally on macOS and cross-checked against current Microsoft documentation.

This is intentionally about browser chrome and adjacent built-in surfaces, not every settings subsection or every Microsoft ecosystem feature ever added to Edge.

Extensions UI is explicitly out of scope for the active roadmap until the product has a real extension story.

## Current Sean Browser Snapshot

Observed in the running Electron app:

- Horizontal or vertical tabs.
- New-tab button.
- Back, conditional Forward, and Reload/Stop controls.
- Address/search field.
- Secure/insecure connection chip.
- Hamburger menu.
- Draggable tabs with reorder, cross-window move, and detach-to-new-window behavior.
- Tab right-click menu.
- Sleeping-tab behavior and sleep actions.
- Local internal pages for History, Favorites, and Settings.

Already implemented behind the current UI architecture:

- Local-first SQLite persistence for history, favorites, settings, and open-tabs snapshots.
- Theme preference stored through shared settings contracts.
- Vertical tab placement stored as a setting.
- Favorites folders with nesting in the data model.
- Window-aware open-tabs records shaped for future restore and sync.

Current UI character:

- Lean and custom.
- Strong foundation for tab/window management.
- Minimal navigation chrome.
- Data model is already more portable than the UI layer.

## Current Edge Snapshot

Observed in the installed local Edge app:

- Top tab strip with vertical-tabs controls and new-tab button.
- Address bar with site info/permissions affordance.
- Favorites star in the address bar.
- Toolbar favorites button.
- Toolbar downloads button.
- Profile/avatar button.
- Update indicator.
- Copilot/Chat entry.
- Favorites bar below the main toolbar.
- Sidebar enabled in the local install.

Documented by Microsoft today:

- Favorites bar can be shown always, never, or only on new tabs.
- Vertical tabs are a first-class built-in layout.
- Workspaces are built in for grouping related browsing contexts.
- Split screen lets one tab host two pages side by side.
- InPrivate is a built-in alternate browsing mode.
- Tab groups support names, colors, collapse, and vertical-tabs compatibility.
- Media Control Center appears at the right of the address bar when tabs are playing media.
- Immersive Reader and Read aloud are built-in reading/accessibility tools.
- Collections still exist in docs, but Microsoft started retiring them in Edge version 145 in February 2026.

## Comparison Matrix

### 1. Navigation And Address Bar

Already in Sean Browser:

- Back.
- Forward.
- Reload and stop-loading toggle.
- Address/search input.
- Basic secure/insecure state indicator.

Edge has that Sean Browser does not yet have:

- Site info / permissions popover anchored in the address bar.
- Address-bar favorite star.
- Downloads shortcut near the address bar.
- Media indicator that appears only when relevant.
- Richer page-action affordances in the address field.

Recommendation:

- Add a page-actions zone to the right side of the address bar.
- Start with portable actions first: favorite star, downloads, media indicator, page info.
- Keep the page-action registry UI-driven so desktop can show several actions while mobile can expose the same actions through overflow menus or sheets.

Best implementation shape:

- Keep actions declarative in renderer code:
  - `PageAction { id, visibility, icon, onClick }`
- Do not hardcode address-bar state into favorites/history/open-tabs tables.
- Store only generic durable data:
  - favorite existence
  - download records
  - media session state if needed
  - permissions/settings where they actually belong

### 2. Tabs, Windows, And Organization

Already in Sean Browser:

- Horizontal tabs.
- Vertical left/right tabs.
- Reorder tabs by drag.
- Drag tabs across windows.
- Move active tab to new window.
- Sleeping tabs.
- Context-menu-driven tab actions.

Edge has that Sean Browser does not yet have:

- Search-tabs utility inside the vertical-tabs menu.
- Tab groups with names/colors/collapse.
- Pinned tabs UI.
- Workspaces.
- Session restore UX.
- Recently closed / continue browsing surfaces.
- Split screen in a single tab.

Recommendation:

- Highest-value next steps here are:
  - Pinned tabs.
  - Tab groups.
  - Session restore.
- Search tabs is still useful, but it can be treated as a later convenience feature rather than core chrome parity.
- Workspaces should come after tab groups and session restore.
- Split screen should come after tab grouping and open-tabs restore, because it changes tab semantics.

Best implementation shape:

- Keep open tabs generic in `OpenTabsWindowRecord` and `OpenTabRecord`.
- Add new shared records rather than stuffing structure into UI state:
  - `TabGroupRecord`
  - `TabGroupMembershipRecord`
  - optionally `WorkspaceRecord`
  - optionally `WorkspaceWindowRecord`
- Split-screen should not become a fake URL trick.
- Model split-screen as layout state attached to an open tab or a lightweight `SplitViewRecord` referencing two tab/session targets.

### 3. Favorites, History, And Library Surfaces

Already in Sean Browser:

- Favorites page.
- History page.
- Favorites folders.
- Favorite creation modal.
- Shared local-first repositories.

Edge has that Sean Browser does not yet have:

- Address-bar favorite star.
- Favorites bar.
- Rich favorites management chrome.
- Edit/delete/reorder favorites UI.
- “Open all” and batch operations.
- More polished history/favorites surfaces.

Recommendation:

- Build a favorites star first.
- Then add a favorites bar with three modes:
  - always
  - never
  - new-tab-only
- Upgrade the favorites/history pages from simple generated HTML to React-rendered internal surfaces.

Best implementation shape:

- Keep `FavoriteRecord` and `FavoriteFolderRecord` generic and syncable.
- Keep favorites bar display mode in `BrowserSettingRecord`, not in favorites entities.
- Keep ordering generic with `sortOrder`.
- Keep folder nesting portable.

### 4. Utility Surfaces

Already in Sean Browser:

- Custom hamburger menu.
- Local Settings page.

Edge has that Sean Browser does not yet have:

- Downloads hub.
- Sidebar / app rail.
- Rich favorites flyout.
- Rich history flyout.
- Profile switcher surface.

Recommendation:

- Add utility surfaces in this order:
  1. Downloads hub
  2. Favorites bar / favorites flyout improvements
  3. Optional sidebar
  4. Search tabs utility if tab volume makes it worth it

Best implementation shape:

- Utility panels should be UI surfaces over shared data/services.
- The sidebar itself is desktop UI, but the things inside it should be modeled separately.
- Avoid “sidebar-only” data structures.

### 5. Identity, Profiles, And Sync-Adjacent UI

Already in Sean Browser:

- Portable `profileId` in shared sync metadata.

Edge has that Sean Browser does not yet have:

- Visible profile button.
- Profile switching/account surfaces.
- Signed-in sync affordances.

Recommendation:

- Do not start with Microsoft-style account chrome.
- First define your own generic browser profile concept:
  - local profile
  - future remote account binding
- Only add visible profile UI after there is a meaningful local profile or sync story.

Best implementation shape:

- Add a shared `ProfileRecord` later if needed.
- Keep sync identity separate from toolbar presentation.
- Mobile and desktop should consume the same profile metadata but present it differently.

### 6. Accessibility, Reading, And Media

Already in Sean Browser:

- Very little UI here today, beyond basic browser controls.

Edge has that Sean Browser does not yet have:

- Immersive Reader.
- Read aloud.
- Media Control Center.
- A more developed accessibility toolchain.

Recommendation:

- If you want meaningful differentiation after core parity, this is a good area.
- Read aloud is probably easier and more generally useful than a full reader mode.
- Media control is valuable because it integrates with your tab system and “audio still playing” edge cases.

Best implementation shape:

- Treat reader/read-aloud as page tools, not as properties of history/favorites/open-tabs.
- Keep media state ephemeral unless you need persistence.
- If you add reading lists later, store them separately from favorites.

## Features To Copy Closely

- Favorites star in the address bar.
- Favorites bar visibility modes.
- Pinned tabs.
- Tab groups.
- Downloads button and downloads surface.
- Session restore / recent tabs.
- Page info / permissions popover.

## Features To Adapt, Not Clone Literally

- Vertical tabs.
  - You already have a stronger placement model than stock Edge in some ways.
- Workspaces.
  - Use your shared open-tabs model, not a Microsoft-shaped workspace concept.
- Sidebar.
  - Make it a shell for portable features, not a dumping ground for vendor integrations.
- Split screen.
  - Useful, but your architecture should define it in terms of tab/session layout rather than mimic Edge’s exact button placement.
- Profile UI.
  - Worth doing only after local profiles or sync exist.

## Features To Avoid Copying 1:1

- Extension toolbar/menu surfaces for now.
  - Do not add empty extension affordances before extensions exist as a product feature.
- Copilot/Chat-specific toolbar entries.
- Microsoft 365 / Outlook sidebar integration.
- Collections as a core new investment.
  - Microsoft is actively retiring them.
- Microsoft-specific shopping surfaces.
- Edge-specific update/account affordances until your app actually has those systems.

## Recommended Roadmap

### Phase 1: High-Value Everyday Parity

- Add address-bar favorite star.
- Add downloads button and a basic downloads panel/page.
- Add page-info popover from the lock chip.
- Add pinned tabs.
- Add favorites bar with visibility setting.
- Implement open-tabs restore policy and UI.

### Phase 2: Tab Organization

- Add tab groups with colors, names, collapse, and drag/drop membership.
- Add recently closed tabs.
- Add Search tabs if the tab strip begins to need a faster retrieval path.
- Add “open all in folder” and favorite management actions.
- Replace HTML-generated history/favorites/settings pages with React internal pages.

### Phase 3: Bigger Desktop Features

- Add split screen.
- Add optional sidebar.
- Add profile entry point once local profiles or sync exist.
- Add media control surface.

### Phase 4: Optional Differentiators

- Read aloud.
- Reader mode / simplified reading surface.
- Workspace model if session restore and tab groups feel solid.

## Data Model Guidance

The current repo is already pointed in the right direction. Keep going in that direction:

- `HistoryVisitRecord` stays append-oriented and generic.
- `FavoriteRecord` and `FavoriteFolderRecord` stay UI-agnostic.
- `OpenTabsWindowRecord` and `OpenTabRecord` stay the canonical open-session model.
- `BrowserSettingRecord` should hold view preferences and platform-specific chrome settings.

Add new shared record types only when a feature needs durable state:

- `DownloadRecord`
- `TabGroupRecord`
- `TabGroupMembershipRecord`
- `WorkspaceRecord`
- `WorkspaceWindowRecord`
- possibly `ProfileRecord`

Do not encode desktop chrome layout decisions into the shared entity models unless the setting is truly cross-platform meaningful.

Good examples of shared settings:

- `appearance.themePreference`
- `browser.defaultSearchEngine`
- `browser.homepageUrl`
- `privacy.blockTrackers`

Good examples of platform-scoped settings:

- `desktop.tabStripPlacement`
- `desktop.favoritesBarVisibility`
- `desktop.sidebarVisibility`
- `mobile.mediaPlaybackPolicy`

## Practical Missing-Features Checklist

- [ ] Address-bar favorite star
- [ ] Favorites bar
- [ ] Pinned tabs
- [ ] Downloads UI
- [ ] Page info / permissions popover
- [ ] Session restore / open-tabs restore
- [ ] Favorite edit/delete/reorder UI
- [ ] Rich React history page
- [ ] Rich React favorites page
- [ ] Expanded React settings page
- [ ] Tab groups
- [ ] Recently closed tabs
- [ ] Split screen
- [ ] Sidebar
- [ ] Profile entry point
- [ ] Media controls
- [ ] Read aloud / reader tools

## Suggested Order If We Start Implementing Soon

1. Favorites star + favorites bar.
2. Pinned tabs.
3. Downloads UI.
4. Session restore.
5. Tab groups.
6. React internal pages.
7. Search tabs.
8. Split screen.
9. Sidebar.
10. Profiles/workspaces/media/reader features.

## Source Notes

Local observations:

- Sean Browser was run from the Electron dev app and inspected live on 2026-05-03.
- Microsoft Edge was inspected live via the installed macOS app on 2026-05-03.

Microsoft documentation used to verify current feature direction:

- Favorites bar: https://support.microsoft.com/en-us/microsoft-edge/see-your-favorites-bar-in-microsoft-edge-566736f8-a11d-52e2-4f6f-7a713e1750d2
- Add to favorites from the address bar: https://support.microsoft.com/en-gb/microsoft-edge/add-a-site-to-my-favorites-in-microsoft-edge-eb40d818-fd1f-cb19-d943-6fcfd1d9a935
- Vertical tabs: https://www.microsoft.com/edge/features/vertical-tabs?form=MT00JO
- Workspaces: https://support.microsoft.com/en-us/topic/getting-started-with-microsoft-edge-workspaces-63a5a6d7-3db4-468f-aba8-fdd00dce4c35
- Split screen: https://www.microsoft.com/en-us/edge/features/split-screen
- Sidebar: https://www.microsoft.com/en-us/edge/learning-center/customize-optimize-edge-sidebar
- InPrivate: https://support.microsoft.com/en-us/microsoft-edge/browse-inprivate-in-microsoft-edge-e6f47704-340c-7d4f-b00d-d0cf35aa1fcc
- Tab groups: https://www.microsoft.com/en-us/edge/features/tab-groups
- Media Control Center: https://www.microsoft.com/en-us/edge/features/media-control-center
- Immersive Reader / Read aloud: https://support.microsoft.com/en-us/topic/use-immersive-reader-in-microsoft-edge-72ac6331-2795-42eb-b3e8-c03503231f32
- Accessibility and Read aloud shortcuts: https://support.microsoft.com/en-gb/microsoft-edge/accessibility-features-in-microsoft-edge-4c696192-338e-9465-b2cd-bd9b698ad19a
- Collections retirement status: https://support.microsoft.com/en-au/microsoft-edge/organize-your-ideas-with-collections-in-microsoft-edge-60fd7bba-6cfd-00b9-3787-b197231b507e

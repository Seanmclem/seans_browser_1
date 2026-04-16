# Desktop Architecture

The desktop app uses Electron as the native shell and keeps browser chrome separate from page rendering. The `BrowserWindow` is frameless, and `WindowManager` attaches React chrome `WebContentsView`s for the top chrome and optional side-tab rail. Actual web pages are separate `WebContentsView` instances managed by `TabManager`.

## Main Process

- `WindowManager` owns the `BrowserWindow`, the React chrome views, chrome height, side-tab rail bounds, page insets, and chrome z-order.
- `TabManager` owns page views, tab metadata, active-tab switching, navigation, snapshots, and sleep/wake transitions.
- `SleepManager` evaluates soft/hard sleep thresholds from `browser-core` and asks `TabManager` to sleep or wake tabs.
- `SessionManager` provides the shared persistent Electron session for page views, including request filtering and permission policy.
- `IPCHandler` exposes tab, navigation, history, local browser pages, theme, and layout operations to the React chrome through the preload bridge.

## View Layout

React chrome and web pages are sibling `WebContentsView`s inside the window content view. The main chrome view sits at the top and reports its measured height through `layout:setChromeHeight`. A side-tabs chrome view is also created and is shown only when the tab strip placement is `left` or `right`.

`WindowManager` converts the current chrome layout into page insets. `TabManager` positions active page views inside those insets rather than assuming a fixed top-only UI height. In top-tabs mode the page inset is only the top chrome height. In left/right vertical-tabs mode the page also gets a left or right inset equal to the side rail width.

Page views are attached before the chrome view is brought back to the front. This preserves the expected z-order while still allowing pages to occupy the main content area.

Custom chrome overlays, currently the top-right hamburger menu, use a separate overlay height rather than changing the page layout height. The renderer calls `layout:setChromeOverlayHeight` while the menu is open, and `WindowManager` grows the transparent top chrome `WebContentsView` above the page view. Page bounds stay unchanged, so opening a menu does not shove or resize the active tab; it only gives React enough paint area to appear above the native page view.

When creating a new active tab, `TabManager` activates and shows its page view before calling `loadURL()`. Loading while hidden can leave Chromium without an available display surface on macOS, which caused pages to load in the DOM but fail to paint visibly.

The tab context menu is native Electron UI. It owns tab-local actions such as moving a tab to a new window, reloading, sleeping, and closing. Manual sleep is routed through `TabManager.userSleepTab(...)` so an active tab can switch away before sleeping instead of violating the automatic-sleep rule that the visible tab is exempt.

## Renderer

The React renderer is browser chrome only. It does not render page contents and does not use DOM `<webview>`. It mirrors tab state from the main process through IPC, renders the tab bar, toolbar, and address bar, and sends navigation/tab commands back to main.

Chrome theming is shared through `@seans-browser/browser-theme`. Desktop resolves `appearance.themePreference` from SQLite settings, Electron `nativeTheme`, or both when set to `system`, then broadcasts resolved light/dark state to all chrome surfaces.

See [`desktop-browser-ui.md`](desktop-browser-ui.md) for the current React/TypeScript browser chrome structure.

## Mobile

The Expo app is a separate React Native shell using `react-native-webview`. Shared URL normalization, tab types, and sleep policy logic live in `packages/browser-core` so desktop and mobile can converge without sharing platform-specific view code.

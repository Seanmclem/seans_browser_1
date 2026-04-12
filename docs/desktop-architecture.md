# Desktop Architecture

The desktop app uses Electron as the native shell and keeps browser chrome separate from page rendering. The `BrowserWindow` is frameless, and `WindowManager` attaches a top-level `WebContentsView` for the React chrome. Actual web pages are separate `WebContentsView` instances managed by `TabManager`.

## Main Process

- `WindowManager` owns the `BrowserWindow`, the React chrome view, chrome height, and chrome z-order.
- `TabManager` owns page views, tab metadata, active-tab switching, navigation, snapshots, and sleep/wake transitions.
- `SleepManager` evaluates soft/hard sleep thresholds from `browser-core` and asks `TabManager` to sleep or wake tabs.
- `SessionManager` provides the shared persistent Electron session for page views, including request filtering and permission policy.
- `IPCHandler` exposes tab, navigation, history, and layout operations to the React chrome through the preload bridge.

## View Layout

React chrome and web pages are sibling `WebContentsView`s inside the window content view. The chrome view sits at the top and reports its measured height through `layout:setChromeHeight`; `TabManager` positions page views below that height.

Page views are attached before the chrome view is brought back to the front. This preserves the expected z-order while still allowing pages to occupy the main content area.

When creating a new active tab, `TabManager` activates and shows its page view before calling `loadURL()`. Loading while hidden can leave Chromium without an available display surface on macOS, which caused pages to load in the DOM but fail to paint visibly.

## Renderer

The React renderer is browser chrome only. It does not render page contents and does not use DOM `<webview>`. It mirrors tab state from the main process through IPC, renders the tab bar, toolbar, and address bar, and sends navigation/tab commands back to main.

See [`desktop-browser-ui.md`](desktop-browser-ui.md) for the current React/TypeScript browser chrome structure.

## Mobile

The Expo app is a separate React Native shell using `react-native-webview`. Shared URL normalization, tab types, and sleep policy logic live in `packages/browser-core` so desktop and mobile can converge without sharing platform-specific view code.

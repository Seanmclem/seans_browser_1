# Desktop Browser UI

The desktop browser UI is the top chrome of the app: tab strip, toolbar, address bar, and small UI-only state. It is a React + TypeScript renderer built by Vite, but it is not the web page renderer. Actual web pages are native Electron `WebContentsView` instances owned by the main process.

## Runtime Shape

The React app runs inside a dedicated chrome `WebContentsView` created by `WindowManager`. That chrome view is a sibling of the tab page views, not a parent DOM container around them. This is important because the browser page contents are not React children and are not DOM `<webview>` elements.

The high-level split is:

- `WindowManager`: creates the frameless `BrowserWindow`, attaches the React chrome `WebContentsView`, and keeps it above page views.
- `TabManager`: creates, positions, shows, hides, sleeps, wakes, and navigates the page `WebContentsView`s.
- React renderer: draws the browser UI and talks to main through `window.browserAPI`.
- `IPCHandler`: connects React UI commands/events to `TabManager`, `SleepManager`, and `HistoryManager`.

## Entry Points

- `apps/desktop/src/renderer/index.html`: Vite HTML entry for the chrome renderer.
- `apps/desktop/src/renderer/main.tsx`: creates the React root and renders `App`.
- `apps/desktop/src/renderer/App.tsx`: top-level chrome layout and dynamic chrome-height reporting.
- `apps/desktop/src/renderer/styles.css`: global renderer CSS.
- `apps/desktop/src/renderer/App.module.css`: shell/chrome layout styles.

`App.tsx` renders only the browser chrome:

- `<TabBar />`
- `<Toolbar />`
- `<AddressBar />`

It also measures the `<header>` height with `ResizeObserver` and sends that value to main through `window.browserAPI.layout.setChromeHeight(...)`. Main then positions each page view below the chrome.

## Components

- `components/TabBar/TabBar.tsx`: renders the tab strip and new-tab button, and calls tab create/activate/close IPC methods.
- `components/TabBar/Tab.tsx`: renders one tab with favicon/title, close control, sleep/crash badges, and sleeping-tab preview.
- `components/Toolbar/Toolbar.tsx`: renders Back, Forward, Reload, and Sleep Tab controls for the active tab.
- `components/AddressBar/AddressBar.tsx`: renders URL/search input, security label, focus behavior, and navigation submit.
- `components/SleepOverlay/SleepOverlay.tsx`: renders a snapshot overlay for sleeping tabs.

Most component styling now uses Tailwind utility classes in the TSX files. `styles.css` keeps global renderer rules such as transparency, base font setup, and Electron drag/no-drag regions.

## Browser Menu

The top-right hamburger menu is a custom React menu rendered by `components/TabBar/TabBar.tsx`, not a native Electron `Menu`. This gives the app control over styling and keeps it visually aligned with the rest of the browser chrome.

Because page contents are separate sibling `WebContentsView`s, a normal React popover cannot extend over the page area unless the chrome view itself is tall enough. When the hamburger menu opens, `TabBar` calls `window.browserAPI.layout.setChromeOverlayHeight(...)` before setting menu state. `WindowManager` temporarily grows the transparent chrome `WebContentsView` so the menu can paint above the active page view. When the menu closes, the overlay height is reset to `0`.

This overlay only exists while the menu is open. During normal browsing the chrome view returns to its measured header height, so the approach should not add ongoing layout or rendering work. While open, the transparent overlay intentionally captures outside clicks so the menu can dismiss cleanly.

The tab right-click menu is still native Electron UI through `tab.showContextMenu(...)`. That menu behaves like an OS context menu and does not need the custom overlay treatment.

## State

Renderer state is intentionally small:

- `store/tabStore.ts`: Zustand + Immer store containing serialized tab records and the active tab id.
- `store/uiStore.ts`: UI-only state, currently the address-bar focus nonce.

The renderer does not own canonical tab state. Main owns the real tab records and Electron objects. The renderer receives serialized snapshots of tab state over IPC.

## IPC Flow

`apps/desktop/src/main/preload.ts` exposes `window.browserAPI` with safe methods:

- `tab.create`, `tab.close`, `tab.activate`, `tab.list`, `tab.sleep`
- `nav.back`, `nav.forward`, `nav.reload`, `nav.loadURL`
- `history.search`
- `layout.setChromeHeight`
- event subscription helpers: `on` and `off`

`hooks/useTabManager.ts` initializes the tab list on mount with `tab.list()` and subscribes to push events from main:

- `tab:added`
- `tab:updated`
- `tab:removed`
- `tab:activated`
- `ui:focus-address-bar`

`hooks/useIPC.ts` wraps subscribe/unsubscribe so React effects can attach stable IPC listeners without leaking handlers.

## Keyboard And Focus

Keyboard shortcuts are registered in the main process against the chrome view's `WebContents`. Main handles tab/navigation shortcuts directly and sends `ui:focus-address-bar` to React for address-bar focus. The renderer responds by incrementing `addressBarFocusNonce`, and `AddressBar` focuses/selects its input when that nonce changes.

## Current Important Constraint

Do not reintroduce DOM `<webview>` for desktop page content unless the architecture intentionally changes. The current desktop design depends on Electron `WebContentsView` for tab pages so sleep, hard-destroy, snapshot, and native Chromium process management can stay in the main process.

Also keep new active page views visible before calling `loadURL()`. Loading an active page while its `WebContentsView` is hidden caused Chromium to load the DOM but skip the visible paint surface on macOS.

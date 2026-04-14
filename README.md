# Sean's Browser

Monorepo scaffold for a custom browser with:

- `apps/desktop`: Electron + TypeScript + React + Vite browser shell using `WebContentsView`
- `apps/mobile`: Expo + React Native + `react-native-webview`
- `packages/browser-core`: shared tab types, sleep policy logic, URL normalization, and local-first data contracts

## What Is Already Implemented

- Desktop multi-tab manager with `WebContentsView`
- Desktop sleep manager with soft/hard sleep thresholds shared from `browser-core`
- Desktop React chrome with tab strip, toolbar, address bar, IPC store sync, and keyboard shortcuts
- Mobile Expo browser shell with tab strip, address bar, toolbar, shared sleep policy watcher, and `WebView` stack
- Shared `normalizeURL()` utility plus browser tab/sleep types and sync-ready browser data contracts

## Workspace Layout

```text
.
├── apps
│   ├── desktop
│   └── mobile
└── packages
    └── browser-core
```

See [`docs/desktop-architecture.md`](docs/desktop-architecture.md) for the current desktop view architecture, [`docs/desktop-browser-ui.md`](docs/desktop-browser-ui.md) for the React browser chrome, and [`docs/local-first-data.md`](docs/local-first-data.md) for the shared local-first data plan.

## Getting Started

Use Node 22:

```bash
nvm use
```

Install dependencies from the repo root:

```bash
npm install
```

Run the desktop app:

```bash
npm run desktop:dev
```

If Electron reports a native module ABI mismatch after installing dependencies, rebuild desktop native modules:

```bash
npm run desktop:rebuild-native
```

Run the Expo app:

```bash
npm run mobile:start
```

## Expo / EAS Notes

The mobile app is configured for Expo and includes `expo-dev-client` plus an `eas.json` so it is ready for EAS once you run:

```bash
cd apps/mobile
eas init
```

You will need to do that once so Expo can attach a real EAS project ID for cloud/dev-client builds.

## Likely Next Steps

- Install dependencies with `npm install`
- Run `npm run desktop:dev` and validate Electron preload/build paths
- Run `npm run mobile:start`, then `eas init` inside `apps/mobile` when you want a real dev-client build
- Add icons/splash assets before packaging

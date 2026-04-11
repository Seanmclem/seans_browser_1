# Sean's Browser

Monorepo scaffold for a custom browser with:

- `apps/desktop`: Electron + TypeScript + React + Vite browser shell using `WebContentsView`
- `apps/mobile`: Expo + React Native + `react-native-webview`
- `packages/browser-core`: shared tab types, sleep policy logic, and URL normalization

## What Is Already Implemented

- Desktop multi-tab manager with `WebContentsView`
- Desktop sleep manager with soft/hard sleep thresholds shared from `browser-core`
- Desktop React chrome with tab strip, toolbar, address bar, IPC store sync, and keyboard shortcuts
- Mobile Expo browser shell with tab strip, address bar, toolbar, shared sleep policy watcher, and `WebView` stack
- Shared `normalizeURL()` utility plus browser tab/sleep types

## Workspace Layout

```text
.
├── apps
│   ├── desktop
│   └── mobile
└── packages
    └── browser-core
```

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

Run the isolated `WebContentsView` lab:

```bash
npm run desktop:wv-lab
```

The lab writes screenshots to `/tmp/seans-browser-wv-lab`. To test a remote page:

```bash
WV_LAB_URL=https://duckduckgo.com/ npm run desktop:wv-lab
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

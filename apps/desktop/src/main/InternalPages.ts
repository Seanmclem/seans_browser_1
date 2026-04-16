import type { Session } from "electron";
import type { FavoriteFolderRecord, FavoriteRecord } from "@seans-browser/browser-core";
import type { BrowserDataManager } from "./BrowserDataManager";
import type { HistoryEntry } from "./HistoryManager";

export const INTERNAL_PAGE_SCHEME = "seans-browser";
export const FAVORITES_PAGE_URL = `${INTERNAL_PAGE_SCHEME}://favorites/`;
export const HISTORY_PAGE_URL = `${INTERNAL_PAGE_SCHEME}://history/`;

const HISTORY_RESULT_LIMIT = 200;

export function isInternalPageUrl(url: string): boolean {
  return url.startsWith(`${INTERNAL_PAGE_SCHEME}://`);
}

export function registerInternalPages(session: Session, dataManager: BrowserDataManager): void {
  session.protocol.handle(INTERNAL_PAGE_SCHEME, async (request) => {
    const url = new URL(request.url);

    if (url.hostname === "history") {
      const query = url.searchParams.get("q") ?? "";
      const entries = await dataManager.history.search(query, HISTORY_RESULT_LIMIT);
      return htmlResponse(renderHistoryPage(entries, query));
    }

    if (url.hostname === "favorites") {
      const folderId = url.searchParams.get("folder");
      const currentFolder = folderId
        ? await dataManager.favorites.getFavoriteFolder(folderId)
        : null;
      const breadcrumbs = currentFolder
        ? await getFavoriteFolderBreadcrumbs(dataManager, currentFolder)
        : [];
      const folders = await dataManager.favorites.listFavoriteFolders(folderId);
      const favorites = await dataManager.favorites.listFavorites(folderId);
      return htmlResponse(renderFavoritesPage(folders, favorites, currentFolder, breadcrumbs));
    }

    return htmlResponse(renderNotFoundPage(url), 404);
  });
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    headers: {
      "content-security-policy":
        "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
      "content-type": "text/html; charset=utf-8"
    },
    status
  });
}

function renderHistoryPage(entries: HistoryEntry[], query: string): string {
  const title = query ? `History results for ${query}` : "History";
  const emptyMessage = query
    ? `No history entries matched "${escapeHtml(query)}".`
    : "No history entries yet. Pages you visit will show up here.";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    ${sharedPageStyles()}
  </head>
  <body>
    <main>
      <h1>History</h1>
      <p class="subtitle">A local view of pages visited on this desktop browser. This is backed by the SQLite history repository, so it is already shaped for later sync without using remote data yet.</p>
      <form action="${HISTORY_PAGE_URL}" method="get">
        <input name="q" value="${escapeAttribute(query)}" placeholder="Search history" autofocus />
        <button type="submit">Search</button>
      </form>
      <section class="history-list" aria-label="History entries">
        ${
          entries.length > 0
            ? entries.map(renderHistoryEntry).join("")
            : `<div class="empty">${emptyMessage}</div>`
        }
      </section>
    </main>
  </body>
</html>`;
}

function renderHistoryEntry(entry: HistoryEntry): string {
  const title = entry.title.trim() || entry.url;
  const visitedAt = new Date(entry.visitedAt);

  return `<a class="history-item" href="${escapeAttribute(entry.url)}">
    <span class="history-title">${escapeHtml(title)}</span>
    <span class="history-url">${escapeHtml(entry.url)}</span>
    <span class="history-meta">
      <span class="history-time">${escapeHtml(formatVisitedAt(visitedAt))}</span>
    </span>
  </a>`;
}

function renderFavoritesPage(
  folders: FavoriteFolderRecord[],
  favorites: FavoriteRecord[],
  currentFolder: FavoriteFolderRecord | null,
  breadcrumbs: FavoriteFolderRecord[]
): string {
  const pageTitle = currentFolder?.title ?? "Favorites";
  const parentUrl = currentFolder?.parentFolderId
    ? `${FAVORITES_PAGE_URL}?folder=${escapeAttribute(currentFolder.parentFolderId)}`
    : FAVORITES_PAGE_URL;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(pageTitle)}</title>
    ${sharedPageStyles()}
  </head>
  <body>
    <main>
      <h1>${escapeHtml(pageTitle)}</h1>
      <p class="subtitle">Saved pages stored locally in SQLite through the shared favorites repository.</p>
      ${renderFavoritesBreadcrumbs(breadcrumbs)}
      ${currentFolder ? `<p><a class="back-link" href="${parentUrl}">Back</a></p>` : ""}
      <section class="history-list" aria-label="Favorite pages">
        ${
          folders.length > 0 || favorites.length > 0
            ? `${folders.map(renderFavoriteFolder).join("")}${favorites.map(renderFavorite).join("")}`
            : `<div class="empty">No favorites yet. Use the browser menu to bookmark the active page.</div>`
        }
      </section>
    </main>
  </body>
</html>`;
}

async function getFavoriteFolderBreadcrumbs(
  dataManager: BrowserDataManager,
  currentFolder: FavoriteFolderRecord
): Promise<FavoriteFolderRecord[]> {
  const breadcrumbs: FavoriteFolderRecord[] = [currentFolder];
  let parentFolderId = currentFolder.parentFolderId;

  while (parentFolderId) {
    const parent = await dataManager.favorites.getFavoriteFolder(parentFolderId);
    if (!parent) {
      break;
    }

    breadcrumbs.unshift(parent);
    parentFolderId = parent.parentFolderId;
  }

  return breadcrumbs;
}

function renderFavoritesBreadcrumbs(breadcrumbs: FavoriteFolderRecord[]): string {
  const links = [
    `<a href="${FAVORITES_PAGE_URL}">Favorites</a>`,
    ...breadcrumbs.map((folder, index) => {
      const isCurrent = index === breadcrumbs.length - 1;
      const label = escapeHtml(folder.title);
      const href = `${FAVORITES_PAGE_URL}?folder=${escapeAttribute(folder.sync.id)}`;
      return isCurrent ? `<span>${label}</span>` : `<a href="${href}">${label}</a>`;
    })
  ];

  return `<nav class="breadcrumbs" aria-label="Favorite folder path">${links.join(
    '<span class="breadcrumb-separator">/</span>'
  )}</nav>`;
}

function renderFavoriteFolder(folder: FavoriteFolderRecord): string {
  return `<a class="history-item" href="${FAVORITES_PAGE_URL}?folder=${escapeAttribute(folder.sync.id)}">
    <span class="history-title">Folder: ${escapeHtml(folder.title)}</span>
    <span class="history-url">Virtual browser folder</span>
  </a>`;
}

function renderFavorite(favorite: FavoriteRecord): string {
  return `<a class="history-item" href="${escapeAttribute(favorite.url)}">
    <span class="history-title">${escapeHtml(favorite.title || favorite.url)}</span>
    <span class="history-url">${escapeHtml(favorite.url)}</span>
  </a>`;
}

function renderNotFoundPage(url: URL): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Page not found</title>
  </head>
  <body>
    <h1>Internal page not found</h1>
    <p>${escapeHtml(url.href)}</p>
  </body>
</html>`;
}

function sharedPageStyles(): string {
  return `<style>
    :root {
      color-scheme: dark;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #07111f;
      color: #e5eefc;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: #07111f;
    }

    main {
      margin: 0 auto;
      max-width: 980px;
      padding: 56px 28px 72px;
    }

    h1 {
      margin: 0 0 10px;
      font-size: clamp(42px, 6vw, 76px);
      letter-spacing: normal;
      line-height: 1;
    }

    .subtitle {
      margin: 0 0 28px;
      max-width: 680px;
      color: #93a4b8;
      font-size: 16px;
      line-height: 1.6;
    }

    form {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      margin-bottom: 28px;
    }

    input,
    button {
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 18px;
      color: inherit;
      font: inherit;
    }

    input {
      background: #0f1b2d;
      padding: 14px 16px;
      outline: none;
    }

    input:focus {
      border-color: #38bdf8;
      box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.15);
    }

    button {
      cursor: pointer;
      background: #2563eb;
      font-weight: 800;
      padding: 0 20px;
    }

    .history-list {
      display: grid;
      gap: 10px;
    }

    .history-item {
      display: grid;
      gap: 6px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 22px;
      background: #0b1628;
      padding: 16px 18px;
      text-decoration: none;
      transition: background 140ms ease, border-color 140ms ease;
    }

    .history-item:hover {
      background: #10233d;
      border-color: rgba(56, 189, 248, 0.42);
    }

    .back-link {
      color: #7dd3fc;
      display: inline-block;
      margin-bottom: 18px;
      text-decoration: none;
    }

    .back-link:hover {
      color: #bae6fd;
    }

    .breadcrumbs {
      align-items: center;
      color: #91a4bc;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: -10px 0 20px;
    }

    .breadcrumbs a {
      color: #7dd3fc;
      text-decoration: none;
    }

    .breadcrumbs a:hover {
      color: #bae6fd;
    }

    .breadcrumbs span:last-child {
      color: #e5eefc;
      font-weight: 800;
    }

    .breadcrumb-separator {
      color: #475569;
    }

    .history-title {
      color: #f8fafc;
      font-size: 16px;
      font-weight: 800;
    }

    .history-url,
    .history-time,
    .empty {
      color: #91a4bc;
    }

    .history-url {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .history-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      font-size: 12px;
    }

    .empty {
      border: 1px dashed rgba(148, 163, 184, 0.32);
      border-radius: 22px;
      padding: 28px;
    }
  </style>`;
}

function formatVisitedAt(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

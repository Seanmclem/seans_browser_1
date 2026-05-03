import type { DownloadItem, Session } from "electron";

export type DownloadState = "in-progress" | "completed" | "cancelled" | "interrupted";

export interface DownloadEntry {
  id: string;
  filename: string;
  receivedBytes: number;
  savePath: string;
  startedAt: string;
  state: DownloadState;
  totalBytes: number;
  url: string;
}

export class DownloadManager {
  private readonly downloads = new Map<string, DownloadEntry>();

  constructor(
    session: Session,
    private readonly onChanged?: () => void
  ) {
    session.on("will-download", (_event, item) => {
      this.trackDownload(item);
    });
  }

  listDownloads(): DownloadEntry[] {
    return Array.from(this.downloads.values()).sort((left, right) =>
      right.startedAt.localeCompare(left.startedAt)
    );
  }

  private trackDownload(item: DownloadItem): void {
    const id = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    const syncEntry = (stateOverride?: DownloadState) => {
      this.downloads.set(id, {
        id,
        filename: item.getFilename(),
        receivedBytes: item.getReceivedBytes(),
        savePath: item.getSavePath(),
        startedAt,
        state: stateOverride ?? (item.isPaused() ? "interrupted" : "in-progress"),
        totalBytes: item.getTotalBytes(),
        url: item.getURL()
      });
      this.onChanged?.();
    };

    syncEntry("in-progress");

    const onUpdated = () => {
      syncEntry();
    };
    item.on("updated", onUpdated);

    item.once("done", (_doneEvent, state) => {
      const normalizedState =
        state === "completed"
          ? "completed"
          : state === "cancelled"
            ? "cancelled"
            : "interrupted";
      syncEntry(normalizedState);
      console.info(
        `[DownloadManager] ${item.getFilename()} finished with state=${normalizedState}`
      );
    });
  }
}

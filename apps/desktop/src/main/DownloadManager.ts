import type { Session } from "electron";

export class DownloadManager {
  constructor(session: Session) {
    session.on("will-download", (_event, item) => {
      const filename = item.getFilename();
      item.once("done", (_doneEvent, state) => {
        console.info(`[DownloadManager] ${filename} finished with state=${state}`);
      });
    });
  }
}


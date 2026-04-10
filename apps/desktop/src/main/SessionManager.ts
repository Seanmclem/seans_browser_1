import { Session, session } from "electron";

export class SessionManager {
  private readonly defaultSession: Session;

  constructor() {
    this.defaultSession = session.fromPartition("persist:default");
    this.configure();
  }

  getSession(): Session {
    return this.defaultSession;
  }

  createPrivateSession(id: string): Session {
    return session.fromPartition(`private:${id}`);
  }

  private configure(): void {
    const blocklist = new Set([
      "doubleclick.net",
      "googlesyndication.com",
      "adservice.google.com"
    ]);

    this.defaultSession.webRequest.onBeforeRequest({ urls: ["*://*/*"] }, (details, callback) => {
      try {
        const hostname = new URL(details.url).hostname;
        const blocked = Array.from(blocklist).some((blockedHost) =>
          hostname.endsWith(blockedHost)
        );
        callback({ cancel: blocked });
      } catch {
        callback({});
      }
    });

    this.defaultSession.setUserAgent(`${this.defaultSession.getUserAgent()} SeanBrowser/1.0`);
    this.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
      const allowed = ["notifications", "geolocation", "media"];
      callback(allowed.includes(permission));
    });
  }
}

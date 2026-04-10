import { BrowserWindow } from "electron";
import { join } from "node:path";

export class WindowManager {
  private win: BrowserWindow | null = null;

  createMainWindow(): BrowserWindow {
    this.win = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: 900,
      minHeight: 560,
      frame: false,
      titleBarStyle: "hidden",
      trafficLightPosition: { x: 18, y: 18 },
      backgroundColor: "#0f172a",
      webPreferences: {
        preload: join(__dirname, "../preload/index.mjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webviewTag: true
      }
    });

    if (process.env.ELECTRON_RENDERER_URL) {
      void this.win.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
      void this.win.loadFile(join(__dirname, "../renderer/index.html"));
    }

    return this.win;
  }

  getWindow(): BrowserWindow | null {
    return this.win;
  }
}

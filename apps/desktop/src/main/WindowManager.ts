import { BrowserWindow, WebContents, WebContentsView } from "electron";
import { join } from "node:path";

export class WindowManager {
  private win: BrowserWindow | null = null;
  private chromeView: WebContentsView | null = null;
  private chromeHeight = 96;

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
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    this.chromeView = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "../preload/index.mjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });
    this.win.contentView.addChildView(this.chromeView);
    this.positionChromeView();

    if (process.env.ELECTRON_RENDERER_URL) {
      void this.chromeView.webContents.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
      void this.chromeView.webContents.loadFile(join(__dirname, "../renderer/index.html"));
    }

    return this.win;
  }

  getWindow(): BrowserWindow | null {
    return this.win;
  }

  getChromeWebContents(): WebContents {
    if (!this.chromeView) {
      throw new Error("Chrome view has not been created yet.");
    }
    return this.chromeView.webContents;
  }

  setChromeHeight(height: number): void {
    if (!Number.isFinite(height)) {
      return;
    }
    this.chromeHeight = Math.max(64, Math.ceil(height));
    this.positionChromeView();
  }

  reflowViews(): void {
    this.positionChromeView();
  }

  bringChromeToFront(): void {
    if (!this.win || !this.chromeView) {
      return;
    }

    try {
      this.win.contentView.removeChildView(this.chromeView);
    } catch {
      // Ignore if the chrome view has not been attached yet.
    }

    // WebContentsView z-order follows attachment order; keep app chrome above page views.
    this.win.contentView.addChildView(this.chromeView);
    this.positionChromeView();
  }

  private positionChromeView(): void {
    if (!this.win || !this.chromeView) {
      return;
    }

    const bounds = this.win.getContentBounds();
    this.chromeView.setBounds({
      x: 0,
      y: 0,
      width: bounds.width,
      height: this.chromeHeight
    });
  }
}

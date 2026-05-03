import { BrowserWindow, WebContents, WebContentsView } from "electron";
import { join } from "node:path";
import type { PageInsets, TabStripPlacement } from "./types";

type ChromeSurface = "main" | "side-tabs";

const SIDE_TAB_RAIL_WIDTH = 280;

export class WindowManager {
  private win: BrowserWindow | null = null;
  private chromeView: WebContentsView | null = null;
  private sideTabView: WebContentsView | null = null;
  private chromeHeight = 96;
  private chromeOverlayHeight = 0;
  private sideTabRailWidth = SIDE_TAB_RAIL_WIDTH;
  private tabStripPlacement: TabStripPlacement;

  constructor(initialTabStripPlacement: TabStripPlacement = "top") {
    this.tabStripPlacement = initialTabStripPlacement;
  }

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

    this.chromeView = this.createChromeView();
    this.sideTabView = this.createChromeView();
    // The chrome view temporarily grows over page views for custom menus.
    // Keep the expanded area transparent so only the menu itself covers content.
    this.chromeView.setBackgroundColor("#00000000");
    this.sideTabView.setBackgroundColor("#0f172a");
    this.win.contentView.addChildView(this.sideTabView);
    this.win.contentView.addChildView(this.chromeView);
    this.positionChromeView();
    this.positionSideTabView();

    this.loadRenderer(this.chromeView, "main");
    this.loadRenderer(this.sideTabView, "side-tabs");

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

  getChromeWebContentses(): WebContents[] {
    return [this.chromeView, this.sideTabView]
      .filter((view): view is WebContentsView => Boolean(view))
      .map((view) => view.webContents);
  }

  getPageInsets(): PageInsets {
    return {
      bottom: 0,
      left: this.tabStripPlacement === "left" ? this.sideTabRailWidth : 0,
      right: this.tabStripPlacement === "right" ? this.sideTabRailWidth : 0,
      top: this.chromeHeight
    };
  }

  getTabStripPlacement(): TabStripPlacement {
    return this.tabStripPlacement;
  }

  setChromeHeight(height: number): void {
    if (!Number.isFinite(height)) {
      return;
    }
    const nextChromeHeight = Math.max(64, Math.ceil(height));
    if (nextChromeHeight === this.chromeHeight) {
      return;
    }
    this.chromeHeight = nextChromeHeight;
    this.reflowViews();
  }

  setChromeOverlayHeight(height: number): void {
    if (!Number.isFinite(height)) {
      return;
    }
    const nextOverlayHeight = Math.max(0, Math.ceil(height));
    if (nextOverlayHeight === this.chromeOverlayHeight) {
      return;
    }
    this.chromeOverlayHeight = nextOverlayHeight;
    this.positionChromeView();
  }

  setTabStripPlacement(placement: TabStripPlacement): void {
    this.tabStripPlacement = placement;
    this.reflowViews();
  }

  reflowViews(): void {
    this.positionChromeView();
    this.positionSideTabView();
  }

  bringChromeToFront(): void {
    if (!this.win || !this.chromeView || !this.sideTabView) {
      return;
    }

    try {
      this.win.contentView.removeChildView(this.chromeView);
    } catch {
      // Ignore if the chrome view has not been attached yet.
    }
    try {
      this.win.contentView.removeChildView(this.sideTabView);
    } catch {
      // Ignore if the side chrome view has not been attached yet.
    }

    // WebContentsView z-order follows attachment order; keep app chrome above page views.
    this.win.contentView.addChildView(this.sideTabView);
    this.win.contentView.addChildView(this.chromeView);
    this.positionSideTabView();
    this.positionChromeView();
  }

  private createChromeView(): WebContentsView {
    return new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "../preload/index.mjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });
  }

  private loadRenderer(view: WebContentsView, surface: ChromeSurface): void {
    if (process.env.ELECTRON_RENDERER_URL) {
      const url = new URL(process.env.ELECTRON_RENDERER_URL);
      url.searchParams.set("surface", surface);
      void view.webContents.loadURL(url.toString());
      return;
    }

    void view.webContents.loadFile(join(__dirname, "../renderer/index.html"), {
      query: { surface }
    });
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
      height: Math.min(bounds.height, this.chromeHeight + this.chromeOverlayHeight)
    });
  }

  private positionSideTabView(): void {
    if (!this.win || !this.sideTabView) {
      return;
    }

    const bounds = this.win.getContentBounds();
    const visible = this.tabStripPlacement !== "top";
    this.sideTabView.setVisible(visible);

    if (!visible) {
      this.sideTabView.setBounds({ x: 0, y: this.chromeHeight, width: 0, height: 0 });
      return;
    }

    this.sideTabView.setBounds({
      x: this.tabStripPlacement === "right" ? bounds.width - this.sideTabRailWidth : 0,
      y: this.chromeHeight,
      width: this.sideTabRailWidth,
      height: Math.max(bounds.height - this.chromeHeight, 0)
    });
  }
}

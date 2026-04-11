import { BrowserWindow, NativeImage, WebContents, WebContentsView } from "electron";
import { EventEmitter } from "node:events";
import { evaluateSleepState, normalizeURL, TabId } from "@seans-browser/browser-core";
import { HistoryManager } from "./HistoryManager";
import { SessionManager } from "./SessionManager";
import { SerializedDesktopTab, TabRecord } from "./types";

const DEFAULT_URL = process.env.SEANS_BROWSER_START_URL ?? "https://duckduckgo.com/";

export class TabManager extends EventEmitter {
  private readonly tabs = new Map<TabId, TabRecord>();
  private activeTabId: TabId | null = null;
  private uiHeight = 96;

  constructor(
    private readonly win: BrowserWindow,
    private readonly sessionManager: SessionManager,
    private readonly historyManager: HistoryManager,
    private readonly onPageViewAttached?: () => void
  ) {
    super();
  }

  getTabs(): TabRecord[] {
    return Array.from(this.tabs.values());
  }

  getSerializedTabs(): SerializedDesktopTab[] {
    return this.getTabs().map((tab) => this.serializeTab(tab));
  }

  getTab(id: TabId): TabRecord | undefined {
    return this.tabs.get(id);
  }

  getActiveTabId(): TabId | null {
    return this.activeTabId;
  }

  getActiveTab(): TabRecord | undefined {
    return this.activeTabId ? this.tabs.get(this.activeTabId) : undefined;
  }

  createTab(inputUrl = DEFAULT_URL): TabId {
    const id = crypto.randomUUID();
    const url = normalizeURL(inputUrl);
    const view = this.createView(id);

    const record: TabRecord = {
      id,
      url,
      title: "New Tab",
      favicon: null,
      state: "awake",
      lastActive: Date.now(),
      snapshot: null,
      savedScrollY: 0,
      pinned: false,
      view,
      canGoBack: false,
      canGoForward: false,
      isLoading: true
    };

    this.tabs.set(id, record);
    this.win.contentView.addChildView(view);
    this.onPageViewAttached?.();
    this.positionView(view);
    this.attachWebContentsListeners(id, view);

    this.emit("tab:added", this.serializeTab(record));
    void this.setActiveTab(id);
    void view.webContents.loadURL(url);
    return id;
  }

  async setActiveTab(id: TabId): Promise<void> {
    const nextTab = this.tabs.get(id);
    if (!nextTab) {
      return;
    }

    if (this.activeTabId && this.activeTabId !== id) {
      const previousTab = this.tabs.get(this.activeTabId);
      if (previousTab) {
        previousTab.lastActive = Date.now();
        if (previousTab.view) {
          previousTab.view.setVisible(false);
        }
        if (previousTab.state !== "hard-sleeping" && previousTab.state !== "crashed") {
          previousTab.state = "awake";
        }
        this.emit("tab:updated", this.serializeTab(previousTab));
      }
    }

    if (nextTab.state === "hard-sleeping") {
      await this.wakeHardSleeping(id);
      return;
    }

    if (!nextTab.view) {
      return;
    }

    nextTab.lastActive = Date.now();
    nextTab.state = "active";
    nextTab.snapshot = null;
    nextTab.view.setVisible(true);
    nextTab.view.webContents.setBackgroundThrottling(false);
    this.positionView(nextTab.view);

    this.activeTabId = id;
    this.emit("tab:activated", id);
    this.emit("tab:updated", this.serializeTab(nextTab));
  }

  async closeTab(id: TabId): Promise<void> {
    const tab = this.tabs.get(id);
    if (!tab) {
      return;
    }

    if (tab.view) {
      try {
        this.win.contentView.removeChildView(tab.view);
      } catch {
        // Ignore detached views.
      }
      try {
        tab.view.webContents.destroy();
      } catch {
        // Ignore already-destroyed contents.
      }
    }

    this.tabs.delete(id);
    this.emit("tab:removed", id);

    if (this.activeTabId === id) {
      const remainingTabs = Array.from(this.tabs.keys());
      this.activeTabId = null;
      if (remainingTabs.length > 0) {
        await this.setActiveTab(remainingTabs[Math.max(remainingTabs.length - 1, 0)]);
      }
    }
  }

  async closeActiveTab(): Promise<void> {
    if (this.activeTabId) {
      await this.closeTab(this.activeTabId);
    }
  }

  async switchToTabAtIndex(index: number): Promise<void> {
    const tab = this.getTabs()[index];
    if (tab) {
      await this.setActiveTab(tab.id);
    }
  }

  async goBack(id: TabId): Promise<void> {
    const tab = this.tabs.get(id);
    if (tab?.view?.webContents.canGoBack()) {
      tab.view.webContents.goBack();
    }
  }

  async goForward(id: TabId): Promise<void> {
    const tab = this.tabs.get(id);
    if (tab?.view?.webContents.canGoForward()) {
      tab.view.webContents.goForward();
    }
  }

  async reload(id: TabId): Promise<void> {
    this.tabs.get(id)?.view?.webContents.reload();
  }

  async navigateTo(id: TabId, input: string): Promise<void> {
    const tab = this.tabs.get(id);
    if (!tab?.view) {
      return;
    }
    const normalized = normalizeURL(input);
    tab.url = normalized;
    tab.isLoading = true;
    this.emit("tab:updated", this.serializeTab(tab));
    await tab.view.webContents.loadURL(normalized);
  }

  async captureSnapshot(id: TabId): Promise<NativeImage | null> {
    const tab = this.tabs.get(id);
    if (!tab?.view) {
      return null;
    }
    try {
      return await tab.view.webContents.capturePage();
    } catch {
      return null;
    }
  }

  async softSleepTab(id: TabId): Promise<void> {
    const tab = this.tabs.get(id);
    if (!tab?.view || tab.id === this.activeTabId || tab.state === "hard-sleeping") {
      return;
    }

    tab.snapshot = await this.captureSnapshot(id);
    tab.view.webContents.setBackgroundThrottling(true);
    tab.view.setVisible(false);
    tab.state = "soft-sleeping";
    this.emit("tab:updated", this.serializeTab(tab));
  }

  async hardSleepTab(id: TabId): Promise<void> {
    const tab = this.tabs.get(id);
    if (!tab || tab.id === this.activeTabId) {
      return;
    }

    if (!tab.view) {
      tab.state = "hard-sleeping";
      this.emit("tab:updated", this.serializeTab(tab));
      return;
    }

    tab.snapshot = await this.captureSnapshot(id);

    try {
      const scrollY = await tab.view.webContents.executeJavaScript("window.scrollY", true);
      tab.savedScrollY = typeof scrollY === "number" ? scrollY : 0;
    } catch {
      tab.savedScrollY = 0;
    }

    try {
      this.win.contentView.removeChildView(tab.view);
    } catch {
      // Ignore detached views.
    }
    try {
      tab.view.webContents.destroy();
    } catch {
      // Ignore already-destroyed contents.
    }

    tab.view = null;
    tab.state = "hard-sleeping";
    tab.isLoading = false;
    this.emit("tab:updated", this.serializeTab(tab));
  }

  reflowViews(): void {
    for (const tab of this.tabs.values()) {
      if (tab.view) {
        this.positionView(tab.view);
      }
    }
  }

  setChromeHeight(height: number): void {
    if (!Number.isFinite(height)) {
      return;
    }
    this.uiHeight = Math.max(64, Math.ceil(height));
    this.reflowViews();
  }

  markCrashedByWebContents(contents: WebContents): void {
    for (const tab of this.tabs.values()) {
      if (tab.view?.webContents.id === contents.id) {
        tab.state = "crashed";
        tab.isLoading = false;
        this.emit("tab:updated", this.serializeTab(tab));
        return;
      }
    }
  }

  async forceEvaluateTabSleep(id: TabId): Promise<void> {
    const tab = this.tabs.get(id);
    if (!tab) {
      return;
    }

    const decision = evaluateSleepState({
      isActive: id === this.activeTabId,
      isPinned: tab.pinned,
      totalTabCount: this.tabs.size,
      lastActive: tab.lastActive
    });

    if (decision.nextState === "hard-sleeping") {
      await this.hardSleepTab(id);
    } else if (decision.nextState === "soft-sleeping") {
      await this.softSleepTab(id);
    }
  }

  private createView(id: TabId): WebContentsView {
    return new WebContentsView({
      webPreferences: {
        session: this.sessionManager.getSession(),
        sandbox: false
      }
    });
  }

  private attachWebContentsListeners(id: TabId, view: WebContentsView): void {
    const contents = view.webContents;

    contents.setWindowOpenHandler(({ url }) => {
      this.createTab(url);
      return { action: "deny" };
    });

    contents.on("page-title-updated", (event, title) => {
      event.preventDefault();
      this.patchTab(id, { title });
    });

    contents.on("page-favicon-updated", (_event, favicons) => {
      this.patchTab(id, { favicon: favicons[0] ?? null });
    });

    contents.on("did-start-loading", () => {
      this.patchTab(id, { isLoading: true });
      this.syncNavigationState(id);
    });

    contents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      console.warn(
        `[TabManager] failed loading ${id}: ${errorCode} ${errorDescription} ${validatedURL}`
      );
    });

    contents.on("did-stop-loading", () => {
      const tab = this.tabs.get(id);
      if (!tab) {
        return;
      }
      const url = contents.getURL() || tab.url;
      const title = contents.getTitle() || tab.title;
      this.historyManager.addEntry(url, title);
      this.patchTab(id, {
        url,
        title,
        isLoading: false,
        canGoBack: contents.canGoBack(),
        canGoForward: contents.canGoForward()
      });
    });

    contents.on("did-navigate", (_event, url) => {
      this.patchTab(id, { url });
      this.syncNavigationState(id);
    });

    contents.on("did-navigate-in-page", (_event, url) => {
      this.patchTab(id, { url });
      this.syncNavigationState(id);
    });

    contents.on("render-process-gone", () => {
      this.patchTab(id, { state: "crashed", isLoading: false });
    });
  }

  private syncNavigationState(id: TabId): void {
    const tab = this.tabs.get(id);
    if (!tab?.view) {
      return;
    }
    this.patchTab(id, {
      canGoBack: tab.view.webContents.canGoBack(),
      canGoForward: tab.view.webContents.canGoForward()
    });
  }

  private patchTab(id: TabId, patch: Partial<TabRecord>): void {
    const tab = this.tabs.get(id);
    if (!tab) {
      return;
    }
    Object.assign(tab, patch);
    this.emit("tab:updated", this.serializeTab(tab));
  }

  private async wakeHardSleeping(id: TabId): Promise<void> {
    const tab = this.tabs.get(id);
    if (!tab) {
      return;
    }

    const view = this.createView(id);
    tab.view = view;
    tab.state = "active";
    tab.lastActive = Date.now();
    tab.isLoading = true;

    this.win.contentView.addChildView(view);
    this.onPageViewAttached?.();
    this.positionView(view);
    this.attachWebContentsListeners(id, view);
    view.setVisible(true);
    view.webContents.setBackgroundThrottling(false);

    view.webContents.once("did-finish-load", () => {
      void view.webContents.executeJavaScript(`window.scrollTo(0, ${tab.savedScrollY})`, true);
    });

    this.activeTabId = id;
    this.emit("tab:activated", id);
    this.emit("tab:updated", this.serializeTab(tab));
    await view.webContents.loadURL(tab.url);
  }

  private positionView(view: WebContentsView): void {
    const bounds = this.win.getContentBounds();
    view.setBounds({
      x: 0,
      y: this.uiHeight,
      width: bounds.width,
      height: Math.max(bounds.height - this.uiHeight, 0)
    });
  }

  private serializeTab(tab: TabRecord): SerializedDesktopTab {
    return {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      favicon: tab.favicon,
      state: tab.state,
      lastActive: tab.lastActive,
      snapshot: tab.snapshot?.toDataURL() ?? null,
      savedScrollY: tab.savedScrollY,
      pinned: tab.pinned,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward,
      isLoading: tab.isLoading
    };
  }
}

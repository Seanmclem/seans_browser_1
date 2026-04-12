import {
  BrowserWindow,
  type Event as ElectronEvent,
  NativeImage,
  WebContents,
  WebContentsView
} from "electron";
import { EventEmitter } from "node:events";
import { evaluateSleepState, normalizeURL, TabId } from "@seans-browser/browser-core";
import { HistoryManager } from "./HistoryManager";
import { SessionManager } from "./SessionManager";
import {
  DetachedTab,
  PageInsets,
  SerializedDesktopTab,
  TabDropPlacement,
  TabRecord
} from "./types";

const DEFAULT_URL = "https://duckduckgo.com/";
type TabListenerCleanup = () => void;

export class TabManager extends EventEmitter {
  private readonly tabs = new Map<TabId, TabRecord>();
  private readonly tabListenerCleanups = new Map<TabId, TabListenerCleanup[]>();
  private activeTabId: TabId | null = null;
  private pageInsets: PageInsets = { bottom: 0, left: 0, right: 0, top: 96 };

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
    const view = this.createView();

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
    // Do not start the initial load while hidden: Chromium may skip the visible paint surface.
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

    this.cleanupTabListeners(id);

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

  destroyAllTabs(): void {
    for (const tab of this.tabs.values()) {
      this.cleanupTabListeners(tab.id);

      if (!tab.view) {
        continue;
      }

      try {
        this.win.contentView.removeChildView(tab.view);
      } catch {
        // The BrowserWindow may already be tearing down.
      }

      try {
        tab.view.webContents.destroy();
      } catch {
        // Ignore already-destroyed contents.
      }
    }

    this.tabs.clear();
    this.activeTabId = null;
  }

  async detachTab(id: TabId): Promise<DetachedTab | null> {
    const tab = this.tabs.get(id);
    if (!tab?.view) {
      return null;
    }

    const view = tab.view;
    const wasActive = this.activeTabId === id;
    this.cleanupTabListeners(id);

    try {
      this.win.contentView.removeChildView(view);
    } catch {
      // Ignore detached views.
    }

    view.setVisible(false);
    view.webContents.setBackgroundThrottling(true);
    this.tabs.delete(id);
    this.emit("tab:removed", id);

    if (wasActive) {
      this.activeTabId = null;
      const nextTabId = Array.from(this.tabs.keys()).at(-1);
      if (nextTabId) {
        await this.setActiveTab(nextTabId);
      }
    }

    tab.state = "awake";
    return { record: tab, view, wasActive };
  }

  async adoptDetachedTab(
    detachedTab: DetachedTab,
    targetTabId: TabId | null = null,
    placement: TabDropPlacement = "end"
  ): Promise<TabId> {
    const { record, view } = detachedTab;
    record.view = view;
    record.state = "awake";
    record.lastActive = Date.now();

    this.tabs.set(record.id, record);
    this.moveTab(record.id, targetTabId, placement);
    this.win.contentView.addChildView(view);
    this.onPageViewAttached?.();
    this.positionView(view);
    this.attachWebContentsListeners(record.id, view);

    this.emit("tab:added", this.serializeTab(record));
    await this.setActiveTab(record.id);
    return record.id;
  }

  moveTab(id: TabId, targetTabId: TabId | null, placement: TabDropPlacement = "end"): void {
    const tab = this.tabs.get(id);
    if (!tab || targetTabId === id) {
      return;
    }

    const orderedTabs = this.getTabs().filter((candidate) => candidate.id !== id);
    let insertIndex = orderedTabs.length;

    if (targetTabId && placement !== "end") {
      const targetIndex = orderedTabs.findIndex((candidate) => candidate.id === targetTabId);
      if (targetIndex >= 0) {
        insertIndex = placement === "before" ? targetIndex : targetIndex + 1;
      }
    }

    orderedTabs.splice(insertIndex, 0, tab);
    this.tabs.clear();
    for (const orderedTab of orderedTabs) {
      this.tabs.set(orderedTab.id, orderedTab);
    }

    this.emit("tab:reordered", this.getSerializedTabs());
    if (this.activeTabId) {
      this.emit("tab:activated", this.activeTabId);
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
      this.cleanupTabListeners(id);
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

  setPageInsets(insets: PageInsets): void {
    this.pageInsets = {
      bottom: Math.max(0, Math.ceil(insets.bottom)),
      left: Math.max(0, Math.ceil(insets.left)),
      right: Math.max(0, Math.ceil(insets.right)),
      top: Math.max(0, Math.ceil(insets.top))
    };
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

  private createView(): WebContentsView {
    return new WebContentsView({
      webPreferences: {
        session: this.sessionManager.getSession(),
        sandbox: false
      }
    });
  }

  private attachWebContentsListeners(id: TabId, view: WebContentsView): void {
    const contents = view.webContents;
    const cleanups: TabListenerCleanup[] = [];

    this.cleanupTabListeners(id);

    contents.setWindowOpenHandler(({ url }) => {
      this.createTab(url);
      return { action: "deny" };
    });
    cleanups.push(() => {
      contents.setWindowOpenHandler(() => ({ action: "deny" }));
    });

    const onPageTitleUpdated = (event: ElectronEvent, title: string) => {
      event.preventDefault();
      this.patchTab(id, { title });
    };
    contents.on("page-title-updated", onPageTitleUpdated);
    cleanups.push(() => contents.off("page-title-updated", onPageTitleUpdated));

    const onPageFaviconUpdated = (_event: ElectronEvent, favicons: string[]) => {
      this.patchTab(id, { favicon: favicons[0] ?? null });
    };
    contents.on("page-favicon-updated", onPageFaviconUpdated);
    cleanups.push(() => contents.off("page-favicon-updated", onPageFaviconUpdated));

    const onDidStartLoading = () => {
      this.patchTab(id, { isLoading: true });
      this.syncNavigationState(id);
    };
    contents.on("did-start-loading", onDidStartLoading);
    cleanups.push(() => contents.off("did-start-loading", onDidStartLoading));

    const onDidFailLoad = (
      _event: ElectronEvent,
      errorCode: number,
      errorDescription: string,
      validatedURL: string
    ) => {
      console.warn(
        `[TabManager] failed loading ${id}: ${errorCode} ${errorDescription} ${validatedURL}`
      );
    };
    contents.on("did-fail-load", onDidFailLoad);
    cleanups.push(() => contents.off("did-fail-load", onDidFailLoad));

    const onDidStopLoading = () => {
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
    };
    contents.on("did-stop-loading", onDidStopLoading);
    cleanups.push(() => contents.off("did-stop-loading", onDidStopLoading));

    const onDidNavigate = (_event: ElectronEvent, url: string) => {
      this.patchTab(id, { url });
      this.syncNavigationState(id);
    };
    contents.on("did-navigate", onDidNavigate);
    cleanups.push(() => contents.off("did-navigate", onDidNavigate));

    const onDidNavigateInPage = (_event: ElectronEvent, url: string) => {
      this.patchTab(id, { url });
      this.syncNavigationState(id);
    };
    contents.on("did-navigate-in-page", onDidNavigateInPage);
    cleanups.push(() => contents.off("did-navigate-in-page", onDidNavigateInPage));

    const onRenderProcessGone = () => {
      this.patchTab(id, { state: "crashed", isLoading: false });
    };
    contents.on("render-process-gone", onRenderProcessGone);
    cleanups.push(() => contents.off("render-process-gone", onRenderProcessGone));

    this.tabListenerCleanups.set(id, cleanups);
  }

  private cleanupTabListeners(id: TabId): void {
    const cleanups = this.tabListenerCleanups.get(id);
    if (!cleanups) {
      return;
    }

    for (const cleanup of cleanups) {
      cleanup();
    }
    this.tabListenerCleanups.delete(id);
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

    const view = this.createView();
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
    const width = bounds.width - this.pageInsets.left - this.pageInsets.right;
    const height = bounds.height - this.pageInsets.top - this.pageInsets.bottom;

    view.setBounds({
      x: this.pageInsets.left,
      y: this.pageInsets.top,
      width: Math.max(width, 0),
      height: Math.max(height, 0)
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

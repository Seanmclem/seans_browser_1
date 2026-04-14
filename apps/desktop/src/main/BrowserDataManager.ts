import type { BrowserSettingRecord, JsonValue } from "@seans-browser/browser-core";
import { HistoryManager } from "./HistoryManager";
import { LocalBrowserDatabase } from "./data/LocalBrowserDatabase";
import { SqliteFavoritesRepository } from "./data/SqliteFavoritesRepository";
import { SqliteLocalChangeRepository } from "./data/SqliteLocalChangeRepository";
import { SqliteOpenTabsRepository } from "./data/SqliteOpenTabsRepository";
import { SqliteSettingsRepository } from "./data/SqliteSettingsRepository";
import type { TabStripPlacement } from "./types";

const TAB_STRIP_PLACEMENT_SETTING_KEY = "desktop.tabStripPlacement";

export class BrowserDataManager {
  readonly database = new LocalBrowserDatabase();
  readonly favorites = new SqliteFavoritesRepository(this.database);
  readonly history = new HistoryManager(this.database);
  readonly localChanges = new SqliteLocalChangeRepository(this.database);
  readonly openTabs = new SqliteOpenTabsRepository(this.database);
  readonly settings = new SqliteSettingsRepository(this.database);

  async getTabStripPlacement(): Promise<TabStripPlacement> {
    const setting = await this.settings.getSetting(TAB_STRIP_PLACEMENT_SETTING_KEY, "desktop");
    return isTabStripPlacement(setting?.value) ? setting.value : "top";
  }

  async setTabStripPlacement(placement: TabStripPlacement): Promise<void> {
    await this.settings.upsertSetting(
      await this.settingRecord(TAB_STRIP_PLACEMENT_SETTING_KEY, placement, "device", "desktop")
    );
  }

  private async settingRecord(
    key: string,
    value: JsonValue,
    scope: BrowserSettingRecord["scope"],
    platform: BrowserSettingRecord["platform"]
  ): Promise<BrowserSettingRecord> {
    const now = new Date().toISOString();
    const setting =
      (await this.settings.getSetting(key, platform)) ??
      this.settings.createSetting({ key, platform, scope, value });

    return {
      ...setting,
      scope,
      value,
      sync: {
        ...setting.sync,
        deletedAt: null,
        updatedAt: now
      }
    };
  }
}

function isTabStripPlacement(value: unknown): value is TabStripPlacement {
  return value === "top" || value === "left" || value === "right";
}

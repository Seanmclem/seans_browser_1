export type TabId = string;

export type TabState =
  | "active"
  | "awake"
  | "soft-sleeping"
  | "hard-sleeping"
  | "crashed";

export interface SerializedTab {
  id: TabId;
  url: string;
  title: string;
  favicon: string | null;
  state: TabState;
  lastActive: number;
  snapshot: string | null;
  savedScrollY: number;
  pinned: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  isLoading?: boolean;
}

export interface SleepPolicyConfig {
  softSleepTabThreshold: number;
  hardSleepTabThreshold: number;
  softSleepHours: number;
  hardSleepHours: number;
}

export interface SleepDecision {
  nextState: Exclude<TabState, "active" | "crashed"> | null;
  otherTabCount: number;
  hoursInactive: number;
}

export const DEFAULT_SLEEP_POLICY: SleepPolicyConfig = {
  softSleepTabThreshold: 25,
  hardSleepTabThreshold: 50,
  softSleepHours: 12,
  hardSleepHours: 36
};


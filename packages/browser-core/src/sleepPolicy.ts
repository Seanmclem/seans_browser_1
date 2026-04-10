import { DEFAULT_SLEEP_POLICY, SleepDecision, SleepPolicyConfig } from "./types";

interface EvaluateSleepInput {
  isActive: boolean;
  isPinned: boolean;
  totalTabCount: number;
  lastActive: number;
  now?: number;
  policy?: Partial<SleepPolicyConfig>;
}

export function evaluateSleepState(input: EvaluateSleepInput): SleepDecision {
  const now = input.now ?? Date.now();
  const policy = {
    ...DEFAULT_SLEEP_POLICY,
    ...input.policy
  };

  if (input.isActive || input.isPinned) {
    return {
      nextState: null,
      otherTabCount: Math.max(input.totalTabCount - 1, 0),
      hoursInactive: 0
    };
  }

  const otherTabCount = Math.max(input.totalTabCount - 1, 0);
  const hoursInactive = (now - input.lastActive) / (1000 * 60 * 60);

  if (
    otherTabCount >= policy.hardSleepTabThreshold ||
    hoursInactive >= policy.hardSleepHours
  ) {
    return { nextState: "hard-sleeping", otherTabCount, hoursInactive };
  }

  if (
    otherTabCount >= policy.softSleepTabThreshold ||
    hoursInactive >= policy.softSleepHours
  ) {
    return { nextState: "soft-sleeping", otherTabCount, hoursInactive };
  }

  return { nextState: null, otherTabCount, hoursInactive };
}


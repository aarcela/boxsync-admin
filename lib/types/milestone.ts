export type MilestoneType = 'class_count' | 'birthday' | 'anniversary' | 'streak' | 'first_month';

export interface MilestoneAchieved {
  id: string;
  user_id: string;
  tenant_id: string;
  milestone_type: MilestoneType;
  milestone_value: string;
  achieved_at: string;
  push_sent_at: string | null;
  created_at: string;
}

export interface MilestoneSettings {
  enabled?: boolean;
  pushEnabled?: boolean;
  classCountThresholds?: number[];
  streakEnabled?: boolean;
  streakNudgeEnabled?: boolean;
  defaultWeeklyTarget?: number;
  firstMonthTarget?: number;
}

export const DEFAULT_MILESTONE_SETTINGS: MilestoneSettings = {
  enabled: true,
  pushEnabled: true,
  classCountThresholds: [1, 10, 25, 50, 100, 200],
  streakEnabled: true,
  streakNudgeEnabled: true,
  defaultWeeklyTarget: 3,
  firstMonthTarget: 8,
};

function readBool(value: unknown, fallback: boolean | undefined): boolean | undefined {
  return typeof value === 'boolean' ? value : fallback;
}

function readInt(value: unknown, fallback: number | undefined, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function parseMilestoneSettings(settings: unknown): MilestoneSettings {
  if (!settings || typeof settings !== 'object') return DEFAULT_MILESTONE_SETTINGS;
  
  const bag = settings as Record<string, unknown>;
  const milestones = bag.milestones as Record<string, unknown> | undefined;
  
  if (!milestones || typeof milestones !== 'object') return DEFAULT_MILESTONE_SETTINGS;
  
  const enabled = typeof milestones.enabled === 'boolean' 
    ? milestones.enabled 
    : DEFAULT_MILESTONE_SETTINGS.enabled;
  
  const pushEnabled = typeof milestones.pushEnabled === 'boolean'
    ? milestones.pushEnabled
    : DEFAULT_MILESTONE_SETTINGS.pushEnabled;
  
  let classCountThresholds = DEFAULT_MILESTONE_SETTINGS.classCountThresholds;
  if (Array.isArray(milestones.classCountThresholds)) {
    const parsed = milestones.classCountThresholds
      .filter((v) => typeof v === 'number' && v > 0)
      .map((v) => v as number)
      .sort((a, b) => a - b);
    if (parsed.length > 0) {
      classCountThresholds = parsed;
    }
  }
  
  return {
    enabled,
    pushEnabled,
    classCountThresholds,
    streakEnabled: readBool(milestones.streakEnabled, DEFAULT_MILESTONE_SETTINGS.streakEnabled),
    streakNudgeEnabled: readBool(milestones.streakNudgeEnabled, DEFAULT_MILESTONE_SETTINGS.streakNudgeEnabled),
    defaultWeeklyTarget: readInt(milestones.defaultWeeklyTarget, DEFAULT_MILESTONE_SETTINGS.defaultWeeklyTarget, 1, 7),
    firstMonthTarget: readInt(milestones.firstMonthTarget, DEFAULT_MILESTONE_SETTINGS.firstMonthTarget, 1, 60),
  };
}

export function patchMilestoneSettings(
  currentSettings: unknown,
  patch: Partial<MilestoneSettings>
): Record<string, unknown> {
  const settings = (currentSettings && typeof currentSettings === 'object'
    ? currentSettings
    : {}) as Record<string, unknown>;
  
  const current = parseMilestoneSettings(settings);
  const milestones = {
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
    pushEnabled: typeof patch.pushEnabled === 'boolean' ? patch.pushEnabled : current.pushEnabled,
    classCountThresholds: Array.isArray(patch.classCountThresholds)
      ? patch.classCountThresholds.filter((v) => typeof v === 'number' && v > 0).sort((a, b) => a - b)
      : current.classCountThresholds,
    streakEnabled: readBool(patch.streakEnabled, current.streakEnabled),
    streakNudgeEnabled: readBool(patch.streakNudgeEnabled, current.streakNudgeEnabled),
    defaultWeeklyTarget: readInt(patch.defaultWeeklyTarget, current.defaultWeeklyTarget, 1, 7),
    firstMonthTarget: readInt(patch.firstMonthTarget, current.firstMonthTarget, 1, 60),
  };
  
  return {
    ...settings,
    milestones,
  };
}

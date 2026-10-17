export type MilestoneType = 'class_count' | 'birthday' | 'anniversary';

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
}

export const DEFAULT_MILESTONE_SETTINGS: MilestoneSettings = {
  enabled: true,
  pushEnabled: true,
  classCountThresholds: [1, 10, 25, 50, 100, 200],
};

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
  };
  
  return {
    ...settings,
    milestones,
  };
}

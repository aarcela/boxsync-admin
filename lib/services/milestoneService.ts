import { supabase } from '../supabase';
import { supabaseAdmin } from '../supabase-admin';
import type { MilestoneAchieved, MilestoneSettings } from '../types/milestone';
import { parseMilestoneSettings } from '../types/milestone';

export const milestoneService = {
  /**
   * Get all milestones achieved by a user in a tenant
   */
  async getUserMilestones(userId: string, tenantId: string): Promise<MilestoneAchieved[]> {
    const { data, error } = await supabase
      .from('milestones_achieved')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .order('achieved_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get milestone settings for a tenant (from tenants.settings)
   */
  async getTenantMilestoneSettings(tenantId: string): Promise<MilestoneSettings> {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    if (error) throw error;
    return parseMilestoneSettings(data?.settings);
  },

  /**
   * Update milestone settings for a tenant
   */
  async updateTenantMilestoneSettings(
    tenantId: string,
    patch: Partial<MilestoneSettings>
  ): Promise<void> {
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    if (fetchError) throw fetchError;

    const currentSettings = (current?.settings || {}) as Record<string, unknown>;
    const currentMilestones = parseMilestoneSettings(currentSettings);

    const updatedMilestones = {
      enabled: typeof patch.enabled === 'boolean' ? patch.enabled : currentMilestones.enabled,
      pushEnabled: typeof patch.pushEnabled === 'boolean' ? patch.pushEnabled : currentMilestones.pushEnabled,
      classCountThresholds: Array.isArray(patch.classCountThresholds)
        ? patch.classCountThresholds.filter((v) => typeof v === 'number' && v > 0).sort((a, b) => a - b)
        : currentMilestones.classCountThresholds,
    };

    const newSettings = {
      ...currentSettings,
      milestones: updatedMilestones,
    };

    const { error: updateError } = await supabaseAdmin
      .from('tenants')
      .update({ settings: newSettings })
      .eq('id', tenantId);

    if (updateError) throw updateError;
  },

  /**
   * Backfill class count milestones for a tenant (or all if tenantId is null)
   * This is useful when first enabling the feature to avoid spam
   */
  async backfillClassCountMilestones(
    tenantId?: string
  ): Promise<Array<{ tenant_id: string; user_id: string; milestone_value: string; count: number }>> {
    const { data, error } = await supabaseAdmin.rpc('backfill_class_count_milestones', {
      p_tenant_id: tenantId || null,
    });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get milestone statistics for a tenant
   */
  async getTenantMilestoneStats(tenantId: string): Promise<{
    totalAchievements: number;
    classCountAchievements: number;
    birthdayAchievements: number;
    anniversaryAchievements: number;
    recentAchievements: MilestoneAchieved[];
  }> {
    const { data: all, error: allError } = await supabaseAdmin
      .from('milestones_achieved')
      .select('*')
      .eq('tenant_id', tenantId);

    if (allError) throw allError;

    const milestones = all || [];
    const classCount = milestones.filter((m) => m.milestone_type === 'class_count').length;
    const birthday = milestones.filter((m) => m.milestone_type === 'birthday').length;
    const anniversary = milestones.filter((m) => m.milestone_type === 'anniversary').length;

    const { data: recent, error: recentError } = await supabaseAdmin
      .from('milestones_achieved')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('achieved_at', { ascending: false })
      .limit(10);

    if (recentError) throw recentError;

    return {
      totalAchievements: milestones.length,
      classCountAchievements: classCount,
      birthdayAchievements: birthday,
      anniversaryAchievements: anniversary,
      recentAchievements: recent || [],
    };
  },
};

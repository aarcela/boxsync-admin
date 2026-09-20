import type { SupabaseClient } from '@supabase/supabase-js';
import {
  currentAiPeriodYm,
  nextAiPeriodResetIso,
  resolveAiMonthlyQuestions,
  type AskAiQuota,
} from '../ai/quota';
import { parsePlatformPlanId } from '../platform-plans';

type ConsumeResult = {
  allowed: boolean;
  used: number;
  question_limit: number;
  period_ym: string;
};

export const tenantAiService = {
  async getQuota(
    tenantId: string,
    client: SupabaseClient,
    tenant: {
      platform_plan?: string | null;
      ai_monthly_question_limit?: number | null;
    }
  ): Promise<AskAiQuota> {
    const periodYm = currentAiPeriodYm();
    const limit = resolveAiMonthlyQuestions(
      tenant.platform_plan,
      tenant.ai_monthly_question_limit
    );
    const { data, error } = await client
      .from('tenant_ai_usage')
      .select('questions_used')
      .eq('tenant_id', tenantId)
      .eq('period_ym', periodYm)
      .maybeSingle();

    if (error) throw error;

    const used = data?.questions_used ?? 0;
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      periodYm,
      resetsAt: nextAiPeriodResetIso(),
      disabled: limit <= 0,
      customLimit: tenant.ai_monthly_question_limit != null,
    };
  },

  async consumeQuestion(
    tenantId: string,
    limit: number,
    client: SupabaseClient
  ): Promise<ConsumeResult> {
    const { data, error } = await client.rpc('consume_tenant_ai_question', {
      p_tenant_id: tenantId,
      p_limit: limit,
    });
    if (error) throw error;
    const row = data as ConsumeResult;
    return {
      allowed: Boolean(row?.allowed),
      used: Number(row?.used ?? 0),
      question_limit: Number(row?.question_limit ?? limit),
      period_ym: String(row?.period_ym ?? currentAiPeriodYm()),
    };
  },

  async releaseQuestion(tenantId: string, client: SupabaseClient): Promise<void> {
    const { error } = await client.rpc('release_tenant_ai_question', {
      p_tenant_id: tenantId,
    });
    if (error) throw error;
  },

  async addTokenUsage(
    tenantId: string,
    tokens: { prompt: number; completion: number },
    client: SupabaseClient
  ): Promise<void> {
    const periodYm = currentAiPeriodYm();
    const { data, error } = await client
      .from('tenant_ai_usage')
      .select('prompt_tokens, completion_tokens')
      .eq('tenant_id', tenantId)
      .eq('period_ym', periodYm)
      .maybeSingle();
    if (error) throw error;
    if (!data) return;
    const { error: updateError } = await client
      .from('tenant_ai_usage')
      .update({
        prompt_tokens: (data.prompt_tokens ?? 0) + Math.max(0, tokens.prompt),
        completion_tokens: (data.completion_tokens ?? 0) + Math.max(0, tokens.completion),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('period_ym', periodYm);
    if (updateError) throw updateError;
  },

  quotaFromTenantRow(tenant: {
    platform_plan?: string | null;
    ai_monthly_question_limit?: number | null;
  }, used: number): AskAiQuota {
    const limit = resolveAiMonthlyQuestions(
      parsePlatformPlanId(tenant.platform_plan),
      tenant.ai_monthly_question_limit
    );
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      periodYm: currentAiPeriodYm(),
      resetsAt: nextAiPeriodResetIso(),
      disabled: limit <= 0,
      customLimit: tenant.ai_monthly_question_limit != null,
    };
  },
};

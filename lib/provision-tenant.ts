import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidSlugFormat, SLUG_RE, suggestSlug } from '@/lib/reserved-slugs';
import { classTypeService } from '@/lib/services/classTypeService';
import { membershipPlanService } from '@/lib/services/membershipPlanService';
import { tenantService } from '@/lib/services/tenantService';
import type { PlatformPlanId } from '@/lib/platform-plans';
import type { Tenant } from '@/lib/types/gym';
import { DEFAULT_UNLIMITED_MEMBERSHIP_PLAN } from '@/lib/types/gym';

export { SLUG_RE };

export type SignupSource = 'hq' | 'self_serve';

export type ProvisionTenantInput = {
  slug: string;
  name: string;
  id?: string;
  platform_plan?: PlatformPlanId;
  signup_source?: SignupSource;
  owner_user_id?: string;
};

export class ProvisionTenantError extends Error {
  status: number;
  code: string;
  suggestions?: string[];

  constructor(code: string, message: string, status: number, suggestions?: string[]) {
    super(message);
    this.code = code;
    this.status = status;
    this.suggestions = suggestions;
  }
}

export async function provisionTenant(
  input: ProvisionTenantInput,
  client: SupabaseClient
): Promise<{ tenant: Tenant; membershipPlan: unknown }> {
  const slug = input.slug.trim().toLowerCase();
  const name = input.name.trim();

  if (!slug || !name) {
    throw new ProvisionTenantError('validation', 'slug and name are required.', 400);
  }
  if (!isValidSlugFormat(slug)) {
    throw new ProvisionTenantError(
      'invalid_slug',
      'Invalid slug. Use lowercase letters, numbers, and hyphens (e.g. madrid, pits-madrid).',
      400,
      suggestSlug(slug)
    );
  }

  const existing = await tenantService.getTenantBySlug(slug, client);
  if (existing) {
    throw new ProvisionTenantError(
      'slug_taken',
      `Tenant slug "${slug}" already exists.`,
      409,
      suggestSlug(slug)
    );
  }

  const tenant = await tenantService.createTenant(
    {
      slug,
      name,
      ...(input.id ? { id: input.id } : {}),
      ...(input.platform_plan ? { platform_plan: input.platform_plan } : {}),
      signup_source: input.signup_source ?? 'hq',
      owner_user_id: input.owner_user_id,
    },
    client
  );

  let membershipPlan;
  try {
    membershipPlan = await membershipPlanService.createMembershipPlan(
      client,
      tenant.id,
      DEFAULT_UNLIMITED_MEMBERSHIP_PLAN
    );
    await classTypeService.seedDefaultsForTenant(client, tenant.id);
  } catch (planError) {
    await client.from('membership_plans').delete().eq('tenant_id', tenant.id);
    const { error: rollbackError } = await client
      .from('tenants')
      .delete()
      .eq('id', tenant.id);
    if (rollbackError) console.error('provisionTenant rollback', rollbackError.message);
    throw planError;
  }

  return { tenant, membershipPlan };
}

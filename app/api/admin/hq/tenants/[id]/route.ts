import { NextResponse } from 'next/server';
import { isPlatformPlanId } from '@/lib/platform-plans';
import { requirePlatformAdminApi } from '@/lib/require-platform-admin-api';
import { hqStatsService } from '@/lib/services/hqStatsService';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const { id: tenantId } = await context.params;
    if (!UUID_RE.test(tenantId)) {
      return NextResponse.json({ error: 'Invalid tenant id.' }, { status: 400 });
    }

    const { tenants } = await hqStatsService.getOverview(supabaseAdmin);
    const tenant = tenants.find((row) => row.id === tenantId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }

    return NextResponse.json({ tenant });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const { id: tenantId } = await context.params;
    if (!UUID_RE.test(tenantId)) {
      return NextResponse.json({ error: 'Invalid tenant id.' }, { status: 400 });
    }

    const existing = await tenantService.getTenantById(tenantId, supabaseAdmin);
    if (!existing) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }

    const body = await request.json() as Record<string, unknown>;

    if (body.action === 'set_active') {
      if (typeof body.is_active !== 'boolean') {
        return NextResponse.json({ error: 'is_active must be a boolean.' }, { status: 400 });
      }
      const reason =
        typeof body.deactivation_reason === 'string'
          ? body.deactivation_reason.trim().slice(0, 500) || null
          : null;
      if (!body.is_active && !reason) {
        return NextResponse.json(
          { error: 'A deactivation reason is required.' },
          { status: 400 }
        );
      }
      const tenant = await tenantService.setActive(
        tenantId,
        body.is_active,
        reason,
        supabaseAdmin
      );
      return NextResponse.json({ tenant });
    }

    if (body.action === 'extend_trial') {
      if (existing.platform_plan !== 'trial') {
        return NextResponse.json({ error: 'Only trial tenants can be extended.' }, { status: 400 });
      }
      const days = typeof body.days === 'number' ? body.days : 0;
      if (!Number.isInteger(days) || days < 1 || days > 90) {
        return NextResponse.json({ error: 'days must be an integer between 1 and 90.' }, { status: 400 });
      }
      const tenant = await tenantService.extendTrial(tenantId, days, supabaseAdmin);
      return NextResponse.json({ tenant });
    }

    if (body.action === 'update_details') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
      if (!name || !slug || !SLUG_RE.test(slug)) {
        return NextResponse.json({ error: 'A name and valid slug are required.' }, { status: 400 });
      }
      const sameSlug = slug === existing.slug;
      if (!sameSlug) {
        const duplicate = await tenantService.getTenantBySlug(slug, supabaseAdmin);
        if (duplicate) {
          return NextResponse.json({ error: `Tenant slug "${slug}" already exists.` }, { status: 409 });
        }
      }
      const tenant = await tenantService.updateTenant(tenantId, { name, slug }, supabaseAdmin);
      return NextResponse.json({ tenant });
    }

    if (body.action === 'set_ai_quota') {
      const raw = body.ai_monthly_question_limit;
      if (raw !== null && raw !== undefined && raw !== '') {
        const limit = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isInteger(limit) || limit < 0 || limit > 10000) {
          return NextResponse.json(
            { error: 'ai_monthly_question_limit must be an integer between 0 and 10000, or empty for the plan default.' },
            { status: 400 }
          );
        }
        const tenant = await tenantService.updateAiMonthlyQuestionLimit(
          tenantId,
          limit,
          supabaseAdmin
        );
        return NextResponse.json({ tenant });
      }
      const tenant = await tenantService.updateAiMonthlyQuestionLimit(
        tenantId,
        null,
        supabaseAdmin
      );
      return NextResponse.json({ tenant });
    }

    if (isPlatformPlanId(body.platform_plan)) {
      const tenant = await tenantService.updatePlatformPlan(
        tenantId,
        body.platform_plan,
        supabaseAdmin
      );
      return NextResponse.json({ tenant });
    }

    return NextResponse.json({ error: 'Invalid tenant update.' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const { id: tenantId } = await context.params;
    if (!UUID_RE.test(tenantId)) {
      return NextResponse.json({ error: 'Invalid tenant id.' }, { status: 400 });
    }

    const tenant = await tenantService.getTenantById(tenantId, supabaseAdmin);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }

    const body = await request.json() as { confirm_name?: unknown };
    if (body.confirm_name !== tenant.name) {
      return NextResponse.json({ error: 'Tenant name confirmation does not match.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { parsePlatformPlanId } from '@/lib/platform-plans';
import { requirePlatformAdminApi } from '@/lib/require-platform-admin-api';
import { hqStatsService } from '@/lib/services/hqStatsService';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { HQ_IMPORT_JOB_TTL_MS, parseCsv, sha256Utf8 } from '@/lib/hq-import/csv';
import { commitMemberRows, commitPlanRows } from '@/lib/hq-import/commit';
import { hqImportTemplate, isHqImportKind, type HqImportKind } from '@/lib/hq-import/templates';
import {
  validateMembersCsv,
  validatePlansCsv,
  type ExistingAuthUser,
  type ExistingPlan,
} from '@/lib/hq-import/validate';
import type { HqImportSummary } from '@/lib/hq-import/types';

export const maxDuration = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

type ImportJobRow = {
  id: string;
  tenant_id: string;
  kind: HqImportKind;
  status: string;
  file_hash: string;
  created_at: string;
};

async function loadTenantContext(tenantId: string) {
  const tenant = await tenantService.getTenantById(tenantId, supabaseAdmin);
  if (!tenant) return null;

  const { tenants } = await hqStatsService.getOverview(supabaseAdmin);
  const withStats = tenants.find((row) => row.id === tenantId);
  const { data: plans, error } = await supabaseAdmin
    .from('membership_plans')
    .select('id, name, is_active')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });
  if (error) throw error;

  return {
    tenant,
    stats: withStats?.stats,
    platformPlan: parsePlatformPlanId(tenant.platform_plan),
    plans: (plans ?? []) as ExistingPlan[],
  };
}

async function lookupEmails(emails: string[]): Promise<ExistingAuthUser[]> {
  if (emails.length === 0) return [];
  const unique = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  const { data, error } = await supabaseAdmin.rpc('hq_lookup_auth_users_by_email', {
    p_emails: unique,
  });
  if (error) throw error;
  return (data ?? []) as ExistingAuthUser[];
}

async function runValidation(
  tenantId: string,
  kind: HqImportKind,
  csv: string
): Promise<
  | { kind: 'plans'; summary: HqImportSummary; creates: ReturnType<typeof validatePlansCsv>['creates'] }
  | { kind: 'members'; summary: HqImportSummary; creates: ReturnType<typeof validateMembersCsv>['creates'] }
> {
  const context = await loadTenantContext(tenantId);
  if (!context) {
    throw new Error('Tenant not found.');
  }

  if (kind === 'plans') {
    const result = validatePlansCsv(csv, context.plans);
    return { kind, summary: result.summary, creates: result.creates };
  }

  const emails = parseCsv(csv)
    .rows.map((row) => (row.values.email ?? '').trim().toLowerCase())
    .filter(Boolean);
  const existingUsers = await lookupEmails(emails);
  const result = validateMembersCsv(csv, {
    tenantId,
    existingPlans: context.plans,
    existingUsers,
    platformPlan: context.platformPlan,
    memberCount: context.stats?.memberCount ?? 0,
    activeMemberCount: context.stats?.activeMemberCount ?? 0,
  });
  return { kind, summary: result.summary, creates: result.creates };
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const { id: tenantId } = await context.params;
    if (!UUID_RE.test(tenantId)) {
      return NextResponse.json({ error: 'Invalid tenant id.' }, { status: 400 });
    }

    const url = new URL(request.url);
    const templateKind = url.searchParams.get('template');
    if (templateKind) {
      if (!isHqImportKind(templateKind)) {
        return NextResponse.json({ error: 'Invalid template.' }, { status: 400 });
      }
      const { filename, csv } = hqImportTemplate(templateKind);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const loaded = await loadTenantContext(tenantId);
    if (!loaded) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }

    const { data: jobs, error } = await supabaseAdmin
      .from('hq_import_jobs')
      .select(
        'id, kind, status, file_name, row_count, create_count, skip_count, error_count, created_at, committed_at'
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(8);
    if (error) throw error;

    return NextResponse.json({
      plans: loaded.plans,
      jobs: jobs ?? [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
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

    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action;
    const kind = body.kind;
    const csv = typeof body.csv === 'string' ? body.csv : '';
    const fileName = typeof body.file_name === 'string' ? body.file_name.slice(0, 200) : null;

    if (!isHqImportKind(kind)) {
      return NextResponse.json({ error: 'Invalid import kind.' }, { status: 400 });
    }
    if (!csv.trim()) {
      return NextResponse.json({ error: 'CSV is required.' }, { status: 400 });
    }

    const fileHash = sha256Utf8(csv);
    const validated = await runValidation(tenantId, kind, csv);

    if (action === 'validate') {
      const { data: job, error } = await supabaseAdmin
        .from('hq_import_jobs')
        .insert({
          tenant_id: tenantId,
          kind,
          status: 'validated',
          file_hash: fileHash,
          file_name: fileName,
          actor_user_id: auth.user.id,
          row_count: validated.summary.rowCount,
          create_count: validated.summary.createCount,
          skip_count: validated.summary.skipCount,
          error_count: validated.summary.errorCount,
          result: {
            blockingErrors: validated.summary.blockingErrors,
            issues: validated.summary.issues.slice(0, 100),
          },
        })
        .select('id, created_at')
        .single();
      if (error) throw error;

      return NextResponse.json({
        jobId: job.id,
        fileHash,
        summary: validated.summary,
      });
    }

    if (action === 'commit') {
      const jobId = typeof body.job_id === 'string' ? body.job_id : '';
      const sendInvites = body.send_invites === true;
      if (!UUID_RE.test(jobId)) {
        return NextResponse.json({ error: 'Invalid job id.' }, { status: 400 });
      }

      const { data: job, error: jobError } = await supabaseAdmin
        .from('hq_import_jobs')
        .select('id, tenant_id, kind, status, file_hash, created_at')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (jobError) throw jobError;
      if (!job) {
        return NextResponse.json({ error: 'Validation expired. Validate again.' }, { status: 400 });
      }

      const typedJob = job as ImportJobRow;
      if (typedJob.status !== 'validated') {
        return NextResponse.json({ error: 'Validation expired. Validate again.' }, { status: 400 });
      }
      if (typedJob.kind !== kind || typedJob.file_hash !== fileHash) {
        return NextResponse.json(
          { error: 'File does not match the last validation.' },
          { status: 400 }
        );
      }
      if (Date.now() - new Date(typedJob.created_at).getTime() > HQ_IMPORT_JOB_TTL_MS) {
        return NextResponse.json({ error: 'Validation expired. Validate again.' }, { status: 400 });
      }
      if (!validated.summary.canCommit) {
        return NextResponse.json(
          { error: 'Fix validation errors before importing.', summary: validated.summary },
          { status: 400 }
        );
      }

      let createdIds: string[] = [];
      let failed: Array<{ line: number; message: string }> = [];
      let inviteWarnings = 0;

      if (validated.kind === 'plans') {
        const result = await commitPlanRows(tenantId, validated.creates);
        createdIds = result.ids;
        failed = result.failed;
      } else {
        const result = await commitMemberRows(request, tenantId, validated.creates, sendInvites);
        createdIds = result.ids;
        failed = result.failed;
        inviteWarnings = result.inviteWarnings;
      }

      const status = failed.length && createdIds.length === 0 ? 'failed' : 'committed';
      await supabaseAdmin
        .from('hq_import_jobs')
        .update({
          status,
          send_invites: sendInvites,
          create_count: createdIds.length,
          committed_at: new Date().toISOString(),
          created_ids: createdIds,
          error_message: failed.length
            ? failed.map((row) => `L${row.line}: ${row.message}`).join('; ')
            : null,
          result: { failed, inviteWarnings },
        })
        .eq('id', jobId)
        .eq('tenant_id', tenantId);

      if (status === 'failed') {
        return NextResponse.json({ error: 'Could not import rows.', failed }, { status: 500 });
      }

      return NextResponse.json({
        created: createdIds.length,
        failed,
        inviteWarnings,
        summary: validated.summary,
      });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

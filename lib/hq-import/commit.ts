import { getMemberInviteRedirectUrl } from '@/lib/auth';
import { sendMemberInviteEmail } from '@/lib/email/memberInviteEmail';
import { membershipPlanService } from '@/lib/services/membershipPlanService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { ValidatedMemberRow, ValidatedPlanRow } from './types';

export async function commitPlanRows(
  tenantId: string,
  rows: ValidatedPlanRow[]
): Promise<{ ids: string[]; failed: Array<{ line: number; message: string }> }> {
  const ids: string[] = [];
  const failed: Array<{ line: number; message: string }> = [];

  for (const row of rows) {
    try {
      const plan = await membershipPlanService.createMembershipPlan(supabaseAdmin, tenantId, {
        name: row.name,
        price_usd: row.price_usd,
        description: row.description,
        is_active: row.is_active,
        weekly_limit: row.weekly_limit,
        limit_type: row.limit_type,
        session_limit: row.session_limit,
        validity_days: row.validity_days,
      });
      ids.push(plan.id);
    } catch (error) {
      failed.push({
        line: row.line,
        message: error instanceof Error ? error.message : 'Could not import row.',
      });
    }
  }

  return { ids, failed };
}

export async function commitMemberRows(
  request: Request,
  tenantId: string,
  rows: ValidatedMemberRow[],
  sendInvites: boolean
): Promise<{
  ids: string[];
  failed: Array<{ line: number; message: string }>;
  inviteWarnings: number;
}> {
  const ids: string[] = [];
  const failed: Array<{ line: number; message: string }> = [];
  let inviteWarnings = 0;

  for (const row of rows) {
    let userId: string | null = null;
    try {
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: 'invite',
          email: row.email,
          options: {
            redirectTo: getMemberInviteRedirectUrl(request),
            data: {
              full_name: row.full_name,
              tenant_id: tenantId,
              language: row.language,
            },
          },
        });

      if (linkError) throw linkError;
      if (!linkData.user) throw new Error('Failed to create user object');
      userId = linkData.user.id;

      const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { app_metadata: { tenant_id: tenantId } }
      );
      if (metadataError) throw metadataError;

      const profileUpdate: Record<string, unknown> = {
        full_name: row.full_name,
        role: row.role,
        is_solvent: row.is_solvent,
        tenant_id: tenantId,
        plan: row.plan_id,
        inscription_plan: row.inscription_plan,
        inscription_cost: 0,
        inscription_paid: false,
      };
      if (row.phone) profileUpdate.phone = row.phone;
      if (row.plan_period_start) profileUpdate.plan_period_start = row.plan_period_start;

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId)
        .select('id, tenant_id, role')
        .single();

      if (profileError) throw profileError;
      if (profile.tenant_id !== tenantId || profile.role !== row.role) {
        throw new Error('Profile tenant_id was not set correctly.');
      }

      ids.push(userId);

      if (sendInvites && linkData.properties?.action_link) {
        try {
          await sendMemberInviteEmail({
            to: row.email,
            fullName: row.full_name,
            inviteLink: linkData.properties.action_link,
            language: row.language,
          });
        } catch (emailError) {
          console.error('HQ import invite email failed:', emailError);
          inviteWarnings += 1;
        }
      }
    } catch (error) {
      if (userId) {
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
      }
      failed.push({
        line: row.line,
        message: error instanceof Error ? error.message : 'Could not import row.',
      });
    }
  }

  return { ids, failed, inviteWarnings };
}

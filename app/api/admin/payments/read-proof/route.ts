import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import {
  PAYMENT_PROOF_EXTRACT_SYSTEM,
  buildPaymentProofUserPrompt,
  compareClaimedAmount,
  parsePaymentProofExtraction,
} from '@/lib/ai/payment-proof-extract';
import { getMemberPeriodBalance } from '@/lib/plan-period';
import { requireStaffApi } from '@/lib/require-staff-api';
import { getPaymentProofPath } from '@/lib/services/financialService';
import { tenantAiService } from '@/lib/services/tenantAiService';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';

const PROOF_MODEL = process.env.AI_PROOF_MODEL || process.env.AI_ASK_MODEL || 'google/gemini-2.5-flash';
const PAYMENT_PROOFS_BUCKET = 'payment-proofs';
const SIGNED_URL_TTL_SECONDS = 60 * 10;

type PaymentRow = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  method: string | null;
  proof_image_url: string | null;
  tenant_id: string | null;
  status: string | null;
};

function mediaTypeFromPath(path: string, fallback: string | undefined): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (fallback?.startsWith('image/')) return fallback;
  return 'image/jpeg';
}

export async function POST(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  const tenantId = staffAuth.profile.tenant_id as string | null;
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const paymentId = typeof body.paymentId === 'string' ? body.paymentId.trim() : '';
    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId is required.' }, { status: 400 });
    }

    const tenant = await tenantService.getTenantById(tenantId, supabaseAdmin);
    if (!tenant) {
      return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
    }

    const { data: payment, error: paymentError } = await staffAuth.supabase
      .from('payments')
      .select('id, user_id, amount, currency, method, proof_image_url, tenant_id, status')
      .eq('id', paymentId)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    }

    const row = payment as PaymentRow;
    if (row.tenant_id && row.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    }

    if (!row.proof_image_url) {
      return NextResponse.json({ error: 'No payment proof attached.' }, { status: 400 });
    }

    const path = getPaymentProofPath(row.proof_image_url);
    if (!path) {
      return NextResponse.json({ error: 'Invalid payment proof path.' }, { status: 400 });
    }

    const { data: profile } = await staffAuth.supabase
      .from('profiles')
      .select('plan, plan_period_start, tenant_id')
      .eq('id', row.user_id)
      .maybeSingle();

    if (!row.tenant_id && profile?.tenant_id && profile.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    }

    let periodRemaining: number | null = null;
    if (profile?.plan) {
      const { data: plan } = await staffAuth.supabase
        .from('membership_plans')
        .select('price_usd')
        .eq('id', profile.plan)
        .maybeSingle();
      const planPriceRef = Number(plan?.price_usd) || 0;
      const balance = await getMemberPeriodBalance(
        staffAuth.supabase,
        row.user_id,
        planPriceRef,
        profile.plan_period_start ?? null
      );
      periodRemaining = balance.remaining;
    }

    const { data: signed, error: signedError } = await staffAuth.supabase.storage
      .from(PAYMENT_PROOFS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signedError) {
      console.error('Failed to sign payment proof:', signedError);
    }
    const proofUrl = signed?.signedUrl || '';
    const claimedAmount = Number(row.amount) || 0;
    const claimedCurrency = (row.currency || '').toUpperCase();

    const quota = await tenantAiService.getQuota(tenantId, supabaseAdmin, tenant);
    if (quota.disabled) {
      return NextResponse.json(
        {
          error: 'Ask AI is disabled for this box.',
          unavailable: true,
          proofUrl,
          comparison: {
            claimedAmount,
            claimedCurrency,
            amountMatch: 'unknown' as const,
            periodRemaining,
          },
          quota,
        },
        { status: 403 }
      );
    }

    const consumed = await tenantAiService.consumeQuestion(tenantId, quota.limit, supabaseAdmin);
    if (!consumed.allowed) {
      const nextQuota = await tenantAiService.getQuota(tenantId, supabaseAdmin, tenant);
      return NextResponse.json(
        {
          error: 'Ask AI monthly limit reached.',
          unavailable: true,
          proofUrl,
          comparison: {
            claimedAmount,
            claimedCurrency,
            amountMatch: 'unknown' as const,
            periodRemaining,
          },
          quota: nextQuota,
        },
        { status: 429 }
      );
    }

    try {
      const { data: file, error: downloadError } = await staffAuth.supabase.storage
        .from(PAYMENT_PROOFS_BUCKET)
        .download(path);

      if (downloadError || !file) {
        await tenantAiService.releaseQuestion(tenantId, supabaseAdmin);
        return NextResponse.json(
          { error: 'Could not load payment proof image.', unavailable: true, proofUrl },
          { status: 502 }
        );
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const mediaType = mediaTypeFromPath(path, file.type);

      const result = await generateText({
        model: PROOF_MODEL,
        system: PAYMENT_PROOF_EXTRACT_SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: buildPaymentProofUserPrompt({
                  claimedAmount,
                  claimedCurrency,
                  method: row.method,
                }),
              },
              {
                type: 'image',
                image: bytes,
                mediaType,
              },
            ],
          },
        ],
        providerOptions: {
          gateway: {
            user: tenantId,
            tags: ['feature:payment-proof-read', `tenant:${tenant.slug}`],
          },
        },
      });

      const usage = result.totalUsage;
      if (usage) {
        await tenantAiService.addTokenUsage(
          tenantId,
          {
            prompt: Number(usage.inputTokens ?? 0),
            completion: Number(usage.outputTokens ?? 0),
          },
          supabaseAdmin
        );
      }

      const extraction = parsePaymentProofExtraction(result.text);
      const nextQuota = await tenantAiService.getQuota(tenantId, supabaseAdmin, tenant);

      return NextResponse.json({
        extraction,
        comparison: {
          claimedAmount,
          claimedCurrency,
          amountMatch: compareClaimedAmount(extraction.amount, claimedAmount),
          periodRemaining,
        },
        proofUrl,
        quota: nextQuota,
      });
    } catch (error: unknown) {
      await tenantAiService.releaseQuestion(tenantId, supabaseAdmin);
      const message = error instanceof Error ? error.message : '';
      if (/api key|oidc|unauthorized|401/i.test(message)) {
        return NextResponse.json(
          {
            error: 'Proof reader is unavailable.',
            unavailable: true,
            proofUrl,
            comparison: {
              claimedAmount,
              claimedCurrency,
              amountMatch: 'unknown' as const,
              periodRemaining,
            },
            quota,
          },
          { status: 503 }
        );
      }
      throw error;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

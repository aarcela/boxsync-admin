import { NextResponse } from 'next/server';
import {
  parseTenantCurrencyConfig,
  parseTenantExchangeRateConfig,
} from '@/lib/currency';
import { publicCorsHeaders } from '@/lib/public-cors';
import { financialService } from '@/lib/services/financialService';
import { membershipPlanService } from '@/lib/services/membershipPlanService';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function json(body: unknown, status: number, request: Request) {
  return NextResponse.json(body, {
    status,
    headers: publicCorsHeaders(request.headers.get('origin')),
  });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: publicCorsHeaders(request.headers.get('origin')),
  });
}

/**
 * Public active membership plans for athlete self-registration.
 * GET /api/auth/tenant-plans?slug={slug}
 *
 * 200: {
 *   plans: [{ id, name, price_usd, description, limit_type, weekly_limit, session_limit, validity_days }],
 *   currencies: { reference, local },
 *   exchange_rate: number | null  // local units per 1 reference
 * }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('slug') ?? '';
    const slug = raw.trim().toLowerCase();

    if (!slug || !SLUG_RE.test(slug) || slug.length < 2 || slug.length > 64) {
      return json({ error: 'invalid_slug' }, 400, request);
    }

    const tenant = await tenantService.getTenantBySlug(slug, supabaseAdmin);
    if (!tenant || tenant.is_active === false) {
      return json({ error: 'not_found' }, 404, request);
    }

    const plans = await membershipPlanService.getActiveMembershipPlans(
      tenant.id,
      supabaseAdmin
    );

    const currencies = parseTenantCurrencyConfig(tenant.settings);
    const rateConfig = parseTenantExchangeRateConfig(tenant.settings);

    let exchangeRate: number | null = null;
    try {
      if (rateConfig.baseSource === 'custom') {
        exchangeRate =
          rateConfig.customRate && rateConfig.customRate > 0
            ? rateConfig.customRate
            : null;
      } else {
        const base = await financialService.getReferenceExchangeRate(
          currencies.reference,
          rateConfig.baseSource
        );
        if (base > 0) {
          exchangeRate = base * (1 + (rateConfig.marginPercent ?? 0) / 100);
        }
      }
    } catch (err) {
      console.error('tenant-plans exchange rate error:', err);
      exchangeRate = null;
    }

    return json(
      {
        plans: plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          price_usd: plan.price_usd,
          description: plan.description,
          limit_type: plan.limit_type,
          weekly_limit: plan.weekly_limit,
          session_limit: plan.session_limit,
          validity_days: plan.validity_days,
        })),
        currencies,
        exchange_rate: exchangeRate,
      },
      200,
      request
    );
  } catch (error) {
    console.error('tenant-plans error:', error);
    return json({ error: 'unavailable' }, 500, request);
  }
}

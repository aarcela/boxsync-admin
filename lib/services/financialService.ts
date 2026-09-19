import { supabase } from '../supabase';
import { buildPaymentApprovedProfileUpdate, getMemberPeriodBalance } from '../plan-period';
import { PaymentMethod, PaymentRecord } from '@/lib/types/gym';
import {
  CurrencyType,
  ExchangeRateSource,
  exchangeRateEndpoint,
  parseTenantExchangeRateConfig,
} from '@/lib/currency';

const PAYMENT_PROOFS_BUCKET = 'payment-proofs';
const SIGNED_URL_TTL_SECONDS = 60 * 10;

function getPaymentProofPath(value: string): string {
  if (!value.startsWith('http')) return value.replace(/^payment-proofs\//, '');

  const decoded = decodeURIComponent(value);
  const marker = '/payment-proofs/';
  const markerIndex = decoded.indexOf(marker);
  return markerIndex >= 0 ? decoded.slice(markerIndex + marker.length).split('?')[0] : '';
}

export async function signPaymentProofUrl(storedPathOrUrl: string): Promise<string> {
  const path = getPaymentProofPath(storedPathOrUrl);
  if (!path) return '';

  const { data, error } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error('Failed to sign payment proof:', error);
    return '';
  }
  return data.signedUrl;
}

export const financialService = {
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const { data, error } = await supabase.from('payment_methods').select('*');
    if (error) throw error;
    return data || [];
  },

  async getPayments(startDate: string, endDate: string): Promise<PaymentRecord[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*, profiles ( full_name )')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Promise.all((data || []).map(async payment => ({
      ...payment,
      proof_image_url: payment.proof_image_url
        ? await signPaymentProofUrl(payment.proof_image_url)
        : '',
    }))) as Promise<PaymentRecord[]>;
  },

  async getMemberStats(): Promise<{ active: number; inactive: number; projectedREF: number; overdueREF: number }> {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('is_solvent, membership_plans!fk_profiles_membership_plans(price_usd)')
      .eq('role', 'member');

    if (error) throw error;

    let active = 0;
    let inactive = 0;
    let projectedREF = 0;
    let overdueREF = 0;

    profiles?.forEach(p => {
      const plan = Array.isArray(p.membership_plans) ? p.membership_plans[0] : p.membership_plans;
      const price = Number(plan?.price_usd) || 0;
      projectedREF += price;
      if (p.is_solvent) {
        active++;
      } else {
        inactive++;
        overdueREF += price;
      }
    });

    return { active, inactive, projectedREF, overdueREF };
  },

  /** Returns the member's outstanding balance for their currently open plan period. */
  async getMemberPeriodBalance(userId: string) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, plan_period_start')
      .eq('id', userId)
      .single();
    if (profileError) throw profileError;

    if (!profile?.plan) return { due: 0, paid: 0, remaining: 0 };

    const { data: plan, error: planError } = await supabase
      .from('membership_plans')
      .select('price_usd')
      .eq('id', profile.plan)
      .maybeSingle();
    if (planError) throw planError;

    const planPriceRef = Number(plan?.price_usd) || 0;
    return getMemberPeriodBalance(supabase, userId, planPriceRef, profile.plan_period_start ?? null);
  },

  async notifyPaymentStatus(userId: string, status: 'approved' | 'rejected', reason?: string | null) {
    try {
      await fetch('/api/admin/notifications/payment-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status, reason }),
      });
    } catch (error) {
      // Push delivery is best-effort — never let it fail the approve/reject flow.
      console.error('Failed to send payment status push notification:', error);
    }
  },

  async approvePayment(paymentId: string, userId: string): Promise<{ activated: boolean }> {
    const { error: payError } = await supabase
      .from('payments')
      .update({ status: 'approved' })
      .eq('id', paymentId);

    if (payError) throw payError;

    const profileUpdate = await buildPaymentApprovedProfileUpdate(supabase, userId);

    // null means the period's due amount hasn't been fully covered yet by the
    // sum of approved payments — leave solvency/period untouched (partial payment).
    if (profileUpdate) {
      const { error: profError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId);

      if (profError) throw profError;
    }

    await this.notifyPaymentStatus(userId, 'approved');
    return { activated: Boolean(profileUpdate) };
  },

  async rejectPayment(paymentId: string, userId?: string, reason?: string): Promise<void> {
    const { error } = await supabase
      .from('payments')
      .update({ status: 'rejected', rejection_reason: reason ?? null })
      .eq('id', paymentId);

    if (error) throw error;

    if (userId) await this.notifyPaymentStatus(userId, 'rejected', reason);
  },

  async getDueExpiryCount(): Promise<number> {
    const response = await fetch('/api/admin/memberships/expire');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load expiry count');
    }
    return Number(data.count) || 0;
  },

  async runExpiryCheck(): Promise<{ message: string; count: number }> {
    const response = await fetch('/api/admin/memberships/expire', { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Expiry sync error.');
    }
    return {
      message: typeof data.message === 'string' ? data.message : '',
      count: Number(data.count) || 0,
    };
  },

  async getReferenceExchangeRate(
    referenceCurrency: CurrencyType | 'EUR' | 'USD' | 'VES' = CurrencyType.USD,
    source: ExchangeRateSource = 'bcv'
  ): Promise<number> {
    try {
      const path = exchangeRateEndpoint(referenceCurrency as CurrencyType, source);
      const response = await fetch(path);
      const data = await response.json();
      return Number(data.promedio);
    } catch (error) {
      console.error('Failed to fetch reference rate:', error);
      return 0;
    }
  },

  /** Applies the tenant's configured base source (BCV/paralelo) + margin % on top of the fetched rate. */
  async getEffectiveExchangeRate(tenantId: string, referenceCurrency: CurrencyType | 'EUR' | 'USD' | 'VES'): Promise<number> {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();
    if (error) throw error;

    const config = parseTenantExchangeRateConfig(tenant?.settings);
    const baseRate = await this.getReferenceExchangeRate(referenceCurrency, config.baseSource);
    return baseRate * (1 + config.marginPercent / 100);
  },

  async getLastPaymentDates(userIds: string[]): Promise<Record<string, string>> {
    const { data, error } = await supabase
      .from('payments')
      .select('user_id, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const lastPayments: Record<string, string> = {};
    data?.forEach(p => {
      if (!lastPayments[p.user_id]) {
        lastPayments[p.user_id] = p.created_at;
      }
    });
    return lastPayments;
  }
};

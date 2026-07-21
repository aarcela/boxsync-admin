import { supabase } from '../supabase';
import { buildPaymentApprovedProfileUpdate } from '../plan-period';
import { PaymentMethod, PaymentRecord } from '@/lib/types/gym';

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

  async getMemberStats(): Promise<{ active: number; inactive: number; projectedEUR: number; overdueEUR: number }> {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('is_solvent, membership_plans!fk_profiles_membership_plans(price_usd)')
      .eq('role', 'member');

    if (error) throw error;

    let active = 0;
    let inactive = 0;
    let projectedEUR = 0;
    let overdueEUR = 0;

    profiles?.forEach(p => {
      const plan = Array.isArray(p.membership_plans) ? p.membership_plans[0] : p.membership_plans;
      const price = Number(plan?.price_usd) || 0;
      projectedEUR += price;
      if (p.is_solvent) {
        active++;
      } else {
        inactive++;
        overdueEUR += price;
      }
    });

    return { active, inactive, projectedEUR, overdueEUR };
  },

  async approvePayment(paymentId: string, userId: string): Promise<void> {
    const { error: payError } = await supabase
      .from('payments')
      .update({ status: 'approved' })
      .eq('id', paymentId);
    
    if (payError) throw payError;

    const profileUpdate = await buildPaymentApprovedProfileUpdate(supabase, userId);

    const { error: profError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId);

    if (profError) throw profError;
  },

  async rejectPayment(paymentId: string): Promise<void> {
    const { error } = await supabase
      .from('payments')
      .update({ status: 'rejected' })
      .eq('id', paymentId);
    
    if (error) throw error;
  },

  async runExpiryCheck(): Promise<{ message: string }> {
    const response = await fetch('/api/admin/cron/expire', { method: 'POST' });
    return response.json();
  },

  async getOfficialExchangeRate(referenceCurrency: 'EUR' | 'USD' | 'VES' = 'EUR'): Promise<number> {
    try {
      const path =
        referenceCurrency === 'USD'
          ? 'https://ve.dolarapi.com/v1/dolares/oficial'
          : 'https://ve.dolarapi.com/v1/euros/oficial';
      const response = await fetch(path);
      const data = await response.json();
      return Number(data.promedio);
    } catch (error) {
      console.error('Failed to fetch official rate:', error);
      return 0;
    }
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

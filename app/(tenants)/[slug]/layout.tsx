import { notFound } from 'next/navigation';
import { TenantProvider } from '@/components/TenantContext';
import { parseTenantCurrencyConfig } from '@/lib/currency';
import { tenantService } from '@/lib/services/tenantService';
import { parseTenantFeatures } from '@/lib/tenant-features';
import { supabaseAdmin } from '@/lib/supabase-admin';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await tenantService.getTenantBySlug(slug, supabaseAdmin);
  if (!tenant) {
    notFound();
  }

  return (
    <TenantProvider
      value={{
        tenantId: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        platformPlan: tenant.platform_plan,
        trialEndsAt: tenant.trial_ends_at ?? null,
        currencies: parseTenantCurrencyConfig(tenant.settings),
        features: parseTenantFeatures(tenant.settings),
      }}
    >
      {children}
    </TenantProvider>
  );
}

import { notFound } from 'next/navigation';import { TenantProvider } from '@/components/TenantContext';
import { tenantService } from '@/lib/services/tenantService';
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
      value={{ tenantId: tenant.id, slug: tenant.slug, name: tenant.name }}
    >
      {children}
    </TenantProvider>
  );
}

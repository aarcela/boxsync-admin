import Link from 'next/link';
import { notFound } from 'next/navigation';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';

export default async function TenantWodsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await tenantService.getTenantBySlug(slug, supabaseAdmin);

  if (!tenant) {
    notFound();
  }
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-gray-500 hover:text-pits-primary">
          ← {tenant.name}
        </Link>
        <h1 className="mt-4 text-2xl font-black text-gray-900 uppercase">
          Workout of the Day
        </h1>
        <p className="mt-4 text-gray-600">
          Public WOD feed for {tenant.name} — content coming soon.
        </p>
      </div>
    </main>
  );
}

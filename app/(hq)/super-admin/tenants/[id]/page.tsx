'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Loader2, Plus } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import { buildTenantDashboardUrl } from '@/lib/tenant-host';
import type { Tenant } from '@/lib/types/gym';

type TenantAdmin = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string | null;
};

export default function SuperAdminTenantDetailPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const params = useParams();
  const tenantId = typeof params.id === 'string' ? params.id : '';

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [admins, setAdmins] = useState<TenantAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loadAdmins = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/hq/tenants/${tenantId}/admins`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'load_failed');
      setTenant(data.tenant ?? null);
      setAdmins(data.admins ?? []);
    } catch {
      toast(t('Could not load admins.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, t, toast]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/hq/tenants/${tenantId}/admins`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'create_failed');
      toast(t('Admin created.'), 'success');
      setFullName('');
      setEmail('');
      setPassword('');
      await loadAdmins();
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message && !err.message.includes('create_failed')
          ? err.message
          : t('Could not create admin.');
      toast(message, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/super-admin"
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-pits-ink-muted hover:text-pits-primary mb-3"
          >
            <ArrowLeft size={14} />
            {t('Back to tenants')}
          </Link>
          <h1 className="text-2xl font-black text-pits-ink uppercase italic tracking-tighter">
            {tenant?.name ?? '…'}
          </h1>
          {tenant && (
            <p className="text-sm text-pits-ink-muted font-mono mt-1">{tenant.slug}</p>
          )}
        </div>
        {tenant && (
          <a
            href={buildTenantDashboardUrl(tenant.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pits-ink-muted hover:text-pits-primary"
          >
            <ExternalLink size={14} />
            {t('Open dashboard')}
          </a>
        )}
      </div>

      <form
        onSubmit={handleCreate}
        className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-6 space-y-4"
      >
        <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink-muted">
          {t('Create admin')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Full name')}
            </label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={creating}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Email')}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={creating}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Password')}
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={creating}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={creating || !tenantId}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-pits-primary text-pits-dark-text font-bold uppercase tracking-widest text-sm disabled:opacity-60"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {creating ? t('Creating...') : t('Create admin')}
        </button>
      </form>

      <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-pits-edge">
          <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink-muted">
            {t('Admins')}
          </h2>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="animate-spin text-pits-ink-muted" />
          </div>
        ) : admins.length === 0 ? (
          <p className="p-8 text-center text-sm text-pits-ink-muted">{t('No admins yet.')}</p>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-pits-surface-muted text-xs font-bold uppercase tracking-wider text-pits-ink-muted">
              <tr>
                <th className="px-4 py-3">{t('Full name')}</th>
                <th className="px-4 py-3">{t('Email')}</th>
                <th className="px-4 py-3">{t('Created')}</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-t border-pits-edge">
                  <td className="px-4 py-3 font-medium text-pits-ink">
                    {admin.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-pits-ink-muted">
                    {admin.email ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-pits-ink-muted">
                    {admin.created_at
                      ? new Date(admin.created_at).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import type { Tenant } from '@/lib/types/gym';

export default function SuperAdminTenantsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/hq/tenants', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'load_failed');
      setTenants(data.tenants ?? []);
    } catch {
      toast(t('Could not load tenants.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/admin/hq/tenants', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'create_failed');
      toast(t('Tenant created.'), 'success');
      setName('');
      setSlug('');
      await loadTenants();
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message && !err.message.includes('create_failed')
          ? err.message
          : t('Could not create tenant.');
      toast(message, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-pits-ink uppercase italic tracking-tighter">
          {t('Tenants')}
        </h1>
      </div>

      <form
        onSubmit={handleCreate}
        className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-6 space-y-4"
      >
        <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink-muted">
          {t('Create tenant')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Tenant name')}
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={creating}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Slug')}
            </label>
            <input
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              disabled={creating}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              title={t('lowercase-hyphen-slug')}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60"
              placeholder="madrid"
            />
            <p className="mt-1 text-[11px] text-pits-ink-muted">{t('lowercase-hyphen-slug')}</p>
          </div>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-pits-primary text-pits-dark-text font-bold uppercase tracking-widest text-sm disabled:opacity-60"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {creating ? t('Creating...') : t('Create tenant')}
        </button>
      </form>

      <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="animate-spin text-pits-ink-muted" />
          </div>
        ) : tenants.length === 0 ? (
          <p className="p-8 text-center text-sm text-pits-ink-muted">{t('No tenants yet.')}</p>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-pits-surface-muted text-xs font-bold uppercase tracking-wider text-pits-ink-muted">
              <tr>
                <th className="px-4 py-3">{t('Tenant name')}</th>
                <th className="px-4 py-3">{t('Slug')}</th>
                <th className="px-4 py-3">{t('Created')}</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="border-t border-pits-edge hover:bg-pits-surface-muted/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/super-admin/tenants/${tenant.id}`}
                      className="font-bold text-pits-ink hover:text-pits-primary"
                    >
                      {tenant.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-pits-ink-muted font-mono">{tenant.slug}</td>
                  <td className="px-4 py-3 text-sm text-pits-ink-muted">
                    {new Date(tenant.created_at).toLocaleDateString()}
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

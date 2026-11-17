'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, RefreshCw, Trash2, CalendarPlus, Eye, Sparkles } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import type { DemoInput, DemoMsg } from '@/lib/demo-factory/parse';
import type { DemoCreateResult } from '@/lib/demo-factory/build';

const EXAMPLE = `estudio: Pulse Studio
fuente: instagram.com/pulsestudio, historia fijada "Horarios" (visto 17-nov-2026)
paleta: girly
tz: America/Caracas
capacidad: 12
planes:
  Plan 8 clases | 40 | 8 clases / 30 dias
  Ilimitado | 60 | ilimitado
horario:
  Lun,Mie,Vie 06:00 Indoor Bike 50 cap=14 coach=Ana
  Lun,Mie,Vie 18:30 Pilates 55
  Mar,Jue 07:00 Funcional
  Sab 09:00 Indoor Bike 50`;

const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

type DemoRow = {
  id: string;
  slug: string;
  name: string;
  label: string | null;
  source: string | null;
  url: string;
  expiresAt: string;
  createdAt: string;
  isActive: boolean;
  classes: number;
  members: number;
};

type Preview = { parsed: DemoInput | null; errors: DemoMsg[]; warnings: DemoMsg[] };

const inputClass =
  'w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-mono text-sm focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60';

function formatDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-VE' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 bg-pits-surface-muted border border-pits-edge rounded-lg px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-pits-ink-muted">{label}</p>
        <p className="font-mono text-sm text-pits-ink truncate">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="shrink-0 p-2 rounded-md text-pits-ink-muted hover:text-pits-ink"
        aria-label={label}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  );
}

function Messages({ items, tone }: { items: DemoMsg[]; tone: 'error' | 'warning' }) {
  if (!items.length) return null;
  const cls =
    tone === 'error'
      ? 'bg-pits-danger-soft text-pits-danger border-pits-danger/30'
      : 'bg-pits-warning-soft text-pits-warning border-pits-warning/30';
  return (
    <ul className={`border rounded-lg p-3 space-y-1 text-sm ${cls}`}>
      {items.map((m, i) => (
        <li key={`${m.code}-${i}`}>
          {m.line ? <span className="font-mono font-bold mr-2">L{m.line}</span> : null}
          {m.text}
        </li>
      ))}
    </ul>
  );
}

export default function SuperAdminDemosPage() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [text, setText] = useState(EXAMPLE);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewedText, setPreviewedText] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<DemoCreateResult | null>(null);
  const [demos, setDemos] = useState<DemoRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<DemoRow | null>(null);

  const loadDemos = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/hq/demos', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'load failed');
      setDemos(data.demos ?? []);
    } catch {
      toast(t('Could not load demos'), 'error');
    } finally {
      setLoadingList(false);
    }
  }, [t, toast]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/admin/hq/demos', { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'load failed');
        if (!cancelled) setDemos(data.demos ?? []);
      })
      .catch(() => {
        if (!cancelled) toast(t('Could not load demos'), 'error');
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t, toast]);

  const canCreate =
    !!preview?.parsed && preview.errors.length === 0 && previewedText === text && !creating;

  const runPreview = async () => {
    setPreviewing(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/hq/demos', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'preview failed');
      setPreview(data as Preview);
      setPreviewedText(text);
    } catch {
      toast(t('Preview failed'), 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const createDemo = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/admin/hq/demos', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'create failed');
      setResult(data as DemoCreateResult);
      toast(t('Demo created'), 'success');
      void loadDemos();
    } catch (error) {
      toast(error instanceof Error ? error.message : t('Action failed'), 'error');
    } finally {
      setCreating(false);
    }
  };

  const patchDemo = async (demo: DemoRow, action: 'extend' | 'roll_week') => {
    setBusyId(demo.id);
    try {
      const res = await fetch(`/api/admin/hq/demos/${demo.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'failed');
      toast(action === 'extend' ? t('Demo extended') : t('Schedule regenerated'), 'success');
      void loadDemos();
    } catch (error) {
      toast(error instanceof Error ? error.message : t('Action failed'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const deleteDemo = async (demo: DemoRow) => {
    setToDelete(null);
    setBusyId(demo.id);
    try {
      const res = await fetch(`/api/admin/hq/demos/${demo.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'failed');
      toast(t('Demo deleted'), 'success');
      void loadDemos();
    } catch (error) {
      toast(error instanceof Error ? error.message : t('Action failed'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const scheduleRows = useMemo(() => {
    const parsed = preview?.parsed;
    if (!parsed) return [];
    const rows: { day: number; time: string; name: string; minutes: number; capacity: number; coach?: string }[] = [];
    for (const s of parsed.sessions) {
      for (const day of s.days) {
        rows.push({ day, time: s.time, name: s.className, minutes: s.minutes, capacity: s.capacity, coach: s.coach });
      }
    }
    return rows.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
  }, [preview]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-pits-ink uppercase italic tracking-tighter">{t('Demos')}</h1>
        <p className="text-sm text-pits-ink-muted">
          {t('Paste a studio block, preview it, then create a demo tenant for the outreach video.')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-6 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={creating}
            rows={18}
            spellCheck={false}
            className={inputClass}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runPreview}
              disabled={previewing || creating || !text.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-pits-edge bg-pits-surface-muted text-pits-ink text-xs font-black uppercase tracking-wider disabled:opacity-50"
            >
              {previewing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
              {t('Preview')}
            </button>
            <button
              type="button"
              onClick={createDemo}
              disabled={!canCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-pits-primary text-pits-dark-text text-xs font-black uppercase tracking-wider disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {creating ? t('Creating demo…') : t('Create demo')}
            </button>
          </div>
          {preview && previewedText !== text && (
            <p className="text-xs text-pits-ink-muted">{t('Text changed: preview again before creating.')}</p>
          )}
        </div>

        <div className="space-y-4">
          {result && (
            <div className="bg-pits-surface-elevated border border-pits-primary/50 rounded-2xl p-6 space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink-muted">{t('Demo ready')}</h2>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-pits-ink font-bold underline break-all"
              >
                {result.url} <ExternalLink size={14} />
              </a>
              <CopyField label={t('Admin email')} value={result.admin.email} />
              <CopyField label={t('Admin password')} value={result.admin.password} />
              <CopyField label={t('Member email (app)')} value={result.member.email} />
              <CopyField label={t('Member password (app)')} value={result.member.password} />
              <p className="text-xs font-bold text-pits-warning">
                {t('Do not show the passwords in the video. They are shown only once.')}
              </p>
              <p className="text-xs text-pits-ink-muted">
                {t('{{classes}} classes · {{members}} members · {{bookings}} bookings · expires {{date}}', {
                  classes: result.counts.classes,
                  members: result.counts.members,
                  bookings: result.counts.bookings,
                  date: formatDate(result.expiresAt, lang),
                })}
              </p>
              <Messages items={result.warnings} tone="warning" />
            </div>
          )}

          {preview && (
            <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink-muted">{t('Preview')}</h2>
              <Messages items={preview.errors} tone="error" />
              <Messages items={preview.warnings} tone="warning" />
              {preview.parsed && (
                <>
                  <div className="text-sm text-pits-ink space-y-1">
                    <p className="font-bold">{preview.parsed.name}</p>
                    <p className="text-pits-ink-muted">
                      {t('Palette')}: {preview.parsed.paletteId} · {preview.parsed.tz} · {t('Expires')}: {preview.parsed.expiresOn}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-widest text-pits-ink-muted">
                          <th className="py-1 pr-3">{t('Day')}</th>
                          <th className="py-1 pr-3">{t('Time')}</th>
                          <th className="py-1 pr-3">{t('Class')}</th>
                          <th className="py-1 pr-3">{t('Min')}</th>
                          <th className="py-1 pr-3">{t('Cap.')}</th>
                          <th className="py-1">{t('Coach')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleRows.map((row, i) => (
                          <tr key={i} className="border-t border-pits-edge text-pits-ink">
                            <td className="py-1 pr-3">{t(DAY_KEYS[row.day - 1])}</td>
                            <td className="py-1 pr-3 font-mono">{row.time}</td>
                            <td className="py-1 pr-3">{row.name}</td>
                            <td className="py-1 pr-3">{row.minutes}</td>
                            <td className="py-1 pr-3">{row.capacity}</td>
                            <td className="py-1">{row.coach ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="text-sm text-pits-ink space-y-1">
                    {preview.parsed.plans.map((plan, i) => (
                      <li key={i}>
                        <span className="font-bold">{plan.name}</span> · ${plan.priceUsd} ·{' '}
                        {plan.limitType === 'none'
                          ? t('Unlimited')
                          : plan.limitType === 'weekly'
                            ? t('{{n}} per week', { n: plan.weeklyLimit ?? 0 })
                            : t('{{n}} classes / {{d}} days', { n: plan.sessionLimit ?? 0, d: plan.validityDays ?? 0 })}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-pits-edge flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink-muted">{t('Active demos')}</h2>
          {loadingList && <Loader2 size={16} className="animate-spin text-pits-ink-muted" />}
        </div>
        {!loadingList && demos.length === 0 ? (
          <p className="px-6 py-8 text-sm text-pits-ink-muted">{t('No demos yet.')}</p>
        ) : (
          <ul className="divide-y divide-pits-edge">
            {demos.map((demo) => (
              <li key={demo.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="min-w-0">
                  <p className="font-bold text-pits-ink truncate">
                    {demo.name}
                    {!demo.isActive && (
                      <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-pits-danger">
                        {t('Expired')}
                      </span>
                    )}
                  </p>
                  <a
                    href={demo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-pits-ink-muted underline break-all"
                  >
                    {demo.url}
                  </a>
                  <p className="text-xs text-pits-ink-muted">
                    {t('Expires {{date}}', { date: formatDate(demo.expiresAt, lang) })} ·{' '}
                    {t('{{classes}} classes · {{members}} members', { classes: demo.classes, members: demo.members })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyId === demo.id}
                    onClick={() => patchDemo(demo, 'extend')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-pits-edge text-xs font-bold text-pits-ink disabled:opacity-50"
                  >
                    <CalendarPlus size={14} /> {t('Extend 7 days')}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === demo.id}
                    onClick={() => patchDemo(demo, 'roll_week')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-pits-edge text-xs font-bold text-pits-ink disabled:opacity-50"
                  >
                    <RefreshCw size={14} /> {t('Redo week')}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === demo.id}
                    onClick={() => setToDelete(demo)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-pits-danger/40 text-xs font-bold text-pits-danger disabled:opacity-50"
                  >
                    {busyId === demo.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    {t('Delete')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!toDelete}
        title={t('Delete demo?')}
        message={t('This permanently deletes {{name}}: classes, fake members, payments and receipts. It cannot be undone.', {
          name: toDelete?.name ?? '',
        })}
        confirmLabel={t('Delete')}
        variant="danger"
        onConfirm={() => toDelete && deleteDemo(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

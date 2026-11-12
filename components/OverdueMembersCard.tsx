'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import MemberContactActions from '@/components/MemberContactActions';
import { dashboardService, type DashboardProfile } from '@/lib/services/dashboardService';

const PREVIEW = 5;

/** Members past their renew date (same rules as Home's "Overdue today"), with contact actions. */
export default function OverdueMembersCard() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [members, setMembers] = useState<DashboardProfile[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    Promise.all([dashboardService.getOverdueMembers(tenantId), dashboardService.getTotalMembers()])
      .then(([overdue, all]) => {
        if (cancelled) return;
        const phoneById = new Map(all.map((m) => [m.id, m.phone ?? null]));
        setMembers(overdue.map((m) => ({ ...m, phone: phoneById.get(m.id) ?? null })));
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const rows = members ?? [];
  const shown = expanded ? rows : rows.slice(0, PREVIEW);

  return (
    <section className="rounded-2xl border border-pits-edge bg-pits-surface-elevated">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-pits-edge">
        <div>
          <h2 className="text-base font-bold text-pits-text">{t('Members who owe')}</h2>
          <p className="text-xs text-pits-dim">{t('Past their renew date and without a proof in review.')}</p>
        </div>
        {members ? (
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
              rows.length > 0
                ? 'bg-pits-danger-soft text-pits-danger border-pits-danger-edge'
                : 'bg-pits-surface-muted text-pits-dim border-pits-edge'
            }`}
          >
            {rows.length}
          </span>
        ) : null}
      </div>

      {members === null ? (
        <div className="px-4 py-6 text-sm text-pits-dim animate-pulse">{t('Loading...')}</div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-pits-dim">{t('Nobody owes right now.')}</p>
      ) : (
        <>
          <ul className="divide-y divide-pits-edge">
            {shown.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Link href={`/dashboard/athletes/${m.id}`} className="min-w-0 flex-1 group">
                  <p className="text-sm font-semibold text-pits-text truncate group-hover:underline">{m.full_name}</p>
                  <p className="text-xs text-pits-dim truncate">
                    {m.plan || t('No plan')}
                    {m.days_overdue != null ? ` · ${t('Days overdue', { days: m.days_overdue })}` : ''}
                  </p>
                </Link>
                <MemberContactActions member={m} showReminder={!m.has_pending_proof} />
              </li>
            ))}
          </ul>
          {rows.length > PREVIEW ? (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="w-full px-4 py-2.5 text-sm font-semibold text-pits-info hover:bg-pits-surface-muted border-t border-pits-edge"
            >
              {expanded ? t('Show less') : t('Show all {{count}}', { count: rows.length })}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { useToast } from '@/components/Toast';
import {
  InterventionStatus,
  InterventionEvent,
  RescueIntervention,
  RescueSignalType,
  revenueRescueService,
} from '@/lib/services/revenueRescueService';

type StaffMember = {
  id: string;
  full_name: string | null;
  role: string;
};

type ViewFilter = 'actionable' | 'contacted' | 'snoozed' | 'resolved' | 'all';

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2 };

const SIGNAL_LABELS: Record<RescueSignalType, string> = {
  payment: 'Payment',
  attendance: 'Attendance',
  onboarding: 'First 90 days',
  no_show: 'No-show',
  feedback: 'Experience',
  registration: 'Registration',
};

const STATUS_STYLES: Record<InterventionStatus, string> = {
  open: 'bg-amber-50 text-amber-700 border-amber-200',
  contacted: 'bg-blue-50 text-blue-700 border-blue-200',
  snoozed: 'bg-gray-100 text-gray-600 border-gray-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  escalated: 'bg-red-50 text-red-700 border-red-200',
};

export default function FinancialInsightsPage() {
  const { tenantId } = useTenant();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [interventions, setInterventions] = useState<RescueIntervention[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [view, setView] = useState<ViewFilter>('actionable');
  const [signalFilter, setSignalFilter] = useState<RescueSignalType | 'all'>('all');
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [eventHistory, setEventHistory] = useState<
    Record<string, InterventionEvent[]>
  >({});
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);

  const copy =
    lang === 'es'
      ? {
          title: 'Rescate de Ingresos',
          subtitle:
            'Las conversaciones que tu equipo debe completar hoy para proteger ingresos.',
          atRisk: 'Ingreso mensual en riesgo',
          recovered: 'Ingreso recuperado',
          actions: 'Acciones abiertas',
          completion: 'Tasa de resolución',
          actionable: 'Prioridades',
          contacted: 'Contactados',
          snoozed: 'Pausados',
          resolved: 'Recuperados',
          all: 'Todos',
          refresh: 'Actualizar señales',
          assigned: 'Responsable',
          unassigned: 'Sin asignar',
          due: 'Vence',
          evidence: 'Por qué aparece',
          recommendation: 'Siguiente acción',
          send: 'Abrir WhatsApp',
          snooze: 'Pausar',
          resolve: 'Resolver',
          escalate: 'Escalar',
          noPhone: 'El atleta no tiene teléfono.',
          empty: 'No hay intervenciones en esta vista.',
          loading: 'Calculando ingresos en riesgo...',
          returned: 'volvieron a entrenar',
        }
      : {
          title: 'Revenue Rescue',
          subtitle:
            'The conversations your team should complete today to protect revenue.',
          atRisk: 'Monthly revenue at risk',
          recovered: 'Revenue recovered',
          actions: 'Open actions',
          completion: 'Resolution rate',
          actionable: 'Priorities',
          contacted: 'Contacted',
          snoozed: 'Snoozed',
          resolved: 'Recovered',
          all: 'All',
          refresh: 'Refresh signals',
          assigned: 'Owner',
          unassigned: 'Unassigned',
          due: 'Due',
          evidence: 'Why this surfaced',
          recommendation: 'Next best action',
          send: 'Open WhatsApp',
          snooze: 'Snooze',
          resolve: 'Resolve',
          escalate: 'Escalate',
          noPhone: 'This member has no phone number.',
          empty: 'No interventions in this view.',
          loading: 'Calculating revenue at risk...',
          returned: 'returned to class',
        };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [nextInterventions, nextStaff] = await Promise.all([
        revenueRescueService.syncAndList(tenantId),
        revenueRescueService.listStaff(tenantId),
      ]);
      setInterventions(nextInterventions);
      setStaff(nextStaff as StaffMember[]);
      setMessageDrafts(
        Object.fromEntries(
          nextInterventions.map((item) => [item.id, item.whatsapp_message])
        )
      );
    } catch (error) {
      console.error(error);
      toast(
        lang === 'es'
          ? 'No se pudo cargar Rescate de Ingresos.'
          : 'Could not load Revenue Rescue.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [lang, tenantId, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const summary = useMemo(
    () => revenueRescueService.summarize(interventions),
    [interventions]
  );

  const visible = useMemo(() => {
    return interventions
      .filter((item) => {
        if (signalFilter !== 'all' && item.signal_type !== signalFilter) return false;
        if (view === 'all') return true;
        if (view === 'actionable') {
          return item.status === 'open' || item.status === 'escalated';
        }
        return item.status === view;
      })
      .sort((a, b) => {
        const priorityDelta =
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (priorityDelta !== 0) return priorityDelta;
        return Number(b.monthly_value) - Number(a.monthly_value);
      });
  }, [interventions, signalFilter, view]);

  const runAction = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    try {
      await action();
      await loadData();
    } catch (error) {
      console.error(error);
      toast(
        lang === 'es' ? 'No se pudo guardar la acción.' : 'Could not save action.',
        'error'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleAssign = (id: string, assigneeId: string) =>
    runAction(id, () =>
      revenueRescueService.assign(id, assigneeId || null)
    );

  const handleContact = async (item: RescueIntervention) => {
    const phone = item.member?.phone?.replace(/\D/g, '');
    if (!phone) {
      toast(copy.noPhone, 'warning');
      return;
    }
    const message = messageDrafts[item.id] || item.whatsapp_message;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer'
    );
    await runAction(item.id, () =>
      revenueRescueService.markContacted(item.id, message)
    );
  };

  const handleSnooze = async (item: RescueIntervention) => {
    const reason = window.prompt(
      lang === 'es'
        ? 'Motivo: vacaciones, lesión, horario, finanzas u otro'
        : 'Reason: vacation, injury, schedule, finances, or other'
    );
    if (!reason?.trim()) return;
    await runAction(item.id, () =>
      revenueRescueService.snooze(item.id, reason.trim())
    );
  };

  const handleResolve = async (item: RescueIntervention) => {
    const reason = window.prompt(
      lang === 'es'
        ? 'Resultado: volvió, pagó, cambió de plan u otro'
        : 'Outcome: returned, paid, changed plan, or other'
    );
    if (!reason?.trim()) return;
    const recovered = window.confirm(
      lang === 'es'
        ? '¿Esta acción protegió el valor mensual de la membresía?'
        : 'Did this action protect the monthly membership value?'
    )
      ? Number(item.monthly_value)
      : 0;
    await runAction(item.id, () =>
      revenueRescueService.resolve(item.id, reason.trim(), recovered)
    );
  };

  const toggleHistory = async (interventionId: string) => {
    if (openHistoryId === interventionId) {
      setOpenHistoryId(null);
      return;
    }
    setOpenHistoryId(interventionId);
    if (eventHistory[interventionId]) return;
    try {
      const events = await revenueRescueService.listEvents(interventionId);
      setEventHistory((previous) => ({
        ...previous,
        [interventionId]: events,
      }));
    } catch (error) {
      console.error(error);
      toast(
        lang === 'es' ? 'No se pudo cargar el historial.' : 'Could not load history.',
        'error'
      );
    }
  };

  const viewTabs: Array<{ key: ViewFilter; label: string; count: number }> = [
    {
      key: 'actionable',
      label: copy.actionable,
      count: interventions.filter(
        (item) => item.status === 'open' || item.status === 'escalated'
      ).length,
    },
    {
      key: 'contacted',
      label: copy.contacted,
      count: interventions.filter((item) => item.status === 'contacted').length,
    },
    {
      key: 'snoozed',
      label: copy.snoozed,
      count: interventions.filter((item) => item.status === 'snoozed').length,
    },
    {
      key: 'resolved',
      label: copy.resolved,
      count: interventions.filter((item) => item.status === 'resolved').length,
    },
    { key: 'all', label: copy.all, count: interventions.length },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck size={18} className="text-pits-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-pits-primary">
              Coach-owned retention
            </span>
          </div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-pits-text sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-pits-dim">
            {copy.subtitle}
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadData()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-pits-panel px-4 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-pits-primary hover:text-pits-dark-text disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          {copy.refresh}
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={copy.atRisk}
          value={`$${summary.openRevenueAtRisk.toLocaleString()}`}
          detail={`${summary.openCount} ${copy.actions.toLowerCase()}`}
          icon={AlertCircle}
          tone="danger"
        />
        <MetricCard
          label={copy.recovered}
          value={`$${summary.recoveredRevenue.toLocaleString()}`}
          detail={`${summary.returnedCount} ${copy.returned}`}
          icon={DollarSign}
          tone="success"
        />
        <MetricCard
          label={copy.actions}
          value={String(summary.openCount)}
          detail={`${summary.contactedCount} ${copy.contacted.toLowerCase()}`}
          icon={Users}
        />
        <MetricCard
          label={copy.completion}
          value={`${summary.completionRate}%`}
          detail={lang === 'es' ? 'Ciclo completo medido' : 'Closed loop measured'}
          icon={TrendingUp}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-pits-edge bg-pits-surface-elevated p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key)}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition ${
                view === tab.key
                  ? 'bg-pits-panel text-white'
                  : 'text-pits-dim hover:bg-pits-surface-muted hover:text-pits-text'
              }`}
            >
              {tab.label} <span className="ml-1 opacity-70">{tab.count}</span>
            </button>
          ))}
        </div>
        <select
          value={signalFilter}
          onChange={(event) =>
            setSignalFilter(event.target.value as RescueSignalType | 'all')
          }
          className="min-h-10 rounded-xl border border-pits-edge bg-pits-surface-muted px-3 text-xs font-bold text-pits-text outline-none focus:border-pits-primary"
        >
          <option value="all">{copy.all} signals</option>
          {Object.entries(SIGNAL_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </section>

      {loading ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-pits-edge bg-pits-surface-elevated">
          <RefreshCw size={30} className="mb-4 animate-spin text-pits-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-pits-dim">
            {copy.loading}
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-pits-edge bg-pits-surface-elevated">
          <UserCheck size={36} className="mb-3 text-pits-success" />
          <p className="font-black uppercase italic text-pits-text">{copy.empty}</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visible.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border bg-pits-surface-elevated p-5 shadow-sm ${
                item.priority === 'urgent'
                  ? 'border-2 border-pits-error'
                  : 'border-pits-edge'
              }`}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-pits-primary-soft px-2 py-1 text-[8px] font-black uppercase tracking-widest text-pits-primary">
                      {SIGNAL_LABELS[item.signal_type]}
                    </span>
                    <span
                      className={`rounded-md border px-2 py-1 text-[8px] font-black uppercase tracking-widest ${STATUS_STYLES[item.status]}`}
                    >
                      {item.status}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-pits-dim">
                      {item.priority}
                    </span>
                  </div>
                  <h2 className="truncate text-lg font-black uppercase italic tracking-tight text-pits-text">
                    {item.member?.full_name || 'Member'}
                  </h2>
                  <p className="text-sm font-bold text-pits-dim">{item.title}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-black italic text-pits-text">
                    ${Number(item.monthly_value).toLocaleString()}
                  </p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-pits-dim">
                    MRR at risk
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-pits-surface-muted p-3">
                  <p className="mb-1 text-[8px] font-black uppercase tracking-widest text-pits-dim">
                    {copy.evidence}
                  </p>
                  <p className="text-xs font-semibold leading-relaxed text-pits-text">
                    {item.explanation}
                  </p>
                </div>
                <div className="rounded-xl bg-pits-primary-soft/50 p-3">
                  <p className="mb-1 text-[8px] font-black uppercase tracking-widest text-pits-primary">
                    {copy.recommendation}
                  </p>
                  <p className="text-xs font-semibold leading-relaxed text-pits-text">
                    {item.suggested_action}
                  </p>
                </div>
              </div>

              {item.status !== 'resolved' && (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
                    <label className="block">
                      <span className="mb-1 block text-[8px] font-black uppercase tracking-widest text-pits-dim">
                        {copy.assigned}
                      </span>
                      <select
                        value={item.assigned_to || ''}
                        disabled={busyId === item.id}
                        onChange={(event) =>
                          void handleAssign(item.id, event.target.value)
                        }
                        className="min-h-10 w-full rounded-xl border border-pits-edge bg-pits-surface-muted px-3 text-xs font-bold text-pits-text outline-none focus:border-pits-primary"
                      >
                        <option value="">{copy.unassigned}</option>
                        {staff.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.full_name || person.role} · {person.role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[8px] font-black uppercase tracking-widest text-pits-dim">
                        WhatsApp
                      </span>
                      <textarea
                        rows={2}
                        value={messageDrafts[item.id] || ''}
                        onChange={(event) =>
                          setMessageDrafts((previous) => ({
                            ...previous,
                            [item.id]: event.target.value,
                          }))
                        }
                        className="w-full resize-none rounded-xl border border-pits-edge bg-pits-surface-muted px-3 py-2 text-xs font-medium text-pits-text outline-none focus:border-pits-primary"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-pits-edge pt-4">
                    <div className="flex items-center gap-2 text-[9px] font-bold uppercase text-pits-dim">
                      {item.assignee?.full_name && (
                        <span>{item.assignee.full_name}</span>
                      )}
                      {item.due_at && (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} />
                          {copy.due}{' '}
                          {new Date(item.due_at).toLocaleDateString(
                            lang === 'es' ? 'es-ES' : 'en-US'
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleHistory(item.id)}
                        className="rounded-lg px-2.5 py-2 text-[9px] font-black uppercase tracking-wider text-pits-dim hover:bg-pits-surface-muted"
                      >
                        {lang === 'es' ? 'Historial' : 'History'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleSnooze(item)}
                        className="rounded-lg px-2.5 py-2 text-[9px] font-black uppercase tracking-wider text-pits-dim hover:bg-pits-surface-muted"
                      >
                        {copy.snooze}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() =>
                          void runAction(item.id, () =>
                            revenueRescueService.escalate(item.id)
                          )
                        }
                        className="rounded-lg px-2.5 py-2 text-[9px] font-black uppercase tracking-wider text-pits-error hover:bg-red-50"
                      >
                        {copy.escalate}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleResolve(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-pits-edge px-3 py-2 text-[9px] font-black uppercase tracking-wider text-pits-text hover:bg-pits-surface-muted"
                      >
                        <CheckCircle2 size={12} />
                        {copy.resolve}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleContact(item)}
                        className="inline-flex items-center gap-1 rounded-lg bg-pits-primary px-3 py-2 text-[9px] font-black uppercase tracking-wider text-pits-dark-text shadow-sm hover:bg-pits-primary-dark"
                      >
                        <MessageCircle size={12} />
                        {copy.send}
                        <ArrowUpRight size={11} />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {item.status === 'resolved' && (
                <>
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-green-50 p-3 text-green-800">
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest">
                        {item.outcome_type || item.resolution_reason}
                      </p>
                      <p className="mt-1 text-xs font-semibold">
                        {item.outcome_detected_at
                          ? new Date(item.outcome_detected_at).toLocaleDateString(
                              lang === 'es' ? 'es-ES' : 'en-US'
                            )
                          : ''}
                      </p>
                    </div>
                    <p className="text-lg font-black">
                      +${Number(item.recovered_amount).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleHistory(item.id)}
                    className="mt-2 text-[9px] font-black uppercase tracking-wider text-pits-dim"
                  >
                    {lang === 'es' ? 'Ver historial' : 'View history'}
                  </button>
                </>
              )}

              {openHistoryId === item.id && (
                <div className="mt-4 rounded-xl border border-pits-edge bg-pits-surface-muted p-3">
                  <p className="mb-3 text-[8px] font-black uppercase tracking-widest text-pits-dim">
                    {lang === 'es' ? 'Historial de intervención' : 'Intervention history'}
                  </p>
                  {(eventHistory[item.id] || []).length === 0 ? (
                    <p className="text-xs text-pits-dim">
                      {lang === 'es' ? 'Sin eventos todavía.' : 'No events yet.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {eventHistory[item.id].map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="font-bold capitalize text-pits-text">
                            {event.event_type.replace(/_/g, ' ')}
                            {event.actor?.full_name
                              ? ` · ${event.actor.full_name}`
                              : ''}
                          </span>
                          <span className="shrink-0 text-[9px] text-pits-dim">
                            {new Date(event.created_at).toLocaleString(
                              lang === 'es' ? 'es-ES' : 'en-US'
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof DollarSign;
  tone?: 'default' | 'danger' | 'success';
}) {
  const iconClass =
    tone === 'danger'
      ? 'text-pits-error bg-red-50'
      : tone === 'success'
        ? 'text-pits-success bg-green-50'
        : 'text-pits-primary bg-pits-primary-soft';
  return (
    <div className="rounded-2xl border border-pits-edge bg-pits-surface-elevated p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-pits-dim">
          {label}
        </p>
        <span className={`rounded-xl p-2 ${iconClass}`}>
          <Icon size={17} />
        </span>
      </div>
      <p className="text-3xl font-black italic tracking-tight text-pits-text">{value}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-pits-dim">
        {detail}
      </p>
    </div>
  );
}

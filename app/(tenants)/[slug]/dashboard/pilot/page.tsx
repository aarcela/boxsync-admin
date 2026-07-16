'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clipboard,
  DollarSign,
  Rocket,
  Target,
  Users,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { useToast } from '@/components/Toast';
import {
  PilotBaseline,
  PilotMetrics,
  pilotProgramService,
} from '@/lib/services/pilotProgramService';

const EMPTY_METRICS: PilotMetrics = {
  activeMembers: 0,
  currentMrr: 0,
  openAtRisk: 0,
  interventionsCreated: 0,
  interventionsContacted: 0,
  interventionsResolved: 0,
  membersReturned: 0,
  paymentsRecovered: 0,
  recoveredRevenue: 0,
  completionRate: 0,
  contactRate: 0,
};

export default function PilotPage() {
  const tenant = useTenant();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [baseline, setBaseline] = useState<PilotBaseline | null>(null);
  const [metrics, setMetrics] = useState<PilotMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const nextBaseline = await pilotProgramService.getBaseline(tenant.tenantId);
      const nextMetrics = await pilotProgramService.getMetrics(
        tenant.tenantId,
        nextBaseline
      );
      setBaseline(nextBaseline);
      setMetrics(nextMetrics);
      setNotes(nextBaseline?.notes || '');
    } catch (error) {
      console.error(error);
      toast(
        lang === 'es'
          ? 'No se pudo cargar el programa piloto.'
          : 'Could not load the pilot program.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [lang, tenant.tenantId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const day = useMemo(() => {
    if (!baseline) return 0;
    return Math.max(
      1,
      Math.min(
        60,
        Math.floor(
          (Date.now() - new Date(baseline.start_date).getTime()) /
            (24 * 60 * 60 * 1000)
        ) + 1
      )
    );
  }, [baseline]);

  const startPilot = async () => {
    setStarting(true);
    try {
      const nextBaseline = await pilotProgramService.createBaseline(
        tenant.tenantId,
        notes
      );
      setBaseline(nextBaseline);
      await load();
      toast(
        lang === 'es'
          ? 'Línea base guardada. El piloto de 60 días comenzó.'
          : 'Baseline saved. The 60-day pilot has started.',
        'success'
      );
    } catch (error) {
      console.error(error);
      toast(
        lang === 'es' ? 'No se pudo iniciar el piloto.' : 'Could not start pilot.',
        'error'
      );
    } finally {
      setStarting(false);
    }
  };

  const saveNotes = async () => {
    try {
      await pilotProgramService.updateNotes(tenant.tenantId, notes);
      toast(lang === 'es' ? 'Notas guardadas.' : 'Notes saved.', 'success');
    } catch (error) {
      console.error(error);
      toast(lang === 'es' ? 'No se pudo guardar.' : 'Could not save.', 'error');
    }
  };

  const copyCaseStudy = async () => {
    if (!baseline) return;
    const report = pilotProgramService.buildCaseStudy({
      gymName: tenant.name,
      baseline,
      metrics,
    });
    await navigator.clipboard.writeText(report);
    toast(
      lang === 'es'
        ? 'Reporte verificable copiado.'
        : 'Verifiable report copied.',
      'success'
    );
  };

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-pits-primary border-t-transparent" />
      </div>
    );
  }

  if (!baseline) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-3xl border border-pits-edge bg-pits-surface-elevated p-8 shadow-sm sm:p-12">
          <div className="mb-6 inline-flex rounded-2xl bg-pits-primary-soft p-4 text-pits-primary">
            <Rocket size={30} />
          </div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-pits-text sm:text-4xl">
            {lang === 'es' ? 'Piloto Fundador de 60 Días' : '60-Day Founding Gym Pilot'}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-pits-dim">
            {lang === 'es'
              ? 'Guarda una línea base verificable antes de comenzar. WODUS medirá conversaciones, retornos, pagos e ingresos protegidos sin inventar resultados.'
              : 'Save a verifiable baseline before starting. WODUS will measure conversations, returns, payments, and protected revenue without inventing outcomes.'}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <PreviewMetric
              label={lang === 'es' ? 'Miembros activos' : 'Active members'}
              value={metrics.activeMembers}
            />
            <PreviewMetric label="MRR" value={`$${metrics.currentMrr.toFixed(0)}`} />
            <PreviewMetric
              label={lang === 'es' ? 'Riesgos abiertos' : 'Open risks'}
              value={metrics.openAtRisk}
            />
          </div>

          <label className="mt-8 block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-pits-dim">
              {lang === 'es' ? 'Contexto y objetivos' : 'Context and goals'}
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder={
                lang === 'es'
                  ? 'Ej. Reducir ausencias y recuperar renovaciones...'
                  : 'Example: reduce attendance drop-off and recover renewals...'
              }
              className="w-full rounded-2xl border border-pits-edge bg-pits-surface-muted p-4 text-sm text-pits-text outline-none focus:border-pits-primary"
            />
          </label>

          <button
            type="button"
            disabled={starting}
            onClick={() => void startPilot()}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-pits-primary px-6 text-xs font-black uppercase tracking-widest text-pits-dark-text shadow-lg hover:bg-pits-primary-dark disabled:opacity-50 sm:w-auto"
          >
            <Target size={17} />
            {starting
              ? lang === 'es'
                ? 'Guardando...'
                : 'Saving...'
              : lang === 'es'
                ? 'Guardar línea base e iniciar'
                : 'Save baseline and start'}
          </button>
        </div>
      </div>
    );
  }

  const mrrDelta = metrics.currentMrr - Number(baseline.starting_mrr);
  const memberDelta =
    metrics.activeMembers - Number(baseline.starting_active_members);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-pits-primary">
            {lang === 'es' ? `Día ${day} de 60` : `Day ${day} of 60`}
          </span>
          <h1 className="mt-1 text-3xl font-black uppercase italic tracking-tighter text-pits-text">
            {lang === 'es' ? 'Resultados del Piloto' : 'Pilot Outcomes'}
          </h1>
          <p className="mt-1 text-sm font-medium text-pits-dim">
            {baseline.start_date} → {baseline.target_end_date}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copyCaseStudy()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-pits-panel px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-pits-primary hover:text-pits-dark-text"
        >
          <Clipboard size={15} />
          {lang === 'es' ? 'Copiar reporte' : 'Copy case-study report'}
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OutcomeCard
          label={lang === 'es' ? 'Ingreso atribuido' : 'Attributed revenue'}
          value={`$${metrics.recoveredRevenue.toFixed(0)}`}
          detail={`${metrics.interventionsResolved} ${lang === 'es' ? 'casos resueltos' : 'resolved cases'}`}
          icon={DollarSign}
        />
        <OutcomeCard
          label={lang === 'es' ? 'Miembros que volvieron' : 'Members returned'}
          value={String(metrics.membersReturned)}
          detail={`${metrics.paymentsRecovered} ${lang === 'es' ? 'pagos recuperados' : 'payments recovered'}`}
          icon={Users}
        />
        <OutcomeCard
          label={lang === 'es' ? 'Tasa de contacto' : 'Contact rate'}
          value={`${metrics.contactRate}%`}
          detail={`${metrics.interventionsContacted}/${metrics.interventionsCreated}`}
          icon={CheckCircle2}
        />
        <OutcomeCard
          label={lang === 'es' ? 'Tasa de resolución' : 'Resolution rate'}
          value={`${metrics.completionRate}%`}
          detail={lang === 'es' ? 'Ciclo medido' : 'Closed loop measured'}
          icon={BarChart3}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-pits-edge bg-pits-surface-elevated p-6 shadow-sm">
          <h2 className="text-lg font-black uppercase italic text-pits-text">
            {lang === 'es' ? 'Antes vs. ahora' : 'Baseline vs. now'}
          </h2>
          <div className="mt-5 space-y-4">
            <ComparisonRow
              label={lang === 'es' ? 'Miembros activos' : 'Active members'}
              before={baseline.starting_active_members}
              current={metrics.activeMembers}
              delta={memberDelta}
            />
            <ComparisonRow
              label="MRR"
              before={`$${Number(baseline.starting_mrr).toFixed(0)}`}
              current={`$${metrics.currentMrr.toFixed(0)}`}
              delta={`${mrrDelta >= 0 ? '+' : ''}$${mrrDelta.toFixed(0)}`}
            />
            <ComparisonRow
              label={lang === 'es' ? 'Riesgos abiertos' : 'Open risks'}
              before={baseline.starting_at_risk}
              current={metrics.openAtRisk}
              delta={metrics.openAtRisk - baseline.starting_at_risk}
              inverse
            />
          </div>
        </div>

        <div className="rounded-2xl border border-pits-edge bg-pits-surface-elevated p-6 shadow-sm">
          <h2 className="text-lg font-black uppercase italic text-pits-text">
            {lang === 'es' ? 'Notas del piloto' : 'Pilot notes'}
          </h2>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={7}
            className="mt-4 w-full rounded-2xl border border-pits-edge bg-pits-surface-muted p-4 text-sm text-pits-text outline-none focus:border-pits-primary"
          />
          <button
            type="button"
            onClick={() => void saveNotes()}
            className="mt-3 min-h-10 rounded-xl bg-pits-primary px-4 text-[10px] font-black uppercase tracking-widest text-pits-dark-text"
          >
            {lang === 'es' ? 'Guardar notas' : 'Save notes'}
          </button>
        </div>
      </section>

      <p className="text-center text-[9px] font-bold uppercase tracking-widest text-pits-dim">
        {lang === 'es'
          ? 'Solo se reportan eventos registrados en WODUS. Correlación no implica causalidad.'
          : 'Only WODUS-recorded events are reported. Correlation does not imply causation.'}
      </p>
    </div>
  );
}

function PreviewMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl bg-pits-surface-muted p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-pits-dim">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black italic text-pits-text">{value}</p>
    </div>
  );
}

function OutcomeCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof DollarSign;
}) {
  return (
    <div className="rounded-2xl border border-pits-edge bg-pits-surface-elevated p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-pits-dim">
          {label}
        </p>
        <Icon size={18} className="text-pits-primary" />
      </div>
      <p className="mt-4 text-3xl font-black italic text-pits-text">{value}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-pits-dim">
        {detail}
      </p>
    </div>
  );
}

function ComparisonRow({
  label,
  before,
  current,
  delta,
  inverse = false,
}: {
  label: string;
  before: number | string;
  current: number | string;
  delta: number | string;
  inverse?: boolean;
}) {
  const numericDelta =
    typeof delta === 'number'
      ? delta
      : Number(String(delta).replace(/[+$,]/g, '')) || 0;
  const positive = inverse ? numericDelta <= 0 : numericDelta >= 0;
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 rounded-xl bg-pits-surface-muted p-3">
      <span className="text-xs font-bold text-pits-text">{label}</span>
      <span className="text-xs text-pits-dim">{before}</span>
      <span className="text-xs font-black text-pits-text">{current}</span>
      <span
        className={`text-xs font-black ${positive ? 'text-pits-success' : 'text-pits-error'}`}
      >
        {typeof delta === 'number' && delta >= 0 ? '+' : ''}
        {delta}
      </span>
    </div>
  );
}

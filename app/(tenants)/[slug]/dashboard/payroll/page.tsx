'use client';

import { useState, useEffect, useMemo, useTransition, useCallback } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Zap,
  Info,
  Users,
  Clock,
  FileDown,
  Mail,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/components/LanguageContext';
import { supabase } from '@/lib/supabase';
import { payrollService } from '@/lib/services/payrollService';
import { coachSalaryService } from '@/lib/services/coachSalaryService';
import { PayrollClass, PayrollClassStatus, CoachWithSalaryTier } from '@/lib/types/gym';
import { updateClassPayrollStatusAction, bulkUpdateClassPayrollStatusAction } from './actions';
import {
  buildCoachPayrollReports,
  getPayrollPeriodLabel,
} from '@/lib/payroll/payrollReport';
import { downloadPdf, generateFullPayrollPdf, generateCoachPayrollPdf } from '@/lib/payroll/generatePayrollPdf';
import {
  getCaracasDate,
  getCaracasDayRange,
  getCaracasWeekRange,
  getCaracasWeekDays,
  getCaracasMonthRange,
  getCaracasCustomRange,
  getCaracasDateSpan,
  getCaracasDateFromIso,
  getCaracasTimeLabel,
} from '@/lib/utils/date';

type FilterMode = 'day' | 'week' | 'month' | 'custom';
type ViewTab = 'calendar' | 'list';

function statusStyles(status: PayrollClassStatus) {
  switch (status) {
    case 'confirmed':
      return 'bg-pits-primary-soft text-pits-success border-pits-success/30';
    case 'cancelled':
      return 'bg-red-100 text-red-700 border-red-300';
    default:
      return 'bg-orange-100 text-orange-700 border-orange-300';
  }
}

function blockStyles(status: PayrollClassStatus) {
  switch (status) {
    case 'confirmed':
      return 'bg-pits-primary-soft border-pits-success/40 text-pits-success';
    case 'cancelled':
      return 'bg-red-100 border-red-300 text-red-800';
    default:
      return 'bg-orange-100 border-orange-300 text-orange-800';
  }
}

export default function PayrollPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<PayrollClass[]>([]);
  const [coaches, setCoaches] = useState<CoachWithSalaryTier[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [callerRole, setCallerRole] = useState<string | null>(null);

  const [filterMode, setFilterMode] = useState<FilterMode>('week');
  const [anchorDate, setAnchorDate] = useState(getCaracasDate());
  const [monthValue, setMonthValue] = useState(getCaracasDate().slice(0, 7));
  const [customStart, setCustomStart] = useState(getCaracasDate());
  const [customEnd, setCustomEnd] = useState(getCaracasDate());
  const [coachFilter, setCoachFilter] = useState<string>('all');
  const [viewTab, setViewTab] = useState<ViewTab>('calendar');
  const [selectedClass, setSelectedClass] = useState<PayrollClass | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportingCoachId, setExportingCoachId] = useState<string | null>(null);
  const [emailing, setEmailing] = useState(false);

  const isAdmin = callerRole === 'admin';

  const dateRange = useMemo(() => {
    try {
      switch (filterMode) {
        case 'day':
          return getCaracasDayRange(anchorDate);
        case 'week':
          return getCaracasWeekRange(anchorDate);
        case 'month':
          return getCaracasMonthRange(monthValue);
        case 'custom':
          return getCaracasCustomRange(customStart, customEnd);
      }
    } catch {
      return getCaracasWeekRange(anchorDate);
    }
  }, [filterMode, anchorDate, monthValue, customStart, customEnd]);

  const calendarDays = useMemo(() => {
    if (filterMode === 'day') return [anchorDate];
    if (filterMode === 'week') return getCaracasWeekDays(anchorDate);
    if (filterMode === 'month') {
      const { startDate, endDate } = getCaracasMonthRange(monthValue);
      return getCaracasDateSpan(startDate, endDate);
    }
    return getCaracasDateSpan(customStart, customEnd);
  }, [filterMode, anchorDate, monthValue, customStart, customEnd]);

  useEffect(() => {
    const loadContext = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, tenant_id')
        .eq('id', user.id)
        .single();

      setCallerRole(profile?.role ?? null);
      setTenantId(profile?.tenant_id ?? null);
    };

    loadContext();
  }, []);

  const loadPayroll = useCallback(async () => {
    if (!tenantId || !isAdmin) return;
    setLoading(true);
    try {
      const coachId = coachFilter === 'all' ? null : coachFilter;
      const data = await payrollService.getPayrollClasses(
        tenantId,
        dateRange.startUtc,
        dateRange.endUtc,
        coachId
      );
      setClasses(data);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
      toast(t('Failed to load payroll data'), 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, isAdmin, dateRange.startUtc, dateRange.endUtc, coachFilter, toast, t]);

  useEffect(() => {
    if (!tenantId) {
      if (callerRole !== null) setLoading(false);
      return;
    }
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    loadPayroll();
  }, [tenantId, callerRole, isAdmin, loadPayroll]);

  useEffect(() => {
    if (!tenantId || !isAdmin) return;
    coachSalaryService.getCoachesWithTiers(tenantId).then(setCoaches).catch(console.error);
  }, [tenantId, isAdmin]);

  const handleStatusChange = (classId: string, status: PayrollClassStatus) => {
    if (!isAdmin) return;
    startTransition(async () => {
      try {
        await updateClassPayrollStatusAction(classId, status);
        toast(t('Payroll status updated'), 'success');
        setSelectedClass(null);
        loadPayroll();
      } catch (error) {
        const message =
          error instanceof Error && error.message === 'Only admins can manage payroll.'
            ? t('Only admins can manage payroll.')
            : t('Action failed');
        toast(message, 'error');
      }
    });
  };

  const toggleSelected = (classId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const allSelected = classes.length > 0 && selectedIds.size === classes.length;
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(classes.map((c) => c.id)));
    }
  };

  const handleBulkStatusChange = (status: PayrollClassStatus) => {
    if (!isAdmin || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      try {
        await bulkUpdateClassPayrollStatusAction(ids, status);
        toast(t('Bulk payroll status updated'), 'success');
        setSelectedIds(new Set());
        loadPayroll();
      } catch (error) {
        const message =
          error instanceof Error && error.message === 'Only admins can manage payroll.'
            ? t('Only admins can manage payroll.')
            : t('Action failed');
        toast(message, 'error');
      }
    });
  };

  const shiftAnchor = (days: number) => {
    const d = new Date(`${anchorDate}T12:00:00-04:00`);
    d.setDate(d.getDate() + days);
    setAnchorDate(getCaracasDate(d));
  };

  const shiftWeek = (weeks: number) => shiftAnchor(weeks * 7);

  const periodLabel = useMemo(
    () => getPayrollPeriodLabel(filterMode, anchorDate, monthValue, customStart, customEnd),
    [filterMode, anchorDate, monthValue, customStart, customEnd]
  );

  const coachReports = useMemo(
    () => buildCoachPayrollReports(classes, periodLabel),
    [classes, periodLabel]
  );

  const handleExportPdf = async () => {
    if (coachReports.length === 0) {
      toast(t('No confirmed classes to export.'), 'error');
      return;
    }
    setExporting(true);
    try {
      const pdf = generateFullPayrollPdf(coachReports);
      downloadPdf(pdf, `payroll-${periodLabel.replace(/\s+/g, '_')}.pdf`);
      toast(t('Payroll PDF exported'), 'success');
    } catch (err) {
      console.error(err);
      toast(t('Failed to export PDF'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCoachPdf = (coachId: string) => {
    const report = coachReports.find((r) => r.coachId === coachId);
    if (!report) return;

    setExportingCoachId(coachId);
    try {
      const pdf = generateCoachPayrollPdf(report);
      const safeName = report.coachName.replace(/\s+/g, '_').toLowerCase();
      downloadPdf(pdf, `payroll-${safeName}-${periodLabel.replace(/\s+/g, '_')}.pdf`);
      toast(t('Payroll PDF exported'), 'success');
    } catch (err) {
      console.error(err);
      toast(t('Failed to export PDF'), 'error');
    } finally {
      setExportingCoachId(null);
    }
  };

  const handleEmailCoaches = async () => {
    if (coachReports.length === 0) {
      toast(t('No confirmed classes to email.'), 'error');
      return;
    }
    setEmailing(true);
    try {
      const response = await fetch('/api/admin/payroll/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUtc: dateRange.startUtc,
          endUtc: dateRange.endUtc,
          periodLabel,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t('Failed to send payroll emails'));
      }

      const sentCount = data.sent?.length ?? 0;
      const skippedCount = data.skipped?.length ?? 0;
      const failedCount = data.failed?.length ?? 0;

      if (sentCount > 0) {
        toast(
          `${t('Payroll emails sent')}: ${sentCount}${skippedCount ? `, ${skippedCount} ${t('skipped')}` : ''}${failedCount ? `, ${failedCount} ${t('failed')}` : ''}`,
          failedCount > 0 ? 'error' : 'success'
        );
      } else {
        toast(t('No emails sent. Check coach email addresses.'), 'error');
      }
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : t('Failed to send payroll emails'), 'error');
    } finally {
      setEmailing(false);
    }
  };

  const summary = useMemo(() => {
    const confirmed = classes.filter((c) => c.payrollStatus === 'confirmed');
    const totalPayroll = confirmed.reduce((sum, c) => sum + (c.payRateUsd ?? 0), 0);
    const byCoach: Record<string, { name: string; total: number; count: number }> = {};

    confirmed.forEach((c) => {
      const id = c.coach?.id ?? 'unassigned';
      const name = c.coach?.full_name ?? t('Unassigned');
      if (!byCoach[id]) byCoach[id] = { name, total: 0, count: 0 };
      byCoach[id].total += c.payRateUsd ?? 0;
      byCoach[id].count += 1;
    });

    return {
      total: classes.length,
      confirmedCount: confirmed.length,
      totalPayroll,
      byCoach: Object.values(byCoach).sort((a, b) => b.total - a.total),
    };
  }, [classes, t]);

  const statusLabel = (status: PayrollClassStatus) => {
    switch (status) {
      case 'confirmed':
        return t('confirmed');
      case 'cancelled':
        return t('cancelled');
      default:
        return t('pending');
    }
  };

  const renderStatusSelect = (cls: PayrollClass, compact = false) => (
    <select
      value={cls.payrollStatus}
      onChange={(e) => handleStatusChange(cls.id, e.target.value as PayrollClassStatus)}
      disabled={isPending}
      className={`${compact ? 'text-[9px] py-1 px-2' : 'text-[10px] py-2 px-3'} font-black uppercase bg-pits-surface-muted border border-pits-edge rounded-xl outline-none focus:ring-2 focus:ring-pits-red`}
    >
      <option value="confirmed">{t('confirmed')}</option>
      <option value="pending">{t('pending')}</option>
      <option value="cancelled">{t('cancelled')}</option>
    </select>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-0">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-pits-edge">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-pits-ink tracking-tighter uppercase">
              {t('Payroll')}
            </h1>
            <div className="bg-pits-primary/50 px-2 py-0.5 rounded text-[10px] font-bold text-pits-dark-text border border-pits-primary-dark tracking-widest uppercase shadow-sm">
              {t('Admin Only')}
            </div>
          </div>
          <p className="text-pits-dim text-xs font-semibold mt-1 tracking-wide uppercase">
            {t('Review class payroll and coach compensation')}
          </p>
          {!isAdmin && callerRole && (
            <p className="text-[10px] font-bold text-pits-secondary uppercase mt-2">
              {t('Only admins can manage payroll.')}
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting || loading}
              className="flex items-center gap-2 px-5 py-3 bg-pits-surface-elevated border border-pits-edge rounded-2xl text-[10px] font-black uppercase shadow-sm hover:border-pits-primary/40 disabled:opacity-50 transition-all"
            >
              <FileDown size={16} className="text-pits-red" />
              {exporting ? t('Processing...') : t('Export PDF')}
            </button>
            <button
              type="button"
              onClick={handleEmailCoaches}
              disabled={emailing || loading}
              className="flex items-center gap-2 px-5 py-3 bg-pits-primary text-pits-dark-text rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-pits-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
            >
              <Mail size={16} />
              {emailing ? t('Sending...') : t('Email Coaches')}
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <>
          {/* Filters */}
          <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {(['day', 'week', 'month', 'custom'] as FilterMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    filterMode === mode
                      ? 'bg-pits-primary text-pits-dark-text border-pits-primary-dark'
                      : 'bg-pits-surface-muted text-pits-dim border-pits-edge hover:border-pits-primary/40'
                  }`}
                >
                  {mode === 'day'
                    ? t('Day')
                    : mode === 'week'
                      ? t('Week')
                      : mode === 'month'
                        ? t('Month')
                        : t('Custom')}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {(filterMode === 'day' || filterMode === 'week') && (
                <>
                  <button
                    onClick={() => (filterMode === 'day' ? shiftAnchor(-1) : shiftWeek(-1))}
                    className="p-2 bg-pits-surface-muted border border-pits-edge rounded-lg hover:bg-pits-edge"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="relative">
                    <Calendar
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim"
                      size={16}
                    />
                    <input
                      type="date"
                      value={anchorDate}
                      onChange={(e) => setAnchorDate(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-pits-surface-muted border border-pits-edge rounded-xl text-xs font-bold text-pits-ink outline-none focus:ring-2 focus:ring-pits-red"
                    />
                  </div>
                  <button
                    onClick={() => (filterMode === 'day' ? shiftAnchor(1) : shiftWeek(1))}
                    className="p-2 bg-pits-surface-muted border border-pits-edge rounded-lg hover:bg-pits-edge"
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}

              {filterMode === 'month' && (
                <input
                  type="month"
                  value={monthValue}
                  onChange={(e) => setMonthValue(e.target.value)}
                  className="px-4 py-2 bg-pits-surface-muted border border-pits-edge rounded-xl text-xs font-bold text-pits-ink outline-none focus:ring-2 focus:ring-pits-red"
                />
              )}

              {filterMode === 'custom' && (
                <>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="px-4 py-2 bg-pits-surface-muted border border-pits-edge rounded-xl text-xs font-bold text-pits-ink outline-none focus:ring-2 focus:ring-pits-red"
                  />
                  <span className="text-pits-dim font-bold text-xs">—</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="px-4 py-2 bg-pits-surface-muted border border-pits-edge rounded-xl text-xs font-bold text-pits-ink outline-none focus:ring-2 focus:ring-pits-red"
                  />
                </>
              )}

              <select
                value={coachFilter}
                onChange={(e) => setCoachFilter(e.target.value)}
                className="ml-auto px-4 py-2 bg-pits-surface-muted border border-pits-edge rounded-xl text-[10px] font-black uppercase text-pits-ink outline-none focus:ring-2 focus:ring-pits-red"
              >
                <option value="all">{t('All Coaches')}</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* View tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setViewTab('calendar')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                  viewTab === 'calendar'
                    ? 'bg-pits-primary text-pits-dark-text border-pits-primary-dark'
                    : 'bg-pits-surface-elevated text-pits-dim border-pits-edge hover:border-pits-primary/40'
                }`}
              >
                <Calendar size={14} />
                {t('Class Calendar')}
              </button>
              <button
                type="button"
                onClick={() => setViewTab('list')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                  viewTab === 'list'
                    ? 'bg-pits-primary text-pits-dark-text border-pits-primary-dark'
                    : 'bg-pits-surface-elevated text-pits-dim border-pits-edge hover:border-pits-primary/40'
                }`}
              >
                <Clock size={14} />
                {t('Class List')}
              </button>
            </div>
            {someSelected && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black text-pits-dim uppercase">
                  {selectedIds.size} {t('selected')}
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleBulkStatusChange('confirmed')}
                  className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border bg-pits-primary-soft text-pits-success border-pits-success/30 hover:opacity-90 disabled:opacity-50"
                >
                  {t('confirmed')}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleBulkStatusChange('pending')}
                  className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border bg-orange-100 text-orange-700 border-orange-300 hover:opacity-90 disabled:opacity-50"
                >
                  {t('pending')}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleBulkStatusChange('cancelled')}
                  className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border bg-red-100 text-red-700 border-red-300 hover:opacity-90 disabled:opacity-50"
                >
                  {t('cancelled')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase text-pits-dim border border-pits-edge hover:bg-pits-surface-muted"
                >
                  {t('Clear selection')}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {viewTab === 'calendar' && (
            <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-pits-edge">
                <h2 className="text-sm font-black text-pits-ink uppercase tracking-tighter flex items-center gap-2">
                  <Calendar size={16} className="text-pits-red" />
                  {t('Class Calendar')}
                </h2>
              </div>

              {loading ? (
                <div className="py-20 text-center text-pits-dim font-bold uppercase animate-pulse">
                  {t('Initializing Data Stream...')}
                </div>
              ) : (
                <div
                  className="p-4 grid gap-4 w-full"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(calendarDays.length, 7)}, minmax(0, 1fr))`,
                  }}
                >
                  {calendarDays.map((day) => {
                    const dayClasses = classes
                      .filter((c) => getCaracasDateFromIso(c.start_time) === day)
                      .sort(
                        (a, b) =>
                          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
                      );
                    return (
                      <div
                        key={day}
                        className="min-h-[120px] p-3 border border-pits-edge/50 rounded-xl bg-pits-surface-muted/30"
                      >
                        <p className="text-[10px] font-black text-pits-dim uppercase mb-3 border-b border-pits-edge/50 pb-2">
                          {new Date(`${day}T12:00:00-04:00`).toLocaleDateString('en-US', {
                            timeZone: 'America/Caracas',
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        {dayClasses.length === 0 ? (
                          <p className="text-[10px] text-pits-dim font-bold uppercase py-3">
                            —
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {dayClasses.map((cls) => (
                              <div
                                key={cls.id}
                                className={`flex items-start gap-2.5 px-3 py-3 rounded-xl border ${blockStyles(cls.payrollStatus!)} ${selectedIds.has(cls.id) ? 'ring-2 ring-pits-primary' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(cls.id)}
                                  onChange={() => toggleSelected(cls.id)}
                                  className="mt-0.5 shrink-0 w-4 h-4 accent-pits-primary cursor-pointer"
                                  aria-label={t('Select class')}
                                />
                                <button
                                  type="button"
                                  onClick={() => setSelectedClass(cls)}
                                  className="flex-1 min-w-0 text-left hover:opacity-90 transition-opacity"
                                >
                                  <p className="text-[11px] font-black uppercase truncate leading-snug">
                                    {cls.class_type}
                                  </p>
                                  <p className="text-[10px] font-bold truncate mt-1 leading-snug">
                                    {getCaracasTimeLabel(cls.start_time)}
                                    {cls.coach?.full_name ? ` · ${cls.coach.full_name}` : ''}
                                  </p>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}

            {viewTab === 'list' && (
            <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-pits-edge">
                  <h2 className="text-sm font-black text-pits-ink uppercase tracking-tighter flex items-center gap-2">
                    <Clock size={16} className="text-pits-red" />
                    {t('Class List')}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-pits-surface-muted/60">
                      <tr>
                        <th className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected && !allSelected;
                            }}
                            onChange={toggleSelectAll}
                            disabled={classes.length === 0}
                            className="accent-pits-primary cursor-pointer"
                            aria-label={t('Select all')}
                          />
                        </th>
                        <th className="px-4 py-3 text-[9px] font-black text-pits-dim uppercase">
                          {t('Date & Time')}
                        </th>
                        <th className="px-4 py-3 text-[9px] font-black text-pits-dim uppercase">
                          {t('Class')}
                        </th>
                        <th className="px-4 py-3 text-[9px] font-black text-pits-dim uppercase">
                          {t('Coach')}
                        </th>
                        <th className="px-4 py-3 text-[9px] font-black text-pits-dim uppercase">
                          {t('Athletes')}
                        </th>
                        <th className="px-4 py-3 text-[9px] font-black text-pits-dim uppercase">
                          {t('Status')}
                        </th>
                        <th className="px-4 py-3 text-[9px] font-black text-pits-dim uppercase">
                          {t('Pay (USD)')}
                        </th>
                        <th className="px-4 py-3 text-[9px] font-black text-pits-dim uppercase">
                          {t('Actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pits-edge">
                      {loading ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-pits-dim uppercase animate-pulse">
                            {t('Loading...')}
                          </td>
                        </tr>
                      ) : classes.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-pits-dim uppercase">
                            {t('No classes in this period.')}
                          </td>
                        </tr>
                      ) : (
                        classes.map((cls) => (
                          <tr
                            key={cls.id}
                            className={`hover:bg-pits-surface-muted/40 ${selectedIds.has(cls.id) ? 'ring-1 ring-inset ring-pits-primary' : ''} ${cls.payrollStatus === 'confirmed' ? 'bg-pits-primary-soft/20' : cls.payrollStatus === 'cancelled' ? 'bg-red-50/50' : 'bg-orange-50/30'}`}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(cls.id)}
                                onChange={() => toggleSelected(cls.id)}
                                className="accent-pits-primary cursor-pointer"
                                aria-label={t('Select class')}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-[10px] font-bold text-pits-ink">
                                {getCaracasDateFromIso(cls.start_time)}
                              </div>
                              <div className="text-[9px] text-pits-dim">
                                {getCaracasTimeLabel(cls.start_time)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs font-bold uppercase">
                              {cls.class_type}
                            </td>
                            <td className="px-4 py-3 text-[10px] font-bold">
                              {cls.coach?.full_name ?? t('Unassigned')}
                            </td>
                            <td className="px-4 py-3 text-[10px] font-bold">
                              {cls.bookings[0]?.count ?? 0}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-1 rounded text-[9px] font-black uppercase border ${statusStyles(cls.payrollStatus!)}`}
                              >
                                {statusLabel(cls.payrollStatus!)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs font-black">
                              {cls.payrollStatus === 'confirmed' ? (
                                cls.payRateUsd != null ? (
                                  `$${cls.payRateUsd.toFixed(2)}`
                                ) : (
                                  <span className="text-[9px] text-pits-dim uppercase">
                                    {t('No rate')}
                                  </span>
                                )
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-4 py-3">{renderStatusSelect(cls, true)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Summary cards — bottom row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-pits-surface-muted rounded-3xl p-6 shadow-xl border border-pits-edge relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-sm font-black text-pits-ink uppercase tracking-tighter mb-4 flex items-center gap-2">
                    <Zap size={18} className="text-pits-red" /> {t('Payroll Summary')}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-pits-surface-elevated rounded-2xl border border-pits-edge">
                      <span className="text-[10px] font-bold text-pits-dim uppercase">
                        {t('Total Classes')}
                      </span>
                      <span className="text-sm font-black text-pits-ink">{summary.total}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-pits-surface-elevated rounded-2xl border border-pits-edge">
                      <span className="text-[10px] font-bold text-pits-dim uppercase">
                        {t('Confirmed Classes')}
                      </span>
                      <span className="text-sm font-black text-pits-success">
                        {summary.confirmedCount}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-pits-primary-soft rounded-2xl border border-pits-success/30">
                      <span className="text-[10px] font-bold text-pits-success uppercase">
                        {t('Total Payroll (USD)')}
                      </span>
                      <span className="text-lg font-black text-pits-success">
                        ${summary.totalPayroll.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-pits-surface-elevated rounded-3xl p-6 border border-pits-edge shadow-sm">
                <h3 className="text-xs font-black text-pits-ink uppercase flex items-center gap-2 mb-4">
                  <Users size={14} className="text-pits-red" /> {t('By Coach')}
                </h3>
                {coachReports.length === 0 ? (
                  <p className="text-[10px] text-pits-dim uppercase font-bold">
                    {t('No confirmed classes yet.')}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {coachReports.map((report) => (
                      <li
                        key={report.coachId}
                        className="flex items-center gap-2 p-2 bg-pits-surface-muted rounded-xl"
                      >
                        <span className="text-[10px] font-bold text-pits-ink uppercase truncate flex-1 min-w-0">
                          {report.coachName}
                        </span>
                        <span className="text-xs font-black text-pits-success shrink-0">
                          ${report.totalUsd.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleExportCoachPdf(report.coachId)}
                          disabled={exportingCoachId === report.coachId}
                          title={t('Export PDF')}
                          className="shrink-0 p-1.5 rounded-lg border border-pits-edge bg-pits-surface-elevated text-pits-dim hover:text-pits-ink hover:border-pits-primary/40 disabled:opacity-50 transition-all"
                        >
                          <FileDown size={14} className="text-pits-red" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-pits-surface-elevated rounded-3xl p-6 border border-pits-edge shadow-sm space-y-4">
                <h3 className="text-xs font-black text-pits-ink uppercase flex items-center gap-2">
                  <Info size={14} className="text-pits-red" /> {t('Legend')}
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded border ${statusStyles('confirmed')}`} />
                    <span className="text-[10px] font-bold text-pits-dim uppercase">
                      {t('Confirmed — pay counted')}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded border ${statusStyles('pending')}`} />
                    <span className="text-[10px] font-bold text-pits-dim uppercase">
                      {t('Pending — awaiting review')}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded border ${statusStyles('cancelled')}`} />
                    <span className="text-[10px] font-bold text-pits-dim uppercase">
                      {t('Cancelled — no pay')}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Detail modal */}
          {selectedClass && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-pits-black/60 backdrop-blur-sm"
                onClick={() => setSelectedClass(null)}
              />
              <div className="relative bg-pits-surface-elevated rounded-[32px] w-full max-w-md p-8 border border-pits-edge shadow-2xl">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-black text-pits-ink uppercase tracking-tighter">
                      {selectedClass.class_type}
                    </h2>
                    <p className="text-[10px] font-bold text-pits-dim uppercase mt-1">
                      {getCaracasDateFromIso(selectedClass.start_time)} •{' '}
                      {getCaracasTimeLabel(selectedClass.start_time)}
                    </p>
                  </div>
                  <div className="p-2 bg-pits-primary-soft rounded-xl">
                    <Receipt size={20} className="text-pits-red" />
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span className="text-pits-dim">{t('Coach')}</span>
                    <span className="text-pits-ink">
                      {selectedClass.coach?.full_name ?? t('Unassigned')}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span className="text-pits-dim">{t('Status')}</span>
                    <span
                      className={`px-2 py-0.5 rounded border ${statusStyles(selectedClass.payrollStatus!)}`}
                    >
                      {statusLabel(selectedClass.payrollStatus!)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span className="text-pits-dim">{t('Pay (USD)')}</span>
                    <span className="text-pits-success font-black">
                      {selectedClass.payrollStatus === 'confirmed'
                        ? selectedClass.payRateUsd != null
                          ? `$${selectedClass.payRateUsd.toFixed(2)}`
                          : t('No rate')
                        : '—'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-pits-dim uppercase">
                    {t('Update Status')}
                  </label>
                  {renderStatusSelect(selectedClass)}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedClass(null)}
                  className="mt-6 w-full py-3 bg-pits-surface-muted text-pits-dim rounded-2xl text-[11px] font-black uppercase border border-pits-edge"
                >
                  {t('Close')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

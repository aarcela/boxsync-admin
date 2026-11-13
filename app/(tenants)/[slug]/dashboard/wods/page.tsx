'use client';

import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { prMovementService } from '@/lib/services/prMovementService';
import { useTenant } from '@/components/TenantContext';
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
  subWeeks,
} from 'date-fns';
import { 
  Save, Loader2, Dumbbell, Search,
  Eye, Zap, Scale, Sparkles, MoveRight, Trash2, Copy, CheckCircle2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatDate, formatDateLong, formatDateShort, formatWeekdayShort } from '@/lib/utils/format-date';
import { useLanguage } from '@/components/LanguageContext';
import { getGymDate } from '@/lib/utils/date';

type WodFields = {
  title: string;
  warmUp: string;
  technique: string;
  strength: string;
  metcon: string;
  scaling: string;
  stimulus: string;
  scoreType: string;
};

const snapshotOf = (f: WodFields) => JSON.stringify(f);

function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Unknown error occurred';
}

function isUniqueViolation(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === '23505',
  );
}

function readWodContent(raw: string | null) {
  const empty = {
    warm_up: '',
    technique: '',
    strength: '',
    metcon: '',
    scaling: '',
    stimulus: '',
  };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Partial<typeof empty>;
    return {
      warm_up: parsed.warm_up || '',
      technique: parsed.technique || '',
      strength: parsed.strength || '',
      metcon: parsed.metcon || '',
      scaling: parsed.scaling || '',
      stimulus: parsed.stimulus || '',
    };
  } catch {
    return { ...empty, metcon: raw };
  }
}

export default function WodEditorPage() {
  const { toast } = useToast();
  const { t, lang } = useLanguage();
  const { tenantId, timezone } = useTenant();
  // "Today" is the gym's calendar day, not the browser's.
  const gymToday = getGymDate(new Date(), timezone);
  const [date, setDate] = useState(() => getGymDate(new Date(), timezone));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // WOD Data Structure
  const [wodId, setWodId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [warmUp, setWarmUp] = useState('');
  const [technique, setTechnique] = useState('');
  const [strength, setStrength] = useState('');
  const [metcon, setMetcon] = useState('');
  const [scaling, setScaling] = useState('');
  const [stimulus, setStimulus] = useState(''); // New key for the strategy
  const [scoreType, setScoreType] = useState('none');
  
  // Combobox State
  const [techniqueDropdownOpen, setTechniqueDropdownOpen] = useState(false);
  const [techniqueSearch, setTechniqueSearch] = useState('');
  const [prMovements, setPrMovements] = useState<string[]>([]);

  const [scheduledDates, setScheduledDates] = useState<Set<string>>(new Set());
  const [weekVersion, setWeekVersion] = useState(0);
  const movementsRequested = useRef(false);
  const saveLock = useRef(false);
  const dateRef = useRef(date);
  dateRef.current = date;

  const selectedDate = useMemo(() => parseISO(date), [date]);
  const weekStart = useMemo(
    () => startOfWeek(selectedDate, { weekStartsOn: 1 }),
    [selectedDate],
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekRangeLabel = useMemo(() => {
    const weekEnd = addDays(weekStart, 6);
    return `${formatDateShort(weekStart, lang)} – ${formatDate(weekEnd, lang)}`;
  }, [weekStart, lang]);

  const loadMovements = async () => {
    if (!tenantId || movementsRequested.current) return;
    movementsRequested.current = true;
    try {
      const data = await prMovementService.getPrMovements(tenantId);
      setPrMovements(data.filter((m) => m.is_active).map((m) => m.name));
    } catch {
      movementsRequested.current = false;
      toast(t('Failed to load PR movements'), 'error');
    }
  };

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;

    const fetchWeekWods = async () => {
      const start = format(weekStart, 'yyyy-MM-dd');
      const end = format(addDays(weekStart, 6), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('wods')
        .select('date')
        .eq('tenant_id', tenantId)
        .gte('date', start)
        .lte('date', end);
      if (cancelled) return;
      if (error) {
        console.error('Error loading week WODs:', error);
        return;
      }
      setScheduledDates(new Set((data ?? []).map((row) => row.date as string)));
    };
    fetchWeekWods();
    return () => {
      cancelled = true;
    };
  }, [weekStart, tenantId, weekVersion]);

  // Fetch WOD for selected date. Ignore stale responses so a slow load cannot wipe a newer day.
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;

    const fetchWod = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('wods')
          .select('id, title, score_type, content')
          .eq('tenant_id', tenantId)
          .eq('date', date)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;

        const content = readWodContent(data?.content ?? null);
        const loaded: WodFields = {
          title: data?.title || '',
          warmUp: content.warm_up,
          technique: content.technique,
          strength: content.strength,
          metcon: content.metcon,
          scaling: content.scaling,
          stimulus: content.stimulus,
          scoreType: data?.score_type || 'none',
        };
        setWodId(data?.id ?? null);
        applyFields(loaded);
        setSavedSnapshot(snapshotOf(loaded));
        setView('edit');
      } catch (error) {
        if (cancelled) return;
        console.error('Error loading WOD:', error);
        setWodId(null);
        applyFields(EMPTY_FIELDS);
        setSavedSnapshot(snapshotOf(EMPTY_FIELDS));
        setView('edit');
        toast(t('Failed to load workout'), 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWod();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, tenantId]);

  const currentFields: WodFields = { title, warmUp, technique, strength, metcon, scaling, stimulus, scoreType };
  const dirty = !loading && snapshotOf(currentFields) !== savedSnapshot;

  function applyFields(f: WodFields) {
    setTitle(f.title);
    setWarmUp(f.warmUp);
    setTechnique(f.technique);
    setStrength(f.strength);
    setMetcon(f.metcon);
    setScaling(f.scaling);
    setStimulus(f.stimulus);
    setScoreType(f.scoreType);
  }

  /** Switching day with unsaved edits asks first instead of silently dropping them. */
  const goToDate = (next: string) => {
    if (next === date) return;
    if (dirty) {
      setPendingDate(next);
      return;
    }
    setDate(next);
  };

  /** Fill the form with the most recent workout before this day (not saved until Publish). */
  const copyLastWorkout = async () => {
    if (!tenantId) return;
    setCopying(true);
    try {
      const { data, error } = await supabase
        .from('wods')
        .select('date, title, score_type, content')
        .eq('tenant_id', tenantId)
        .lt('date', date)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast(t('No earlier workout to copy.'), 'warning');
        return;
      }
      const content = readWodContent(data.content);
      applyFields({
        title: data.title || '',
        warmUp: content.warm_up,
        technique: content.technique,
        strength: content.strength,
        metcon: content.metcon,
        scaling: content.scaling,
        stimulus: content.stimulus,
        scoreType: data.score_type || 'none',
      });
      setView('edit');
      toast(t('Copied from {{date}}. Review and publish.', { date: formatDateLong(parseISO(data.date), lang) }), 'success');
    } catch (error) {
      toast(`${t('Failed to load workout')}: ${errorText(error)}`, 'error');
    } finally {
      setCopying(false);
    }
  };

  const handleSave = async () => {
    if (saveLock.current) return;
    if (!tenantId) {
      toast(t('Missing tenant context.'), 'error');
      return;
    }

    saveLock.current = true;
    const savedDate = date;
    setSaving(true);
    try {
      const contentJson = JSON.stringify({
        warm_up: warmUp,
        technique,
        strength,
        metcon,
        scaling,
        stimulus,
      });

      const fields = {
        date: savedDate,
        title: title.trim() || t('Daily WOD'),
        content: contentJson,
        score_type: scoreType,
      };

      const savedFields = snapshotOf({ ...currentFields, title: fields.title });
      const applySaved = (id: string) => {
        if (dateRef.current !== savedDate) return;
        setWodId(id);
        setTitle(fields.title);
        setSavedSnapshot(savedFields);
      };

      if (wodId) {
        const { error } = await supabase
          .from('wods')
          .update(fields)
          .eq('id', wodId)
          .eq('tenant_id', tenantId);
        if (error) throw error;
        applySaved(wodId);
      } else {
        const { data, error } = await supabase
          .from('wods')
          .insert({ ...fields, tenant_id: tenantId })
          .select('id')
          .single();

        if (error && isUniqueViolation(error)) {
          const { data: existing, error: loadError } = await supabase
            .from('wods')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('date', savedDate)
            .maybeSingle();
          if (loadError || !existing?.id) throw error;
          const { error: updateError } = await supabase
            .from('wods')
            .update(fields)
            .eq('id', existing.id)
            .eq('tenant_id', tenantId);
          if (updateError) throw updateError;
          applySaved(existing.id);
        } else {
          if (error) throw error;
          if (!data?.id) throw new Error('Insert returned no row');
          applySaved(data.id);
        }
      }

      setWeekVersion((version) => version + 1);
      toast(wodId ? t('Changes saved') : t('Workout Published Successfully'), 'success');
    } catch (error: unknown) {
      toast(`${t('Error saving WOD')}: ${errorText(error)}`, 'error');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const resetForm = () => {
    setWodId(null);
    applyFields(EMPTY_FIELDS);
    setSavedSnapshot(snapshotOf(EMPTY_FIELDS));
    setView('edit');
  };

  const handleDelete = async () => {
    if (!wodId || !tenantId) return;
    setDeleteConfirmOpen(false);
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('wods')
        .delete()
        .eq('id', wodId)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      resetForm();
      setWeekVersion((version) => version + 1);
      toast(t('Workout deleted'), 'success');
    } catch (error: unknown) {
      toast(`${t('Error deleting WOD')}: ${errorText(error)}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const selectDay = (day: Date) => goToDate(format(day, 'yyyy-MM-dd'));
  const goToPrevWeek = () => goToDate(format(subWeeks(selectedDate, 1), 'yyyy-MM-dd'));
  const goToNextWeek = () => goToDate(format(addWeeks(selectedDate, 1), 'yyyy-MM-dd'));
  const goToToday = () => goToDate(gymToday);

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">{t('Daily workouts')}</h1>
          <p className="page-subtitle flex flex-wrap items-center gap-x-2">
            <span>{capitalize(formatDateLong(selectedDate, lang))}</span>
            {wodId ? (
              <span className="inline-flex items-center gap-1 text-pits-positive font-semibold">
                <CheckCircle2 size={14} aria-hidden />
                {t('Published in the app')}
              </span>
            ) : (
              <span className="text-pits-dim">· {t('Not published yet')}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void copyLastWorkout()}
            disabled={copying || loading}
            className="inline-flex items-center gap-2 min-h-10 px-3 rounded-xl border border-pits-edge bg-pits-surface-elevated text-sm font-semibold text-pits-text hover:bg-pits-surface-muted disabled:opacity-50"
          >
            {copying ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
            {t('Copy last workout')}
          </button>
          <button
            type="button"
            onClick={() => setView(view === 'edit' ? 'preview' : 'edit')}
            aria-pressed={view === 'preview'}
            className={`lg:hidden inline-flex items-center gap-2 min-h-10 px-3 rounded-xl border text-sm font-semibold ${
              view === 'preview' ? 'bg-pits-text text-white border-pits-text' : 'bg-pits-surface-elevated border-pits-edge text-pits-text'
            }`}
          >
            <Eye size={16} />
            {t('Preview')}
          </button>
        </div>
      </div>

      {/* WEEK CALENDAR */}
      <div className="bg-pits-surface-elevated p-4 sm:p-5 rounded-2xl border border-pits-edge shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={goToPrevWeek}
            className="p-2 rounded-xl border border-pits-edge text-pits-dim hover:bg-pits-surface-muted hover:text-pits-text transition-all shrink-0"
            aria-label={t('Previous week')}
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center min-w-0">
            <p className="text-[11px] font-black text-pits-dim uppercase tracking-widest">{t('Week of')}</p>
            <p className="text-sm sm:text-base font-black text-pits-text uppercase tracking-tight truncate">
              {weekRangeLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={goToNextWeek}
            className="p-2 rounded-xl border border-pits-edge text-pits-dim hover:bg-pits-surface-muted hover:text-pits-text transition-all shrink-0"
            aria-label={t('Next week')}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weekDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const selected = isSameDay(day, selectedDate);
            const today = dayKey === gymToday;
            const hasWod = scheduledDates.has(dayKey);

            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => selectDay(day)}
                className={`flex flex-col items-center py-2 sm:py-3 px-1 rounded-xl border transition-all
                  ${selected
                    ? 'bg-pits-primary border-pits-primary text-pits-dark-text shadow-lg shadow-pits-primary/20'
                    : today
                      ? 'bg-pits-primary-soft border-pits-red/30 text-pits-text hover:border-pits-red/50'
                      : 'bg-pits-surface-muted border-pits-edge text-pits-text hover:bg-pits-surface-elevated hover:border-pits-edge'
                  }`}
              >
                <span className={`text-[11px] sm:text-[11px] font-black uppercase tracking-wider mb-0.5 sm:mb-1 ${selected ? 'text-pits-dark-text/80' : 'text-pits-dim'}`}>
                  {formatWeekdayShort(day, lang)}
                </span>
                <span className={`text-base sm:text-lg font-black leading-none ${selected ? 'text-pits-dark-text' : 'text-pits-text'}`}>
                  {format(day, 'd')}
                </span>
                <span
                  className={`mt-1 w-1.5 h-1.5 rounded-full ${hasWod ? (selected ? 'bg-pits-surface-elevated' : 'bg-pits-success') : 'bg-transparent'}`}
                  aria-hidden={!hasWod}
                />
              </button>
            );
          })}
        </div>

        {date !== gymToday && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={goToToday}
              className="text-[11px] font-black uppercase tracking-widest text-pits-red hover:text-pits-red-dark transition-colors"
            >
              {t('Jump to today')}
            </button>
          </div>
        )}
      </div>
      
      {loading ? (
        <div className="p-24 flex flex-col items-center justify-center text-pits-dim gap-4">
          <Loader2 size={40} className="animate-spin text-pits-red" />
          <p className="font-bold text-sm uppercase tracking-widest">{t('Loading Whiteboard...')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* MAIN FORM: INPUTS */}
          <div className={`lg:col-span-7 space-y-6 relative ${view === 'preview' ? 'hidden lg:block' : 'block'}`}>
            <div className="space-y-6">

            {/* Title & Score Type Block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-pits-surface-elevated p-6 rounded-2xl border border-pits-edge shadow-sm overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-pits-red"></div>
                <label className="block text-xs font-black text-pits-dim uppercase tracking-widest mb-3">
                  {t('Workout Theme or Naming')}
                </label>
                <input 
                  type="text" 
                  value={title}
                  maxLength={200}
                  
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('WOD title placeholder')}
                  className="w-full p-4 bg-pits-surface-muted border border-pits-edge rounded-xl font-black text-xl text-pits-text focus:bg-pits-surface-elevated focus:border-pits-red outline-none transition-all placeholder:font-normal disabled:cursor-not-allowed"
                />
                <div className="text-right mt-1.5">
                  <span className={`text-[11px] font-bold ${title.length > 180 ? 'text-pits-error' : 'text-pits-dim'}`}>
                    {200 - title.length}
                  </span>
                </div>
              </div>

              <div className="bg-pits-surface-elevated p-6 rounded-2xl border border-pits-edge shadow-sm overflow-hidden relative">
                <label className="block text-xs font-black text-pits-dim uppercase tracking-widest mb-3">
                  {t('Score Type')}
                </label>
                <select 
                  value={scoreType}
                  
                  onChange={(e) => setScoreType(e.target.value)}
                  className="w-full p-4 bg-pits-surface-muted border border-pits-edge rounded-xl font-black text-xl text-pits-text focus:bg-pits-surface-elevated focus:border-pits-red outline-none transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  <option value="none">{t('None')}</option>
                  <option value="amrap">AMRAP</option>
                  <option value="for_time">{t('For Time')}</option>
                  <option value="emom">EMOM</option>
                </select>
              </div>
            </div>

            {/* Warm Up Section */}
            <Section 
              label={t('1. Preparation (Warm-up)')} 
              color="bg-pits-primary" 
              icon={<Sparkles size={16} />}
              value={warmUp} 
              onChange={setWarmUp}
              
              placeholder={t('Warm up placeholder')}
            />

            {/* Technique Section */}
            <div className="bg-pits-surface-elevated p-6 rounded-2xl border border-pits-edge shadow-sm relative group overflow-visible">
              <div className="flex items-center justify-between mb-4 gap-3">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-pits-primary-soft text-pits-primary rounded-lg flex items-center justify-center mr-3">
                    <Zap size={16} />
                  </div>
                  <label className="text-sm font-black text-pits-text uppercase tracking-widest">
                    {t('2. Focus (Technique)')}
                  </label>
                </div>
                <Link
                  href="/dashboard/personal_records"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-pits-primary hover:text-pits-red transition-colors shrink-0"
                >
                  {t('Personal Records')}
                  <MoveRight size={14} />
                </Link>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-pits-dim" size={18} />
                <input 
                  type="text"
                  
                  value={techniqueDropdownOpen ? techniqueSearch : technique}
                  onChange={(e) => {
                    setTechniqueSearch(e.target.value);
                    setTechniqueDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setTechniqueSearch('');
                    setTechniqueDropdownOpen(true);
                    void loadMovements();
                  }}
                  onBlur={() => setTimeout(() => setTechniqueDropdownOpen(false), 200)}
                  placeholder={t('Skill focus placeholder')}
                  className="w-full pl-11 pr-4 py-4 bg-pits-surface-muted border border-pits-edge rounded-xl text-sm font-bold text-pits-text focus:bg-pits-surface-elevated focus:border-pits-red outline-none transition-all placeholder:font-normal disabled:cursor-not-allowed"
                />
              </div>

              {techniqueDropdownOpen && (
                <div className="absolute z-50 left-6 right-6 mt-2 bg-pits-surface-elevated border border-pits-edge rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                  {(() => {
                    const filtered = prMovements.filter((tech) =>
                      tech.toLowerCase().includes(techniqueSearch.toLowerCase()),
                    );
                    if (filtered.length === 0) {
                      return (
                        <div className="p-4 text-center text-xs text-pits-dim">
                          {t('No match found')}
                        </div>
                      );
                    }
                    return filtered.map((tech) => (
                      <div
                        key={tech}
                        className="px-5 py-3 hover:bg-pits-surface-muted cursor-pointer text-sm font-bold text-pits-text transition-colors border-b border-pits-edge last:border-0 flex items-center justify-between group/item"
                        onClick={() => {
                          setTechnique(tech);
                          setTechniqueDropdownOpen(false);
                        }}
                      >
                        {tech}
                        <MoveRight size={14} className="opacity-0 group-hover/item:opacity-100 text-pits-primary" />
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* Strength Section */}
            <Section 
              label={t('3. Build (Strength / Skill)')} 
              color="bg-pits-primary" 
              icon={<Dumbbell size={16} />}
              value={strength} 
              onChange={setStrength}
              
              placeholder={t('Strength placeholder')}
            />

            {/* Metcon Section */}
            <Section 
              label={t('4. Perform (The Metcon)')} 
              color="bg-pits-red" 
              icon={<Zap size={16} />}
              value={metcon} 
              onChange={setMetcon}
              
              rows={8}
              placeholder={t('Metcon placeholder')}
            />

            {/* Stimulus & Scaling */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="bg-pits-surface-elevated p-6 rounded-2xl border border-pits-edge shadow-sm">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-pits-primary-soft text-pits-success rounded-lg flex items-center justify-center mr-3">
                    <Sparkles size={16} />
                  </div>
                  <label className="text-xs font-black text-pits-text uppercase tracking-widest">{t('Intended Stimulus')}</label>
                </div>
                <textarea 
                  value={stimulus}
                  
                  onChange={(e) => setStimulus(e.target.value)}
                  rows={3}
                  placeholder={t('Stimulus placeholder')}
                  className="w-full p-4 bg-pits-surface-muted border border-pits-edge rounded-xl text-sm font-bold focus:bg-pits-surface-elevated focus:border-pits-red outline-none resize-none transition-all placeholder:text-pits-dim placeholder:font-normal disabled:cursor-not-allowed"
                />
              </div>
              <div className="bg-pits-surface-elevated p-6 rounded-2xl border border-pits-edge shadow-sm">
                <div className="flex items-center mb-1">
                  <div className="w-8 h-8 bg-pits-surface-muted text-pits-text rounded-lg flex items-center justify-center mr-3">
                    <Scale size={16} />
                  </div>
                  <label className="text-xs font-black text-pits-text uppercase tracking-widest">{t('Scaling & Notes')}</label>
                </div>
                <p className="text-[11px] font-medium text-pits-dim mb-3 ml-11">
                  {t('Notes are only visible to coaches')}
                </p>
                <textarea 
                  value={scaling}
                  
                  onChange={(e) => setScaling(e.target.value)}
                  rows={3}
                  placeholder={t('Scaling placeholder')}
                  className="w-full p-4 bg-pits-surface-muted border border-pits-edge rounded-xl text-sm font-bold focus:bg-pits-surface-elevated focus:border-pits-edge0 outline-none resize-none transition-all placeholder:text-pits-dim placeholder:font-normal disabled:cursor-not-allowed"
                />
              </div>
            </div>

            </div>
          </div>

          {/* PREVIEW & ACTIONS PANEL */}
          <div className="lg:col-span-5 space-y-6 sticky top-6">
            
            {/* Live Mobile Preview */}
            <div className={`bg-gray-900 rounded-[2.5rem] p-4 border-[8px] border-gray-800 shadow-2xl relative transition-all duration-500 ${view === 'preview' ? 'scale-100' : 'scale-95 opacity-80'}`}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-pits-surface-muted rounded-b-2xl z-10 flex items-center justify-center">
                 <div className="w-10 h-1 bg-gray-700 rounded-full"></div>
              </div>
              
              <div className="bg-pits-surface-elevated rounded-[1.8rem] h-[600px] overflow-hidden relative flex flex-col pt-8">
                {/* Simulated In-App Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  <div className="uppercase font-black text-2xl italic tracking-tighter text-pits-text leading-none">
                    {title || t("TODAY'S WORKOUT")}
                  </div>
                  <div className="text-[11px] font-bold text-pits-dim tracking-widest uppercase">
                    {capitalize(formatDateLong(selectedDate, lang))}
                  </div>

                  {/* Reactive Blocks */}
                  {warmUp && <PreviewBlock label={t('Prep')} color="border-pits-primary" content={warmUp} />}
                  {technique && <PreviewBlock label={t('Focus')} color="border-pits-primary" content={technique} />}
                  {strength && <PreviewBlock label={t('Strength')} color="border-pits-primary" content={strength} />}
                  {metcon && <PreviewBlock label={t('Metcon')} color="border-pits-red" content={metcon} />}
                  {(stimulus || scaling) && (
                    <div className="bg-pits-primary-soft p-4 rounded-xl border border-pits-edge">
                       <div className="text-[11px] font-black text-pits-success uppercase mb-1">{t('Stimulus & Scaling')}</div>
                       <p className="text-[11px] font-bold text-pits-success leading-relaxed whitespace-pre-line">
                         {stimulus ? `💡 ${stimulus}\n` : ''}
                         {scaling ? `⚖️ ${scaling}` : ''}
                       </p>
                    </div>
                  )}
                  
                  {!warmUp && !metcon && !strength && (
                    <div className="flex flex-col items-center justify-center h-48 text-pits-dim">
                       <div className="w-12 h-12 bg-pits-surface-muted rounded-full flex items-center justify-center mb-3">
                         <Dumbbell size={24} className="opacity-20" />
                       </div>
                       <p className="text-xs font-bold uppercase tracking-widest">{t('Workout is empty')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Save Action */}
            <div className="bg-pits-surface-elevated p-4 sm:p-5 rounded-2xl border border-pits-edge shadow-sm max-lg:sticky max-lg:bottom-3 max-lg:z-20">
              {dirty ? (
                <p className="mb-2 text-xs font-semibold text-pits-warning text-center">{t('Unsaved changes')}</p>
              ) : null}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading || deleting || (!!wodId && !dirty)}
                className="w-full min-h-12 rounded-xl flex items-center justify-center gap-2 bg-pits-primary text-pits-dark-text text-sm font-semibold hover:bg-pits-primary-dark disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {saving ? t('Publishing...') : wodId ? (dirty ? t('Save Changes') : t('Saved')) : t('Publish to App')}
              </button>

              {wodId && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={deleting || saving}
                  className="w-full mt-2 min-h-10 rounded-xl flex items-center justify-center gap-2 text-pits-danger text-sm font-semibold hover:bg-pits-danger-soft disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  {deleting ? t('Deleting...') : t('Delete workout btn')}
                </button>
              )}

            </div>

          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!pendingDate}
        title={t('Unsaved changes')}
        message={t('Leave this day without saving? Your changes will be lost.')}
        confirmLabel={t('Discard changes')}
        cancelLabel={t('Keep editing')}
        variant="warning"
        onConfirm={() => {
          if (pendingDate) setDate(pendingDate);
          setPendingDate(null);
        }}
        onCancel={() => setPendingDate(null)}
      />

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title={t('Delete workout title')}
        message={t('Delete workout dated message', { date: formatDateLong(selectedDate, lang) })}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}

const EMPTY_FIELDS: WodFields = {
  title: '',
  warmUp: '',
  technique: '',
  strength: '',
  metcon: '',
  scaling: '',
  stimulus: '',
  scoreType: 'none',
};

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

// UI HELPER COMPONENTS
function Section({ label, color, icon, value, onChange, placeholder, rows = 4, disabled = false }: {
  label: string;
  color: string;
  icon: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <div className="bg-pits-surface-elevated p-6 rounded-2xl border border-pits-edge shadow-sm transition-all hover:border-gray-300">
      <div className="flex items-center mb-4">
        <div className={`w-8 h-8 ${color} text-pits-dark-text rounded-lg flex items-center justify-center mr-3 shadow-sm`}>
          {icon}
        </div>
        <label className="text-sm font-black text-pits-text uppercase tracking-widest">
          {label}
        </label>
      </div>
      <textarea 
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full p-4 bg-pits-surface-muted border border-pits-edge rounded-xl text-sm font-bold text-pits-text focus:bg-pits-surface-elevated focus:border-gray-400 outline-none resize-none transition-all placeholder:text-pits-dim placeholder:font-normal font-mono disabled:cursor-not-allowed"
      />
    </div>
  );
}

function PreviewBlock({ label, color, content }: { label: string, color: string, content: string }) {
  return (
    <div className={`border-l-4 ${color} pl-4 py-1`}>
      <div className="text-[11px] font-black uppercase text-pits-dim mb-1 tracking-widest">{label}</div>
      <p className="text-[12px] font-bold text-pits-text leading-snug whitespace-pre-line">
        {content}
      </p>
    </div>
  );
}
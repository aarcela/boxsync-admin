'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { supabase } from '../../../lib/supabase';
import { UNIQUE_TECHNIQUES } from '../../../lib/techniques';
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfWeek,
  subWeeks,
} from 'date-fns';
import { 
  Calendar, Save, Loader2, Dumbbell, Search, 
  Eye, Zap, Scale, Sparkles, MoveRight, Lock, Pencil, Trash2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useToast } from '../../../components/Toast';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { useLanguage } from '../../../components/LanguageContext';

export default function WodEditorPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [isLocked, setIsLocked] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
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

  const [scheduledDates, setScheduledDates] = useState<Set<string>>(new Set());

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
    const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
    if (sameMonth) {
      return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'd, yyyy')}`;
    }
    return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;
  }, [weekStart]);

  useEffect(() => {
    const fetchWeekWods = async () => {
      const start = format(weekStart, 'yyyy-MM-dd');
      const end = format(addDays(weekStart, 6), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('wods')
        .select('date')
        .gte('date', start)
        .lte('date', end);
      if (data) {
        setScheduledDates(new Set(data.map((row) => row.date as string)));
      }
    };
    fetchWeekWods();
  }, [weekStart, loading, wodId]);

  // Fetch WOD for selected date
  useEffect(() => {
    const fetchWod = async () => {
      setLoading(true);
      setWodId(null);
      setTitle('');
      setWarmUp('');
      setTechnique('');
      setStrength('');
      setMetcon('');
      setScaling('');
      setStimulus('');
      setScoreType('none');
      setIsLocked(false);

      try {
        const { data } = await supabase
          .from('wods')
          .select('*')
          .eq('date', date)
          .single();

        if (data) {
          setWodId(data.id);
          setTitle(data.title || '');
          setScoreType(data.score_type || 'none');
          setIsLocked(true);
          setView('preview');

          try {
            const contentObj = JSON.parse(data.content);
            setWarmUp(contentObj.warm_up || '');
            setTechnique(contentObj.technique || '');
            setStrength(contentObj.strength || '');
            setMetcon(contentObj.metcon || '');
            setScaling(contentObj.scaling || '');
            setStimulus(contentObj.stimulus || ''); 
          } catch (e) {
            console.error('Error parsing WOD content:', e);
          }
        }
      } catch (error) {
        // No WOD found
      } finally {
        setLoading(false);
      }
    };

    fetchWod();
  }, [date]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const contentJson = JSON.stringify({
        warm_up: warmUp,
        technique,
        strength,
        metcon,
        scaling,
        stimulus, // Save strategic stimulus
      });

      const payload = {
        date,
        title: title || 'Daily WOD',
        content: contentJson,
        score_type: scoreType
      };

      if (wodId) {
        const { error } = await supabase
          .from('wods')
          .update(payload)
          .eq('id', wodId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('wods')
          .insert(payload);
        if (error) throw error;
        // Refresh to get the new ID
        const { data } = await supabase.from('wods').select('id').eq('date', date).single();
        if (data) setWodId(data.id);
      }

      toast(t('Workout Published Successfully'), 'success');
      setView('preview');
      setIsLocked(true);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast(`${t('Error saving WOD')}: ${errorMessage}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const requestUnlock = () => setEditConfirmOpen(true);

  const handleConfirmEdit = () => {
    setEditConfirmOpen(false);
    setIsLocked(false);
    setView('edit');
  };

  const resetForm = () => {
    setWodId(null);
    setTitle('');
    setWarmUp('');
    setTechnique('');
    setStrength('');
    setMetcon('');
    setScaling('');
    setStimulus('');
    setScoreType('none');
    setIsLocked(false);
    setView('edit');
  };

  const handleDelete = async () => {
    if (!wodId) return;
    setDeleteConfirmOpen(false);
    setDeleting(true);
    try {
      const { error } = await supabase.from('wods').delete().eq('id', wodId);
      if (error) throw error;
      resetForm();
      toast(t('Workout deleted'), 'success');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast(`${t('Error deleting WOD')}: ${errorMessage}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const selectDay = (day: Date) => setDate(format(day, 'yyyy-MM-dd'));
  const goToPrevWeek = () => setDate(format(subWeeks(selectedDate, 1), 'yyyy-MM-dd'));
  const goToNextWeek = () => setDate(format(addWeeks(selectedDate, 1), 'yyyy-MM-dd'));
  const goToToday = () => setDate(format(new Date(), 'yyyy-MM-dd'));

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">

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
            <p className="text-[10px] font-black text-pits-dim uppercase tracking-widest">{t('Week of')}</p>
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
            const today = isToday(day);
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
                <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider mb-0.5 sm:mb-1 ${selected ? 'text-pits-dark-text/80' : 'text-pits-dim'}`}>
                  {format(day, 'EEE')}
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

        {!isToday(selectedDate) && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={goToToday}
              className="text-[10px] font-black uppercase tracking-widest text-pits-red hover:text-pits-red-dark transition-colors"
            >
              {t('Jump to today')}
            </button>
          </div>
        )}
      </div>
      
      {/* HEADER & DATE PICKER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-pits-surface-elevated p-6 rounded-2xl border border-pits-edge shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-pits-red rounded-xl flex items-center justify-center text-pits-dark-text">
            <Dumbbell className="text-pits-dark-text" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-pits-text-main uppercase italic tracking-tighter">
              {t('Programming Center')}
            </h2>
            <p className="text-pits-dim font-medium text-xs flex items-center">
              <Calendar size={12} className="mr-1" />
              {t('Assigning workout for {{date}}', { date: new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) })}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <div className="relative">
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-4 pr-10 py-3 bg-pits-surface-muted border border-pits-edge rounded-xl font-bold text-pits-text focus:ring-2 focus:ring-pits-red/20 focus:border-pits-red outline-none shadow-sm transition-all"
            />
          </div>
          <button 
            onClick={() => setView(view === 'edit' ? 'preview' : 'edit')}
            className={`p-3 rounded-xl border transition-all ${view === 'preview' ? 'bg-pits-panel text-pits-text' : 'bg-pits-surface-elevated text-pits-dim hover:bg-pits-surface-muted'}`}
            title={t('Toggle Preview')}
          >
            <Eye size={20} />
          </button>
        </div>
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
            {isLocked && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-pits-primary-soft border border-pits-edge rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-pits-primary-soft text-pits-primary rounded-xl flex items-center justify-center">
                    <Lock size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-pits-text uppercase tracking-wide">{t('Workout published')}</p>
                    <p className="text-xs text-pits-success font-medium">{t('Workout published lock message')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={requestUnlock}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-pits-surface-elevated border border-pits-edge text-pits-success rounded-xl font-black text-xs uppercase tracking-widest hover:bg-pits-primary-soft transition-all shrink-0"
                >
                  <Pencil size={14} />
                  {t('Edit workout')}
                </button>
              </div>
            )}

            <div
              className={`space-y-6 ${isLocked ? 'pointer-events-none opacity-60 select-none' : ''}`}
              onClick={isLocked ? requestUnlock : undefined}
              role={isLocked ? 'button' : undefined}
              tabIndex={isLocked ? 0 : undefined}
              onKeyDown={isLocked ? (e) => { if (e.key === 'Enter' || e.key === ' ') requestUnlock(); } : undefined}
              aria-label={isLocked ? t('Published workout click to edit') : undefined}
            >
            
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
                  disabled={isLocked}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('WOD title placeholder')}
                  className="w-full p-4 bg-pits-surface-muted border border-pits-edge rounded-xl font-black text-xl text-pits-text focus:bg-pits-surface-elevated focus:border-pits-red outline-none transition-all disabled:cursor-not-allowed"
                />
                <div className="text-right mt-1.5">
                  <span className={`text-[10px] font-bold ${title.length > 180 ? 'text-pits-error' : 'text-pits-dim'}`}>
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
                  disabled={isLocked}
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
              disabled={isLocked}
              placeholder={t('Warm up placeholder')}
            />

            {/* Technique Section */}
            <div className="bg-pits-surface-elevated p-6 rounded-2xl border border-pits-edge shadow-sm relative group overflow-visible">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-pits-primary-soft text-pits-primary rounded-lg flex items-center justify-center mr-3">
                    <Zap size={16} />
                  </div>
                  <label className="text-sm font-black text-pits-text uppercase tracking-widest">
                    {t('2. Focus (Technique)')}
                  </label>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-pits-dim" size={18} />
                <input 
                  type="text"
                  disabled={isLocked}
                  value={techniqueDropdownOpen ? techniqueSearch : technique}
                  onChange={(e) => {
                    setTechniqueSearch(e.target.value);
                    setTechniqueDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (isLocked) return;
                    setTechniqueSearch('');
                    setTechniqueDropdownOpen(true);
                  }}
                  onBlur={() => setTimeout(() => setTechniqueDropdownOpen(false), 200)}
                  placeholder={t('Skill focus placeholder')}
                  className="w-full pl-11 pr-4 py-4 bg-pits-surface-muted border border-pits-edge rounded-xl text-sm font-bold text-pits-text focus:bg-pits-surface-elevated focus:border-pits-red outline-none transition-all disabled:cursor-not-allowed"
                />
              </div>

              {techniqueDropdownOpen && (
                <div className="absolute z-50 left-6 right-6 mt-2 bg-pits-surface-elevated border border-pits-edge rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                  {UNIQUE_TECHNIQUES.filter(tech => tech.toLowerCase().includes(techniqueSearch.toLowerCase())).map((tech) => (
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
                  )) || (
                    <div className="p-4 text-center text-xs text-pits-dim">{t('No match found')}</div>
                  )}
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
              disabled={isLocked}
              placeholder={t('Strength placeholder')}
            />

            {/* Metcon Section */}
            <Section 
              label={t('4. Perform (The Metcon)')} 
              color="bg-pits-red" 
              icon={<Zap size={16} />}
              value={metcon} 
              onChange={setMetcon}
              disabled={isLocked}
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
                  disabled={isLocked}
                  onChange={(e) => setStimulus(e.target.value)}
                  rows={3}
                  placeholder={t('Stimulus placeholder')}
                  className="w-full p-4 bg-pits-surface-muted border border-pits-edge rounded-xl text-sm font-bold focus:bg-pits-surface-elevated focus:border-pits-red outline-none resize-none transition-all placeholder:text-pits-dim disabled:cursor-not-allowed"
                />
              </div>
              <div className="bg-pits-surface-elevated p-6 rounded-2xl border border-pits-edge shadow-sm">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-pits-surface-muted text-pits-text rounded-lg flex items-center justify-center mr-3">
                    <Scale size={16} />
                  </div>
                  <label className="text-xs font-black text-pits-text uppercase tracking-widest">{t('Scaling & Notes')}</label>
                </div>
                <textarea 
                  value={scaling}
                  disabled={isLocked}
                  onChange={(e) => setScaling(e.target.value)}
                  rows={3}
                  placeholder={t('Scaling placeholder')}
                  className="w-full p-4 bg-pits-surface-muted border border-pits-edge rounded-xl text-sm font-bold focus:bg-pits-surface-elevated focus:border-pits-edge0 outline-none resize-none transition-all placeholder:text-pits-dim disabled:cursor-not-allowed"
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
                  <div className="text-[10px] font-bold text-pits-dim tracking-widest uppercase">
                    {new Date(date).toDateString()}
                  </div>

                  {/* Reactive Blocks */}
                  {warmUp && <PreviewBlock label={t('Prep')} color="border-pits-primary" content={warmUp} />}
                  {technique && <PreviewBlock label={t('Focus')} color="border-pits-primary" content={technique} />}
                  {strength && <PreviewBlock label={t('Strength')} color="border-pits-primary" content={strength} />}
                  {metcon && <PreviewBlock label={t('Metcon')} color="border-pits-red" content={metcon} />}
                  {(stimulus || scaling) && (
                    <div className="bg-pits-primary-soft p-4 rounded-xl border border-pits-edge">
                       <div className="text-[9px] font-black text-pits-success uppercase mb-1">{t('Stimulus & Scaling')}</div>
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

                <div className="p-4 border-t border-pits-edge bg-pits-surface-muted text-center">
                   <p className="text-[10px] text-pits-dim font-bold uppercase tracking-widest">{t('Athlete Mobile View')}</p>
                </div>
              </div>
            </div>
            
            {/* Save Action */}
            <div className="bg-pits-surface-elevated p-6 rounded-2xl border border-pits-edge shadow-sm">
              <button
                onClick={isLocked ? requestUnlock : handleSave}
                disabled={saving}
                className={`w-full py-4 rounded-xl flex items-center justify-center font-black uppercase tracking-widest text-sm shadow-xl transition-all
                  ${saving ? 'bg-pits-dim text-pits-dark-text cursor-not-allowed' : isLocked ? 'bg-pits-success hover:opacity-90 text-pits-dark-text shadow-pits-primary/20' : 'bg-pits-primary text-pits-dark-text hover:bg-pits-primary-dark hover:scale-[1.02] active:scale-[0.98] shadow-pits-primary/20'}
                `}
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin mr-2" />
                ) : isLocked ? (
                  <Pencil size={18} className="mr-2" />
                ) : (
                  <Save size={18} className="mr-2" />
                )}
                {saving ? t('Publishing...') : isLocked ? t('Edit published workout btn') : t('Publish to PITS App')}
              </button>

              {wodId && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={deleting || saving}
                  className="w-full mt-3 py-3 rounded-xl flex items-center justify-center gap-2 border border-pits-edge text-pits-error font-black uppercase tracking-widest text-xs hover:bg-pits-primary-soft transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  {deleting ? t('Deleting...') : t('Delete workout btn')}
                </button>
              )}

              <div className="mt-4 flex items-center justify-between px-2">
                 <div className="flex items-center gap-1.5 opacity-40">
                   <div className="w-2 h-2 bg-pits-success rounded-full animate-pulse"></div>
                   <span className="text-[10px] font-bold uppercase tracking-wider text-pits-text">{t('Connected')}</span>
                 </div>
                 <p className="text-[10px] text-pits-dim font-bold uppercase text-right">
                   {t('Auto-scales for iOS/Android')}
                 </p>
              </div>
            </div>

          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={editConfirmOpen}
        title={t('Edit published workout title')}
        message={t('Edit published workout message')}
        confirmLabel={t('Yes, edit')}
        cancelLabel={t('Keep locked')}
        variant="warning"
        onConfirm={handleConfirmEdit}
        onCancel={() => setEditConfirmOpen(false)}
      />

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title={t('Delete workout title')}
        message={t('Delete workout dated message', { date: new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) })}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
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
        className="w-full p-4 bg-pits-surface-muted border border-pits-edge rounded-xl text-sm font-bold text-pits-text focus:bg-pits-surface-elevated focus:border-gray-400 outline-none resize-none transition-all placeholder:text-pits-dim font-mono disabled:cursor-not-allowed"
      />
    </div>
  );
}

function PreviewBlock({ label, color, content }: { label: string, color: string, content: string }) {
  return (
    <div className={`border-l-4 ${color} pl-4 py-1`}>
      <div className="text-[9px] font-black uppercase text-pits-dim mb-1 tracking-widest">{label}</div>
      <p className="text-[12px] font-bold text-pits-text leading-snug whitespace-pre-line">
        {content}
      </p>
    </div>
  );
}
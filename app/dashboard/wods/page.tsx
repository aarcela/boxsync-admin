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

export default function WodEditorPage() {
  const { toast } = useToast();
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

      toast('Workout Published Successfully', 'success');
      setView('preview');
      setIsLocked(true);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast('Error saving WOD: ' + errorMessage, 'error');
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
      toast('Workout deleted', 'success');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast('Error deleting WOD: ' + errorMessage, 'error');
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
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={goToPrevWeek}
            className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-pits-text transition-all shrink-0"
            aria-label="Previous week"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center min-w-0">
            <p className="text-[10px] font-black text-pits-dim uppercase tracking-widest">Week of</p>
            <p className="text-sm sm:text-base font-black text-pits-text uppercase tracking-tight truncate">
              {weekRangeLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={goToNextWeek}
            className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-pits-text transition-all shrink-0"
            aria-label="Next week"
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
                    ? 'bg-pits-red border-pits-red text-white shadow-lg shadow-red-100'
                    : today
                      ? 'bg-red-50 border-pits-red/30 text-pits-text hover:border-pits-red/50'
                      : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-white hover:border-gray-200'
                  }`}
              >
                <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider mb-0.5 sm:mb-1 ${selected ? 'text-white/80' : 'text-gray-400'}`}>
                  {format(day, 'EEE')}
                </span>
                <span className={`text-base sm:text-lg font-black leading-none ${selected ? 'text-white' : 'text-pits-text'}`}>
                  {format(day, 'd')}
                </span>
                <span
                  className={`mt-1 w-1.5 h-1.5 rounded-full ${hasWod ? (selected ? 'bg-white' : 'bg-emerald-500') : 'bg-transparent'}`}
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
              Jump to today
            </button>
          </div>
        )}
      </div>
      
      {/* HEADER & DATE PICKER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-pits-red rounded-xl flex items-center justify-center shadow-lg shadow-red-100">
            <Dumbbell className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-pits-text uppercase italic tracking-tighter">
              Programming Center
            </h2>
            <p className="text-pits-dim font-medium text-xs flex items-center">
              <Calendar size={12} className="mr-1" />
              Assigning workout for {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <div className="relative">
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 focus:ring-2 focus:ring-pits-red/20 focus:border-pits-red outline-none shadow-sm transition-all"
            />
          </div>
          <button 
            onClick={() => setView(view === 'edit' ? 'preview' : 'edit')}
            className={`p-3 rounded-xl border transition-all ${view === 'preview' ? 'bg-pits-panel text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            title="Toggle Preview"
          >
            <Eye size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-24 flex flex-col items-center justify-center text-gray-400 gap-4">
          <Loader2 size={40} className="animate-spin text-pits-red" />
          <p className="font-bold text-sm uppercase tracking-widest">Loading Whiteboard...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* MAIN FORM: INPUTS */}
          <div className={`lg:col-span-7 space-y-6 relative ${view === 'preview' ? 'hidden lg:block' : 'block'}`}>
            {isLocked && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
                    <Lock size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-emerald-900 uppercase tracking-wide">Workout published</p>
                    <p className="text-xs text-emerald-700 font-medium">Editing is locked to avoid accidental changes.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={requestUnlock}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-emerald-200 text-emerald-800 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-100 transition-all shrink-0"
                >
                  <Pencil size={14} />
                  Edit workout
                </button>
              </div>
            )}

            <div
              className={`space-y-6 ${isLocked ? 'pointer-events-none opacity-60 select-none' : ''}`}
              onClick={isLocked ? requestUnlock : undefined}
              role={isLocked ? 'button' : undefined}
              tabIndex={isLocked ? 0 : undefined}
              onKeyDown={isLocked ? (e) => { if (e.key === 'Enter' || e.key === ' ') requestUnlock(); } : undefined}
              aria-label={isLocked ? 'Published workout — click to edit' : undefined}
            >
            
            {/* Title & Score Type Block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-pits-red"></div>
                <label className="block text-xs font-black text-pits-dim uppercase tracking-widest mb-3">
                  Workout Theme or Naming
                </label>
                <input 
                  type="text" 
                  value={title}
                  maxLength={200}
                  disabled={isLocked}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 'Stronger Together' or 'Engine Builder'"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-black text-xl text-pits-text focus:bg-white focus:border-pits-red outline-none transition-all disabled:cursor-not-allowed"
                />
                <div className="text-right mt-1.5">
                  <span className={`text-[10px] font-bold ${title.length > 180 ? 'text-red-500' : 'text-gray-400'}`}>
                    {200 - title.length}
                  </span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">
                <label className="block text-xs font-black text-pits-dim uppercase tracking-widest mb-3">
                  Score Type
                </label>
                <select 
                  value={scoreType}
                  disabled={isLocked}
                  onChange={(e) => setScoreType(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-black text-xl text-pits-text focus:bg-white focus:border-pits-red outline-none transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  <option value="none">None</option>
                  <option value="amrap">AMRAP</option>
                  <option value="for_time">For Time</option>
                  <option value="emom">EMOM</option>
                </select>
              </div>
            </div>

            {/* Warm Up Section */}
            <Section 
              label="1. Preparation (Warm-up)" 
              color="bg-orange-500" 
              icon={<Sparkles size={16} />}
              value={warmUp} 
              onChange={setWarmUp}
              disabled={isLocked}
              placeholder="Elevate heart rate & prep specific joints...\n3 Rounds:\n- 10 Empty Bar Cleans\n- 10 Scaps Pull"
            />

            {/* Technique Section */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative group overflow-visible">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mr-3">
                    <Zap size={16} />
                  </div>
                  <label className="text-sm font-black text-pits-text uppercase tracking-widest">
                    2. Focus (Technique)
                  </label>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
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
                  placeholder="Select primary skill focus..."
                  className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-pits-text focus:bg-white focus:border-purple-600 outline-none transition-all disabled:cursor-not-allowed"
                />
              </div>

              {techniqueDropdownOpen && (
                <div className="absolute z-50 left-6 right-6 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                  {UNIQUE_TECHNIQUES.filter(t => t.toLowerCase().includes(techniqueSearch.toLowerCase())).map((t) => (
                    <div 
                      key={t}
                      className="px-5 py-3 hover:bg-purple-50 cursor-pointer text-sm font-bold text-gray-700 transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between group/item"
                      onClick={() => {
                        setTechnique(t);
                        setTechniqueDropdownOpen(false);
                      }}
                    >
                      {t}
                      <MoveRight size={14} className="opacity-0 group-hover/item:opacity-100 text-purple-400" />
                    </div>
                  )) || (
                    <div className="p-4 text-center text-xs text-gray-400">No match found</div>
                  )}
                </div>
              )}
            </div>

            {/* Strength Section */}
            <Section 
              label="3. Build (Strength / Skill)" 
              color="bg-blue-600" 
              icon={<Dumbbell size={16} />}
              value={strength} 
              onChange={setStrength}
              disabled={isLocked}
              placeholder="Specify sets, reps and load intensity...\n5x3 Back Squats @ 80-85%\nRest 2:00 between sets."
            />

            {/* Metcon Section */}
            <Section 
              label="4. Perform (The Metcon)" 
              color="bg-pits-red" 
              icon={<Zap size={16} />}
              value={metcon} 
              onChange={setMetcon}
              disabled={isLocked}
              rows={8}
              placeholder="Describe the workout heart...\nAMRAP 15:\n- 10 Box Jumps\n- 10 Power Snatches (95/65)"
            />

            {/* Stimulus & Scaling */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mr-3">
                    <Sparkles size={16} />
                  </div>
                  <label className="text-xs font-black text-pits-text uppercase tracking-widest">Intended Stimulus</label>
                </div>
                <textarea 
                  value={stimulus}
                  disabled={isLocked}
                  onChange={(e) => setStimulus(e.target.value)}
                  rows={3}
                  placeholder="e.g. 'Fast & Unbroken. Heart rate 90%+'"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:bg-white focus:border-emerald-500 outline-none resize-none transition-all placeholder:text-gray-300 disabled:cursor-not-allowed"
                />
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center mr-3">
                    <Scale size={16} />
                  </div>
                  <label className="text-xs font-black text-pits-text uppercase tracking-widest">Scaling & Notes</label>
                </div>
                <textarea 
                  value={scaling}
                  disabled={isLocked}
                  onChange={(e) => setScaling(e.target.value)}
                  rows={3}
                  placeholder="e.g. 'Scale Pull-ups to Ring Rows...'"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:bg-white focus:border-slate-500 outline-none resize-none transition-all placeholder:text-gray-300 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            </div>
          </div>

          {/* PREVIEW & ACTIONS PANEL */}
          <div className="lg:col-span-5 space-y-6 sticky top-6">
            
            {/* Live Mobile Preview */}
            <div className={`bg-gray-900 rounded-[2.5rem] p-4 border-[8px] border-gray-800 shadow-2xl relative transition-all duration-500 ${view === 'preview' ? 'scale-100' : 'scale-95 opacity-80'}`}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-2xl z-10 flex items-center justify-center">
                 <div className="w-10 h-1 bg-gray-700 rounded-full"></div>
              </div>
              
              <div className="bg-white rounded-[1.8rem] h-[600px] overflow-hidden relative flex flex-col pt-8">
                {/* Simulated In-App Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  <div className="uppercase font-black text-2xl italic tracking-tighter text-pits-text leading-none">
                    {title || 'TODAY\'S WORKOUT'}
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
                    {new Date(date).toDateString()}
                  </div>

                  {/* Reactive Blocks */}
                  {warmUp && <PreviewBlock label="Prep" color="border-orange-500" content={warmUp} />}
                  {technique && <PreviewBlock label="Focus" color="border-purple-600" content={technique} />}
                  {strength && <PreviewBlock label="Strength" color="border-blue-600" content={strength} />}
                  {metcon && <PreviewBlock label="Metcon" color="border-pits-red" content={metcon} />}
                  {(stimulus || scaling) && (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                       <div className="text-[9px] font-black text-emerald-600 uppercase mb-1">Stimulus & Scaling</div>
                       <p className="text-[11px] font-bold text-emerald-800 leading-relaxed whitespace-pre-line">
                         {stimulus ? `💡 ${stimulus}\n` : ''}
                         {scaling ? `⚖️ ${scaling}` : ''}
                       </p>
                    </div>
                  )}
                  
                  {!warmUp && !metcon && !strength && (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-300">
                       <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                         <Dumbbell size={24} className="opacity-20" />
                       </div>
                       <p className="text-xs font-bold uppercase tracking-widest">Workout is empty</p>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
                   <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Athlete Mobile View</p>
                </div>
              </div>
            </div>
            
            {/* Save Action */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <button
                onClick={isLocked ? requestUnlock : handleSave}
                disabled={saving}
                className={`w-full py-4 rounded-xl flex items-center justify-center text-white font-black uppercase tracking-widest text-sm shadow-xl transition-all
                  ${saving ? 'bg-gray-400 cursor-not-allowed' : isLocked ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : 'bg-pits-red hover:bg-pits-red-dark hover:scale-[1.02] active:scale-[0.98] shadow-red-100'}
                `}
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin mr-2" />
                ) : isLocked ? (
                  <Pencil size={18} className="mr-2" />
                ) : (
                  <Save size={18} className="mr-2" />
                )}
                {saving ? 'Publishing...' : isLocked ? 'Edit published workout' : 'Publish to PITS App'}
              </button>

              {wodId && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={deleting || saving}
                  className="w-full mt-3 py-3 rounded-xl flex items-center justify-center gap-2 border border-red-200 text-red-600 font-black uppercase tracking-widest text-xs hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  {deleting ? 'Deleting...' : 'Delete workout'}
                </button>
              )}

              <div className="mt-4 flex items-center justify-between px-2">
                 <div className="flex items-center gap-1.5 opacity-40">
                   <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                   <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">Connected</span>
                 </div>
                 <p className="text-[10px] text-gray-400 font-bold uppercase text-right">
                   Auto-scales for iOS/Android
                 </p>
              </div>
            </div>

          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={editConfirmOpen}
        title="Edit published workout?"
        message="This workout is already live for athletes. Do you want to unlock the editor and change the content?"
        confirmLabel="Yes, edit"
        cancelLabel="Keep locked"
        variant="warning"
        onConfirm={handleConfirmEdit}
        onCancel={() => setEditConfirmOpen(false)}
      />

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Delete workout?"
        message={`This will permanently remove the workout for ${new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}. Athletes will no longer see it in the app.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
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
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-all hover:border-gray-300">
      <div className="flex items-center mb-4">
        <div className={`w-8 h-8 ${color} text-white rounded-lg flex items-center justify-center mr-3 shadow-sm`}>
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
        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-pits-text focus:bg-white focus:border-gray-400 outline-none resize-none transition-all placeholder:text-gray-300 font-mono disabled:cursor-not-allowed"
      />
    </div>
  );
}

function PreviewBlock({ label, color, content }: { label: string, color: string, content: string }) {
  return (
    <div className={`border-l-4 ${color} pl-4 py-1`}>
      <div className="text-[9px] font-black uppercase text-gray-400 mb-1 tracking-widest">{label}</div>
      <p className="text-[12px] font-bold text-pits-text leading-snug whitespace-pre-line">
        {content}
      </p>
    </div>
  );
}
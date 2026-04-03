'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { UNIQUE_TECHNIQUES } from '../../../lib/techniques';
import { 
  Calendar, Save, Loader2, Dumbbell, Search, 
  Eye, Zap, ListOrdered, Scale, Sparkles, MoveRight
} from 'lucide-react';
import { useToast } from '../../../components/Toast';

export default function WodEditorPage() {
  const { toast } = useToast();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  
  // WOD Data Structure
  const [wodId, setWodId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [warmUp, setWarmUp] = useState('');
  const [technique, setTechnique] = useState('');
  const [strength, setStrength] = useState('');
  const [metcon, setMetcon] = useState('');
  const [scaling, setScaling] = useState('');
  const [stimulus, setStimulus] = useState(''); // New key for the strategy
  
  // Combobox State
  const [techniqueDropdownOpen, setTechniqueDropdownOpen] = useState(false);
  const [techniqueSearch, setTechniqueSearch] = useState('');

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

      try {
        const { data } = await supabase
          .from('wods')
          .select('*')
          .eq('date', date)
          .single();

        if (data) {
          setWodId(data.id);
          try {
            const contentObj = JSON.parse(data.content);
            setTitle(data.title || '');
            setWarmUp(contentObj.warm_up || '');
            setTechnique(contentObj.technique || '');
            setStrength(contentObj.strength || '');
            setMetcon(contentObj.metcon || '');
            setScaling(contentObj.scaling || '');
            setStimulus(contentObj.stimulus || ''); // Load the new field if it exists
          } catch (e) {
            setTitle(data.title || '');
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
        stimulus // Save strategic stimulus
      });

      const payload = {
        date,
        title: title || 'Daily WOD',
        content: contentJson,
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

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast('Error saving WOD: ' + errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      
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
            className={`p-3 rounded-xl border transition-all ${view === 'preview' ? 'bg-pits-text text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
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
          <div className={`lg:col-span-7 space-y-6 ${view === 'preview' ? 'hidden lg:block' : 'block'}`}>
            
            {/* Title Block */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-pits-red"></div>
              <label className="block text-xs font-black text-pits-dim uppercase tracking-widest mb-3">
                Workout Theme or Naming
              </label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 'Stronger Together' or 'Engine Builder'"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-black text-xl text-pits-text focus:bg-white focus:border-pits-red outline-none transition-all"
              />
            </div>

            {/* Warm Up Section */}
            <Section 
              label="1. Preparation (Warm-up)" 
              color="bg-orange-500" 
              icon={<Sparkles size={16} />}
              value={warmUp} 
              onChange={setWarmUp} 
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
                  value={techniqueDropdownOpen ? techniqueSearch : technique}
                  onChange={(e) => {
                    setTechniqueSearch(e.target.value);
                    setTechniqueDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setTechniqueSearch('');
                    setTechniqueDropdownOpen(true);
                  }}
                  onBlur={() => setTimeout(() => setTechniqueDropdownOpen(false), 200)}
                  placeholder="Select primary skill focus..."
                  className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-pits-text focus:bg-white focus:border-purple-600 outline-none transition-all"
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
              placeholder="Specify sets, reps and load intensity...\n5x3 Back Squats @ 80-85%\nRest 2:00 between sets."
            />

            {/* Metcon Section */}
            <Section 
              label="4. Perform (The Metcon)" 
              color="bg-pits-red" 
              icon={<Zap size={16} />}
              value={metcon} 
              onChange={setMetcon} 
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
                  onChange={(e) => setStimulus(e.target.value)}
                  rows={3}
                  placeholder="e.g. 'Fast & Unbroken. Heart rate 90%+'"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:bg-white focus:border-emerald-500 outline-none resize-none transition-all placeholder:text-gray-300"
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
                  onChange={(e) => setScaling(e.target.value)}
                  rows={3}
                  placeholder="e.g. 'Scale Pull-ups to Ring Rows...'"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:bg-white focus:border-slate-500 outline-none resize-none transition-all placeholder:text-gray-300"
                />
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
                onClick={handleSave}
                disabled={saving}
                className={`w-full py-4 rounded-xl flex items-center justify-center text-white font-black uppercase tracking-widest text-sm shadow-xl transition-all
                  ${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-pits-red hover:bg-pits-red-dark hover:scale-[1.02] active:scale-[0.98] shadow-red-100'}
                `}
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin mr-2" />
                ) : (
                  <Save size={18} className="mr-2" />
                )}
                {saving ? 'Publishing...' : 'Publish to PITS App'}
              </button>

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
    </div>
  );
}

// UI HELPER COMPONENTS
function Section({ label, color, icon, value, onChange, placeholder, rows = 4 }: any) {
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
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-pits-text focus:bg-white focus:border-gray-400 outline-none resize-none transition-all placeholder:text-gray-300 font-mono"
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
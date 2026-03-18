'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { UNIQUE_TECHNIQUES } from '../../../lib/techniques';
import { Calendar, Save, Loader2, Dumbbell, Search } from 'lucide-react';

export default function WodEditorPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // WOD Data Structure
  const [wodId, setWodId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [warmUp, setWarmUp] = useState('');
  const [technique, setTechnique] = useState('');
  const [strength, setStrength] = useState('');
  const [metcon, setMetcon] = useState('');
  const [scaling, setScaling] = useState('');
  
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

      try {
        const { data, error } = await supabase
          .from('wods')
          .select('*')
          .eq('date', date)
          .single();

        if (data) {
          setWodId(data.id);
          // Parse content if it's JSON, or use raw if simple text
          // For this implementation, we assume we store JSON in the 'content' column 
          // or we can add specific columns. To keep it compatible with the mobile app 
          // we built earlier which expected sections, let's restructure the 'content' field.
          // Mobile expects: type='STRENGTH' | 'METCON'
          
          try {
            const contentObj = JSON.parse(data.content);
            setTitle(data.title || '');
            setWarmUp(contentObj.warmUp || '');
            setTechnique(contentObj.technique || '');
            setStrength(contentObj.strength || '');
            setMetcon(contentObj.metcon || '');
            setScaling(contentObj.scaling || '');
          } catch (e) {
            // Fallback for legacy data
            setTitle(data.title || '');
          }
        }
      } catch (error) {
        // No WOD found for this date, which is fine (new entry)
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
        scaling
      });

      const payload = {
        date,
        title: title || 'Daily WOD',
        content: contentJson,
      };

      if (wodId) {
        // Update existing
        const { error } = await supabase
          .from('wods')
          .update(payload)
          .eq('id', wodId);
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('wods')
          .insert(payload);
        if (error) throw error;
        // Refresh to get the new ID
        const { data } = await supabase.from('wods').select('id').eq('date', date).single();
        if (data) setWodId(data.id);
      }

      alert('WOD Saved Successfully');

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert('Error saving WOD: ' + errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* HEADER & DATE PICKER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-pits-text uppercase italic tracking-tighter flex items-center">
            <Dumbbell className="mr-3 text-pits-red" />
            Program WOD
          </h2>
          <p className="text-pits-dim font-medium text-sm">
            Select a date to assign the workout.
          </p>
        </div>
        
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-700 focus:border-pits-red outline-none shadow-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-400">Loading whiteboard...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: INPUTS */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Title Block */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                Workout Title / Theme
              </label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 'Murph Prep' or 'Leg Day'"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg font-black text-lg text-pits-text focus:border-pits-red outline-none"
              />
            </div>

            {/* Warm Up Section */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="w-1 h-6 bg-orange-500 rounded-full mr-3"></div>
                <label className="text-sm font-bold text-pits-text uppercase tracking-wide">
                  Warm Up
                </label>
              </div>
              <textarea 
                value={warmUp}
                onChange={(e) => setWarmUp(e.target.value)}
                rows={4}
                placeholder="3 Rounds: 10 Squats, 10 Push-ups, 10 Sit-ups"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:border-orange-500 outline-none resize-none font-mono"
              />
            </div>

            {/* Technique Section */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
              <div className="flex items-center mb-3">
                <div className="w-1 h-6 bg-purple-600 rounded-full mr-3"></div>
                <label className="text-sm font-bold text-pits-text uppercase tracking-wide">
                  Technique
                </label>
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
                  onBlur={() => setTechniqueDropdownOpen(false)}
                  placeholder="Search or select technique..."
                  className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-pits-text focus:border-purple-600 outline-none transition-colors"
                />
              </div>

              {techniqueDropdownOpen && (
                <div className="absolute z-50 left-6 right-6 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                  {UNIQUE_TECHNIQUES.filter(t => t.toLowerCase().includes(techniqueSearch.toLowerCase())).length > 0 ? (
                    UNIQUE_TECHNIQUES.filter(t => t.toLowerCase().includes(techniqueSearch.toLowerCase())).map((t) => (
                      <div 
                        key={t}
                        className="px-4 py-3 hover:bg-purple-50 cursor-pointer text-sm font-medium text-gray-700 transition-colors border-b border-gray-50 last:border-0"
                        onMouseDown={(e) => {
                          // Prevent input blur before click registers
                          e.preventDefault();
                        }}
                        onClick={() => {
                          setTechnique(t);
                          setTechniqueDropdownOpen(false);
                          setTechniqueSearch('');
                        }}
                      >
                        {t}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-4 text-center text-sm text-gray-400 font-medium">
                      No techniques found
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Strength Section */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="w-1 h-6 bg-blue-600 rounded-full mr-3"></div>
                <label className="text-sm font-bold text-pits-text uppercase tracking-wide">
                  Strength / Skill
                </label>
              </div>
              <textarea 
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                rows={4}
                placeholder="5-5-5 Back Squat @ 75%"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:border-blue-500 outline-none resize-none font-mono"
              />
            </div>

            {/* Metcon Section */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="w-1 h-6 bg-pits-red rounded-full mr-3"></div>
                <label className="text-sm font-bold text-pits-text uppercase tracking-wide">
                  Metcon (WOD)
                </label>
              </div>
              <textarea 
                value={metcon}
                onChange={(e) => setMetcon(e.target.value)}
                rows={6}
                placeholder={`AMRAP 12:\n10 Wall Balls\n10 Box Jumps`}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:border-pits-red outline-none resize-none font-mono"
              />
            </div>

            {/* Scaling Options */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="w-1 h-6 bg-gray-400 rounded-full mr-3"></div>
                <label className="text-sm font-bold text-pits-text uppercase tracking-wide">
                  Scaling / Notes
                </label>
              </div>
              <textarea 
                value={scaling}
                onChange={(e) => setScaling(e.target.value)}
                rows={3}
                placeholder="Scale Pull-ups to Ring Rows"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:border-gray-400 outline-none resize-none"
              />
            </div>

          </div>

          {/* RIGHT COLUMN: ACTIONS & PREVIEW HINT */}
          <div className="space-y-6">
            
            {/* Save Action */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm sticky top-6">
              <h3 className="font-bold text-pits-text uppercase text-xs tracking-wider mb-4">
                Publishing
              </h3>
              
              <button
                onClick={handleSave}
                disabled={saving}
                className={`w-full py-4 rounded-lg flex items-center justify-center text-white font-black uppercase tracking-widest text-sm shadow-lg transition-all
                  ${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-pits-red hover:bg-pits-red-dark shadow-red-200'}
                `}
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin mr-2" />
                ) : (
                  <Save size={18} className="mr-2" />
                )}
                {saving ? 'Saving...' : 'Publish to App'}
              </button>

              <p className="text-xs text-gray-400 mt-4 text-center">
                Updates appear instantly on athlete devices.
              </p>
            </div>

            {/* Mobile Preview (Static Visual) */}
            <div className="bg-pits-text rounded-[2rem] p-4 border-4 border-gray-800 shadow-2xl opacity-90 hidden md:block">
              <div className="bg-gray-900 rounded-2xl h-96 overflow-hidden relative p-4">
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-1 bg-gray-800 rounded-full"></div>
                </div>
                <div className="space-y-3">
                  <div className="h-4 w-1/2 bg-gray-800 rounded mb-4"></div>
                  <div className="p-3 bg-gray-800 rounded-lg border-l-2 border-pits-red">
                    <div className="h-2 w-10 bg-pits-red rounded mb-2"></div>
                    <div className="h-2 w-full bg-gray-700 rounded"></div>
                    <div className="h-2 w-2/3 bg-gray-700 rounded mt-1"></div>
                  </div>
                  <div className="p-3 bg-gray-800 rounded-lg border-l-2 border-blue-600">
                    <div className="h-2 w-10 bg-blue-600 rounded mb-2"></div>
                    <div className="h-2 w-full bg-gray-700 rounded"></div>
                    <div className="h-2 w-2/3 bg-gray-700 rounded mt-1"></div>
                  </div>
                </div>
                <div className="absolute bottom-4 w-full text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Mobile Preview</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
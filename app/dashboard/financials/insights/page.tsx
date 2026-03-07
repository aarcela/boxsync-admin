'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { 
  TrendingUp, Users, AlertCircle, ArrowUpRight, 
  MessageSquare, DollarSign, Zap, UserCheck, 
  Clock, ShieldAlert, Award
} from 'lucide-react';

interface Recommendation {
  id: string;
  type: 'recovery' | 'upsell' | 'retention' | 'inscription';
  title: string;
  description: string;
  impact: string;
  actionLabel: string;
  athleteName?: string;
}

export default function FinancialInsightsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ recoveredPotential: 0, upsellPotential: 0 });

  const analyzeData = async () => {
    setLoading(true);
    const newRecs: Recommendation[] = [];
    let recoveryTotal = 0;
    let upsellTotal = 0;

    try {
      // 1. Fetch All Profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'member');

      // 2. Fetch Recent Bookings (Last 30 days) to analyze behavior
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: bookings } = await supabase
        .from('bookings')
        .select('user_id, created_at, status')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (!profiles) return;

      // --- LOGIC A: REVENUE RECOVERY (Insolvent Users) ---
      const insolvent = profiles.filter(p => !p.is_solvent);
      insolvent.forEach(p => {
        const planPrice = p.plan === 'unlimited' ? 80 : 60; // Estimated
        recoveryTotal += planPrice;
        newRecs.push({
          id: `recovery-${p.id}`,
          type: 'recovery',
          title: 'Unpaid Membership',
          athleteName: p.full_name,
          description: `${p.full_name} is currently locked out. Reach out to collect their monthly fee.`,
          impact: `+$${planPrice}`,
          actionLabel: 'Contact Athlete'
        });
      });

      // --- LOGIC B: UPSELL OPPORTUNITIES (Plan Usage) ---
      // We look for users on limited plans who are very active
      const limitedProfiles = profiles.filter(p => p.plan === '3x_week' || p.plan === '4x_week');
      limitedProfiles.forEach(p => {
        const userBookings = bookings?.filter(b => b.user_id === p.id && b.status === 'attended') || [];
        // If they attended more than 12 times in 30 days, they are hitting 3x/week limit consistently
        if (userBookings.length >= 11) {
          upsellTotal += 20; // Estimated $20 jump to next plan
          newRecs.push({
            id: `upsell-${p.id}`,
            type: 'upsell',
            title: 'Upsell Opportunity',
            athleteName: p.full_name,
            description: `${p.full_name} has attended ${userBookings.length} classes this month. They are maximizing their plan.`,
            impact: '+$20/mo',
            actionLabel: 'Suggest Upgrade'
          });
        }
      });

      // --- LOGIC C: RETENTION (Inactive but Paying) ---
      const solventProfiles = profiles.filter(p => p.is_solvent);
      solventProfiles.forEach(p => {
        const lastBooking = bookings?.filter(b => b.user_id === p.id).sort((a,b) => b.created_at.localeCompare(a.created_at))[0];
        
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        
        if (!lastBooking || new Date(lastBooking.created_at) < tenDaysAgo) {
          newRecs.push({
            id: `retention-${p.id}`,
            type: 'retention',
            title: 'Churn Risk',
            athleteName: p.full_name,
            description: `${p.full_name} hasn't been to the box in 10+ days. Check in to keep them motivated.`,
            impact: 'Protect Rev',
            actionLabel: 'Send Motivation'
          });
        }
      });

      // --- LOGIC D: INSCRIPTION DEBT ---
      const unpaidIns = profiles.filter(p => !p.inscription_paid);
      unpaidIns.forEach(p => {
        newRecs.push({
          id: `ins-${p.id}`,
          type: 'inscription',
          title: 'Pending Inscription',
          athleteName: p.full_name,
          description: `The registration fee for ${p.full_name} is still pending.`,
          impact: 'One-time Recov',
          actionLabel: 'Mark as Paid'
        });
      });

      setRecommendations(newRecs);
      setTotals({ recoveredPotential: recoveryTotal, upsellPotential: upsellTotal });

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyzeData();
  }, []);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-3xl font-black text-pits-text uppercase italic tracking-tighter">
            Action Center
          </h2>
          <p className="text-pits-dim font-medium text-sm">
            AI-driven recommendations to grow your Box revenue.
          </p>
        </div>
        <div className="bg-pits-text text-white px-4 py-2 rounded-lg flex items-center">
          <Zap size={16} className="text-yellow-400 mr-2" />
          <span className="text-xs font-bold uppercase tracking-widest">
            {recommendations.length} Actions Found
          </span>
        </div>
      </div>

      {/* POTENTIAL GAIN CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-600 p-6 rounded-2xl shadow-xl shadow-green-100 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Recoverable Revenue</p>
            <p className="text-4xl font-black text-white italic">${totals.recoveredPotential}</p>
            <p className="text-white/60 text-[10px] mt-2 font-medium">From currently unpaid/locked athletes.</p>
          </div>
          <DollarSign size={48} className="text-white/20" />
        </div>
        <div className="bg-blue-600 p-6 rounded-2xl shadow-xl shadow-blue-100 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Upsell Potential</p>
            <p className="text-4xl font-black text-white italic">+${totals.upsellPotential}<span className="text-sm">/mo</span></p>
            <p className="text-white/60 text-[10px] mt-2 font-medium">From athletes outgrowing their current plan.</p>
          </div>
          <TrendingUp size={48} className="text-white/20" />
        </div>
      </div>

      {/* RECOMMENDATIONS FEED */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <Clock className="animate-spin mx-auto text-pits-red mb-4" size={32} />
            <p className="text-pits-dim font-bold uppercase text-xs">Analyzing Athlete Data...</p>
          </div>
        ) : (
          recommendations.map((rec) => (
            <div 
              key={rec.id} 
              className={`bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all hover:shadow-md
                ${rec.type === 'recovery' ? 'border-l-4 border-l-red-500' : 
                  rec.type === 'upsell' ? 'border-l-4 border-l-blue-500' : 
                  rec.type === 'retention' ? 'border-l-4 border-l-orange-500' : 
                  'border-l-4 border-l-gray-400'}
              `}
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest
                    ${rec.type === 'recovery' ? 'bg-red-50 text-red-600' : 
                      rec.type === 'upsell' ? 'bg-blue-50 text-blue-600' : 
                      rec.type === 'retention' ? 'bg-orange-50 text-orange-600' : 
                      'bg-gray-100 text-gray-600'}
                  `}>
                    {rec.type}
                  </div>
                  <span className="text-pits-text font-black text-sm">{rec.impact}</span>
                </div>
                
                <h4 className="text-pits-text font-bold text-base mb-1">{rec.title}</h4>
                <p className="text-pits-dim text-xs font-medium leading-relaxed mb-4">
                  {rec.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-auto">
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center mr-2">
                    <Users size={12} className="text-gray-400" />
                  </div>
                  <span className="text-[10px] font-bold text-pits-text uppercase">{rec.athleteName?.split(' ')[0]}</span>
                </div>
                <button className="text-[10px] font-black text-pits-red uppercase tracking-widest hover:underline">
                  {rec.actionLabel}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {recommendations.length === 0 && !loading && (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-200 text-center">
           <UserCheck size={48} className="mx-auto text-gray-200 mb-4" />
           <p className="text-pits-text font-black uppercase italic">The Box is Healthy</p>
           <p className="text-pits-dim text-sm">No critical financial actions required at this moment.</p>
        </div>
      )}
    </div>
  );
}
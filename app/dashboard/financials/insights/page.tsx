'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { 
  TrendingUp, Users, 
  DollarSign, Zap, UserCheck, 
  Clock, Filter, MessageCircle, AlertCircle, ArrowUpRight
} from 'lucide-react';
import { useToast } from '../../../../components/Toast';
import { useLanguage } from '../../../../components/LanguageContext';

interface Recommendation {
  id: string;
  type: 'recovery' | 'upsell' | 'retention' | 'inscription';
  title: string;
  description: string;
  impact: string;
  impactValue: number; // For sorting
  actionLabel: string;
  athleteName?: string;
  athleteId?: string;
  phone?: string;
  priority: 'urgent' | 'high' | 'medium';
}

type FilterType = 'all' | 'recovery' | 'upsell' | 'retention' | 'inscription';

const PLAN_PRICES: Record<string, number> = { 
  unlimited: 80, 
  '5x_week': 70, 
  '4x_week': 60, 
  '3x_week': 50, 
  'open_box': 40 
};

export default function FinancialInsightsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ recoveredPotential: 0, upsellPotential: 0 });
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const analyzeData = async () => {
    setLoading(true);
    const newRecs: Recommendation[] = [];
    let recoveryTotal = 0;
    let upsellTotal = 0;

    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'member');

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: bookings } = await supabase
        .from('bookings')
        .select('user_id, created_at, status')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (!profiles) return;

      // --- LOGIC A: REVENUE RECOVERY (Debt) ---
      const insolvent = profiles.filter(p => !p.is_solvent);
      insolvent.forEach(p => {
        const planPrice = PLAN_PRICES[p.plan] || 60;
        recoveryTotal += planPrice;
        newRecs.push({
          id: `recovery-${p.id}`,
          type: 'recovery',
          title: t('Debt Recovery'),
          athleteName: p.full_name,
          athleteId: p.id,
          phone: p.phone,
          description: `Locked account: €${planPrice} due. Reach out to restore access.`,
          impact: `+€${planPrice}`,
          impactValue: planPrice * 5, // High weight
          actionLabel: t('Send Reminder'),
          priority: 'urgent'
        });
      });

      // --- LOGIC B: UPSELL (Plan Saturation) ---
      const limitedProfiles = profiles.filter(p => p.plan === '3x_week' || p.plan === '4x_week');
      limitedProfiles.forEach(p => {
        const userBookings = bookings?.filter(b => b.user_id === p.id && b.status === 'attended') || [];
        if (userBookings.length >= 11) {
          const currentPrice = PLAN_PRICES[p.plan] || 50;
          const nextPlanKey = p.plan === '3x_week' ? '4x_week' : '5x_week';
          const nextPrice = PLAN_PRICES[nextPlanKey];
          const delta = (nextPrice || 60) - currentPrice;
          upsellTotal += delta;
          newRecs.push({
            id: `upsell-${p.id}`,
            type: 'upsell',
            title: t('Plan Saturation'),
            athleteName: p.full_name,
            athleteId: p.id,
            phone: p.phone,
            description: `${userBookings.length} sessions this month. They've outgrown the ${p.plan.replace('_', ' ')} plan.`,
            impact: `+€${delta}/mo`,
            impactValue: delta * 3,
            actionLabel: t('Suggest Upgrade'),
            priority: 'high'
          });
        }
      });

      // --- LOGIC C: RETENTION (Silent Churn) ---
      const twelveDaysAgo = new Date();
      twelveDaysAgo.setDate(twelveDaysAgo.getDate() - 12);

      const activePaying = profiles.filter(p => p.is_solvent);
      activePaying.forEach(p => {
        const userBookingsDesc = bookings?.filter(b => b.user_id === p.id)
          .sort((a,b) => b.created_at.localeCompare(a.created_at));
        
        const lastBooking = userBookingsDesc?.[0];
        
        if (!lastBooking || new Date(lastBooking.created_at) < twelveDaysAgo) {
          const daysInactive = lastBooking 
            ? Math.floor((new Date().getTime() - new Date(lastBooking.created_at).getTime()) / (1000 * 3600 * 24))
            : '30+';

          newRecs.push({
            id: `retention-${p.id}`,
            type: 'retention',
            title: t('Churn Risk'),
            athleteName: p.full_name,
            athleteId: p.id,
            phone: p.phone,
            description: `${daysInactive} days inactive. Member is currently paying but not attending.`,
            impact: t('Protect Rev'),
            impactValue: 100, // Fixed high importance for retention
            actionLabel: t('Missing You'),
            priority: 'high'
          });
        }
      });

      // --- LOGIC D: INSCRIPTION (One-time Recovery) ---
      const unpaidIns = profiles.filter(p => !p.inscription_paid);
      if (unpaidIns.length > 0) {
        if (unpaidIns.length > 3) {
          newRecs.push({
            id: 'ins-bulk',
            type: 'inscription',
            title: t('Bulk Inscription Recovery'),
            description: `${unpaidIns.length} athletes have pending registration fees.`,
            impact: 'Multiple',
            impactValue: unpaidIns.length * 20,
            actionLabel: t('View Roster'),
            priority: 'medium'
          });
        } else {
          unpaidIns.forEach(p => {
             newRecs.push({
              id: `ins-${p.id}`,
              type: 'inscription',
              title: t('Pending Registration'),
              athleteName: p.full_name,
              athleteId: p.id,
              phone: p.phone,
              description: `Registration fee still pending for ${p.full_name.split(' ')[0]}.`,
              impact: 'One-time',
              impactValue: 50,
              actionLabel: t('Mark Paid'),
              priority: 'medium'
            });
          });
        }
      }

      newRecs.sort((a, b) => b.impactValue - a.impactValue);
      setRecommendations(newRecs);
      setTotals({ recoveredPotential: recoveryTotal, upsellPotential: upsellTotal });

    } catch (error) {
      console.error(error);
      toast(t('Failed to analyze data'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyzeData();
  }, []);

  const getWhatsAppLink = (rec: Recommendation) => {
    if (!rec.phone) return null;
    const cleanPhone = rec.phone.replace(/[^0-9]/g, '');
    let message = '';

    switch (rec.type) {
      case 'recovery':
        message = `Hola ${rec.athleteName?.split(' ')[0]}! Notamos un problema con tu suscripción en PITS. ¿Podemos ayudarte a regularizarlo para que no pierdas tus reservas?`;
        break;
      case 'upsell':
        message = `¡Hola ${rec.athleteName?.split(' ')[0]}! Estás a tope este mes. Notamos que estás aprovechando al máximo tu plan actual, ¿te interesaría subir al siguiente nivel para entrenar sin límites?`;
        break;
      case 'retention':
        message = `¡Hola ${rec.athleteName?.split(' ')[0]}! Te extrañamos en el Box. Te escribo para ver si todo bien y motivarte a volver a los entrenamientos. ¡Te esperamos!`;
        break;
    }

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const handleAction = async (rec: Recommendation) => {
    if (rec.id === 'ins-bulk') {
      window.location.href = '/dashboard/athletes';
      return;
    }

    switch (rec.type) {
      case 'inscription':
        if (!rec.athleteId) return;
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ inscription_paid: true })
            .eq('id', rec.athleteId);
          if (error) throw error;
          toast(`${t('Registration marked as paid for')} ${rec.athleteName}`, 'success');
          setDismissed(prev => new Set(prev).add(rec.id));
        } catch {
          toast('Failed to update registration', 'error');
        }
        break;

      default:
        const waLink = getWhatsAppLink(rec);
        if (waLink) {
          window.open(waLink, '_blank');
          toast(t('WhatsApp message opened'), 'info');
        } else {
          toast(`Contact ${rec.athleteName} directly (No phone on file)`, 'warning');
        }
        break;
    }
  };

  const handleDismiss = (recId: string) => {
    setDismissed(prev => new Set(prev).add(recId));
    toast(t('Dismiss'), 'info');
  };

  const visibleRecs = recommendations.filter(r => {
    if (dismissed.has(r.id)) return false;
    if (activeFilter === 'all') return true;
    return r.type === activeFilter;
  });

  const FILTER_TABS: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: t('All'), count: recommendations.filter(r => !dismissed.has(r.id)).length },
    { key: 'recovery', label: t('Recovery'), count: recommendations.filter(r => r.type === 'recovery' && !dismissed.has(r.id)).length },
    { key: 'upsell', label: t('Upsell'), count: recommendations.filter(r => r.type === 'upsell' && !dismissed.has(r.id)).length },
    { key: 'retention', label: t('Retention'), count: recommendations.filter(r => r.type === 'retention' && !dismissed.has(r.id)).length },
    { key: 'inscription', label: t('Registration'), count: recommendations.filter(r => r.type === 'inscription' && !dismissed.has(r.id)).length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-3xl font-black text-pits-text uppercase italic tracking-tighter">
            {t('Action Center')}
          </h2>
          <p className="text-pits-dim font-medium text-sm">
            {t('High-impact decisions to recover revenue and protect growth.')}
          </p>
        </div>
        <div className="bg-pits-panel text-pits-text px-4 py-2 rounded-lg flex items-center shadow-lg">
          <Zap size={16} className="text-yellow-400 mr-2 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest">
            {visibleRecs.filter(r => r.priority === 'urgent' || r.priority === 'high').length} {t('Critical Actions')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-pits-surface-elevated p-6 border border-pits-edge rounded-2xl shadow-sm flex items-center justify-between group cursor-default">
          <div>
            <p className="text-pits-dim text-[10px] font-black uppercase tracking-widest mb-1">{t('Recoverable Debt')}</p>
            <p className="text-4xl font-black text-pits-text italic">€{totals.recoveredPotential}</p>
            <p className="text-pits-dim text-[10px] mt-2 font-bold uppercase">{t('Immediate Cash Flow')}</p>
          </div>
          <DollarSign size={40} className="text-pits-dim/30 group-hover:scale-110 transition-transform" />
        </div>
        
        <div className="bg-pits-surface-elevated p-6 border border-pits-edge rounded-2xl shadow-sm flex items-center justify-between group cursor-default">
          <div>
            <p className="text-pits-dim text-[10px] font-black uppercase tracking-widest mb-1">{t('Monthly Growth')}</p>
            <p className="text-4xl font-black text-pits-text italic">+€{totals.upsellPotential}<span className="text-sm">/mo</span></p>
            <p className="text-pits-dim text-[10px] mt-2 font-bold uppercase">{t('Plan Optimization')}</p>
          </div>
          <TrendingUp size={40} className="text-pits-dim/30 group-hover:scale-110 transition-transform" />
        </div>

        <div className="bg-pits-surface-elevated p-6 border border-pits-edge rounded-2xl shadow-sm flex items-center justify-between group cursor-default">
          <div>
            <p className="text-pits-dim text-[10px] font-black uppercase tracking-widest mb-1">{t('Churn Risk')}</p>
            <p className="text-4xl font-black text-pits-text italic">{recommendations.filter(r => r.type === 'retention').length}</p>
            <p className="text-pits-dim text-[10px] mt-2 font-bold uppercase">{t('Members Missing more 12d')}</p>
          </div>
          <AlertCircle size={40} className="text-pits-dim/30 group-hover:scale-110 transition-transform" />
        </div>
      </div>

      <div className="flex items-center gap-2 bg-pits-surface-elevated p-2 rounded-xl border border-pits-edge shadow-sm overflow-x-auto no-scrollbar">
        <Filter size={16} className="text-pits-dim shrink-0 ml-2" />
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
              activeFilter === tab.key 
                ? 'bg-pits-panel text-pits-text shadow-md' 
                : 'text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black ${
                activeFilter === tab.key ? 'bg-pits-surface-elevated text-black' : 'bg-pits-surface-muted text-pits-dim'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <Clock className="animate-spin mx-auto text-pits-red mb-4" size={32} />
            <p className="text-pits-dim font-bold uppercase text-[10px] tracking-widest">{t('Running Intelligence Layer...')}</p>
          </div>
        ) : (
          visibleRecs.map((rec) => (
            <div 
              key={rec.id} 
              className={`bg-pits-surface-elevated border rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden
                ${rec.priority === 'urgent' ? 'border-2 border-pits-error' : 'border-pits-edge'}
              `}
            >
              {rec.priority === 'urgent' && (
                <div className="absolute top-0 right-0 bg-pits-error text-pits-text text-[8px] font-black uppercase px-3 py-1 rounded-bl-lg tracking-widest">
                  {t('Urgent Recovery')}
                </div>
              )}
              
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest
                    ${rec.type === 'recovery' ? 'bg-pits-primary-soft text-pits-error' : 
                      rec.type === 'upsell' ? 'bg-pits-surface-muted text-pits-primary' : 
                      rec.type === 'retention' ? 'bg-pits-primary-soft text-pits-primary' : 
                      'bg-pits-surface-muted text-pits-text'}
                  `}>
                    {t(rec.type.charAt(0).toUpperCase() + rec.type.slice(1) as any)}
                  </div>
                  <span className={`font-black text-sm italic ${rec.type === 'recovery' ? 'text-pits-error' : 'text-pits-text'}`}>
                    {rec.impact}
                  </span>
                </div>
                
                <h4 className="text-pits-text font-black text-base mb-1 uppercase tracking-tight italic">
                  {rec.title}
                </h4>
                <p className="text-pits-dim text-xs font-semibold leading-normal mb-6 min-h-[40px]">
                  {rec.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-pits-edge">
                <div className="flex items-center">
                  <div className="w-7 h-7 bg-pits-surface-muted rounded-full flex items-center justify-center mr-2 border border-pits-edge">
                    <Users size={14} className="text-pits-dim" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-pits-text uppercase leading-none">
                      {rec.athleteName ? rec.athleteName.split(' ')[0] : t('Bulk Inscription Recovery')}
                    </span>
                    <span className="text-[8px] text-pits-dim font-bold uppercase">Athlete ID {rec.athleteId?.slice(0,5) || 'Group'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleDismiss(rec.id)}
                    className="text-[9px] font-bold text-pits-dim uppercase tracking-widest hover:text-pits-text transition-colors"
                  >
                    {t('Dismiss')}
                  </button>
                  <button 
                    onClick={() => handleAction(rec)}
                    className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all active:scale-95 shadow-sm
                      ${rec.type === 'recovery' || rec.priority === 'urgent'
                        ? 'bg-pits-error text-pits-text hover:bg-pits-primary-dark' 
                        : 'bg-pits-panel text-pits-text hover:bg-pits-primary-dark'}
                    `}
                  >
                    {rec.type !== 'inscription' && rec.id !== 'ins-bulk' && (
                      <MessageCircle size={10} className="mr-0.5" />
                    )}
                    {rec.actionLabel}
                    <ArrowUpRight size={10} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {visibleRecs.length === 0 && !loading && (
        <div className="bg-pits-surface-elevated p-20 rounded-2xl border border-dashed border-pits-edge text-center flex flex-col items-center">
           <div className="w-16 h-16 bg-pits-surface-muted rounded-full flex items-center justify-center mb-4">
             <UserCheck size={32} className="text-pits-dim" />
           </div>
           <p className="text-pits-text font-black uppercase italic tracking-wider text-xl">{t('The Box is Perfectly Balanced')}</p>
           <p className="text-pits-dim text-xs font-bold uppercase mt-2 tracking-widest opacity-60">{t('No high-impact recovery or growth tasks detected.')}</p>
        </div>
      )}
    </div>
  );
}

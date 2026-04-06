'use client';

import { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart,
  RefreshCw,
  Wallet,
  Zap,
  Info,
  ChevronLeft,
  ChevronRight,
  Scale
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useAccountability } from './hooks/useAccountability';
import { CurrencyType } from '@/lib/types/gym';

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export default function AccountabilityPage() {
  const { t } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeCurrency, setActiveCurrency] = useState<CurrencyType>(CurrencyType.EUR);

  const periodString = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const { loading, stats, refresh, expenses } = useAccountability(periodString);

  const changeMonth = (direction: number) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;

    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const currentStats = stats[activeCurrency] || { income: 0, outcome: 0, net: 0, margin: 0 };
  const symbol = activeCurrency === CurrencyType.EUR ? '€' : 'Bs.';

  // Determine fixed vs variable costs for the active currency
  const activeExpenses = expenses.filter(e => e.currency === activeCurrency);
  const fixedCosts = activeExpenses.filter(e => ['Rent', 'Staff', 'Services'].includes(e.category)).reduce((sum, e) => sum + e.amount, 0);
  const variableCosts = currentStats.outcome - fixedCosts;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-0 pb-12">
      
      {/* 1. COMMAND HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">
              {t('Accountability')}
            </h1>
            <div className="bg-pits-red px-2 py-0.5 rounded text-[10px] font-bold text-white border border-red-600 tracking-widest uppercase shadow-sm">
               {t('Strategic balance and financial sustainability')}
            </div>
          </div>
          <p className="text-slate-400 text-xs font-semibold mt-1 tracking-wide uppercase">
            {t('Independent accountability tracking for EUR and VES')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          {/* Currency Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button 
              onClick={() => setActiveCurrency(CurrencyType.EUR)}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${
                activeCurrency === CurrencyType.EUR ? 'bg-white text-pits-red shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t('EURO OPERATIONS')}
            </button>
            <button 
              onClick={() => setActiveCurrency(CurrencyType.VES)}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${
                activeCurrency === CurrencyType.VES ? 'bg-white text-pits-red shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t('VES BOLIVARES')}
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
            <button 
              onClick={() => changeMonth(-1)}
              className="p-2 hover:bg-slate-50 text-slate-400 hover:text-pits-red transition-all rounded-xl"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-3 flex items-center gap-2">
              <Calendar size={14} className="text-pits-red" />
              <span className="text-[11px] font-black uppercase text-slate-700 w-28 text-center">
                {t(MONTHS[selectedMonth - 1] as any)} {selectedYear}
              </span>
            </div>
            <button 
              onClick={() => changeMonth(1)}
              className="p-2 hover:bg-slate-50 text-slate-400 hover:text-pits-red transition-all rounded-xl"
            >
              <ChevronRight size={18} />
            </button>
            <div className="mx-1 h-6 w-px bg-slate-100" />
            <button 
              onClick={refresh}
              className={`p-2 hover:bg-slate-50 text-slate-400 hover:text-pits-red transition-all rounded-xl ${loading ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. THE BALANCE BOARD (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <BalanceCard 
          label={t('Incomes')} 
          value={currentStats.income} 
          symbol={symbol} 
          type="plus" 
          info={`${t('Revenue Flow')} (${activeCurrency})`}
          color="emerald"
        />
        <BalanceCard 
          label={t('Outcomes')} 
          value={currentStats.outcome} 
          symbol={symbol} 
          type="minus" 
          info={`${t('Expense Burn')} (${activeCurrency})`}
          color="red"
        />
        <BalanceCard 
          label={t('Net Balance')} 
          value={currentStats.net} 
          symbol={symbol} 
          type={currentStats.net >= 0 ? 'plus' : 'minus'} 
          info={`${t('Profit')} (${activeCurrency})`}
          color={currentStats.net >= 0 ? 'emerald' : 'red'}
          highlight={true}
        />
        <BalanceCard 
          label={t('Profit Margin')} 
          value={currentStats.margin} 
          symbol="%" 
          type={currentStats.margin >= 20 ? 'plus' : 'neutral'} 
          info={t('Sustainability Index')}
          color={currentStats.margin >= 20 ? 'purple' : 'slate'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: P&L LEDGER (8 COLS) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
            <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                <Scale size={18} className="text-pits-red" /> {t('Monthly P&L')} - {activeCurrency}
              </h3>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase">{t('Exchange Base')}:</span>
                <span className="text-[10px] font-black text-slate-700">€1 = {stats.exchangeRate?.toFixed(2) || '---'} VES</span>
              </div>
            </div>

            <div className="p-8">
              <div className="space-y-8">
                
                {/* INCOMES SECTION */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 border border-emerald-100 uppercase font-black text-xs"><TrendingUp size={14}/></div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase">{t('Incomes')}</h4>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center bg-slate-50 rounded-2xl p-4 border border-slate-100">
                     <span className="text-xs font-black uppercase text-slate-500">{t('Total Revenue Flow')}</span>
                     <span className="text-xl font-black text-emerald-500">{symbol}{currentStats.income.toLocaleString()}</span>
                  </div>
                </div>

                {/* OUTCOMES SECTION */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                    <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-red-500 border border-red-100 uppercase font-black text-xs"><TrendingDown size={14}/></div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase">{t('Outcomes')}</h4>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 rounded-2xl p-4 border border-slate-100">
                     <span className="text-xs font-black uppercase text-slate-500">{t('Total Expense Burn')}</span>
                     <span className="text-xl font-black text-red-500">{symbol}{currentStats.outcome.toLocaleString()}</span>
                  </div>
                </div>

              </div>

              {/* CONSOLIDATED SUMMARY BAR */}
              <div className={`mt-10 p-6 rounded-[32px] text-white relative overflow-hidden shadow-xl border ${currentStats.net >= 0 ? 'bg-slate-900 border-slate-800' : 'bg-red-950 border-red-900'}`}>
                 <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Zap size={100} className="text-white" />
                 </div>
                 <div className="relative z-10 flex justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                       <div className={`p-3 rounded-2xl shadow-lg ring-4 ${currentStats.net >= 0 ? 'bg-pits-red ring-pits-red/20' : 'bg-red-600 ring-red-500/20'}`}>
                          <Wallet size={24} />
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{t('Sustainability Report')}</p>
                          <h4 className="text-2xl font-black tracking-tighter uppercase">{t('Net Balance')}</h4>
                       </div>
                    </div>
                    
                    <div className="text-right">
                       <p className="text-[10px] font-black text-white/30 uppercase mb-1">{t('Total')} {activeCurrency}</p>
                       <p className={`text-3xl font-black tracking-tighter ${currentStats.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                         {symbol}{currentStats.net.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                       </p>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: COST STRUCTURE & ACTIONS (4 COLS) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
             <h3 className="text-xs font-black text-slate-900 uppercase mb-6 flex items-center gap-2">
                <PieChart size={16} className="text-pits-red" /> {t('Financial Sustainability')}
             </h3>
             <div className="space-y-5">
                <SustainabilityMetric 
                  label={t('Fixed Costs')} 
                  value={fixedCosts} 
                  total={currentStats.outcome} 
                  symbol={symbol}
                  color="slate"
                  t={t}
                />
                <SustainabilityMetric 
                  label={t('Variable Costs')} 
                  value={variableCosts} 
                  total={currentStats.outcome} 
                  symbol={symbol}
                  color="amber"
                  t={t}
                />
                <SustainabilityMetric 
                  label={t('Profit')} 
                  value={currentStats.net > 0 ? currentStats.net : 0} 
                  total={currentStats.income} 
                  symbol={symbol}
                  color="emerald"
                  t={t}
                />
             </div>
             
             <div className="mt-8 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                <p className="text-[9px] font-bold text-blue-700 uppercase tracking-tight flex items-center gap-2">
                   <Info size={12} /> {t('Strategic Insight')}
                </p>
                <p className="text-[10px] font-bold text-slate-600 mt-2 leading-relaxed">
                   {currentStats.margin > 30 
                     ? t('Strong margin. Consider reinvesting in gear or marketing.') 
                     : currentStats.margin > 0 
                     ? t('Operational stability secured. Aiming for efficiency.') 
                     : t('Warning: Operational burn exceeding revenue. Immediate review required.')}
                </p>
             </div>
          </div>

        </div>
      </div>

    </div>
  );
}

// --- CORE UI COMPONENTS ---

function BalanceCard({ label, value, symbol, type, info, color, highlight }: any) {
  const colors: Record<string, string> = {
    red: 'text-red-500 bg-red-50 border-red-100',
    emerald: 'text-emerald-500 bg-emerald-50 border-emerald-100',
    slate: 'text-slate-500 bg-slate-50 border-slate-100',
    purple: 'text-purple-500 bg-purple-50 border-purple-100',
  };

  return (
    <div className={`p-6 rounded-[32px] border shadow-sm transition-all hover:shadow-md relative overflow-hidden group ${highlight ? 'bg-slate-50 border-slate-200 ring-2 ring-pits-red/5' : 'bg-white border-slate-200'}`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-sm font-black text-slate-400">{symbol}</span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter">
              {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
          </div>
        </div>
        <div className={`p-3 rounded-2xl border ${colors[color]}`}>
          {type === 'plus' ? <TrendingUp size={18} /> : type === 'minus' ? <TrendingDown size={18} /> : <Zap size={18} />}
        </div>
      </div>
      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1">
        <Info size={10} /> {info}
      </p>
    </div>
  );
}

function SustainabilityMetric({ label, value, total, symbol, color, t }: any) {
  const barColors: Record<string, string> = {
    slate: 'bg-slate-400',
    amber: 'bg-amber-400',
    emerald: 'bg-emerald-400',
  };
  
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end">
        <p className="text-[9px] font-black text-slate-400 uppercase">{t(label)}</p>
        <span className="text-[10px] font-black text-slate-900">{symbol}{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 flex items-center p-0.5">
        <div 
          className={`h-full rounded-full ${barColors[color]} transition-all duration-1000 shadow-sm`} 
          style={{ width: `${percentage}%` }} 
        />
      </div>
      <div className="flex justify-between">
         <span className="text-[8px] font-bold text-slate-300 uppercase">{percentage.toFixed(1)}% of total</span>
      </div>
    </div>
  );
}

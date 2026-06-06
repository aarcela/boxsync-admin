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
  Scale,
  Percent,
  Layers,
  Flame,
  Target,
  Users
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
  const { loading, stats, refresh, expenses, payments } = useAccountability(periodString);

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

  // --- DERIVED KPIs ---

  // 1. % Gasto sobre ingresos
  const spendingRatio = currentStats.income > 0
    ? (currentStats.outcome / currentStats.income) * 100
    : 0;

  // 2. Gasto por categoría
  const categoryMap: Record<string, number> = {};
  activeExpenses.forEach(e => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
  });
  const categoryBreakdown = Object.entries(categoryMap)
    .map(([cat, amt]) => ({ category: cat, amount: amt }))
    .sort((a, b) => b.amount - a.amount);

  // 3. Burn rate mensual (daily rate × days in month)
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const dailyBurnRate = currentStats.outcome / daysInMonth;
  const projectedMonthlyBurn = dailyBurnRate * daysInMonth; // = outcome (already a full month)
  const today = new Date();
  const currentDay = selectedMonth === today.getMonth() + 1 && selectedYear === today.getFullYear()
    ? today.getDate()
    : daysInMonth;
  const burnToDate = dailyBurnRate * currentDay;
  const burnProgress = (burnToDate / (currentStats.income || 1)) * 100;

  // 4. Punto de equilibrio: how much income covers current expenses
  const breakEvenCoverage = currentStats.income > 0
    ? Math.min((currentStats.income / (currentStats.outcome || 1)) * 100, 100)
    : 0;
  const breakEvenGap = currentStats.outcome - currentStats.income;

  // 5. Gasto por atleta: unique paying members this month
  const uniquePayingAthletes = new Set(
    payments.filter(p => p.status === 'approved').map(p => p.user_id)
  ).size;
  const costPerAthlete = uniquePayingAthletes > 0
    ? currentStats.outcome / uniquePayingAthletes
    : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-0 pb-12">
      
      {/* 1. COMMAND HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">
              {t('Accountability')}
            </h1>
            <div className="bg-pits-primary px-2 py-0.5 rounded text-[10px] font-bold text-pits-dark-text border border-pits-primary-dark tracking-widest uppercase shadow-sm">
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
                activeCurrency === CurrencyType.EUR ? 'bg-pits-surface-elevated text-pits-red shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t('EURO OPERATIONS')}
            </button>
            <button 
              onClick={() => setActiveCurrency(CurrencyType.VES)}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${
                activeCurrency === CurrencyType.VES ? 'bg-pits-surface-elevated text-pits-red shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t('VES BOLIVARES')}
            </button>
          </div>

          <div className="flex items-center gap-2 bg-pits-surface-elevated border border-slate-200 rounded-2xl p-1 shadow-sm">
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
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-pits-surface-elevated rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
            <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                <Scale size={18} className="text-pits-red" /> {t('Monthly P&L')} - {activeCurrency}
              </h3>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-pits-surface-elevated rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase">{t('Exchange Base')}:</span>
                <span className="text-[10px] font-black text-slate-700">€1 = {stats.exchangeRate?.toFixed(2) || '---'} VES</span>
              </div>
            </div>

            <div className="px-8">

              {/* PUNTO DE EQUILIBRIO — income vs outcome in one view */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-tighter flex items-center gap-2">
                    <Target size={14} className="text-pits-red" /> Punto de Equilibrio
                  </h4>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wide ${
                    breakEvenGap <= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    : 'bg-red-50 text-red-600 border border-red-100'
                  }`}>
                    {breakEvenGap <= 0 ? 'Alcanzado ✓' : 'No alcanzado'}
                  </span>
                </div>

                <div className="flex items-center gap-6">
                  {/* Circular gauge */}
                  <div className="relative w-24 h-24 flex-shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="14" />
                      <circle
                        cx="50" cy="50" r="38" fill="none"
                        stroke={breakEvenGap <= 0 ? '#10b981' : '#ef4444'}
                        strokeWidth="14"
                        strokeDasharray={`${(breakEvenCoverage / 100) * 238.76} 238.76`}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-black text-slate-900 leading-none">{breakEvenCoverage.toFixed(0)}%</span>
                      <span className="text-[7px] font-black text-slate-400 uppercase">cubierto</span>
                    </div>
                  </div>

                  {/* Rows */}
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-center bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Total gastos</span>
                      <span className="text-xs font-black text-red-500">{symbol}{currentStats.outcome.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Ingresos actuales</span>
                      <span className="text-xs font-black text-emerald-600">{symbol}{currentStats.income.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>
                    {breakEvenGap > 0 && (
                      <div className="flex justify-between items-center bg-red-50 rounded-xl p-2.5 border border-red-100">
                        <span className="text-[9px] font-black text-red-500 uppercase">Déficit</span>
                        <span className="text-xs font-black text-red-600">{symbol}{breakEvenGap.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                      </div>
                    )}
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
          <div className="bg-pits-surface-elevated rounded-3xl p-6 border border-slate-200 shadow-sm">
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

      {/* 3. NEW KPI SECTIONS */}
      <div className="space-y-6">

        {/* ROW A: % Gasto sobre ingresos + Burn Rate */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* % Gasto sobre ingresos */}
          <div className="bg-pits-surface-elevated rounded-3xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                <Percent size={16} className="text-pits-red" /> % Gasto sobre Ingresos
              </h3>
              <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wide ${
                spendingRatio > 100 ? 'bg-red-50 text-red-600 border border-red-100'
                : spendingRatio > 80 ? 'bg-amber-50 text-amber-600 border border-amber-100'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              }`}>
                {spendingRatio > 100 ? 'Over Budget' : spendingRatio > 80 ? 'Warning' : 'Healthy'}
              </span>
            </div>

            <div className="flex items-end gap-2 mb-4">
              <span className="text-5xl font-black text-slate-900 tracking-tighter">
                {spendingRatio.toFixed(1)}
              </span>
              <span className="text-2xl font-black text-slate-400 mb-1">%</span>
            </div>

            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-3">
              De cada {symbol}100 de ingreso, {symbol}{spendingRatio.toFixed(0)} se van en gastos
            </p>

            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  spendingRatio > 100 ? 'bg-red-500'
                  : spendingRatio > 80 ? 'bg-amber-400'
                  : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(spendingRatio, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[8px] font-bold text-slate-300 uppercase">0%</span>
              <span className="text-[8px] font-bold text-slate-300 uppercase">100% breakeven</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase">Ingresos</p>
                <p className="text-sm font-black text-emerald-600 mt-0.5">{symbol}{currentStats.income.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase">Gastos</p>
                <p className="text-sm font-black text-red-500 mt-0.5">{symbol}{currentStats.outcome.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
              </div>
            </div>
          </div>

          {/* Burn Rate Mensual */}
          <div className="bg-pits-surface-elevated rounded-3xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                <Flame size={16} className="text-orange-500" /> Burn Rate Mensual
              </h3>
              <span className="text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wide bg-orange-50 text-orange-600 border border-orange-100">
                {symbol}{dailyBurnRate.toFixed(2)}/día
              </span>
            </div>

            <div className="flex items-end gap-2 mb-1">
              <span className="text-5xl font-black text-slate-900 tracking-tighter">
                {symbol}{dailyBurnRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-sm font-black text-slate-400 mb-1">/ día</span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-4">
              Gasto diario promedio · {daysInMonth} días en el mes
            </p>

            <div className="space-y-2">
              <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase">
                <span>Quemado al día {currentDay}</span>
                <span>{symbol}{burnToDate.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-400 transition-all duration-1000"
                  style={{ width: `${Math.min(burnProgress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] font-bold text-slate-300 uppercase">
                <span>Día 1</span>
                <span>Día {daysInMonth}</span>
              </div>
            </div>

            <div className="mt-4 p-4 bg-orange-50/60 rounded-2xl border border-orange-100">
              <p className="text-[9px] font-black text-orange-700 uppercase tracking-wide">Proyección mensual completa</p>
              <p className="text-lg font-black text-slate-900 mt-1">{symbol}{projectedMonthlyBurn.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
          </div>
        </div>

        {/* ROW B: Gasto por Categoría */}
        <div className="bg-pits-surface-elevated rounded-3xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2 mb-6">
            <Layers size={16} className="text-violet-500" /> Gasto por Categoría
          </h3>

          {categoryBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-slate-300 text-xs font-bold uppercase">
              Sin gastos registrados en {activeCurrency}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
              {categoryBreakdown.map(({ category, amount }) => {
                const pct = currentStats.outcome > 0 ? (amount / currentStats.outcome) * 100 : 0;
                const CAT_COLORS: Record<string, string> = {
                  Staff: 'bg-blue-400',
                  Rent: 'bg-violet-400',
                  Utilities: 'bg-cyan-400',
                  Maintenance: 'bg-amber-400',
                  Services: 'bg-indigo-400',
                  Marketing: 'bg-pink-400',
                  Taxes: 'bg-red-400',
                  Other: 'bg-slate-400',
                };
                const barColor = CAT_COLORS[category] || 'bg-slate-400';
                return (
                  <div key={category} className="space-y-1.5">
                    <div className="flex justify-between items-end">
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-wide">{category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400">{pct.toFixed(1)}%</span>
                        <span className="text-xs font-black text-slate-900">{symbol}{amount.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all duration-1000`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide">
              {categoryBreakdown.length} categorías · Total gastos
            </span>
            <span className="text-sm font-black text-slate-900">
              {symbol}{currentStats.outcome.toLocaleString(undefined, {maximumFractionDigits: 0})}
            </span>
          </div>
        </div>


        {/* ROW C: Gasto por Atleta — full width */}
        <div className="bg-pits-surface-elevated rounded-3xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                <Users size={16} className="text-sky-500" /> Gasto por Atleta
              </h3>
              <span className="text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wide bg-sky-50 text-sky-600 border border-sky-100">
                {uniquePayingAthletes} atletas
              </span>
            </div>

            <div className="flex items-end gap-2 mb-1">
              <span className="text-5xl font-black text-slate-900 tracking-tighter">
                {symbol}{costPerAthlete.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-sm font-black text-slate-400 mb-1">/ atleta</span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-4">
              Costo operativo por atleta activo este mes
            </p>

            <div className="space-y-3">
              <div className="flex justify-between items-center bg-slate-50 rounded-xl p-3 border border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase">Atletas pagadores</span>
                <span className="text-xs font-black text-slate-900">{uniquePayingAthletes}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 rounded-xl p-3 border border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase">Total gastos</span>
                <span className="text-xs font-black text-red-500">{symbol}{currentStats.outcome.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
              </div>
              <div className="flex justify-between items-center bg-sky-50 rounded-xl p-3 border border-sky-100">
                <span className="text-[9px] font-black text-sky-600 uppercase">Ingreso por atleta</span>
                <span className="text-xs font-black text-sky-700">
                  {symbol}{(uniquePayingAthletes > 0 ? currentStats.income / uniquePayingAthletes : 0).toLocaleString(undefined, {maximumFractionDigits: 0})}
                </span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Margen neto por atleta</p>
              <p className={`text-lg font-black mt-0.5 ${
                uniquePayingAthletes > 0 && currentStats.net / uniquePayingAthletes >= 0 ? 'text-emerald-500' : 'text-red-500'
              }`}>
                {symbol}{(uniquePayingAthletes > 0 ? currentStats.net / uniquePayingAthletes : 0).toLocaleString(undefined, {maximumFractionDigits: 0})}
              </p>
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
    <div className={`p-6 rounded-[32px] border shadow-sm transition-all hover:shadow-md relative overflow-hidden group ${highlight ? 'bg-slate-50 border-slate-200 ring-2 ring-pits-red/5' : 'bg-pits-surface-elevated border-slate-200'}`}>
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

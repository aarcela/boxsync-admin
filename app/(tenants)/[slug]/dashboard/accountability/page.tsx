'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
import { currencySymbol } from '@/lib/currency';

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export default function AccountabilityPage() {
  const { t } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const periodString = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const { loading, stats, refresh, expenses, payments, currencies } = useAccountability(periodString);
  const [activeCurrency, setActiveCurrency] = useState<CurrencyType>(currencies.reference);

  useEffect(() => {
    setActiveCurrency((prev) =>
      prev === currencies.reference || prev === currencies.local
        ? prev
        : currencies.reference
    );
  }, [currencies.reference, currencies.local]);

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

  const currentStats =
    activeCurrency === currencies.local
      ? stats.local
      : stats.reference;
  const symbol = currencySymbol(activeCurrency);

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
    <div className="space-y-8 max-w-7xl mx-auto px-1 sm:px-0 pb-[max(7rem,calc(3rem+env(safe-area-inset-bottom)))] sm:pb-16">
      
      {/* 1. COMMAND HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-pits-edge">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-pits-text tracking-tighter uppercase">
              {t('Accountability')}
            </h1>
            <StatusBadge tone="info">{t('Monthly P&L')}</StatusBadge>
          </div>
          <p className="text-pits-dim text-xs font-semibold mt-1 tracking-wide uppercase">
            {t('Strategic balance and financial sustainability')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto min-w-0">
          <div className="flex w-full sm:w-auto bg-pits-surface-muted p-1 rounded-2xl border border-pits-edge">
            <button 
              onClick={() => setActiveCurrency(currencies.reference)}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-[10px] font-black uppercase rounded-xl whitespace-nowrap transition-all ${
                activeCurrency === currencies.reference ? 'bg-pits-surface-elevated text-pits-red shadow-sm' : 'text-pits-dim hover:text-pits-text'
              }`}
            >
              {t('REF OPERATIONS')}
            </button>
            <button 
              onClick={() => setActiveCurrency(currencies.local)}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-[10px] font-black uppercase rounded-xl whitespace-nowrap transition-all ${
                activeCurrency === currencies.local ? 'bg-pits-surface-elevated text-pits-red shadow-sm' : 'text-pits-dim hover:text-pits-text'
              }`}
            >
              {t('LOCAL OPERATIONS')}
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 bg-pits-surface-elevated border border-pits-edge rounded-2xl p-1 shadow-sm w-full sm:w-auto">
            <button 
              onClick={() => changeMonth(-1)}
              className="p-2 hover:bg-pits-surface-muted text-pits-dim hover:text-pits-red transition-all rounded-xl"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-3 flex items-center gap-2">
              <Calendar size={14} className="text-pits-red" />
              <span className="text-[11px] font-black uppercase text-pits-text w-28 text-center">
                {t(MONTHS[selectedMonth - 1] as any)} {selectedYear}
              </span>
            </div>
            <button 
              onClick={() => changeMonth(1)}
              className="p-2 hover:bg-pits-surface-muted text-pits-dim hover:text-pits-red transition-all rounded-xl"
            >
              <ChevronRight size={18} />
            </button>
            <div className="mx-1 h-6 w-px bg-pits-surface-muted" />
            <button 
              onClick={refresh}
              className={`p-2 hover:bg-pits-surface-muted text-pits-dim hover:text-pits-red transition-all rounded-xl ${loading ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. THE BALANCE BOARD (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <BalanceCard 
          label={t('Incomes')} 
          value={currentStats.income} 
          symbol={symbol} 
          type="plus" 
          info={`${t('Revenue Flow')} (${activeCurrency})`}
          color="success"
        />
        <BalanceCard 
          label={t('Outcomes')} 
          value={currentStats.outcome} 
          symbol={symbol} 
          type="minus" 
          info={`${t('Expense Burn')} (${activeCurrency})`}
          color="primary"
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
          <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm overflow-hidden min-h-[400px]">
            <div className="px-4 sm:px-6 py-5 border-b border-pits-edge flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-pits-surface-elevated">
              <h3 className="text-sm font-black text-pits-text uppercase tracking-tighter flex items-center gap-2 min-w-0">
                <Scale size={18} className="text-pits-red shrink-0" /> {t('Monthly P&L')} · {activeCurrency}
              </h3>
              <span className="inline-flex items-center gap-1.5 max-w-full shrink-0 px-2.5 py-1 rounded-lg border border-pits-edge bg-pits-surface-muted text-[9px] sm:text-[10px] font-black uppercase tracking-wide">
                <span className="text-pits-dim">{t('Exchange Base')}</span>
                <span className="text-pits-text truncate">
                  {currencySymbol(currencies.reference)}1 = {stats.exchangeRate?.toFixed(2) || '---'} {currencies.local}
                </span>
              </span>
            </div>

            <div className="px-4 sm:px-8 pb-6 sm:pb-8">

              {/* PUNTO DE EQUILIBRIO — income vs outcome in one view */}
              <div className="mt-6 pt-6 border-t border-pits-edge">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-6">
                  <h4 className="text-xs font-black text-pits-text uppercase tracking-tighter flex items-center gap-2 min-w-0">
                    <Target size={14} className="text-pits-red shrink-0" /> {t('Break-even Point')}
                  </h4>
                  <StatusBadge tone={breakEvenGap <= 0 ? 'success' : 'error'}>
                    {breakEvenGap <= 0 ? t('Achieved check') : t('Not achieved')}
                  </StatusBadge>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
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
                      <span className="text-lg font-black text-pits-text leading-none">{breakEvenCoverage.toFixed(0)}%</span>
                      <span className="text-[7px] font-black text-pits-dim uppercase">{t('covered')}</span>
                    </div>
                  </div>

                  {/* Rows */}
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-center bg-pits-surface-muted rounded-xl p-2.5 border border-pits-edge">
                      <span className="text-[9px] font-black text-pits-dim uppercase">{t('Total expenses label')}</span>
                      <span className="text-xs font-black text-pits-error">{symbol}{currentStats.outcome.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>
                    <div className="flex justify-between items-center bg-pits-surface-muted rounded-xl p-2.5 border border-pits-edge">
                      <span className="text-[9px] font-black text-pits-dim uppercase">{t('Current income label')}</span>
                      <span className="text-xs font-black text-pits-success">{symbol}{currentStats.income.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>
                    {breakEvenGap > 0 && (
                      <div className="flex justify-between items-center bg-pits-primary-soft rounded-xl p-2.5 border border-pits-edge">
                        <span className="text-[9px] font-black text-pits-error uppercase">{t('Deficit')}</span>
                        <span className="text-xs font-black text-pits-error">{symbol}{breakEvenGap.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CONSOLIDATED SUMMARY BAR */}
              <div className={`mt-8 sm:mt-10 p-5 sm:p-6 rounded-2xl sm:rounded-[32px] text-pits-text relative overflow-hidden shadow-sm border ${currentStats.net >= 0 ? 'bg-pits-surface-elevated border-pits-edge' : 'bg-pits-primary-soft border-pits-error'}`}>
                 <div className="absolute top-0 right-0 p-6 opacity-5">
                    <Zap size={72} className="text-pits-text" />
                 </div>
                 <div className="relative z-10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                       <div className={`p-2.5 rounded-xl shadow-sm ring-4 shrink-0 ${currentStats.net >= 0 ? 'bg-pits-primary text-pits-dark-text ring-pits-primary/20' : 'bg-pits-error text-pits-text ring-pits-error/20'}`}>
                          <Wallet size={18} />
                       </div>
                       <div className="min-w-0">
                          <p className="text-[9px] font-black text-pits-dim uppercase tracking-widest">{t('Sustainability Report')}</p>
                          <h4 className="text-sm sm:text-lg font-black tracking-tighter uppercase">{t('Net Balance')}</h4>
                       </div>
                    </div>
                    
                    <div className="sm:text-right min-w-0">
                       <p className="text-[9px] font-black text-pits-dim uppercase mb-0.5">{t('Total')} {activeCurrency}</p>
                       <p className={`text-xl sm:text-2xl font-black tracking-tighter break-all ${currentStats.net >= 0 ? 'text-pits-success' : 'text-pits-error'}`}>
                         {symbol}{formatMoney(currentStats.net)}
                       </p>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: COST STRUCTURE & ACTIONS (4 COLS) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-pits-surface-elevated rounded-3xl p-6 border border-pits-edge shadow-sm">
             <h3 className="text-xs font-black text-pits-text uppercase mb-6 flex items-center gap-2">
                <PieChart size={16} className="text-pits-red" /> {t('Financial Sustainability')}
             </h3>
             <div className="space-y-5">
                <SustainabilityMetric 
                  label={t('Fixed Costs')} 
                  value={fixedCosts} 
                  total={currentStats.outcome} 
                  symbol={symbol}
                  color="muted"
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
                  color="success"
                  t={t}
                />
             </div>
             
             <div className="mt-8 p-4 bg-pits-surface-muted/50 rounded-2xl border border-pits-edge/50">
                <p className="text-[9px] font-bold text-blue-700 uppercase tracking-tight flex items-center gap-2">
                   <Info size={12} /> {t('Strategic Insight')}
                </p>
                <p className="text-[10px] font-bold text-pits-text mt-2 leading-relaxed">
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
      <div className="space-y-8">

        {/* ROW A: % Gasto sobre ingresos + Burn Rate */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* % Gasto sobre ingresos */}
          <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm p-6">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-6">
              <h3 className="text-xs font-black text-pits-text uppercase tracking-tighter flex items-center gap-2 min-w-0">
                <Percent size={16} className="text-pits-red shrink-0" /> {t('% Spending vs Income')}
              </h3>
              <StatusBadge tone={spendingRatio > 100 ? 'error' : spendingRatio > 80 ? 'warning' : 'success'}>
                {spendingRatio > 100 ? t('Over Budget') : spendingRatio > 80 ? t('Warning') : t('Healthy')}
              </StatusBadge>
            </div>

            <div className="flex items-end gap-1 mb-4 min-w-0">
              <span className="text-3xl sm:text-4xl font-black text-pits-text tracking-tighter leading-none break-all">
                {spendingRatio.toFixed(1)}
              </span>
              <span className="text-lg sm:text-xl font-black text-pits-dim mb-0.5">%</span>
            </div>

            <p className="text-[9px] font-bold text-pits-dim uppercase tracking-wide mb-3">
              {t('Spending per income tip', { symbol, amount: spendingRatio.toFixed(0) })}
            </p>

            <div className="h-2 w-full bg-pits-surface-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  spendingRatio > 100 ? 'bg-pits-error'
                  : spendingRatio > 80 ? 'bg-pits-primary'
                  : 'bg-pits-success'
                }`}
                style={{ width: `${Math.min(spendingRatio, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[8px] font-bold text-pits-dim uppercase">0%</span>
              <span className="text-[8px] font-bold text-pits-dim uppercase">{t('100% breakeven')}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-pits-surface-muted rounded-2xl p-3 border border-pits-edge">
                <p className="text-[8px] font-black text-pits-dim uppercase">{t('Income')}</p>
                <p className="text-sm font-black text-pits-success mt-0.5">{symbol}{currentStats.income.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
              </div>
              <div className="bg-pits-surface-muted rounded-2xl p-3 border border-pits-edge">
                <p className="text-[8px] font-black text-pits-dim uppercase">{t('Expenses')}</p>
                <p className="text-sm font-black text-pits-error mt-0.5">{symbol}{currentStats.outcome.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
              </div>
            </div>
          </div>

          {/* Burn Rate Mensual */}
          <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm p-6">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-6">
              <h3 className="text-xs font-black text-pits-text uppercase tracking-tighter flex items-center gap-2 min-w-0">
                <Flame size={16} className="text-pits-primary shrink-0" /> {t('Monthly Burn Rate')}
              </h3>
              <StatusBadge tone="warning">
                {symbol}{dailyBurnRate.toFixed(0)} {t('per_day')}
              </StatusBadge>
            </div>

            <div className="flex items-end gap-1 mb-1 min-w-0">
              <span className="text-3xl sm:text-4xl font-black text-pits-text tracking-tighter leading-none break-all">
                {symbol}{formatMoney(dailyBurnRate)}
              </span>
              <span className="text-xs sm:text-sm font-black text-pits-dim mb-0.5 shrink-0">{t('per_day')}</span>
            </div>
            <p className="text-[9px] font-bold text-pits-dim uppercase tracking-wide mb-4">
              {t('Average daily spend · {{days}} days in month', { days: daysInMonth })}
            </p>

            <div className="space-y-2">
              <div className="flex justify-between text-[9px] font-black text-pits-dim uppercase">
                <span>{t('Burned through day {{day}}', { day: currentDay })}</span>
                <span>{symbol}{burnToDate.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
              </div>
              <div className="h-2 w-full bg-pits-surface-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-pits-primary transition-all duration-1000"
                  style={{ width: `${Math.min(burnProgress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] font-bold text-pits-dim uppercase">
                <span>{t('Day 1')}</span>
                <span>{t('Day {{day}}', { day: daysInMonth })}</span>
              </div>
            </div>

            <div className="mt-4 p-4 bg-pits-primary-soft/60 rounded-2xl border border-pits-edge">
              <p className="text-[9px] font-black text-pits-text uppercase tracking-wide">{t('Projected monthly burn label')}</p>
              <p className="text-lg font-black text-pits-text mt-1">{symbol}{projectedMonthlyBurn.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
          </div>
        </div>

        {/* ROW B: Gasto por Categoría */}
        <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm p-6">
          <h3 className="text-xs font-black text-pits-text uppercase tracking-tighter flex items-center gap-2 mb-6">
            <Layers size={16} className="text-violet-500" /> {t('Expense by Category')}
          </h3>

          {categoryBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-pits-dim text-xs font-bold uppercase">
              {t('No expenses recorded in {{currency}}', { currency: activeCurrency })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
              {categoryBreakdown.map(({ category, amount }) => {
                const pct = currentStats.outcome > 0 ? (amount / currentStats.outcome) * 100 : 0;
                const CAT_COLORS: Record<string, string> = {
                  Staff: 'bg-pits-primary',
                  Rent: 'bg-pits-success',
                  Utilities: 'bg-pits-dim',
                  Maintenance: 'bg-pits-primary',
                  Services: 'bg-pits-success',
                  Marketing: 'bg-pits-primary',
                  Taxes: 'bg-pits-error',
                  Other: 'bg-pits-dim',
                };
                const barColor = CAT_COLORS[category] || 'bg-pits-dim';
                return (
                  <div key={category} className="space-y-1.5">
                    <div className="flex justify-between items-end">
                      <span className="text-[9px] font-black text-pits-text uppercase tracking-wide">{category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-pits-dim">{pct.toFixed(1)}%</span>
                        <span className="text-xs font-black text-pits-text">{symbol}{amount.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-pits-surface-muted rounded-full overflow-hidden">
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

          <div className="mt-6 pt-4 border-t border-pits-edge flex items-center justify-between">
            <span className="text-[9px] font-black text-pits-dim uppercase tracking-wide">
              {t('{{count}} categories · Total expenses', { count: categoryBreakdown.length })}
            </span>
            <span className="text-sm font-black text-pits-text">
              {symbol}{currentStats.outcome.toLocaleString(undefined, {maximumFractionDigits: 0})}
            </span>
          </div>
        </div>


        {/* ROW C: Gasto por Atleta — full width */}
        <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm p-6">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-6">
              <h3 className="text-xs font-black text-pits-text uppercase tracking-tighter flex items-center gap-2 min-w-0">
                <Users size={16} className="text-pits-primary shrink-0" /> {t('Cost per athlete')}
              </h3>
              <StatusBadge tone="info">
                {t('{{count}} athletes', { count: uniquePayingAthletes })}
              </StatusBadge>
            </div>

            <div className="flex items-end gap-1 mb-1 min-w-0">
              <span className="text-3xl sm:text-4xl font-black text-pits-text tracking-tighter leading-none break-all">
                {symbol}{formatMoney(costPerAthlete)}
              </span>
              <span className="text-xs sm:text-sm font-black text-pits-dim mb-0.5 shrink-0">{t('per_athlete')}</span>
            </div>
            <p className="text-[9px] font-bold text-pits-dim uppercase tracking-wide mb-4">
              {t('Operating cost per active athlete this month')}
            </p>

            <div className="space-y-3">
              <div className="flex justify-between items-center bg-pits-surface-muted rounded-xl p-3 border border-pits-edge">
                <span className="text-[9px] font-black text-pits-dim uppercase">{t('Paying athletes')}</span>
                <span className="text-xs font-black text-pits-text">{uniquePayingAthletes}</span>
              </div>
              <div className="flex justify-between items-center bg-pits-surface-muted rounded-xl p-3 border border-pits-edge">
                <span className="text-[9px] font-black text-pits-dim uppercase">Total gastos</span>
                <span className="text-xs font-black text-pits-error">{symbol}{currentStats.outcome.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
              </div>
              <div className="flex justify-between items-center bg-pits-primary-soft rounded-xl p-3 border border-pits-edge">
                <span className="text-[9px] font-black text-pits-primary uppercase">{t('Revenue per athlete')}</span>
                <span className="text-xs font-black text-pits-text">
                  {symbol}{(uniquePayingAthletes > 0 ? currentStats.income / uniquePayingAthletes : 0).toLocaleString(undefined, {maximumFractionDigits: 0})}
                </span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-pits-surface-muted rounded-2xl border border-pits-edge">
              <p className="text-[9px] font-bold text-pits-dim uppercase">{t('Net margin per athlete')}</p>
              <p className={`text-lg font-black mt-0.5 ${
                uniquePayingAthletes > 0 && currentStats.net / uniquePayingAthletes >= 0 ? 'text-pits-success' : 'text-pits-error'
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

function formatMoney(value: number) {
  const digits = Math.abs(value) >= 1000 ? 0 : 2;
  return value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function StatusBadge({ tone, children }: { tone: 'success' | 'warning' | 'error' | 'info'; children: ReactNode }) {
  const tones: Record<string, string> = {
    success: 'bg-pits-success/15 text-pits-success border-pits-success/25',
    warning: 'bg-pits-primary-soft text-pits-primary border-pits-edge',
    error: 'bg-pits-error/10 text-pits-error border-pits-error/20',
    info: 'bg-pits-primary-soft text-pits-red border-pits-edge',
  };

  return (
    <span className={`inline-flex items-center justify-center text-center shrink-0 px-2 py-1 rounded-lg text-[8px] sm:text-[10px] font-black uppercase tracking-wide border leading-tight ${tones[tone]}`}>
      {children}
    </span>
  );
}

function BalanceCard({ label, value, symbol, type, info, color, highlight }: any) {
  const colors: Record<string, string> = {
    success: 'text-pits-success bg-pits-success/10 border-pits-success/20',
    primary: 'text-pits-error bg-pits-error/10 border-pits-error/20',
    emerald: 'text-pits-success bg-pits-success/10 border-pits-success/20',
    red: 'text-pits-error bg-pits-error/10 border-pits-error/20',
    purple: 'text-pits-primary bg-pits-primary-soft border-pits-edge',
    slate: 'text-pits-dim bg-pits-surface-muted border-pits-edge',
  };

  return (
    <div className={`p-3 sm:p-5 rounded-2xl sm:rounded-[28px] border shadow-sm transition-all hover:shadow-md relative overflow-hidden group min-w-0 ${highlight ? 'bg-pits-surface-muted border-pits-edge ring-2 ring-pits-red/5' : 'bg-pits-surface-elevated border-pits-edge'}`}>
      <div className="flex justify-between items-start gap-2 mb-4">
        <p className="text-[9px] sm:text-[10px] font-black text-pits-dim uppercase tracking-widest leading-tight min-w-0">{label}</p>
        <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border shrink-0 ${colors[color] ?? colors.slate}`}>
          {type === 'plus' ? <TrendingUp size={14} /> : type === 'minus' ? <TrendingDown size={14} /> : <Zap size={14} />}
        </div>
      </div>
      <div className="flex items-baseline gap-0.5 min-w-0">
        <span className="text-[10px] sm:text-xs font-black text-pits-dim shrink-0">{symbol}</span>
        <h2 className="text-sm sm:text-xl font-black text-pits-text tracking-tighter leading-none break-all">
          {formatMoney(value)}
        </h2>
      </div>
      <p className="text-[8px] font-bold text-pits-dim uppercase tracking-tighter flex items-center gap-1 mt-3">
        <Info size={10} className="shrink-0" /> <span className="truncate">{info}</span>
      </p>
    </div>
  );
}

function SustainabilityMetric({ label, value, total, symbol, color, t }: any) {
  const barColors: Record<string, string> = {
    muted: 'bg-pits-dim',
    slate: 'bg-pits-dim',
    amber: 'bg-pits-primary',
    success: 'bg-pits-success',
    emerald: 'bg-pits-success',
  };
  
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end">
        <p className="text-[9px] font-black text-pits-dim uppercase">{t(label)}</p>
        <span className="text-[10px] font-black text-pits-text">{symbol}{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      </div>
      <div className="h-1.5 w-full bg-pits-surface-muted rounded-full overflow-hidden border border-pits-edge flex items-center p-0.5">
        <div 
          className={`h-full rounded-full ${barColors[color]} transition-all duration-1000 shadow-sm`} 
          style={{ width: `${percentage}%` }} 
        />
      </div>
      <div className="flex justify-between">
         <span className="text-[8px] font-bold text-pits-dim uppercase">{percentage.toFixed(1)}% of total</span>
      </div>
    </div>
  );
}

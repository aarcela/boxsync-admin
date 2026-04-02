'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  DollarSign, Filter, Search, CheckCircle, XCircle, 
  AlertCircle, ExternalLink, RefreshCw, Lock, Clock, 
  TrendingUp, PieChart, Users, AlertTriangle, CreditCard,
  ArrowUpRight, ArrowDownRight, Activity
} from 'lucide-react';

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  status: 'pending' | 'approved' | 'rejected';
  proof_image_url: string;
  created_at: string;
  user_id: string;
  currency_type: string;
  profiles: {
    full_name: string | null;
  } | null;
}

interface CurrencyStats {
  totalRevenue: number;
  pendingAmount: number;
  methodCounts: Record<string, number>;
}

interface FinancialStats {
  EUR: CurrencyStats;
  ves: CurrencyStats;
  activeMembers: number;
  inactiveMembers: number;
  projectedRevenue: number;
  solvencyRate: number;
}

export enum CurrencyType {
  EUR = 'EUR',
  VES = 'VES',
}

export interface PaymentMethod {
  id: string;
  label: string;
  currency: CurrencyType;
  details: string | null;
  is_active: boolean;
}

const getPaymentCurrency = (method?: string, dbCurrency?: string, paymentMethods?: PaymentMethod[]) => {
  if (paymentMethods && paymentMethods.length > 0) {
    const methodObj = paymentMethods.find(
      m => m.id === method || m.label.toLowerCase() === String(method || '').toLowerCase()
    );
    if (methodObj) return methodObj.currency === CurrencyType.VES ? 'VES' : 'EUR';
  }
  return dbCurrency && String(dbCurrency).toUpperCase() === 'VES' ? 'VES' : 'EUR';
};

export default function FinancialsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCurrency, setActiveCurrency] = useState<'EUR' | 'VES'>('EUR');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [permissionIssue, setPermissionIssue] = useState(false);
  const [runningExpiry, setRunningExpiry] = useState(false);
  
  // Date Filter State
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());


  // Advanced Stats State
  const [stats, setStats] = useState<FinancialStats>({
    EUR: { totalRevenue: 0, pendingAmount: 0, methodCounts: {} },
    ves: { totalRevenue: 0, pendingAmount: 0, methodCounts: {} },
    activeMembers: 0,
    inactiveMembers: 0,
    projectedRevenue: 0,
    solvencyRate: 0
  });

  const fetchFinancials = async () => {
    setLoading(true);
    setPermissionIssue(false);
    
    try {
      // 1. Fetch All Payments
      const { data: payData, error: payError } = await supabase
        .from('payments')
        .select(`*, profiles ( full_name )`)
        .order('created_at', { ascending: false });

      if (payError) throw payError;
      const records = payData;
      setPayments(records);

      // 1.5 Fetch Payment Methods
      const { data: methodsData, error: methodsError } = await supabase
        .from('payment_methods')
        .select('*');
        
      if (methodsError) throw methodsError;
      const loadedMethods = methodsData as PaymentMethod[];
      setPaymentMethods(loadedMethods);

      // 2. Fetch Athlete Stats for Health/Projection
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('is_solvent, plan')
        .eq('role', 'member');

      if (profError) throw profError;

      // 3. Calculate Metrics
      const EURStats: CurrencyStats = { totalRevenue: 0, pendingAmount: 0, methodCounts: {} };
      const vesStats: CurrencyStats = { totalRevenue: 0, pendingAmount: 0, methodCounts: {} };

      records.forEach(p => {
        const paymentDate = new Date(p.created_at);
        const isSelectedMonth = paymentDate.getMonth() === selectedMonth && paymentDate.getFullYear() === selectedYear;

        if (isSelectedMonth) {
          const isVes = getPaymentCurrency(p.method, p.currency_type, loadedMethods) === 'VES';
          const targetStats = isVes ? vesStats : EURStats;

          if (p.status === 'approved') {
            targetStats.totalRevenue += p.amount;
            if (p.method && String(p.method) !== 'null' && String(p.method).trim() !== '') {
              targetStats.methodCounts[p.method] = (targetStats.methodCounts[p.method] || 0) + p.amount;
            }
          } else if (p.status === 'pending') {
            targetStats.pendingAmount += p.amount;
          }
        }
      });

      // Price mapping for projection (adjust based on your real prices)
      const PLAN_PRICES: Record<string, number> = { 
        unlimited: 80, 
        '5x_week': 70, 
        '4x_week': 60, 
        '3x_week': 50, 
        'open_box': 40 
      };

      let projected = 0;
      let activeCount = 0;
      let inactiveCount = 0;

      profiles.forEach(p => {
        if (p.is_solvent) activeCount++;
        else inactiveCount++;
        projected += PLAN_PRICES[p.plan] || 0;
      });

      const totalMembers = activeCount + inactiveCount;

      setStats({
        EUR: EURStats,
        ves: vesStats,
        activeMembers: activeCount,
        inactiveMembers: inactiveCount,
        projectedRevenue: projected,
        solvencyRate: totalMembers > 0 ? Math.round((activeCount / totalMembers) * 100) : 0
      });

      // RLS Check
      if (records.length === 0) {
        const { count } = await supabase.from('payments').select('*', { count: 'exact', head: true });
        if (count && count > 0) setPermissionIssue(true);
      }

    } catch (error: unknown) {
      console.error('Error loading financials:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, [selectedMonth, selectedYear]);

  const handleRunExpiry = async () => {
    if (!confirm('Run daily membership expiry check? This will lock accounts whose month is up.')) return;
    setRunningExpiry(true);
    try {
      const response = await fetch('/api/admin/cron/expire', { method: 'POST' });
      const result = await response.json();
      alert(result.message || 'Expiry check complete.');
      fetchFinancials();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert('Error: ' + errorMessage);
    } finally {
      setRunningExpiry(false);
    }
  };

  const handleApprove = async (id: string, userId: string) => {
    try {
      const { error: payError } = await supabase.from('payments').update({ status: 'approved' }).eq('id', id);
      if (payError) throw payError;
      await supabase.from('profiles').update({ is_solvent: true }).eq('id', userId);
      fetchFinancials();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert('Error approving' + errorMessage);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Reject payment?')) return;
    try {
      await supabase.from('payments').update({ status: 'rejected' }).eq('id', id);
      fetchFinancials();
    } catch (error) {
      alert('Error rejecting');
    }
  };

  const filteredPayments = payments.filter(p => {
    const paymentDate = new Date(p.created_at);
    const isSelectedMonth = paymentDate.getMonth() === selectedMonth && paymentDate.getFullYear() === selectedYear;
    if (!isSelectedMonth) return false;

    const isVes = getPaymentCurrency(p.method, p.currency_type, paymentMethods) === 'VES';
    const matchesCurrency = activeCurrency === 'VES' ? isVes : !isVes;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const athleteName = p.profiles?.full_name || 'Unknown';
    const matchesSearch = searchTerm === '' || athleteName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCurrency && matchesStatus && matchesSearch;
  });

  const currentStats = activeCurrency === 'VES' ? stats.ves : stats.EUR;
  const currSym = activeCurrency === 'VES' ? 'Bs' : '';

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-pits-text uppercase italic tracking-tighter">
            Financial Dashboard
          </h2>
          <p className="text-pits-dim font-medium text-sm">
            Revenue tracking and solvency health monitoring.
          </p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={handleRunExpiry}
            disabled={runningExpiry}
            className={`flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-black transition-all €{runningExpiry ? 'opacity-50' : ''}`}
          >
            <Clock size={16} className={`mr-2 €{runningExpiry ? 'animate-spin' : ''}`} />
            {runningExpiry ? 'Syncing...' : 'Run Expiry Check'}
          </button>
          <button onClick={fetchFinancials} className="p-2 bg-pits-card border border-gray-200 rounded-lg hover:bg-gray-50 text-pits-dim"><RefreshCw size={20} /></button>
        </div>
      </div>

      {/* PERIOD SELECTOR & CURRENCY TABS */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex bg-gray-100 p-1 rounded-xl w-full max-w-sm">
          <button 
            onClick={() => setActiveCurrency('EUR')} 
            className={`flex-1 py-1.5 text-center text-[10px] font-black uppercase rounded-lg transition-all ${activeCurrency === 'EUR' ? 'bg-white text-pits-text shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            EUR (€)
          </button>
          <button 
            onClick={() => setActiveCurrency('VES')} 
            className={`flex-1 py-1.5 text-center text-[10px] font-black uppercase rounded-lg transition-all ${activeCurrency === 'VES' ? 'bg-white text-pits-text shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            VES (Bs)
          </button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="flex-1 md:w-32 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-gray-700 outline-none uppercase"
          >
            {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, i) => (
              <option key={month} value={i}>{month}</option>
            ))}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="flex-1 md:w-24 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-gray-700 outline-none uppercase"
          >
            {[2024, 2025, 2026].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TOP METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Actual Revenue */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-green-50 rounded-lg text-green-600"><DollarSign size={20}/></div>
            <ArrowUpRight size={16} className="text-green-500" />
          </div>
          <p className="text-2xl font-black text-pits-text">{currSym}{currentStats.totalRevenue.toLocaleString()}</p>
          <p className="text-pits-dim text-[10px] font-bold uppercase tracking-widest mt-1">
            Total Approved in {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][selectedMonth]}
          </p>
        </div>

        {/* Projected Revenue */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><TrendingUp size={20}/></div>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">TARGET</span>
          </div>
          <p className="text-2xl font-black text-pits-text">€{stats.projectedRevenue.toLocaleString()}</p>
          <p className="text-pits-dim text-[10px] font-bold uppercase tracking-widest mt-1">Expected Monthly Income</p>
        </div>

        {/* Box Health */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Activity size={20}/></div>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full €{stats.solvencyRate < 80 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              {stats.solvencyRate}% HEALTH
            </span>
          </div>
          <p className="text-2xl font-black text-pits-text">{stats.activeMembers} / {stats.activeMembers + stats.inactiveMembers}</p>
          <p className="text-pits-dim text-[10px] font-bold uppercase tracking-widest mt-1">Athletes Solvent / Total</p>
        </div>

        {/* Method Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <p className="text-pits-dim text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center">
            <PieChart size={12} className="mr-2"/> Method Share
          </p>
          <div className="space-y-2">
            {Object.entries(currentStats.methodCounts).map(([method, amount]) => (
              <div key={method} className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 truncate mr-2">{method}</span>
                <span className="text-[10px] font-black text-pits-text">{currSym}{amount.toLocaleString()}</span>
              </div>
            ))}
            {Object.keys(currentStats.methodCounts).length === 0 && <p className="text-[10px] text-gray-300 italic">No approved data</p>}
          </div>
        </div>
      </div>

      {/* PENDING QUEUE ALERT */}
      {currentStats.pendingAmount > 0 && (
        <div className="bg-pits-red p-4 rounded-xl flex items-center justify-between shadow-lg shadow-red-100 animate-pulse">
          <div className="flex items-center">
            <AlertTriangle className="text-white mr-3" size={24} />
            <div>
              <p className="text-white font-black text-sm uppercase italic tracking-tight">Pending Capital</p>
              <p className="text-white/80 text-xs font-medium">There is <span className="font-black text-white">{currSym}{currentStats.pendingAmount.toLocaleString()}</span> waiting to be approved.</p>
            </div>
          </div>
          <button 
            onClick={() => setStatusFilter('pending')}
            className="bg-white text-pits-red px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-colors"
          >
            Process Now
          </button>
        </div>
      )}

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by athlete name..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-pits-red outline-none transition-all" 
          />
        </div>
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter size={20} className="text-gray-400" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex-1 md:w-48 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none">
            <option value="all">All Records</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center">
            <RefreshCw className="animate-spin mb-2" />
            <p className="text-xs font-bold uppercase">Syncing Ledger...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-gray-50 font-bold tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Transaction Date</th>
                  <th className="px-6 py-4">Athlete</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Reference</th>
                  <th className="px-6 py-4 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-500 font-medium text-xs">
                      {new Date(payment.created_at).toLocaleDateString()} 
                      <span className="block text-[10px] text-gray-300">{new Date(payment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-pits-text">{payment.profiles?.full_name || 'Anonymous Athlete'}</div>
                      <div className="text-[10px] text-gray-400">ID: {payment.user_id.slice(0, 8)}</div>
                    </td>
                    <td className="px-6 py-4">
                      {payment.method && String(payment.method) !== 'null' && String(payment.method).trim() !== '' ? (
                        <div className="flex items-center text-gray-500">
                          <CreditCard size={12} className="mr-1.5 opacity-50" />
                          <span className="text-[10px] font-black uppercase tracking-wider">
                            {payment.method}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-black text-gray-900">{currSym}{payment.amount}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border
                        €{payment.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : 
                          payment.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-yellow-50 text-yellow-700 border-yellow-200'}
                      `}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <a href={payment.proof_image_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 font-black text-[10px] underline flex items-center justify-center">
                         VIEW PROOF <ExternalLink size={10} className="ml-1" />
                       </a>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {payment.status === 'pending' ? (
                        <div className="flex items-center justify-end space-x-2">
                           <button onClick={() => handleReject(payment.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Reject"><XCircle size={18} /></button>
                           <button onClick={() => handleApprove(payment.id, payment.user_id)} className="px-3 py-1.5 bg-green-600 text-white rounded font-black text-[10px] uppercase shadow-sm hover:bg-green-700 transition-all">APPROVE</button>
                        </div>
                      ) : (<span className="text-gray-300 italic text-[10px]">Archived</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
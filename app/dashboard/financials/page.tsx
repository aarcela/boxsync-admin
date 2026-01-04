'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { DollarSign, Filter, Search, CheckCircle, XCircle, AlertCircle, ExternalLink, RefreshCw, Lock } from 'lucide-react';

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  status: 'pending' | 'approved' | 'rejected';
  proof_image_url: string;
  created_at: string;
  user_id: string; // Needed for approving solvency
  profiles: {
    full_name: string | null;
  } | null;
}

export default function FinancialsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Debug State
  const [permissionIssue, setPermissionIssue] = useState(false);

  // Stats
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);

  const fetchFinancials = async () => {
    setLoading(true);
    setPermissionIssue(false);
    
    try {
      // 1. Fetch Payments
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          profiles ( full_name )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const records = data as PaymentRecord[];
      setPayments(records);

      // 2. Permission Check
      if (records.length === 0) {
        const { count } = await supabase.from('payments').select('*', { count: 'exact', head: true });
        if (count && count > 0) {
          setPermissionIssue(true);
        }
      }

      // Calculate Totals
      const approved = records.filter(p => p.status === 'approved');
      setApprovedCount(approved.length);
      setTotalRevenue(approved.reduce((sum, p) => sum + p.amount, 0));

    } catch (error: unknown) {
      console.error('Error loading financials:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  // --- ACTIONS ---

  const handleApprove = async (id: string, userId: string) => {
    try {
      // 1. Update Payment Status
      const { error: payError } = await supabase
        .from('payments')
        .update({ status: 'approved' })
        .eq('id', id);
      
      if (payError) throw payError;

      // 2. Update User Solvency (Grant Access)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_solvent: true })
        .eq('id', userId);

      if (profileError) throw profileError;

      // 3. Local Update
      setPayments(prev => prev.map(p => 
        p.id === id ? { ...p, status: 'approved' } : p
      ));
      // Re-calc stats
      setApprovedCount(prev => prev + 1);
      const paymentAmount = payments.find(p => p.id === id)?.amount || 0;
      setTotalRevenue(prev => prev + paymentAmount);

    } catch (error) {
      alert('Error approving payment');
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Are you sure you want to reject this payment?')) return;
    
    try {
      const { error } = await supabase
        .from('payments')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;

      // Local Update
      setPayments(prev => prev.map(p => 
        p.id === id ? { ...p, status: 'rejected' } : p
      ));
      
      // If it was previously approved, decrease stats (edge case)
      const wasApproved = payments.find(p => p.id === id)?.status === 'approved';
      if (wasApproved) {
        setApprovedCount(prev => prev - 1);
        const paymentAmount = payments.find(p => p.id === id)?.amount || 0;
        setTotalRevenue(prev => prev - paymentAmount);
      }

    } catch (error) {
      alert('Error rejecting payment');
    }
  };

  const filteredPayments = payments.filter(p => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const athleteName = p.profiles?.full_name || 'Unknown';
    const matchesSearch = searchTerm === '' || athleteName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-pits-text uppercase italic tracking-tighter">
            Financial History
          </h2>
          <p className="text-pits-dim font-medium text-sm">
            Audit trail of all incoming transactions.
          </p>
        </div>
        <button 
          onClick={fetchFinancials}
          className="p-2 bg-pits-card border border-gray-200 rounded-lg hover:bg-gray-50 text-pits-dim transition-colors"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* PERMISSION ERROR BANNER */}
      {permissionIssue && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-center justify-between animate-pulse">
          <div className="flex items-center">
            <Lock className="text-red-500 mr-3" size={24} />
            <div>
              <h4 className="text-red-800 font-bold text-sm uppercase">Hidden Data Detected</h4>
              <p className="text-red-700 text-sm">Database contains payments, but you are not authorized to see them. Please run the SQL Repair Script.</p>
            </div>
          </div>
        </div>
      )}

      {/* STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-pits-card p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
             <p className="text-pits-dim font-bold text-xs uppercase tracking-widest mb-1">Total Revenue</p>
             <p className="text-4xl font-black text-pits-text">${totalRevenue.toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="bg-pits-card p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
             <p className="text-pits-dim font-bold text-xs uppercase tracking-widest mb-1">Successful Payments</p>
             <p className="text-4xl font-black text-pits-text">{approvedCount}</p>
          </div>
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-500">
            <CheckCircle size={24} />
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search athlete..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-pits-red focus:border-transparent outline-none transition-all"
          />
        </div>
        
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter size={20} className="text-gray-400" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 md:w-48 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-pits-red"
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading records...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p>No records found matching your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 font-bold tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Athlete</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Proof</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    
                    <td className="px-6 py-4 text-gray-500 font-medium whitespace-nowrap">
                      {new Date(payment.created_at).toLocaleDateString()} 
                      <span className="text-xs text-gray-400 ml-1">
                        {new Date(payment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-bold text-pits-text">
                      {payment.profiles?.full_name || 'Unknown'}
                    </td>

                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                        {payment.method || 'Transfer'}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-black text-gray-900">
                      ${payment.amount}
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border
                        ${payment.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : 
                          payment.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-yellow-50 text-yellow-700 border-yellow-200'}
                      `}>
                        {payment.status === 'approved' && <CheckCircle size={12} className="mr-1" />}
                        {payment.status === 'rejected' && <XCircle size={12} className="mr-1" />}
                        {payment.status === 'pending' && <AlertCircle size={12} className="mr-1" />}
                        {payment.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                       <a 
                         href={payment.proof_image_url} 
                         target="_blank" 
                         rel="noreferrer"
                         className="inline-flex items-center text-blue-600 hover:text-blue-800 font-bold text-xs underline"
                       >
                         Receipt <ExternalLink size={10} className="ml-1" />
                       </a>
                    </td>

                    <td className="px-6 py-4 text-right">
                      {payment.status === 'pending' ? (
                        <div className="flex items-center justify-end space-x-2">
                           <button 
                            onClick={() => handleReject(payment.id)}
                            className="p-1 text-gray-400 hover:text-pits-error hover:bg-red-50 rounded transition-colors"
                            title="Reject"
                          >
                            <XCircle size={18} />
                          </button>
                          <button 
                            onClick={() => handleApprove(payment.id, payment.user_id)}
                            className="p-1 text-gray-400 hover:text-pits-success hover:bg-green-50 rounded transition-colors"
                            title="Approve"
                          >
                            <CheckCircle size={18} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-300">--</span>
                      )}
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
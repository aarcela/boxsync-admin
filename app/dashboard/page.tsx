'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle, XCircle, ExternalLink, RefreshCw, DollarSign, Users, AlertTriangle } from 'lucide-react';

// Type definition for the joined data
interface PaymentRequest {
  id: string;
  amount: number;
  method: string;
  proof_image_url: string;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string;
  } | null;
}

export default function DashboardPage() {
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pendingCount: 0, totalMembers: 0 });

  // FETCH DATA
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Get Pending Payments (Joined with Profiles)
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          id, amount, method, proof_image_url, created_at, user_id,
          profiles ( full_name )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // 2. Get Total Members Count
      const { count: memberCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      setPayments((paymentsData as unknown) as PaymentRequest[]);
      setStats({
        pendingCount: paymentsData?.length || 0,
        totalMembers: memberCount || 0
      });

    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // ACTION: APPROVE PAYMENT
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

      // 3. Remove from local state
      setPayments(prev => prev.filter(p => p.id !== id));
      setStats(prev => ({ ...prev, pendingCount: prev.pendingCount - 1 }));

    } catch (error) {
      alert('Error approving payment');
    }
  };

  // ACTION: REJECT PAYMENT
  const handleReject = async (id: string) => {
    if (!confirm('Are you sure you want to reject this payment?')) return;
    
    try {
      const { error } = await supabase
        .from('payments')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;

      setPayments(prev => prev.filter(p => p.id !== id));
      setStats(prev => ({ ...prev, pendingCount: prev.pendingCount - 1 }));

    } catch (error) {
      alert('Error rejecting payment');
    }
  };

  return (
    <div className="space-y-8">
      {/* TITLE SECTION */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-pits-text uppercase italic tracking-tighter">
            Overview
          </h2>
          <p className="text-pits-dim font-medium text-sm">Welcome back, Coach.</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="p-2 bg-pits-card border border-gray-200 rounded-lg hover:bg-gray-50 text-pits-dim transition-colors"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Pending (Action Required) */}
        <div className="bg-pits-card p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between border-l-4 border-l-pits-red">
          <div>
            <p className="text-pits-dim font-bold text-xs uppercase tracking-widest mb-1">Pending Reviews</p>
            <p className="text-4xl font-black text-pits-text">{stats.pendingCount}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-full text-pits-red">
            <AlertTriangle size={24} />
          </div>
        </div>

        {/* Card 2: Members */}
        <div className="bg-pits-card p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-pits-dim font-bold text-xs uppercase tracking-widest mb-1">Total Athletes</p>
            <p className="text-4xl font-black text-pits-text">{stats.totalMembers}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-full text-gray-600">
            <Users size={24} />
          </div>
        </div>

        {/* Card 3: Revenue (Placeholder) */}
        <div className="bg-pits-card p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-pits-dim font-bold text-xs uppercase tracking-widest mb-1">Monthly Revenue</p>
            <p className="text-4xl font-black text-pits-text">$ --</p>
          </div>
          <div className="p-3 bg-green-50 rounded-full text-pits-success">
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      {/* PENDING PAYMENTS TABLE */}
      <div className="bg-pits-card rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-black text-pits-text uppercase italic tracking-tight">
            Incoming Payments
          </h3>
          <span className="bg-pits-red/10 text-pits-red text-xs font-bold px-2 py-1 rounded-md">
            {stats.pendingCount} New
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-pits-dim">Loading payments...</div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-pits-dim flex flex-col items-center">
             <CheckCircle size={48} className="mb-4 text-pits-success opacity-20" />
             <p>All clear. No pending payments.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-pits-dim uppercase bg-gray-50 font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Athlete</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Proof</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-pits-dim">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-pits-text">
                        {payment.profiles?.full_name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs font-bold bg-gray-100 text-pits-dim border border-gray-200">
                        {payment.method || 'Transfer'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-pits-text text-lg">
                      ${payment.amount}
                    </td>
                    <td className="px-6 py-4">
                      <a 
                        href={payment.proof_image_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center text-blue-600 hover:text-blue-800 font-bold text-xs"
                      >
                        <ExternalLink size={14} className="mr-1" />
                        View
                      </a>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => handleReject(payment.id)}
                        className="inline-flex items-center justify-center p-2 rounded-lg text-pits-error hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
                        title="Reject"
                      >
                        <XCircle size={20} />
                      </button>
                      <button 
                        onClick={() => handleApprove(payment.id, payment.user_id)}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-pits-success text-white hover:bg-green-700 font-bold text-xs uppercase tracking-wide shadow-md shadow-green-100 transition-all"
                      >
                        <CheckCircle size={16} className="mr-2" />
                        Approve
                      </button>
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
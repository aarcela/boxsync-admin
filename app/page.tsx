'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import Image from 'next/image';
import { Loader2, Globe } from 'lucide-react';
import { useLanguage } from '../components/LanguageContext';

export default function LoginPage() {
  const { lang, setLanguage, t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Authenticate
      const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      if (!user) throw new Error(t('No user found'));

      // 2. Authorization Check (RBAC)
      // We check the profiles table to ensure they are actually Staff
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.role !== 'manager' && profile.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error(t('Unauthorized: Staff access only.'));
      }

      // 3. Redirect to Dashboard
      router.push('/dashboard');

    } catch (err: unknown) {
      // Type-safe error handling
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred during login.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      {/* Top Right Language Toggle */}
      <div className="absolute top-6 right-6 flex items-center bg-white border border-gray-100 rounded-full p-1 shadow-sm">
        <button
          onClick={() => setLanguage('en')}
          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${
            lang === 'en' ? 'bg-pits-red text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          EN
        </button>
        <button
          onClick={() => setLanguage('es')}
          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${
            lang === 'es' ? 'bg-pits-red text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          ES
        </button>
      </div>

      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gray-900 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg p-3">
            <Image
              src="/assets/logo.png"
              alt="Pits CrossFit"
              width={48}
              height={48}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">
            Pits CrossFit
          </h1>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">
            {t('Command Center')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              {t('Staff Email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none"
              placeholder="coach@pitscrossfit.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              {t('Password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm font-bold p-3 rounded-lg text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-lg flex items-center justify-center text-white font-bold uppercase tracking-widest text-sm shadow-lg transition-all
              ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-pits-red hover:bg-pits-red-dark shadow-red-200'}
            `}
          >
            {loading && <Loader2 size={18} className="animate-spin mr-2" />}
            {loading ? t('Verifying...') : t('Access Dashboard')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            {t('Authorized personnel only. IP address is being logged.')}
          </p>
        </div>
      </div>
    </div>
  );
}
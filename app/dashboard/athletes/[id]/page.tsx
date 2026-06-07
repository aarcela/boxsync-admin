'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  MessageCircle, 
  Mail, 
  Phone, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  CreditCard, 
  User, 
  TrendingUp, 
  Clock,
  Shield,
  Award,
  History,
  Instagram,
  QrCode,
  AlertTriangle as AlertSquare,
  FileCheck,
  Ruler,
  Activity
} from 'lucide-react';
import { athleteService } from '@/lib/services/athleteService';
import { membershipPlanService } from '@/lib/services/membershipPlanService';
import { Profile } from '@/lib/types/gym';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/components/Toast';

export default function AthleteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [planDisplayName, setPlanDisplayName] = useState<string>('None');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAthlete() {
      if (!id) return;
      try {
        const data = await athleteService.getProfileById(id as string);
        setProfile(data);
        const profileWithTenant = data as Profile & { tenant_id?: string };
        const name = await membershipPlanService.resolvePlanDisplayName(
          profileWithTenant.plan,
          profileWithTenant.tenant_id
        );
        setPlanDisplayName(name ?? 'None');
      } catch (error) {
        console.error('Error fetching athlete:', error);
        toast('Failed to load athlete details', 'error');
      } finally {
        setLoading(false);
      }
    }

    fetchAthlete();
  }, [id, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pits-red border-t-transparent rounded-full animate-spin" />
          <p className="text-pits-dim font-bold uppercase tracking-widest text-xs">Loading Athlete Radar...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-black text-gray-400">Athlete Not Found</h2>
        <button 
          onClick={() => router.back()}
          className="mt-4 text-pits-red font-bold flex items-center justify-center mx-auto hover:underline"
        >
          <ArrowLeft size={18} className="mr-2" /> Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* NAVIGATION */}
      <div className="flex justify-between items-center">
        <button 
          onClick={() => router.back()}
          className="group flex items-center text-gray-400 hover:text-black transition-colors font-bold uppercase text-xs tracking-widest"
        >
          <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Roster
        </button>
        <span className="text-[10px] text-gray-400 font-mono">UUID: {profile.id}</span>
      </div>

      {/* HEADER CARD */}
      <div className="bg-pits-surface-elevated rounded-3xl border border-gray-100 shadow-2xl overflow-hidden">
        <div className="h-32 from-black via-gray-900 to-pits-red" />
        <div className="px-8 pb-8 -mt-16">
          <div className="flex flex-col md:flex-row items-end gap-6">
            <div className="relative">
              <div className="w-32 h-32 rounded-3xl bg-pits-surface-elevated p-1 shadow-2xl border border-gray-100">
                <div className="relative w-full h-full rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 overflow-hidden">
                  {profile.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <User size={48} />
                  )}
                </div>
              </div>
              <div className={`absolute -bottom-2 -right-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg ${
                profile.is_solvent ? 'bg-green-500 text-white' : 'bg-pits-primary text-pits-dark-text'
              }`}>
                {profile.is_solvent ? 'Solvent' : 'Overdue'}
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-black text-black uppercase italic tracking-tighter">
                  {profile.full_name}
                </h1>
                <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-black uppercase tracking-widest">
                  {profile.role}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center text-gray-500 text-sm font-medium">
                  <Mail size={16} className="mr-2 text-pits-red" />
                  {profile.email}
                </div>
                <div className="flex items-center text-gray-500 text-sm font-medium">
                  <Phone size={16} className="mr-2 text-pits-red" />
                  {profile.phone}
                </div>
                <div className="flex items-center text-gray-500 text-sm font-medium italic">
                  <History size={16} className="mr-2 text-pits-red" />
                  Since {format(new Date(profile.created_at), 'MMMM yyyy')}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {profile.qr_code && (
                <div className="p-3 bg-gray-100 text-gray-500 rounded-2xl hover:bg-black hover:text-white transition-all cursor-help" title={`QR ID: ${profile.qr_code}`}>
                  <QrCode size={24} />
                </div>
              )}
              {profile.instagram && (
                <a 
                  href={`https://instagram.com/${profile.instagram.replace('@', '')}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-3 bg-pink-50 text-pink-600 rounded-2xl hover:bg-pink-600 hover:text-white transition-all shadow-sm active:scale-95"
                  title="Instagram"
                >
                  <Instagram size={24} />
                </a>
              )}
              <a 
                href={`https://wa.me/${profile.phone?.replace(/[^0-9]/g, '')}`} 
                target="_blank" 
                rel="noreferrer"
                className="p-3 bg-green-50 text-green-600 rounded-2xl hover:bg-green-600 hover:text-white transition-all shadow-sm active:scale-95"
                title="WhatsApp"
              >
                <MessageCircle size={24} />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* LEFT COLUMN: MEMBERSHIP & LEGAL */}
        <div className="md:col-span-1 space-y-8">
          {/* MEMBERSHIP */}
          <div className="bg-pits-surface-elevated p-6 rounded-3xl border border-gray-100 shadow-xl space-y-6">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50 pb-4 flex items-center">
              <Shield size={14} className="mr-2" /> Membership Radar
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pits-red/5 text-pits-red rounded-xl">
                    <Award size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Current Plan</p>
                    <p className="text-sm font-black text-black uppercase">{planDisplayName}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Inscription ({profile.inscription_plan || 'Standard'})</p>
                    <p className="text-sm font-black text-black uppercase">
                      {profile.inscription_cost ? `$${profile.inscription_cost}` : 'Fee N/A'}
                    </p>
                  </div>
                </div>
                {profile.inscription_paid ? (
                  <CheckCircle2 size={18} className="text-green-500" />
                ) : (
                  <XCircle size={18} className="text-pits-red" />
                )}
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Last Payment Detected</p>
                  <p className="text-xs font-bold text-gray-700">
                    {profile.last_payment_date ? format(new Date(profile.last_payment_date), 'dd MMM yyyy') : 'No records'}
                  </p>
                </div>
                {profile.last_payment_date && (
                  <span className="text-[10px] text-gray-400 font-medium">
                    {formatDistanceToNow(new Date(profile.last_payment_date), { addSuffix: true })}
                  </span>
                )}
              </div>
              
              {profile.admin_note && (
                <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-2xl">
                  <p className="text-[10px] text-yellow-700 font-black uppercase tracking-wider mb-1">Coach Notes</p>
                  <p className="text-xs text-yellow-900 leading-relaxed font-medium">&quot;{profile.admin_note}&quot;</p>
                </div>
              )}
            </div>
          </div>

          {/* EMERGENCY CONTACT */}
          <div className="bg-pits-card text-white p-6 rounded-3xl shadow-xl space-y-6">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] border-b border-white/10 pb-4 flex items-center">
              <AlertSquare size={14} className="mr-2 text-pits-red" /> In Case of Emergency
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Contact Person</p>
                <p className="text-sm font-black text-white uppercase italic">{profile.emergency_contact_name || 'Not Specified'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Contact Phone</p>
                <p className="text-sm font-black text-white italic">{profile.emergency_contact_phone || 'None'}</p>
              </div>
            </div>
          </div>

          {/* LEGAL & AFFIDAVITS */}
          <div className="bg-pits-surface-elevated p-6 rounded-3xl border border-gray-100 shadow-xl space-y-6">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50 pb-4 flex items-center">
              <FileCheck size={14} className="mr-2" /> Legal & Onboarding
            </h3>
            <div className="space-y-4 font-mono">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-400 uppercase">Affid. Version</span>
                <span className="font-bold">v{profile.onboarding_affidavit_version || 1}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold uppercase">Truthfulness</span>
                {profile.onboarding_affidavit_truth ? <CheckCircle2 size={16} className="text-green-500" /> : <XCircle size={16} className="text-gray-300" />}
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold uppercase">Physical Fit</span>
                {profile.onboarding_affidavit_fit ? <CheckCircle2 size={16} className="text-green-500" /> : <XCircle size={16} className="text-gray-300" />}
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold uppercase">Rights Release</span>
                {profile.onboarding_affidavit_release ? <CheckCircle2 size={16} className="text-green-500" /> : <XCircle size={16} className="text-gray-300" />}
              </div>
              <div className="pt-4 border-t border-gray-50">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Accepted At</p>
                <p className="text-xs font-medium text-gray-700 italic">
                  {profile.onboarding_affidavit_accepted_at ? format(new Date(profile.onboarding_affidavit_accepted_at), 'dd/MM/yyyy HH:mm') : 'Pending acceptance'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: PHYSICAL PROFILE & HEALTH */}
        <div className="md:col-span-1 space-y-8">
           {/* PHYSICAL PROFILE */}
           <div className="bg-pits-surface-elevated p-6 rounded-3xl border border-gray-100 shadow-xl space-y-6">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50 pb-4 flex items-center">
              <Ruler size={14} className="mr-2 text-pits-red" /> Physical Profile
            </h3>
            <div className="grid grid-cols-2 gap-6">
               <div className="space-y-1">
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Sex</p>
                 <p className="text-sm font-black text-black uppercase">{profile.sex || 'N/A'}</p>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Birth Date</p>
                 <p className="text-sm font-black text-black uppercase">
                   {profile.birth_date ? format(new Date(profile.birth_date), 'dd/MM/yyyy') : 'N/A'}
                 </p>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Height</p>
                 <p className="text-sm font-black text-black uppercase">{profile.height_cm ? `${profile.height_cm} cm` : 'N/A'}</p>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Weight</p>
                 <p className="text-sm font-black text-black uppercase">{profile.weight_kg ? `${profile.weight_kg} kg` : 'N/A'}</p>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">CF Level</p>
                 <span className="px-2 py-0.5 bg-pits-primary text-pits-dark-text rounded text-[10px] font-black uppercase tracking-tighter italic">
                   {profile.level || 'Beginner'}
                 </span>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Experience</p>
                 <p className="text-sm font-black text-black uppercase">{profile.crossfit_years ? `${profile.crossfit_years} Yrs` : 'New'}</p>
               </div>
            </div>
            <div className="pt-4 border-t border-gray-50">
               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Home Box</p>
               <p className="text-sm font-black text-black uppercase italic">{profile.home_box || 'WODUS'}</p>
            </div>
          </div>

          {/* HEALTH & SAFETY */}
          <div className="bg-red-50 p-6 rounded-3xl border border-red-100 shadow-xl space-y-6">
            <h3 className="text-xs font-black text-red-400 uppercase tracking-[0.2em] border-b border-red-100 pb-4 flex items-center">
              <Activity size={14} className="mr-2" /> Health & Safety
            </h3>
            <div className="space-y-4">
              <div className="p-3 bg-pits-surface-elevated rounded-2xl">
                 <div className="flex justify-between items-center mb-1">
                   <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Allergies</p>
                   {profile.has_allergies ? <XCircle size={14} className="text-red-500" /> : <CheckCircle2 size={14} className="text-green-500" />}
                 </div>
                 <p className="text-xs font-bold text-gray-900">{profile.allergies_text || 'No known allergies'}</p>
              </div>

              <div className="p-3 bg-pits-surface-elevated rounded-2xl">
                 <div className="flex justify-between items-center mb-1">
                   <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Medical Conditions</p>
                   {profile.has_medical_condition ? <XCircle size={14} className="text-red-500" /> : <CheckCircle2 size={14} className="text-green-500" />}
                 </div>
                 <p className="text-xs font-bold text-gray-900">{profile.medical_condition_text || 'No known conditions'}</p>
              </div>

              <div className="p-3 bg-pits-surface-elevated rounded-2xl">
                 <div className="flex justify-between items-center mb-1">
                   <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Current Injuries</p>
                   {profile.has_injury ? <XCircle size={14} className="text-red-500" /> : <CheckCircle2 size={14} className="text-green-500" />}
                 </div>
                 <p className="text-xs font-bold text-gray-900">{profile.injury_text || 'No injuries reported'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: STATS & ACTIVITY */}
        <div className="md:col-span-1 space-y-8">
          {/* STATS GRID */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-pits-card text-white p-6 rounded-3xl shadow-xl">
              <TrendingUp className="text-pits-red mb-4" size={24} />
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Attendance</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black italic">{profile.bookings?.filter(b => b.status === 'attended').length || 0}</h3>
                <span className="text-gray-500 text-xs font-bold">Visits</span>
              </div>
            </div>
            <div className="bg-pits-surface-elevated p-6 rounded-3xl shadow-xl border border-gray-100">
              <Clock className="text-pits-red mb-4" size={24} />
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">No Shows</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black italic text-black">{profile.bookings?.filter(b => b.status === 'no_show').length || 0}</h3>
                <span className="text-gray-400 text-xs font-bold">Missed</span>
              </div>
            </div>
          </div>

          {/* ACTIVITY LOG */}
          <div className="bg-pits-surface-elevated rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xs font-black text-black uppercase tracking-widest flex items-center">
                <Calendar size={14} className="mr-2 text-pits-red" />
                Recent History
              </h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
              {profile.bookings && profile.bookings.length > 0 ? (
                profile.bookings
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 20)
                  .map((booking, idx) => (
                    <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full ${
                          booking.status === 'attended' ? 'bg-green-500' : 
                          booking.status === 'no_show' ? 'bg-pits-red' : 'bg-blue-500'
                        }`} />
                        <div>
                          <p className="text-sm font-bold text-gray-900 capitalize leading-none mb-1">
                            {booking.classes?.class_type || 'WOD'}
                          </p>
                          <p className="text-[10px] text-gray-400 font-medium">
                            {booking.classes?.start_time ? format(new Date(booking.classes.start_time), 'EEE, MMM dd • HH:mm') : format(new Date(booking.created_at), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${
                        booking.status === 'attended' ? 'bg-green-50 text-green-600' : 
                        booking.status === 'no_show' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                  ))
              ) : (
                <div className="px-6 py-12 text-center">
                  <p className="text-gray-400 text-sm italic font-medium">No activity recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

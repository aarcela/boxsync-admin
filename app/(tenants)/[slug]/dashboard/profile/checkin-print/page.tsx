'use client';

import { useEffect, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { buildPublicCheckinUrl } from '@/lib/constants/app-links';
import { checkinCodeService } from '@/lib/services/checkinCodeService';

export default function CheckinPrintPage() {
  const { t } = useLanguage();
  const { name: tenantName } = useTenant();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const row = await checkinCodeService.get();
        if (!row?.code) throw new Error('missing_code');
        const dataUrl = await QRCode.toDataURL(buildPublicCheckinUrl(row.code), {
          width: 720,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#111111', light: '#ffffff' },
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) {
          setQrDataUrl(null);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-white text-black overflow-auto">
      <div className="print:hidden flex justify-end gap-3 p-4 border-b border-gray-200">
        <button
          type="button"
          onClick={() => window.close()}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-bold uppercase tracking-widest"
        >
          {t('Cancel')}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!qrDataUrl}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-sm font-bold uppercase tracking-widest disabled:opacity-40"
        >
          <Printer size={16} />
          {t('Print')}
        </button>
      </div>

      <div className="mx-auto max-w-lg px-6 py-16 text-center flex flex-col items-center gap-8">
        <h1 className="text-3xl font-black tracking-tight">{tenantName}</h1>

        {loading ? (
          <Loader2 className="animate-spin" size={32} />
        ) : error || !qrDataUrl ? (
          <p className="text-sm text-gray-600">{t('Failed to load check-in QR')}</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt={t('Check-in QR')}
            width={360}
            height={360}
            className="w-[360px] h-[360px] object-contain"
          />
        )}

        <p className="text-base font-medium text-gray-700 max-w-sm">
          {t('Scan with the WODUS app to mark attendance')}
        </p>
      </div>
    </div>
  );
}

import { redirect } from 'next/navigation';

/** Income now lives in Money → Movements; keep old links working. */
export default function IncomePage() {
  redirect('/dashboard/movements?type=in');
}

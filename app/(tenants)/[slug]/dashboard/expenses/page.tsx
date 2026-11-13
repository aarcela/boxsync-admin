import { redirect } from 'next/navigation';

/** Expenses now lives in Money → Movements; keep old links working. */
export default function ExpensesPage() {
  redirect('/dashboard/movements?type=out');
}

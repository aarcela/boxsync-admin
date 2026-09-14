import { NextResponse } from 'next/server';
import { requirePlatformAdminApi } from '@/lib/require-platform-admin-api';
import { hqFinancialsService, resolveHqPeriodRange } from '@/lib/services/hqFinancialsService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { HQ_EXPENSE_CATEGORIES, HQ_INCOME_CATEGORIES } from '@/lib/types/gym';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const range = resolveHqPeriodRange({
      period: searchParams.get('period'),
      start: searchParams.get('start'),
      end: searchParams.get('end'),
    });
    const payload = await hqFinancialsService.getOverview(supabaseAdmin, range);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const kind = body.kind as string;
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: 'Invalid amount.' }, { status: 400 });
    }

    if (kind === 'tenant_payment') {
      if (!UUID_RE.test(body.tenant_id) || !body.period_start) {
        return NextResponse.json({ error: 'tenant_id and period_start are required.' }, { status: 400 });
      }
      const status =
        body.status === 'pending' || body.status === 'rejected' ? body.status : 'approved';
      const payment = await hqFinancialsService.createTenantPayment(supabaseAdmin, {
        tenant_id: body.tenant_id,
        amount,
        method: typeof body.method === 'string' ? body.method : '',
        period_start: String(body.period_start).slice(0, 10),
        status,
        notes: typeof body.notes === 'string' ? body.notes : '',
        created_by: auth.user.id,
      });
      return NextResponse.json({ payment }, { status: 201 });
    }

    if (kind === 'income') {
      const description = typeof body.description === 'string' ? body.description.trim() : '';
    const category = (HQ_INCOME_CATEGORIES as readonly string[]).includes(body.category)
      ? body.category
      : 'other_income';
      if (!description || !body.income_date) {
        return NextResponse.json({ error: 'description and income_date are required.' }, { status: 400 });
      }
      const income = await hqFinancialsService.createIncome(supabaseAdmin, {
        description,
        category,
        amount,
        income_date: String(body.income_date).slice(0, 10),
        status: body.status === 'pending' ? 'pending' : 'confirmed',
        notes: typeof body.notes === 'string' ? body.notes : '',
        created_by: auth.user.id,
      });
      return NextResponse.json({ income }, { status: 201 });
    }

    if (kind === 'expense') {
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      const category = (HQ_EXPENSE_CATEGORIES as readonly string[]).includes(body.category)
        ? body.category
        : 'Other';
      if (!description || !body.expense_date) {
        return NextResponse.json({ error: 'description and expense_date are required.' }, { status: 400 });
      }
      const expense = await hqFinancialsService.createExpense(supabaseAdmin, {
        description,
        category,
        amount,
        expense_date: String(body.expense_date).slice(0, 10),
        status: body.status === 'pending' || body.status === 'due' ? body.status : 'paid',
        notes: typeof body.notes === 'string' ? body.notes : '',
        created_by: auth.user.id,
      });
      return NextResponse.json({ expense }, { status: 201 });
    }

    return NextResponse.json({ error: 'Unknown kind.' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const kind = body.kind as string;
    if (!UUID_RE.test(body.id) || (kind !== 'payment' && kind !== 'income' && kind !== 'expense')) {
      return NextResponse.json({ error: 'Invalid delete payload.' }, { status: 400 });
    }
    await hqFinancialsService.deleteEntry(supabaseAdmin, kind, body.id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

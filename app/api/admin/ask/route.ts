import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { ASK_AI_SYSTEM_KNOWLEDGE } from '@/lib/ai/system-knowledge';
import { requireStaffApi } from '@/lib/require-staff-api';
import { tenantAiService } from '@/lib/services/tenantAiService';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';

const MAX_QUESTION = 1000;
const MAX_HISTORY = 6;
const MAX_HISTORY_CHARS = 800;
const ASK_MODEL = process.env.AI_ASK_MODEL || 'google/gemini-2.5-flash';

type HistoryItem = { role: 'user' | 'assistant'; content: string };

function parseHistory(raw: unknown): HistoryItem[] {
  if (!Array.isArray(raw)) return [];
  const items: HistoryItem[] = [];
  for (const row of raw.slice(-MAX_HISTORY)) {
    if (!row || typeof row !== 'object') continue;
    const role = (row as { role?: unknown }).role;
    const content = (row as { content?: unknown }).content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue;
    const trimmed = content.trim().slice(0, MAX_HISTORY_CHARS);
    if (!trimmed) continue;
    items.push({ role, content: trimmed });
  }
  return items;
}

export async function GET() {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  const tenantId = staffAuth.profile.tenant_id as string | null;
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
  }

  try {
    const tenant = await tenantService.getTenantById(tenantId, supabaseAdmin);
    if (!tenant) {
      return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
    }
    const quota = await tenantAiService.getQuota(tenantId, supabaseAdmin, tenant);
    return NextResponse.json({ quota });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  const tenantId = staffAuth.profile.tenant_id as string | null;
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const question =
      typeof body.question === 'string' ? body.question.trim().slice(0, MAX_QUESTION) : '';
    if (!question) {
      return NextResponse.json({ error: 'Ask a question about how Wodus works.' }, { status: 400 });
    }

    const tenant = await tenantService.getTenantById(tenantId, supabaseAdmin);
    if (!tenant) {
      return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
    }

    const quota = await tenantAiService.getQuota(tenantId, supabaseAdmin, tenant);
    if (quota.disabled) {
      return NextResponse.json(
        { error: 'Ask AI is disabled for this box.', quota },
        { status: 403 }
      );
    }

    const consumed = await tenantAiService.consumeQuestion(tenantId, quota.limit, supabaseAdmin);
    if (!consumed.allowed) {
      const nextQuota = await tenantAiService.getQuota(tenantId, supabaseAdmin, tenant);
      return NextResponse.json(
        { error: 'Ask AI monthly limit reached.', quota: nextQuota },
        { status: 429 }
      );
    }

    const history = parseHistory(body.history);
    const language = body.language === 'es' ? 'Spanish' : body.language === 'en' ? 'English' : null;

    try {
      const result = await generateText({
        model: ASK_MODEL,
        system: [
          ASK_AI_SYSTEM_KNOWLEDGE,
          language ? `Reply in ${language}.` : '',
          `Answer the staff question using the product rules. Do not mention tenant ids. Do not refuse how-it-works questions.`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        messages: [
          ...history.map((item) => ({
            role: item.role,
            content: item.content,
          })),
          { role: 'user' as const, content: question },
        ],
        providerOptions: {
          gateway: {
            user: tenantId,
            tags: ['feature:admin-ask', `tenant:${tenant.slug}`],
          },
        },
      });

      const usage = result.totalUsage;
      if (usage) {
        await tenantAiService.addTokenUsage(
          tenantId,
          {
            prompt: Number(usage.inputTokens ?? 0),
            completion: Number(usage.outputTokens ?? 0),
          },
          supabaseAdmin
        );
      }

      const nextQuota = await tenantAiService.getQuota(tenantId, supabaseAdmin, tenant);
      return NextResponse.json({ answer: result.text, quota: nextQuota });
    } catch (error: unknown) {
      await tenantAiService.releaseQuestion(tenantId, supabaseAdmin);
      const message = error instanceof Error ? error.message : '';
      if (/api key|oidc|unauthorized|401/i.test(message)) {
        return NextResponse.json(
          { error: 'Ask AI is unavailable.', quota },
          { status: 503 }
        );
      }
      throw error;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

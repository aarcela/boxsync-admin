export type ProofConfidence = 'high' | 'medium' | 'low';

export type PaymentProofExtraction = {
  amount: number | null;
  currency: string | null;
  paid_at: string | null;
  reference: string | null;
  confidence: ProofConfidence;
  raw_notes: string | null;
};

export type AmountMatch = 'match' | 'mismatch' | 'unknown';

export const PAYMENT_PROOF_EXTRACT_SYSTEM = `You read gym membership payment proofs (bank transfers, pago móvil, Zelle, PayPal, cash receipts, screenshots).

Return ONLY valid JSON with this shape:
{
  "amount": number | null,
  "currency": string | null,
  "paid_at": string | null,
  "reference": string | null,
  "confidence": "high" | "medium" | "low",
  "raw_notes": string | null
}

Rules:
- amount: the transferred/paid amount as a number (no currency symbols). Prefer the settlement amount on the receipt.
- currency: ISO-like code when clear (USD, EUR, VES, COP, MXN, …). Use VES for Venezuelan bolívares / Bs. Null if unclear.
- paid_at: payment date as YYYY-MM-DD when visible. Null if missing.
- reference: transfer / operation / confirmation / reference number if present. Null if none.
- confidence: high when amount is clear; medium if partially readable; low if guessy or unreadable.
- raw_notes: one short English note (max 120 chars), e.g. bank name or why a field is null.
- Do not invent values. Use null when not visible.
- No markdown, no code fences, JSON only.`;

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/[^\d,.-]/g, '').replace(',', '.');
    const n = Number.parseFloat(normalized);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 120) : null;
}

function asConfidence(value: unknown): ProofConfidence {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'low';
}

function asPaidAt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return trimmed;
}

export function parsePaymentProofExtraction(text: string): PaymentProofExtraction {
  const fallback: PaymentProofExtraction = {
    amount: null,
    currency: null,
    paid_at: null,
    reference: null,
    confidence: 'low',
    raw_notes: null,
  };

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return fallback;

  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    return {
      amount: asFiniteNumber(raw.amount),
      currency: asNullableString(raw.currency)?.toUpperCase() ?? null,
      paid_at: asPaidAt(raw.paid_at),
      reference: asNullableString(raw.reference),
      confidence: asConfidence(raw.confidence),
      raw_notes: asNullableString(raw.raw_notes),
    };
  } catch {
    return fallback;
  }
}

export function compareClaimedAmount(
  extractedAmount: number | null,
  claimedAmount: number
): AmountMatch {
  if (extractedAmount == null || !Number.isFinite(claimedAmount)) return 'unknown';
  const absDiff = Math.abs(extractedAmount - claimedAmount);
  const tolerance = Math.max(0.01, Math.abs(claimedAmount) * 0.01);
  return absDiff <= tolerance ? 'match' : 'mismatch';
}

export function buildPaymentProofUserPrompt(input: {
  claimedAmount: number;
  claimedCurrency: string;
  method: string | null;
}): string {
  return [
    'Extract amount, date, and reference from this payment proof image.',
    `Athlete claimed amount: ${input.claimedAmount}`,
    `Athlete claimed currency: ${input.claimedCurrency}`,
    `Payment method label: ${input.method || 'unknown'}`,
    'Prefer the amount actually shown on the receipt over the claimed values.',
  ].join('\n');
}

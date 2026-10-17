# AI Payment Proof Review - Feature Guide

## Overview

The AI Payment Proof Review feature automatically extracts key information from payment proof images (bank transfers, pago móvil, Zelle screenshots, etc.) to help staff quickly verify and approve member payments.

## What Gets Extracted

1. **Amount** - The payment amount (numeric value)
2. **Currency** - ISO currency code (USD, VES, EUR, etc.)
3. **Date** - Payment date (YYYY-MM-DD format)
4. **Reference** - Transaction/confirmation/operation number
5. **Bank** - Bank or payment service name (NEW)

## New Features (This Update)

### 1. Bank Extraction

The AI now identifies and extracts the bank or payment service:

**Supported Banks:**
- Venezuelan banks: Banesco, Mercantil, Provincial, BNC, Banco de Venezuela, etc.
- Payment services: Zelle, PayPal, Binance

**Display:**
- Shows in dedicated "Bank" field
- Helps staff quickly verify payment method matches claimed method
- Shows "Not found" if bank cannot be determined

### 2. Plan Price Comparison

Automatically compares the extracted amount to the athlete's expected membership plan price:

**How it works:**
- Fetches athlete's active membership plan
- For VES payments with USD plans:
  - Retrieves live BCV (official) exchange rate
  - Converts expected USD price to VES
  - Shows conversion rate used
- For USD payments with USD plans:
  - Direct comparison, no conversion
- Uses 5% tolerance to account for:
  - Exchange rate fluctuations
  - Bank rounding differences
  - Payment timing vs extraction timing

**Display:**
- "Plan price comparison" card
- Shows expected amount and currency
- Shows BCV rate when conversion applied
- Warning if amount differs beyond tolerance
- Separate from athlete-entered amount comparison

### 3. Duplicate Reference Detection

Checks if the payment reference has been used before in the same box:

**How it works:**
- After extraction, queries database for same reference
- Only checks within current tenant (multi-tenant isolated)
- Excludes current payment from duplicate check
- Checks both reference and tenant_id

**Display:**
- Red warning banner: "Duplicate reference detected"
- Message: "This reference was already used in another payment."
- Shows even if other checks pass
- Does NOT block approval (legitimate duplicates exist, e.g., partial payments)

## User Interface

### Proof Reader Card

```
┌─────────────────────────────────────┐
│ ✨ PROOF READER      [Check Proof] │
├─────────────────────────────────────┤
│ [!] Duplicate reference detected    │ ← NEW (if duplicate)
│     This reference was already...   │
├─────────────────────────────────────┤
│ Extracted amount                    │
│ 2,000 VES         [Amount matches]  │
├─────────────────────────────────────┤
│ [Plan price comparison]             │ ← NEW
│ Expected: 2,000 VES                 │
│ BCV rate: 40.15                     │
├─────────────────────────────────────┤
│ Payment date                        │
│ 2026-10-15                          │
├─────────────────────────────────────┤
│ Reference                           │
│ 12345678                            │
├─────────────────────────────────────┤
│ Bank                                │ ← NEW
│ Banesco                             │
├─────────────────────────────────────┤
│ Claimed: 2,000 VES                  │
│ Period remaining: 50                │
├─────────────────────────────────────┤
│ AI assist only — confirm before...  │
└─────────────────────────────────────┘
```

## Warnings and What They Mean

### Amount Matches (Green)
- Extracted amount is within 1% of athlete-entered amount
- High confidence in accuracy

### Amount Mismatch (Red)
- Extracted amount differs by more than 1% from athlete-entered
- Review proof carefully before approving
- May be typo in athlete entry or unclear proof image

### Amount Unclear (Amber)
- AI couldn't extract amount with confidence
- Manual review required

### Duplicate Reference Detected (Red Banner)
- Same reference found in another payment in this box
- **Possible scenarios:**
  - Accidental duplicate submission
  - Multiple athletes used same proof (fraud attempt)
  - Legitimate partial payments with same reference
  - Receipt reused for different period
- **Action:** Review carefully, but can approve if legitimate

### Amount Differs from Expected Plan Price (Amber)
- Extracted amount differs by more than 5% from expected plan price
- **Possible reasons:**
  - Exchange rate changed between payment and extraction
  - Partial payment
  - Athlete on wrong plan
  - Proof is for different service
- **Action:** Verify correct plan and payment amount

## Important Behaviors

### Never Auto-Approves
- Regardless of confidence level
- Regardless of all checks passing
- Staff must always manually approve
- Warnings are advisory only

### Ask AI Quota
- Each extraction consumes 1 question from monthly quota
- If quota exhausted, extraction is blocked
- Manual review required when quota reached

### Multi-Tenant Isolation
- Duplicate detection only checks within current box
- Same reference in different boxes is NOT flagged
- Tenant ID scoped on all queries

### Graceful Degradation
- If BCV rate unavailable, shows comparison without conversion
- If bank not found, shows "Not found" (doesn't fail extraction)
- If reference missing, skips duplicate check
- If no active plan, skips plan comparison

## Data Storage

New database columns on `payments` table:

| Column | Type | Purpose |
|--------|------|---------|
| `ai_extracted_bank` | text | Stores extracted bank name |
| `ai_extracted_reference` | text | Stores reference for duplicate detection |
| `tenant_id` | uuid | Links payment to tenant for isolation |

## Technical Details

### BCV Rate Source
- **API:** https://ve.dolarapi.com/v1/dolares/oficial
- **Type:** Official (BCV) rate
- **Caching:** No caching, fetched fresh each extraction
- **Fallback:** If unavailable, plan comparison skipped or shown without conversion

### Duplicate Detection Query
```sql
SELECT id, created_at, user_id
FROM payments
WHERE tenant_id = ? 
  AND ai_extracted_reference = ?
  AND id != ?  -- exclude current payment
ORDER BY created_at DESC
LIMIT 1
```

### Plan Price Comparison Logic
```typescript
// For VES payments with USD plans
expectedVES = planPriceUSD * bcvRate

// Tolerance check (5%)
tolerance = max(1, expectedAmount * 0.05)
match = abs(paidAmount - expectedAmount) <= tolerance
```

## Configuration

### Tolerance Levels
- **Athlete-entered comparison:** 1% (hardcoded)
- **Plan price comparison:** 5% (hardcoded)
- Future: May be made configurable per tenant

### Exchange Rate
- **Source:** Official BCV rate only
- Future: May respect tenant's configured rate source (official/parallel/custom)

## Troubleshooting

### "Duplicate reference detected" but it's a new payment
- Previous payment may have used same proof
- Check payment history for reference
- Safe to approve if you've verified it's legitimate

### Plan comparison shows wrong expected amount
- Check athlete's active plan is correct
- Verify BCV rate is current
- Athlete may need plan adjustment

### Bank shows "Not found"
- Proof image unclear or unusual format
- Bank logo not recognized by AI
- Manual verification still possible

### No plan comparison shown
- Athlete has no active membership plan
- Assign plan to athlete to enable comparison

## Related Documentation

- Original AI payment proof feature: PR #7
- Ask AI quota system: `lib/services/tenantAiService.ts`
- Payment approval flow: `app/dashboard/financials/`
- Multi-tenancy implementation: `AGENTS.md`

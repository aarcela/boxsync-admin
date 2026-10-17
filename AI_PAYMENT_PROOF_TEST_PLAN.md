# AI Payment Proof Enhancements - Test Plan

## Test Environment Setup

1. Ensure you have a test tenant with:
   - At least one athlete with an active membership plan
   - Payment methods configured (pago móvil, Zelle, etc.)
   - Ask AI quota available

2. Prepare test payment proof images:
   - Pago móvil screenshots from various banks (Banesco, Mercantil, Provincial, etc.)
   - Zelle payment confirmations
   - Same image for duplicate testing
   - VES and USD payment proofs

## Feature 1: Bank Extraction

### Test Case 1.1: Extract Venezuelan Bank
**Steps:**
1. Navigate to athlete profile with pending payment
2. Open payment review modal
3. Click "Ask AI" to read proof (pago móvil from Banesco)
4. Wait for extraction to complete

**Expected:**
- "Bank" field displays "Banesco"
- Other fields (amount, date, reference) extracted correctly
- No errors in console

### Test Case 1.2: Extract Zelle Payment
**Steps:**
1. Upload Zelle payment screenshot
2. Trigger AI reading

**Expected:**
- "Bank" field displays "Zelle"
- Currency shows "USD"

### Test Case 1.3: Missing Bank Information
**Steps:**
1. Upload cash receipt or proof without clear bank branding
2. Trigger AI reading

**Expected:**
- "Bank" field shows "Not found" or is omitted
- No errors, extraction continues normally

## Feature 2: Plan Price Comparison

### Test Case 2.1: VES Payment with USD Plan (Match)
**Prerequisites:**
- Athlete has $50 USD plan
- Current BCV rate is ~40 Bs/USD

**Steps:**
1. Upload pago móvil proof showing Bs. 2,000
2. Wait for extraction

**Expected:**
- "Plan price comparison" card displays
- Shows "Expected: 2,000 VES" (or close to it)
- Shows "BCV rate: 40.00" (actual current rate)
- Match status is "match" (green) or no warning if within 5% tolerance
- Athlete-entered comparison still shown separately

### Test Case 2.2: VES Payment with USD Plan (Mismatch)
**Prerequisites:**
- Athlete has $50 USD plan
- Current BCV rate is ~40 Bs/USD

**Steps:**
1. Upload pago móvil proof showing Bs. 1,000 (intentionally wrong)
2. Wait for extraction

**Expected:**
- "Plan price comparison" card displays
- Shows "Expected: ~2,000 VES"
- Shows "Amount differs from expected plan price" warning
- Can still approve payment (warning is advisory only)

### Test Case 2.3: USD Payment with USD Plan
**Prerequisites:**
- Athlete has $50 USD plan

**Steps:**
1. Upload Zelle proof showing $50
2. Wait for extraction

**Expected:**
- "Plan price comparison" card displays
- Shows "Expected: 50 USD"
- No BCV rate shown (no conversion needed)
- Match status shows match

### Test Case 2.4: No Active Plan
**Prerequisites:**
- Athlete has no active membership plan

**Steps:**
1. Upload any payment proof
2. Wait for extraction

**Expected:**
- No "Plan price comparison" card shown
- Other fields display normally
- Athlete-entered comparison still works

### Test Case 2.5: BCV Rate Unavailable
**Prerequisites:**
- Simulate BCV API failure (or test when API is down)

**Steps:**
1. Upload VES payment proof
2. Wait for extraction

**Expected:**
- Extraction completes
- Either no plan comparison shown or shows comparison without conversion
- No crash or blocking error

## Feature 3: Duplicate Detection

### Test Case 3.1: First Use of Reference
**Steps:**
1. Upload payment proof with reference "12345678"
2. Let AI extract
3. Approve payment

**Expected:**
- No duplicate warning shown
- Reference stored in database

### Test Case 3.2: Duplicate Reference (Same Tenant)
**Steps:**
1. Create second pending payment for same or different athlete
2. Upload same proof from Test 3.1 (or proof with same reference)
3. Let AI extract

**Expected:**
- Red warning box displays: "Duplicate reference detected"
- Warning states: "This reference was already used in another payment."
- Can still view other extracted fields
- Can still approve payment if legitimate (e.g., partial payment)

### Test Case 3.3: Same Reference Different Tenant (No Duplicate)
**Prerequisites:**
- Access to two different tenant accounts

**Steps:**
1. As Tenant A staff, upload payment with reference "99999999"
2. As Tenant B staff, upload different payment with reference "99999999"
3. Let AI extract for Tenant B payment

**Expected:**
- No duplicate warning for Tenant B payment
- Tenant isolation is maintained

### Test Case 3.4: Duplicate on Same Payment (Edit/Re-read)
**Steps:**
1. Upload payment proof, let AI extract (reference "11111111")
2. Click "Ask AI" again on same payment

**Expected:**
- No duplicate warning (ignores self)
- Extraction runs normally

## Feature 4: Combined Scenarios

### Test Case 4.1: All Features Active
**Steps:**
1. Athlete with $30 USD plan
2. Upload pago móvil from Mercantil showing Bs. 1,200 (at ~40 Bs/USD)
3. This reference was used before

**Expected:**
- Bank: "Mercantil"
- Duplicate warning shown in red
- Plan comparison shows expected ~1,200 VES with BCV rate
- Match status shows match
- Athlete-entered comparison also shown
- Can still approve despite duplicate warning

### Test Case 4.2: Low Confidence Extraction
**Steps:**
1. Upload blurry or partial payment proof
2. Let AI extract

**Expected:**
- Confidence: "low"
- Warning: "AI assist only — confirm before approving." (bold amber)
- All extracted fields shown (may be null)
- Bank/duplicate/plan features still work if data extracted

## Regression Testing

### Test Case 5.1: Existing Amount Comparison Still Works
**Steps:**
1. Athlete enters payment: 100 VES
2. Proof shows 100 VES
3. Let AI extract

**Expected:**
- "Amount matches" badge still displays
- 1% tolerance still applied for athlete-entered comparison
- New plan comparison doesn't interfere

### Test Case 5.2: Approval Workflow Unchanged
**Steps:**
1. Extract payment with duplicate warning and plan mismatch
2. Click "Approve"

**Expected:**
- Payment approves successfully
- Warnings are advisory only, never block approval
- Athlete becomes solvent if period is covered

### Test Case 5.3: Ask AI Quota Respected
**Steps:**
1. Exhaust tenant's monthly Ask AI quota
2. Try to read payment proof

**Expected:**
- Error: "Ask AI monthly limit reached."
- No extraction performed
- No new columns updated
- Quota display shows 0 remaining

## Database Verification

### Test Case 6.1: Migration Applied
**Steps:**
```sql
-- In Supabase SQL Editor
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'payments' 
  AND column_name IN ('ai_extracted_bank', 'ai_extracted_reference', 'tenant_id');
```

**Expected:**
- All three columns exist
- `ai_extracted_bank`: text, nullable
- `ai_extracted_reference`: text, nullable
- `tenant_id`: uuid, nullable (nullable for backward compat)

### Test Case 6.2: Indexes Created
**Steps:**
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'payments' 
  AND indexname LIKE 'payments_tenant%';
```

**Expected:**
- `payments_tenant_reference_idx` exists
- `payments_tenant_idx` exists

### Test Case 6.3: Data Stored Correctly
**Steps:**
1. After running AI extraction with bank and reference
```sql
SELECT id, ai_extracted_bank, ai_extracted_reference, tenant_id
FROM payments 
WHERE ai_extracted_reference IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:**
- Bank and reference values populated
- tenant_id matches the tenant that processed the payment

## Performance Testing

### Test Case 7.1: Duplicate Check Performance
**Steps:**
1. Create 1000+ payment records in test tenant
2. Upload payment proof and measure extraction time

**Expected:**
- Duplicate check completes in < 100ms
- Indexed query is fast even with large dataset

### Test Case 7.2: BCV Rate Fetch Timeout
**Prerequisites:**
- Simulate slow network to dolarapi.com

**Steps:**
1. Upload VES payment proof
2. Monitor extraction time

**Expected:**
- Total extraction time < 15 seconds
- BCV fetch doesn't block other operations excessively
- Graceful fallback if BCV fetch fails

## Security Testing

### Test Case 8.1: Tenant Isolation in Duplicate Check
**Steps:**
1. Manually insert payment with reference "XYZABC" for tenant A
2. As tenant B staff, upload payment with reference "XYZABC"

**Expected:**
- No duplicate warning shown
- Query only checks within tenant_id

### Test Case 8.2: Staff Authorization Required
**Steps:**
1. Attempt API call without staff auth token

**Expected:**
- 401 Unauthorized
- No extraction performed

## Edge Cases

### Test Case 9.1: Null Reference (No Duplicate Check)
**Steps:**
1. Upload payment proof without visible reference
2. Let AI extract

**Expected:**
- Reference: "Not found"
- No duplicate check performed (skipped when null)
- No errors

### Test Case 9.2: Special Characters in Reference
**Steps:**
1. Upload proof with reference "REF-2024/10#123"
2. Let AI extract

**Expected:**
- Reference stored exactly as extracted
- Duplicate check matches exact string

### Test Case 9.3: Very Large Reference Number
**Steps:**
1. Upload proof with 20+ digit reference
2. Let AI extract

**Expected:**
- Full reference stored (truncated to 120 chars per extraction rules)
- No database errors

## Acceptance Criteria

All tests must pass before merging:
- ✅ Bank extraction works for major Venezuelan banks and Zelle
- ✅ Plan price comparison shows correct expected amount with USD→VES conversion
- ✅ BCV rate fetched and displayed when applicable
- ✅ Duplicate reference warning shown for same tenant
- ✅ No false positives for duplicate detection across tenants
- ✅ Staff can still approve payments despite warnings
- ✅ Existing functionality (athlete-entered comparison) still works
- ✅ Migration applies cleanly
- ✅ No console errors during normal operation
- ✅ Spanish translations display correctly
- ✅ Performance acceptable with large datasets

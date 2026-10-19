# Graph Report - admin  (2026-10-04)

## Corpus Check
- 239 files · ~169,463 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: .mdc 5, (none) 3, .css 2)

## Summary
- 1247 nodes · 3681 edges · 60 communities (55 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `67e343f9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- admin/users/route.ts
- validate.ts
- PaymentProofReader.tsx
- requireAdminTenantId
- react
- rate-limit.ts
- appearance/page.tsx
- StaffLoginPage.tsx
- LanguageContext.tsx
- insights/page.tsx
- booking/page.tsx
- requireStaffApi
- hqFinancialsService.ts
- lucide-react
- push.ts
- super-admin/financials/page.tsx
- ScheduleWeekCalendar.tsx
- TenantContext.tsx
- classService.ts
- gym.ts
- payroll/page.tsx
- platform-plans.ts
- useLanguage
- package.json
- auth.ts
- payment_methods/page.tsx
- smtp.ts
- reset-password/page.tsx
- currency.ts
- compilerOptions
- sentry-scrub.ts
- provision/users/route.ts
- expenses/page.tsx
- users/[id]/route.ts
- hqStatsService.ts
- whatsapp.ts
- dependencies
- ask/route.ts
- next
- financialService.ts
- useTenant
- devDependencies
- profiles/route.ts
- dashboard/layout.tsx
- dashboard/financials/page.tsx
- supabase.ts
- useToast
- colorTokens.js
- CurrencyType
- scripts
- accountability/page.tsx
- README.md
- techniques.ts
- engines
- postcss.config.mjs
- vercel.json
- sync-color-theme.mjs
- tailwind.config.ts

## God Nodes (most connected - your core abstractions)
1. `useLanguage()` - 103 edges
2. `useToast()` - 81 edges
3. `next` - 73 edges
4. `react` - 65 edges
5. `lucide-react` - 55 edges
6. `supabase` - 50 edges
7. `requireStaffApi()` - 43 edges
8. `supabaseAdmin` - 43 edges
9. `useTenant()` - 35 edges
10. `requireAdminTenantId()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `SuperAdminLayout()` --calls--> `useLanguage()`  [EXTRACTED]
  app/(hq)/super-admin/layout.tsx → components/LanguageContext.tsx
- `GET()` --calls--> `requireStaffApi()`  [EXTRACTED]
  app/api/admin/ask/route.ts → lib/require-staff-api.ts
- `GET()` --calls--> `requireStaffApi()`  [EXTRACTED]
  app/api/admin/users/[id]/route.ts → lib/require-staff-api.ts
- `DELETE()` --calls--> `requireStaffApi()`  [EXTRACTED]
  app/api/admin/users/[id]/route.ts → lib/require-staff-api.ts
- `AuthConfirmContent()` --calls--> `useLanguage()`  [EXTRACTED]
  app/auth/confirm/page.tsx → components/LanguageContext.tsx

## Import Cycles
- None detected.

## Communities (60 total, 5 thin omitted)

### Community 0 - "admin/users/route.ts"
Cohesion: 0.30
Nodes (13): POST(), POST(), resolvePlanIdForTenant(), getAuthCallbackRedirectUrl(), getMemberInviteRedirectUrl(), buildInviteEmailHtml(), sendMemberInviteEmail(), getAuthFromEmail() (+5 more)

### Community 1 - "validate.ts"
Cohesion: 0.06
Nodes (59): GET(), ImportJobRow, loadTenantContext(), lookupEmails(), maxDuration, POST(), RouteContext, runValidation() (+51 more)

### Community 2 - "PaymentProofReader.tsx"
Cohesion: 0.13
Nodes (19): mediaTypeFromPath(), POST(), ApiResponse, Comparison, matchBadgeClass(), PaymentProofReader(), PaymentProofReadResult, sessionCache (+11 more)

### Community 3 - "requireAdminTenantId"
Cohesion: 0.08
Nodes (47): createClassTypeAction(), deleteClassTypeAction(), parseClassTypeForm(), toggleClassTypeStatusAction(), updateClassTypeAction(), ClassTypesPage(), saveOnboardingRequiredAction(), GROUPS (+39 more)

### Community 4 - "react"
Cohesion: 0.13
Nodes (25): SortDir, SortKey, useAthletes(), AthleteDetailPage(), ConfirmKind, AthletesPage(), AddAthleteModal(), AddAthleteModalProps (+17 more)

### Community 5 - "rate-limit.ts"
Cohesion: 0.12
Nodes (27): GET(), json(), OPTIONS(), OPTIONS(), GET(), OPTIONS(), fxCacheKey(), getCachedFxRate() (+19 more)

### Community 6 - "appearance/page.tsx"
Cohesion: 0.11
Nodes (31): GET(), POST(), supabaseAdmin, saveTenantFeaturesAction(), saveTenantPaletteAction(), AppearancePage(), MODULE_COPY, paletteDescKey() (+23 more)

### Community 7 - "StaffLoginPage.tsx"
Cohesion: 0.14
Nodes (22): PageProps, StaffLoginPage(), useOptionalTenant(), isPlatformAdmin(), resolveLoginError(), resolvePostLoginTenantSlug(), hostWithPort(), HQ_HOSTS (+14 more)

### Community 8 - "LanguageContext.tsx"
Cohesion: 0.12
Nodes (19): app_globals, inter, jetbrainsMono, metadata, plusJakarta, CommunityPage(), emitLanguageChange(), getServerLanguageSnapshot() (+11 more)

### Community 9 - "insights/page.tsx"
Cohesion: 0.08
Nodes (29): BadgeTone, EVENT_LABELS, FinancialInsightsPage(), interventionCopy(), OUTCOME_LABELS, PRIORITY_LABELS, PRIORITY_ORDER, PRIORITY_TONE (+21 more)

### Community 10 - "booking/page.tsx"
Cohesion: 0.25
Nodes (17): saveBookingSettingsAction(), BookingSettingsPage(), CloseWindowEditor(), fullWindowLabel(), isPresetMinutes(), minutesToParts(), partsToMinutes(), shortPresetLabel() (+9 more)

### Community 11 - "requireStaffApi"
Cohesion: 0.13
Nodes (21): DELETE(), PATCH(), POST(), DELETE(), GET(), GuestBookingStatus, normalizeContact(), PATCH() (+13 more)

### Community 12 - "hqFinancialsService.ts"
Cohesion: 0.11
Nodes (21): GET(), RouteContext, caracasYmd(), emptySeries(), ExpenseRow, hqFinancialsService, HqPeriodRange, IncomeRow (+13 more)

### Community 13 - "lucide-react"
Cohesion: 0.24
Nodes (13): DashboardDetailModal(), DashboardDetailModalProps, DashboardModalItem, DashboardModalItem, DashboardPage(), PaymentProofPreviewModal(), useDashboardData(), DashboardClass (+5 more)

### Community 14 - "push.ts"
Cohesion: 0.16
Nodes (22): addDays(), daysBetween(), GET(), POST(), startOfDay(), drain(), GET(), POST() (+14 more)

### Community 15 - "super-admin/financials/page.tsx"
Cohesion: 0.16
Nodes (24): categoryMixItems(), EXPENSE_KEYS, formatUsd(), INCOME_KEYS, IncomeExpenseChart(), KpiCard(), ledgerLabel(), methodMixItems() (+16 more)

### Community 16 - "ScheduleWeekCalendar.tsx"
Cohesion: 0.10
Nodes (35): useAttendance(), AttendancePage(), bookingStatusKey(), classTime(), Coach, HOURS, ScheduleWeekCalendarProps, useSchedule() (+27 more)

### Community 17 - "TenantContext.tsx"
Cohesion: 0.36
Nodes (6): TenantContext, TenantContextValue, DEFAULT_TENANT_CURRENCIES, TenantCurrencyConfig, tenantCurrencyService, DEFAULT_TENANT_FEATURES

### Community 18 - "classService.ts"
Cohesion: 0.10
Nodes (23): AddGuestModal(), AddGuestModalProps, classService, ClassUpdateFields, mapClassOccupancy(), occupancyCount(), AthleteProfile, BookingProfileJoin (+15 more)

### Community 19 - "gym.ts"
Cohesion: 0.15
Nodes (17): isCashMethod(), useFinancials(), CATEGORIES, IncomePage(), isLocalCurrency(), incomeService, ClassTypeInput, CurrencyStats (+9 more)

### Community 20 - "payroll/page.tsx"
Cohesion: 0.06
Nodes (66): bulkUpdateClassPayrollStatusAction(), requireAdminTenant(), updateClassPayrollStatusAction(), VALID_STATUSES, blockStyles(), classDurationMinutes(), FilterMode, formatCaracasDay() (+58 more)

### Community 21 - "platform-plans.ts"
Cohesion: 0.12
Nodes (23): PLAN_HINT, planBadgeClass(), SuperAdminTenantsPage(), PLAN_HINT, SuperAdminTenantDetailPage(), TenantAdmin, DashboardLayout(), defaultAiMonthlyQuestions() (+15 more)

### Community 22 - "useLanguage"
Cohesion: 0.19
Nodes (12): ForgotPasswordForm(), ForgotPasswordPage(), AppPreview(), AthleteRanking, ClassPerf, CoachAccumulator, CoachPerf, PerformancePage() (+4 more)

### Community 23 - "package.json"
Cohesion: 0.10
Nodes (19): eslintConfig, name, packageManager, pnpm, onlyBuiltDependencies, private, version, babel-plugin-react-compiler (+11 more)

### Community 24 - "auth.ts"
Cohesion: 0.15
Nodes (22): POST(), RouteContext, POST(), findUserByEmail(), POST(), sendMobilePasswordReset(), POST(), AUTH_CALLBACK_NEXT_PATHS (+14 more)

### Community 25 - "payment_methods/page.tsx"
Cohesion: 0.21
Nodes (16): createPaymentMethodAction(), deletePaymentMethodAction(), readStructuredFields(), togglePaymentMethodStatusAction(), updatePaymentMethodAction(), currencySelectValue(), PaymentMethodsPage(), defaultCurrencyForMethodType() (+8 more)

### Community 26 - "smtp.ts"
Cohesion: 0.24
Nodes (16): isMemberInviteEmailConfigured(), buildEmailHtml(), isPayrollEmailConfigured(), sendCoachPayrollEmail(), createTransporter(), EmailAttachment, formatFromAddress(), getPayrollFromEmail() (+8 more)

### Community 27 - "reset-password/page.tsx"
Cohesion: 0.11
Nodes (26): AuthCallbackHandler(), handleCallback(), AuthConfirmContent(), ResetPasswordPage(), WelcomePage(), AuthPageShell(), AuthPageShellProps, useAuthHashSession() (+18 more)

### Community 28 - "currency.ts"
Cohesion: 0.17
Nodes (14): applyRateMargin(), computeEffectiveRate(), CURRENCY_NAMES, CURRENCY_SYMBOLS, CUSTOM_CURRENCY_VALUE, DEFAULT_EXCHANGE_RATE_CONFIG, isCurrencyCode(), LOCAL_CURRENCY_OPTIONS (+6 more)

### Community 29 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 30 - "sentry-scrub.ts"
Cohesion: 0.20
Nodes (10): onRouterTransitionStart, onRequestError, register(), AUTH_PATH_MARKERS, getSentryDsn(), getSentryInitOptions(), isAuthRelatedUrl(), scrubSentryEvent() (+2 more)

### Community 31 - "provision/users/route.ts"
Cohesion: 0.53
Nodes (5): authorizeProvisioning(), POST(), resolvePlanIdForTenant(), resolveTenantId(), PROFILE_ROLES

### Community 32 - "expenses/page.tsx"
Cohesion: 0.21
Nodes (13): expenseCategoryKey(), ExpensesPage(), expenseStatusKey(), currencyOptionLabel(), currencySymbol(), isCurrencyType(), CATEGORY_BY_LABEL, expenseService (+5 more)

### Community 33 - "users/[id]/route.ts"
Cohesion: 0.20
Nodes (15): DELETE(), GET(), PUT(), resolveUnlimitedPlanId(), supabaseAdmin, validatePlanForTenant(), POST(), resolveDefaultPlanId() (+7 more)

### Community 34 - "hqStatsService.ts"
Cohesion: 0.22
Nodes (11): TenantProvider(), AskAiQuota, currentAiPeriodYm(), nextAiPeriodResetIso(), resolveAiMonthlyQuestions(), parsePlatformPlanId(), Counts, PendingRow (+3 more)

### Community 35 - "whatsapp.ts"
Cohesion: 0.33
Nodes (7): addDays(), POST(), startOfDay(), buildExpiryReminderMessage(), buildWelcomeMessage(), sendExpiryReminderWhatsApp(), sendWhatsAppMessage()

### Community 36 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, ai, date-fns, jspdf, jspdf-autotable, lucide-react, next, nodemailer (+8 more)

### Community 37 - "ask/route.ts"
Cohesion: 0.28
Nodes (7): GET(), HistoryItem, parseHistory(), POST(), ASK_AI_SYSTEM_KNOWLEDGE, tenantAiService, ai

### Community 38 - "next"
Cohesion: 0.11
Nodes (32): DELETE(), GET(), POST(), GET(), POST(), resolveUnlimitedPlanId(), RouteContext, DELETE() (+24 more)

### Community 39 - "financialService.ts"
Cohesion: 0.32
Nodes (7): exchangeRateEndpoint(), ExchangeRateSource, buildPaymentApprovedProfileUpdate(), getMemberPeriodBalance(), getPaymentProofPath(), signPaymentProofUrl(), PaymentRecord

### Community 40 - "useTenant"
Cohesion: 0.15
Nodes (11): EMPTY_METRICS, PilotPage(), errorText(), isUniqueViolation(), localDateKey(), readWodContent(), WodEditorPage(), useTenant() (+3 more)

### Community 43 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, babel-plugin-react-compiler, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/nodemailer (+4 more)

### Community 44 - "profiles/route.ts"
Cohesion: 0.23
Nodes (12): applyProfileFilters(), DB_SORT_COLUMNS, enrichWithEmails(), GET(), getLastPaymentDates(), parseSolvencyFilter(), parseSortDir(), parseSortKey() (+4 more)

### Community 45 - "dashboard/layout.tsx"
Cohesion: 0.16
Nodes (11): NavItem, NavLinkItem, NavParentItem, NavSection, NavSubItem, NotificationsPage(), Recipient, ConfirmDialog() (+3 more)

### Community 46 - "dashboard/financials/page.tsx"
Cohesion: 0.16
Nodes (11): CurrencyPanelProps, FinancialsPage(), formatExportRange(), MetricRowProps, parseRangeDate(), Period, ReconInputProps, StatCardProps (+3 more)

### Community 47 - "supabase.ts"
Cohesion: 0.22
Nodes (10): SuperAdminLayout(), getInitials(), ProfilePage(), roleLabel(), StaffProfile, toSupportWhatsAppUrl(), buildMobileJoinDeepLink(), tenantSupportService (+2 more)

### Community 48 - "useToast"
Cohesion: 0.12
Nodes (19): AskAiPage(), ChatMessage, SUGGESTIONS, CoachEvaluation, Feedback, FeedbackPage(), NewsItem, NewsPage() (+11 more)

### Community 49 - "colorTokens.js"
Cohesion: 0.28
Nodes (8): camelToKebab(), PITS_COLORS, PITS_FONTS, PITS_LEGACY, PITS_SEMANTIC, PITS_THEME_COLORS, toPitsTailwindColors(), toPitsThemeCssVars()

### Community 50 - "CurrencyType"
Cohesion: 0.18
Nodes (11): CurrencyType, ARS, BRL, CLP, COP, EUR, GBP, MXN (+3 more)

### Community 54 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, prebuild, predev, start, sync:theme

### Community 55 - "accountability/page.tsx"
Cohesion: 0.36
Nodes (5): useAccountability(), AccountabilityPage(), BalanceCard(), formatMoney(), MONTHS

### Community 57 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 59 - "engines"
Cohesion: 0.67
Nodes (3): engines, node, pnpm

### Community 64 - "sync-color-theme.mjs"
Cohesion: 0.22
Nodes (8): ref_node_fs, ref_node_module, ref_node_path, ref_node_url, outPath, require, root, { toPitsThemeCssVars }

### Community 69 - "tailwind.config.ts"
Cohesion: 0.50
Nodes (3): lib_constants_colortokens_pitstailwindcolors, tailwindcss, config

## Knowledge Gaps
- **291 isolated node(s):** `INCOME_KEYS`, `EXPENSE_KEYS`, `STATUS_KEYS`, `PLAN_HINT`, `TenantAdmin` (+286 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 354 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `admin/users/route.ts`, `validate.ts`, `requireAdminTenantId`, `react`, `rate-limit.ts`, `appearance/page.tsx`, `StaffLoginPage.tsx`, `LanguageContext.tsx`, `booking/page.tsx`, `requireStaffApi`, `hqFinancialsService.ts`, `push.ts`, `super-admin/financials/page.tsx`, `ScheduleWeekCalendar.tsx`, `payroll/page.tsx`, `platform-plans.ts`, `useLanguage`, `package.json`, `auth.ts`, `payment_methods/page.tsx`, `reset-password/page.tsx`, `sentry-scrub.ts`, `provision/users/route.ts`, `users/[id]/route.ts`, `whatsapp.ts`, `ask/route.ts`, `useTenant`, `profiles/route.ts`, `dashboard/layout.tsx`, `supabase.ts`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `validate.ts`, `PaymentProofReader.tsx`, `requireAdminTenantId`, `appearance/page.tsx`, `StaffLoginPage.tsx`, `LanguageContext.tsx`, `insights/page.tsx`, `booking/page.tsx`, `lucide-react`, `super-admin/financials/page.tsx`, `ScheduleWeekCalendar.tsx`, `TenantContext.tsx`, `classService.ts`, `gym.ts`, `payroll/page.tsx`, `platform-plans.ts`, `useLanguage`, `package.json`, `payment_methods/page.tsx`, `reset-password/page.tsx`, `sentry-scrub.ts`, `expenses/page.tsx`, `useTenant`, `dashboard/layout.tsx`, `dashboard/financials/page.tsx`, `supabase.ts`, `useToast`, `accountability/page.tsx`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `lucide-react` to `validate.ts`, `PaymentProofReader.tsx`, `requireAdminTenantId`, `react`, `appearance/page.tsx`, `StaffLoginPage.tsx`, `LanguageContext.tsx`, `insights/page.tsx`, `booking/page.tsx`, `super-admin/financials/page.tsx`, `ScheduleWeekCalendar.tsx`, `classService.ts`, `gym.ts`, `payroll/page.tsx`, `platform-plans.ts`, `useLanguage`, `package.json`, `payment_methods/page.tsx`, `reset-password/page.tsx`, `expenses/page.tsx`, `useTenant`, `dashboard/layout.tsx`, `dashboard/financials/page.tsx`, `supabase.ts`, `useToast`, `accountability/page.tsx`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `INCOME_KEYS`, `EXPENSE_KEYS`, `STATUS_KEYS` to the rest of the system?**
  _291 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `validate.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `PaymentProofReader.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12987012987012986 - nodes in this community are weakly interconnected._
- **Should `requireAdminTenantId` be split into smaller, more focused modules?**
  _Cohesion score 0.08123904149620105 - nodes in this community are weakly interconnected._
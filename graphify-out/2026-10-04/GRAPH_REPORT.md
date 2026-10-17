# Graph Report - admin  (2026-10-04)

## Corpus Check
- 237 files · ~168,061 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: .mdc 5, (none) 3, .css 2)

## Summary
- 1242 nodes · 3648 edges · 60 communities (54 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `67e343f9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- translations.ts
- validate.ts
- dashboard/page.tsx
- requireAdminTenantId
- supabase.ts
- rate-limit.ts
- appearance/page.tsx
- StaffLoginPage.tsx
- LanguageContext.tsx
- insights/page.tsx
- booking/page.tsx
- next
- hqFinancialsService.ts
- useLanguage
- push.ts
- super-admin/financials/page.tsx
- ScheduleWeekCalendar.tsx
- TenantContext.tsx
- gym.ts
- useTenant
- payroll/page.tsx
- platform-plans.ts
- performance/page.tsx
- package.json
- auth.ts
- payment_methods/page.tsx
- @supabase/supabase-js
- auth-callback.ts
- app-links.ts
- compilerOptions
- sentry-scrub.ts
- provision/users/route.ts
- expenses/page.tsx
- users/[id]/route.ts
- AddToClassModal.tsx
- tenants/[id]/page.tsx
- dependencies
- requirePlatformAdminApi
- pilot/page.tsx
- cron/expire/route.ts
- devDependencies
- profiles/route.ts
- dashboard/layout.tsx
- dashboard/financials/page.tsx
- profile/page.tsx
- useToast
- colorTokens.js
- CurrencyType
- personal_records/page.tsx
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
3. `next` - 72 edges
4. `react` - 65 edges
5. `lucide-react` - 55 edges
6. `supabase` - 50 edges
7. `requireStaffApi()` - 43 edges
8. `supabaseAdmin` - 41 edges
9. `useTenant()` - 35 edges
10. `requireAdminTenantId()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `AppPreview()` --calls--> `useLanguage()`  [EXTRACTED]
  app/(tenants)/[slug]/dashboard/appearance/page.tsx → components/LanguageContext.tsx
- `POST()` --calls--> `requirePlatformAdminApi()`  [EXTRACTED]
  app/api/admin/hq/financials/route.ts → lib/require-platform-admin-api.ts
- `DELETE()` --calls--> `requirePlatformAdminApi()`  [EXTRACTED]
  app/api/admin/hq/financials/route.ts → lib/require-platform-admin-api.ts
- `GET()` --calls--> `requireStaffApi()`  [EXTRACTED]
  app/api/admin/users/[id]/route.ts → lib/require-staff-api.ts
- `DELETE()` --calls--> `requireStaffApi()`  [EXTRACTED]
  app/api/admin/users/[id]/route.ts → lib/require-staff-api.ts

## Import Cycles
- None detected.

## Communities (60 total, 6 thin omitted)

### Community 0 - "translations.ts"
Cohesion: 0.20
Nodes (18): POST(), addDays(), POST(), startOfDay(), POST(), resolvePlanIdForTenant(), getMemberInviteRedirectUrl(), buildInviteEmailHtml() (+10 more)

### Community 1 - "validate.ts"
Cohesion: 0.07
Nodes (55): GET(), ImportJobRow, loadTenantContext(), lookupEmails(), maxDuration, POST(), RouteContext, runValidation() (+47 more)

### Community 2 - "dashboard/page.tsx"
Cohesion: 0.09
Nodes (33): mediaTypeFromPath(), PaymentRow, POST(), DashboardDetailModal(), DashboardDetailModalProps, DashboardModalItem, DashboardModalItem, DashboardPage() (+25 more)

### Community 3 - "requireAdminTenantId"
Cohesion: 0.10
Nodes (38): createClassTypeAction(), deleteClassTypeAction(), parseClassTypeForm(), toggleClassTypeStatusAction(), updateClassTypeAction(), ClassTypesPage(), saveOnboardingRequiredAction(), GROUPS (+30 more)

### Community 4 - "supabase.ts"
Cohesion: 0.14
Nodes (24): SortDir, SortKey, useAthletes(), AthleteDetailPage(), ConfirmKind, AthletesPage(), AddAthleteModal(), AddAthleteModalProps (+16 more)

### Community 5 - "rate-limit.ts"
Cohesion: 0.10
Nodes (33): GET(), json(), OPTIONS(), GET(), json(), OPTIONS(), GET(), OPTIONS() (+25 more)

### Community 6 - "appearance/page.tsx"
Cohesion: 0.12
Nodes (28): saveTenantFeaturesAction(), saveTenantPaletteAction(), AppearancePage(), AppPreview(), MODULE_COPY, paletteDescKey(), paletteNameKey(), TenantWodsPage() (+20 more)

### Community 7 - "StaffLoginPage.tsx"
Cohesion: 0.14
Nodes (23): PageProps, StaffLoginPage(), useOptionalTenant(), isPlatformAdmin(), resolveLoginError(), resolvePostLoginTenantSlug(), buildHqUrl(), hostWithPort() (+15 more)

### Community 8 - "LanguageContext.tsx"
Cohesion: 0.17
Nodes (13): app_globals, inter, jetbrainsMono, metadata, plusJakarta, emitLanguageChange(), getServerLanguageSnapshot(), LanguageContext (+5 more)

### Community 9 - "insights/page.tsx"
Cohesion: 0.08
Nodes (29): BadgeTone, EVENT_LABELS, FinancialInsightsPage(), interventionCopy(), OUTCOME_LABELS, PRIORITY_LABELS, PRIORITY_ORDER, PRIORITY_TONE (+21 more)

### Community 10 - "booking/page.tsx"
Cohesion: 0.25
Nodes (17): saveBookingSettingsAction(), BookingSettingsPage(), CloseWindowEditor(), fullWindowLabel(), isPresetMinutes(), minutesToParts(), partsToMinutes(), shortPresetLabel() (+9 more)

### Community 11 - "next"
Cohesion: 0.11
Nodes (29): GET(), HistoryItem, parseHistory(), POST(), DELETE(), PATCH(), POST(), DELETE() (+21 more)

### Community 12 - "hqFinancialsService.ts"
Cohesion: 0.12
Nodes (20): GET(), RouteContext, GET(), caracasYmd(), emptySeries(), ExpenseRow, hqFinancialsService, HqPeriodRange (+12 more)

### Community 13 - "useLanguage"
Cohesion: 0.18
Nodes (15): AuthConfirmContent(), SuperAdminLayout(), ForgotPasswordForm(), ForgotPasswordPage(), ResetPasswordPage(), WelcomePage(), AuthLanguageToggle(), AuthPageShell() (+7 more)

### Community 14 - "push.ts"
Cohesion: 0.16
Nodes (21): addDays(), daysBetween(), GET(), POST(), startOfDay(), drain(), GET(), POST() (+13 more)

### Community 15 - "super-admin/financials/page.tsx"
Cohesion: 0.15
Nodes (24): categoryMixItems(), EXPENSE_KEYS, formatUsd(), INCOME_KEYS, IncomeExpenseChart(), KpiCard(), ledgerLabel(), methodMixItems() (+16 more)

### Community 16 - "ScheduleWeekCalendar.tsx"
Cohesion: 0.05
Nodes (66): authorizeProvisioning(), POST(), useAttendance(), AttendancePage(), bookingStatusKey(), classTime(), Coach, getCaracasHourMinute() (+58 more)

### Community 17 - "TenantContext.tsx"
Cohesion: 0.36
Nodes (6): TenantContext, TenantContextValue, DEFAULT_TENANT_CURRENCIES, TenantCurrencyConfig, tenantCurrencyService, DEFAULT_TENANT_FEATURES

### Community 18 - "gym.ts"
Cohesion: 0.14
Nodes (14): DELETE(), POST(), FinancialStats, HQ_EXPENSE_CATEGORIES, HQ_INCOME_CATEGORIES, HqExpenseCategory, HqIncomeCategory, HqLedgerExpense (+6 more)

### Community 19 - "useTenant"
Cohesion: 0.26
Nodes (12): useAccountability(), isCashMethod(), useFinancials(), CATEGORIES, IncomePage(), useTenant(), isLocalCurrency(), financialService (+4 more)

### Community 20 - "payroll/page.tsx"
Cohesion: 0.05
Nodes (79): POST(), bulkUpdateClassPayrollStatusAction(), requireAdminTenant(), updateClassPayrollStatusAction(), VALID_STATUSES, blockStyles(), classDurationMinutes(), FilterMode (+71 more)

### Community 21 - "platform-plans.ts"
Cohesion: 0.10
Nodes (32): PLAN_HINT, planBadgeClass(), SuperAdminTenantsPage(), DashboardLayout(), TenantLayout(), TenantProvider(), AskAiQuota, currentAiPeriodYm() (+24 more)

### Community 22 - "performance/page.tsx"
Cohesion: 0.25
Nodes (7): AthleteRanking, ClassPerf, CoachAccumulator, CoachPerf, PerformancePage(), PlanEfficiency, SlotAccumulator

### Community 23 - "package.json"
Cohesion: 0.10
Nodes (20): eslintConfig, name, packageManager, pnpm, onlyBuiltDependencies, private, version, babel-plugin-react-compiler (+12 more)

### Community 24 - "auth.ts"
Cohesion: 0.18
Nodes (14): findUserByEmail(), POST(), sendMobilePasswordReset(), POST(), AUTH_CALLBACK_NEXT_PATHS, AuthCallbackNextPath, getAuthCallbackRedirectUrl(), getPasswordResetRedirectUrl() (+6 more)

### Community 25 - "payment_methods/page.tsx"
Cohesion: 0.13
Nodes (28): createPaymentMethodAction(), deletePaymentMethodAction(), readStructuredFields(), togglePaymentMethodStatusAction(), updatePaymentMethodAction(), currencySelectValue(), PaymentMethodsPage(), applyRateMargin() (+20 more)

### Community 26 - "@supabase/supabase-js"
Cohesion: 0.47
Nodes (4): ensureRowTenantId(), TenantScopedTable, paymentMethodService, @supabase/supabase-js

### Community 27 - "auth-callback.ts"
Cohesion: 0.27
Nodes (10): AuthCallbackHandler(), handleCallback(), useAuthHashSession(), checkSession(), ALLOWED_NEXT_PATHS, AUTH_CALLBACK_NEXT_PATHS, AuthCallbackNextPath, establishSessionFromAuthCallbackUrl() (+2 more)

### Community 28 - "app-links.ts"
Cohesion: 0.21
Nodes (11): POST(), APP_STORE_URL, buildMobilePasswordResetEmailLink(), buildPublicJoinUrl(), getPublicSiteOrigin(), GOOGLE_PLAY_URL, IOS_APP_COMING_SOON, NOTE: this URL slug ("pits-crossfit") predates the app's generic WODUS/BoxWave (+3 more)

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
Cohesion: 0.17
Nodes (18): DELETE(), GET(), PUT(), resolveUnlimitedPlanId(), supabaseAdmin, validatePlanForTenant(), POST(), resolveDefaultPlanId() (+10 more)

### Community 35 - "tenants/[id]/page.tsx"
Cohesion: 0.20
Nodes (8): PLAN_HINT, SuperAdminTenantDetailPage(), TenantAdmin, ISSUE_KEYS, PlanOption, Props, TenantImportPanel(), translateIssue()

### Community 36 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, ai, date-fns, jspdf, jspdf-autotable, lucide-react, next, nodemailer (+8 more)

### Community 38 - "requirePlatformAdminApi"
Cohesion: 0.23
Nodes (13): GET(), POST(), resolveUnlimitedPlanId(), RouteContext, DELETE(), GET(), PATCH(), RouteContext (+5 more)

### Community 40 - "pilot/page.tsx"
Cohesion: 0.24
Nodes (5): EMPTY_METRICS, PilotPage(), PilotBaseline, PilotMetrics, pilotProgramService

### Community 41 - "cron/expire/route.ts"
Cohesion: 0.67
Nodes (3): GET(), POST(), supabaseAdmin

### Community 43 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, babel-plugin-react-compiler, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/nodemailer (+4 more)

### Community 44 - "profiles/route.ts"
Cohesion: 0.23
Nodes (12): applyProfileFilters(), DB_SORT_COLUMNS, enrichWithEmails(), GET(), getLastPaymentDates(), parseSolvencyFilter(), parseSortDir(), parseSortKey() (+4 more)

### Community 45 - "dashboard/layout.tsx"
Cohesion: 0.15
Nodes (13): CommunityPage(), NavItem, NavLinkItem, NavParentItem, NavSection, NavSubItem, ConfirmDialog(), ConfirmDialogProps (+5 more)

### Community 46 - "dashboard/financials/page.tsx"
Cohesion: 0.12
Nodes (15): CurrencyPanelProps, FinancialsPage(), formatExportRange(), MetricRowProps, parseRangeDate(), Period, ReconInputProps, StatCardProps (+7 more)

### Community 47 - "profile/page.tsx"
Cohesion: 0.33
Nodes (8): getInitials(), ProfilePage(), roleLabel(), StaffProfile, toSupportWhatsAppUrl(), buildMobileJoinDeepLink(), tenantSupportService, normalizeWhatsAppRecipient()

### Community 48 - "useToast"
Cohesion: 0.11
Nodes (22): AskAiPage(), ChatMessage, SUGGESTIONS, CoachEvaluation, Feedback, FeedbackPage(), NewsItem, NewsPage() (+14 more)

### Community 49 - "colorTokens.js"
Cohesion: 0.28
Nodes (8): camelToKebab(), PITS_COLORS, PITS_FONTS, PITS_LEGACY, PITS_SEMANTIC, PITS_THEME_COLORS, toPitsTailwindColors(), toPitsThemeCssVars()

### Community 50 - "CurrencyType"
Cohesion: 0.18
Nodes (11): CurrencyType, ARS, BRL, CLP, COP, EUR, GBP, MXN (+3 more)

### Community 53 - "personal_records/page.tsx"
Cohesion: 0.18
Nodes (13): defaultForm, errorText(), isUniqueViolation(), localDateKey(), readWodContent(), WodEditorPage(), PrMovementInput, prMovementService (+5 more)

### Community 54 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, prebuild, predev, start, sync:theme

### Community 55 - "accountability/page.tsx"
Cohesion: 0.38
Nodes (4): AccountabilityPage(), BalanceCard(), formatMoney(), MONTHS

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
- **290 isolated node(s):** `INCOME_KEYS`, `EXPENSE_KEYS`, `STATUS_KEYS`, `PLAN_HINT`, `TenantAdmin` (+285 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 353 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `translations.ts`, `validate.ts`, `dashboard/page.tsx`, `requireAdminTenantId`, `supabase.ts`, `rate-limit.ts`, `appearance/page.tsx`, `StaffLoginPage.tsx`, `LanguageContext.tsx`, `booking/page.tsx`, `hqFinancialsService.ts`, `useLanguage`, `push.ts`, `super-admin/financials/page.tsx`, `ScheduleWeekCalendar.tsx`, `gym.ts`, `payroll/page.tsx`, `platform-plans.ts`, `performance/page.tsx`, `package.json`, `auth.ts`, `payment_methods/page.tsx`, `auth-callback.ts`, `app-links.ts`, `sentry-scrub.ts`, `provision/users/route.ts`, `users/[id]/route.ts`, `tenants/[id]/page.tsx`, `requirePlatformAdminApi`, `cron/expire/route.ts`, `profiles/route.ts`, `dashboard/layout.tsx`, `profile/page.tsx`, `personal_records/page.tsx`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Why does `react` connect `useToast` to `dashboard/page.tsx`, `requireAdminTenantId`, `supabase.ts`, `appearance/page.tsx`, `StaffLoginPage.tsx`, `LanguageContext.tsx`, `insights/page.tsx`, `booking/page.tsx`, `useLanguage`, `super-admin/financials/page.tsx`, `ScheduleWeekCalendar.tsx`, `TenantContext.tsx`, `useTenant`, `payroll/page.tsx`, `platform-plans.ts`, `performance/page.tsx`, `package.json`, `payment_methods/page.tsx`, `auth-callback.ts`, `sentry-scrub.ts`, `expenses/page.tsx`, `AddToClassModal.tsx`, `tenants/[id]/page.tsx`, `pilot/page.tsx`, `dashboard/layout.tsx`, `dashboard/financials/page.tsx`, `profile/page.tsx`, `personal_records/page.tsx`, `accountability/page.tsx`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `useLanguage()` connect `useLanguage` to `dashboard/page.tsx`, `requireAdminTenantId`, `supabase.ts`, `appearance/page.tsx`, `StaffLoginPage.tsx`, `LanguageContext.tsx`, `insights/page.tsx`, `booking/page.tsx`, `super-admin/financials/page.tsx`, `ScheduleWeekCalendar.tsx`, `useTenant`, `payroll/page.tsx`, `platform-plans.ts`, `performance/page.tsx`, `payment_methods/page.tsx`, `expenses/page.tsx`, `tenants/[id]/page.tsx`, `pilot/page.tsx`, `dashboard/layout.tsx`, `dashboard/financials/page.tsx`, `profile/page.tsx`, `useToast`, `personal_records/page.tsx`, `accountability/page.tsx`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **What connects `INCOME_KEYS`, `EXPENSE_KEYS`, `STATUS_KEYS` to the rest of the system?**
  _290 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `validate.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06836158192090395 - nodes in this community are weakly interconnected._
- **Should `dashboard/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09024390243902439 - nodes in this community are weakly interconnected._
- **Should `requireAdminTenantId` be split into smaller, more focused modules?**
  _Cohesion score 0.09758454106280193 - nodes in this community are weakly interconnected._
# Graph Report - admin  (2026-11-10)

## Corpus Check
- 285 files · ~202,014 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: .mdc 5, (none) 3, .css 2)

## Summary
- 1541 nodes · 4466 edges · 76 communities (71 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c0b72a4b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- translations.ts
- validate.ts
- read-proof/route.ts
- onboarding/page.tsx
- financialService.ts
- rate-limit.ts
- appPalettes.ts
- StaffLoginPage.tsx
- react
- insights/page.tsx
- booking/page.tsx
- requireStaffApi
- AI Payment Proof Enhancements - Test Plan
- dashboard/page.tsx
- push.ts
- hqFinancialsService.ts
- useTenant
- setup/route.ts
- gym.ts
- expenses/page.tsx
- payroll/page.tsx
- setup/page.tsx
- useLanguage
- package.json
- auth.ts
- payment_methods/page.tsx
- smtp.ts
- platform-plans.ts
- hqStatsService.ts
- compilerOptions
- sentry-scrub.ts
- gym-signup/route.ts
- dashboard/financials/page.tsx
- AI Payment Proof Review - Feature Guide
- tenant-terms.ts
- provision-tenant.ts
- dependencies
- salary/page.tsx
- next
- fx-cache.ts
- pilot/page.tsx
- personal_records/page.tsx
- TenantContext.tsx
- devDependencies
- profiles/route.ts
- trial-lifecycle/route.ts
- CreateClassModal.tsx
- supabase.ts
- useToast
- colorTokens.js
- CurrencyType
- requireAdminTenantId
- athletes/page.tsx
- useFinancials.ts
- scripts
- tenant-features.ts
- appearance/page.tsx
- README.md
- techniques.ts
- engines
- postcss.config.mjs
- vercel.json
- sync-color-theme.mjs
- appearance/actions.ts
- app/layout.tsx
- class_types/page.tsx
- dashboard/layout.tsx
- auth-callback.ts
- member-payment-status.ts
- accountability/page.tsx
- cron/expire/route.ts
- parsePlatformPlanId
- notify-founder.ts
- dashboard/wods/page.tsx

## God Nodes (most connected - your core abstractions)
1. `useLanguage()` - 111 edges
2. `next` - 84 edges
3. `useToast()` - 83 edges
4. `react` - 69 edges
5. `lucide-react` - 57 edges
6. `supabaseAdmin` - 55 edges
7. `supabase` - 54 edges
8. `requireStaffApi()` - 50 edges
9. `useTenant()` - 41 edges
10. `requireAdminTenantId()` - 36 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `requirePlatformAdminApi()`  [EXTRACTED]
  app/api/admin/hq/financials/route.ts → lib/require-platform-admin-api.ts
- `DELETE()` --calls--> `requirePlatformAdminApi()`  [EXTRACTED]
  app/api/admin/hq/financials/route.ts → lib/require-platform-admin-api.ts
- `AuthConfirmContent()` --calls--> `useLanguage()`  [EXTRACTED]
  app/auth/confirm/page.tsx → components/LanguageContext.tsx
- `HqTenantFinancialsPage()` --calls--> `useLanguage()`  [EXTRACTED]
  app/(hq)/super-admin/financials/[id]/page.tsx → components/LanguageContext.tsx
- `HqTenantFinancialsPage()` --calls--> `useToast()`  [EXTRACTED]
  app/(hq)/super-admin/financials/[id]/page.tsx → components/Toast.tsx

## Import Cycles
- None detected.

## Communities (76 total, 5 thin omitted)

### Community 0 - "translations.ts"
Cohesion: 0.16
Nodes (23): authorizeProvisioning(), POST(), resolvePlanIdForTenant(), resolveTenantId(), POST(), addDays(), POST(), startOfDay() (+15 more)

### Community 1 - "validate.ts"
Cohesion: 0.07
Nodes (56): GET(), ImportJobRow, loadTenantContext(), lookupEmails(), maxDuration, POST(), RouteContext, runValidation() (+48 more)

### Community 2 - "read-proof/route.ts"
Cohesion: 0.12
Nodes (24): mediaTypeFromPath(), PaymentRow, POST(), ApiResponse, Comparison, DuplicatePayment, matchBadgeClass(), PaymentProofReader() (+16 more)

### Community 3 - "onboarding/page.tsx"
Cohesion: 0.23
Nodes (15): saveOnboardingRequiredAction(), GROUPS, OnboardingSettingsPage(), asObject(), boolFlag(), DEFAULT_ONBOARDING_REQUIRED, isLockedOnboardingField(), LOCKED_ONBOARDING_FIELD_IDS (+7 more)

### Community 4 - "financialService.ts"
Cohesion: 0.17
Nodes (15): SortDir, SortKey, AddToClassModalProps, AthleteOption, buildMembershipActivationFields(), buildPaymentApprovedProfileUpdate(), getMemberPeriodBalance(), getPlanLimitType() (+7 more)

### Community 5 - "rate-limit.ts"
Cohesion: 0.12
Nodes (27): POST(), GET(), json(), OPTIONS(), GET(), json(), OPTIONS(), cors() (+19 more)

### Community 6 - "appPalettes.ts"
Cohesion: 0.22
Nodes (12): AppPalette, DEFAULT_PALETTE_ID, getPalette(), isPaletteId(), PALETTE_IDS, PaletteColors, PaletteId, PALETTES (+4 more)

### Community 7 - "StaffLoginPage.tsx"
Cohesion: 0.13
Nodes (24): GET(), PageProps, StaffLoginPage(), useOptionalTenant(), isPlatformAdmin(), resolveLoginError(), resolvePostLoginTenantSlug(), buildTenantDashboardUrl() (+16 more)

### Community 8 - "react"
Cohesion: 0.20
Nodes (14): AuthConfirmContent(), ResetPasswordPage(), WelcomePage(), AuthPageShell(), AuthPageShellProps, useAuthHashSession(), resolvePasswordResetError(), APP_STORE_URL (+6 more)

### Community 9 - "insights/page.tsx"
Cohesion: 0.08
Nodes (29): BadgeTone, EVENT_LABELS, FinancialInsightsPage(), interventionCopy(), OUTCOME_LABELS, PRIORITY_LABELS, PRIORITY_ORDER, PRIORITY_TONE (+21 more)

### Community 10 - "booking/page.tsx"
Cohesion: 0.12
Nodes (38): saveBookingSettingsAction(), saveOverdueSettingsAction(), BookingSettingsPage(), CloseWindowEditor(), fullWindowLabel(), isPresetMinutes(), isReminderPresetMinutes(), minutesToParts() (+30 more)

### Community 11 - "requireStaffApi"
Cohesion: 0.09
Nodes (29): GET(), HistoryItem, parseHistory(), POST(), DELETE(), PATCH(), POST(), DELETE() (+21 more)

### Community 12 - "AI Payment Proof Enhancements - Test Plan"
Cohesion: 0.05
Nodes (39): Acceptance Criteria, AI Payment Proof Enhancements - Test Plan, Database Verification, Edge Cases, Feature 1: Bank Extraction, Feature 2: Plan Price Comparison, Feature 3: Duplicate Detection, Feature 4: Combined Scenarios (+31 more)

### Community 13 - "dashboard/page.tsx"
Cohesion: 0.20
Nodes (14): DashboardDetailModal(), DashboardDetailModalProps, DashboardModalItem, DashboardModalItem, DashboardPage(), useDashboardData(), DashboardClass, DashboardPayment (+6 more)

### Community 14 - "push.ts"
Cohesion: 0.13
Nodes (32): addDays(), daysBetween(), GET(), POST(), startOfDay(), drain(), GET(), POST() (+24 more)

### Community 15 - "hqFinancialsService.ts"
Cohesion: 0.07
Nodes (48): GET(), DELETE(), GET(), POST(), categoryMixItems(), EXPENSE_KEYS, formatUsd(), INCOME_KEYS (+40 more)

### Community 16 - "useTenant"
Cohesion: 0.15
Nodes (24): useAttendance(), AttendancePage(), bookingStatusKey(), classTime(), Coach, getCaracasHourMinute(), getDurationMinutes(), HOURS (+16 more)

### Community 17 - "setup/route.ts"
Cohesion: 0.24
Nodes (11): GET(), isSetupStep(), loadFacts(), PATCH(), detectSetupSteps(), EMPTY_SETUP_STEPS, parseSetupSteps(), SETUP_STEPS (+3 more)

### Community 18 - "gym.ts"
Cohesion: 0.14
Nodes (22): AddGuestModal(), AddGuestModalProps, classService, ClassUpdateFields, mapClassOccupancy(), occupancyCount(), GuestAthleteOption, GuestBooking (+14 more)

### Community 19 - "expenses/page.tsx"
Cohesion: 0.20
Nodes (14): expenseCategoryKey(), ExpensesPage(), expenseStatusKey(), currencyOptionLabel(), currencySymbol(), isCurrencyType(), isLocalCurrency(), CATEGORY_BY_LABEL (+6 more)

### Community 20 - "payroll/page.tsx"
Cohesion: 0.05
Nodes (69): POST(), bulkUpdateClassPayrollStatusAction(), requireAdminTenant(), updateClassPayrollStatusAction(), VALID_STATUSES, blockStyles(), classDurationMinutes(), FilterMode (+61 more)

### Community 21 - "setup/page.tsx"
Cohesion: 0.16
Nodes (15): DashboardLayout(), slugFromPath(), TrialFounderBanner(), saveGymNameAction(), GymSetupPage(), SetupPayload, STEP_META, FOUNDER_WHATSAPP_E164 (+7 more)

### Community 22 - "useLanguage"
Cohesion: 0.12
Nodes (21): SuperAdminLayout(), PLAN_HINT, SuperAdminTenantDetailPage(), TenantAdmin, ForgotPasswordForm(), ForgotPasswordPage(), CoachEvaluation, Feedback (+13 more)

### Community 23 - "package.json"
Cohesion: 0.09
Nodes (21): eslintConfig, name, packageManager, pnpm, onlyBuiltDependencies, private, version, babel-plugin-react-compiler (+13 more)

### Community 24 - "auth.ts"
Cohesion: 0.14
Nodes (23): POST(), RouteContext, POST(), findUserByEmail(), POST(), sendMobilePasswordReset(), POST(), AUTH_CALLBACK_NEXT_PATHS (+15 more)

### Community 25 - "payment_methods/page.tsx"
Cohesion: 0.22
Nodes (16): createPaymentMethodAction(), deletePaymentMethodAction(), readStructuredFields(), togglePaymentMethodStatusAction(), updatePaymentMethodAction(), currencySelectValue(), PaymentMethodsPage(), defaultCurrencyForMethodType() (+8 more)

### Community 26 - "smtp.ts"
Cohesion: 0.22
Nodes (17): buildGymSignupVerifyEmailHtml(), isGymSignupEmailConfigured(), sendGymSignupVerifyEmail(), isMemberInviteEmailConfigured(), createTransporter(), EmailAttachment, formatFromAddress(), isSmtpConfigured() (+9 more)

### Community 27 - "platform-plans.ts"
Cohesion: 0.17
Nodes (12): PLAN_HINT, planBadgeClass(), SuperAdminTenantsPage(), caracasYmd(), DEFAULT_PLATFORM_PLAN, PLATFORM_PLAN_IDS, PLATFORM_PLANS, PlatformPlanDef (+4 more)

### Community 28 - "hqStatsService.ts"
Cohesion: 0.24
Nodes (9): PlatformPlanId, Counts, PendingRow, ProfileRow, HqTenantFinancialDetail, HqTenantFinancialRow, PlatformHqOverview, Tenant (+1 more)

### Community 29 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 30 - "sentry-scrub.ts"
Cohesion: 0.20
Nodes (10): onRouterTransitionStart, onRequestError, register(), AUTH_PATH_MARKERS, getSentryDsn(), getSentryInitOptions(), isAuthRelatedUrl(), scrubSentryEvent() (+2 more)

### Community 31 - "gym-signup/route.ts"
Cohesion: 0.20
Nodes (18): POST(), resolveDefaultPlanId(), resolveRequestedPlanId(), cors(), OPTIONS(), POST(), cors(), emailExists() (+10 more)

### Community 32 - "dashboard/financials/page.tsx"
Cohesion: 0.13
Nodes (14): CurrencyPanelProps, FinancialsPage(), formatExportRange(), MetricRowProps, parseRangeDate(), Period, ReconInputProps, StatCardProps (+6 more)

### Community 33 - "AI Payment Proof Review - Feature Guide"
Cohesion: 0.06
Nodes (34): 1. Bank Extraction, 2. Plan Price Comparison, 3. Duplicate Reference Detection, AI Payment Proof Review - Feature Guide, Amount Differs from Expected Plan Price (Amber), Amount Matches (Green), Amount Mismatch (Red), Amount Unclear (Amber) (+26 more)

### Community 34 - "tenant-terms.ts"
Cohesion: 0.12
Nodes (26): AppPreview(), emitLanguageChange(), getServerLanguageSnapshot(), LanguageProvider(), readStoredLanguage(), subscribeToLanguage(), useTenantTerms(), applyPlaceholderCase() (+18 more)

### Community 35 - "provision-tenant.ts"
Cohesion: 0.13
Nodes (24): authorizeProvisioning(), POST(), GYM_SIGNUP_FIELD_MAX, GymSignupFieldError, GymSignupInput, isTurnstileRequired(), normalizeInstagram(), normalizeWhatsAppVe() (+16 more)

### Community 36 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, ai, date-fns, jspdf, jspdf-autotable, lucide-react, next, nodemailer (+8 more)

### Community 37 - "salary/page.tsx"
Cohesion: 0.40
Nodes (11): assignCoachSalaryTierAction(), createSalaryTierAction(), deleteSalaryTierAction(), parseTierForm(), requireAdminTenant(), toggleSalaryTierStatusAction(), updateSalaryTierAction(), emptyRates() (+3 more)

### Community 38 - "next"
Cohesion: 0.13
Nodes (25): checkDailyMilestones(), GET(), POST(), RouteContext, GET(), POST(), resolveUnlimitedPlanId(), RouteContext (+17 more)

### Community 39 - "fx-cache.ts"
Cohesion: 0.46
Nodes (6): fxCacheKey(), getCachedFxRate(), getFxCacheTtlSeconds(), setCachedFxRate(), getUpstashRedis(), @upstash/redis

### Community 40 - "pilot/page.tsx"
Cohesion: 0.24
Nodes (5): EMPTY_METRICS, PilotPage(), PilotBaseline, PilotMetrics, pilotProgramService

### Community 41 - "personal_records/page.tsx"
Cohesion: 0.25
Nodes (15): createPrMovementAction(), deletePrMovementAction(), parseMovementForm(), togglePrMovementStatusAction(), updatePrMovementAction(), defaultForm, PersonalRecordsPage(), slugify() (+7 more)

### Community 42 - "TenantContext.tsx"
Cohesion: 0.12
Nodes (21): TenantContext, TenantContextValue, applyRateMargin(), computeEffectiveRate(), CURRENCY_NAMES, CURRENCY_SYMBOLS, CUSTOM_CURRENCY_VALUE, DEFAULT_EXCHANGE_RATE_CONFIG (+13 more)

### Community 43 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, babel-plugin-react-compiler, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/nodemailer (+4 more)

### Community 44 - "profiles/route.ts"
Cohesion: 0.23
Nodes (12): applyProfileFilters(), DB_SORT_COLUMNS, enrichWithEmails(), GET(), getLastPaymentDates(), parseSolvencyFilter(), parseSortDir(), parseSortKey() (+4 more)

### Community 45 - "trial-lifecycle/route.ts"
Cohesion: 0.36
Nodes (8): authorize(), GET(), hasEvent(), POST(), runTrialLifecycle(), TenantProvider(), isTrialExpired(), publishTenantSettings()

### Community 46 - "CreateClassModal.tsx"
Cohesion: 0.36
Nodes (9): Coach, computeEndFromStart(), CreateClassModal(), CreateClassModalProps, DAYS_OF_WEEK, defaultDurationMinutes(), parseCaracasDateTime(), toCaracasTimeInput() (+1 more)

### Community 47 - "supabase.ts"
Cohesion: 0.10
Nodes (25): NewsItem, CheckinPrintPage(), getInitials(), ProfilePage(), roleLabel(), StaffProfile, toSupportWhatsAppUrl(), CreateNewsModal() (+17 more)

### Community 48 - "useToast"
Cohesion: 0.09
Nodes (20): AskAiPage(), ChatMessage, SUGGESTIONS, CATEGORIES, IncomePage(), NewsPage(), AthleteRanking, ClassPerf (+12 more)

### Community 49 - "colorTokens.js"
Cohesion: 0.18
Nodes (11): camelToKebab(), PITS_COLORS, PITS_FONTS, PITS_LEGACY, PITS_SEMANTIC, PITS_THEME_COLORS, lib_constants_colortokens_pitstailwindcolors, toPitsTailwindColors() (+3 more)

### Community 50 - "CurrencyType"
Cohesion: 0.18
Nodes (11): CurrencyType, ARS, BRL, CLP, COP, EUR, GBP, MXN (+3 more)

### Community 51 - "requireAdminTenantId"
Cohesion: 0.36
Nodes (10): createMembershipPlanAction(), deleteMembershipPlanAction(), getMemberCountForPlan(), parseLimitType(), parseOptionalInt(), parsePlanForm(), toggleMembershipPlanStatusAction(), updateMembershipPlanAction() (+2 more)

### Community 52 - "athletes/page.tsx"
Cohesion: 0.18
Nodes (17): useAthletes(), AthleteDetailPage(), ConfirmKind, AthletesPage(), AddAthleteModal(), AddAthleteModalProps, EditAthleteModal(), EditAthleteModalProps (+9 more)

### Community 53 - "useFinancials.ts"
Cohesion: 0.23
Nodes (11): isCashMethod(), useFinancials(), incomeService, PaymentLedgerRow, paymentStatusToIncome(), paymentToIncomeRow(), profileFullName(), CurrencyStats (+3 more)

### Community 54 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, prebuild, predev, start, sync:theme

### Community 55 - "tenant-features.ts"
Cohesion: 0.26
Nodes (10): TenantLayout(), TenantWodsPage(), tenantFeaturesService, asObject(), boolFlag(), parseTenantFeatures(), patchTenantFeaturesSettings(), TENANT_FEATURE_IDS (+2 more)

### Community 56 - "appearance/page.tsx"
Cohesion: 0.26
Nodes (12): getMilestoneSettingsAction(), saveMilestoneSettingsAction(), saveTenantFeaturesAction(), saveTenantPaletteAction(), saveTenantTermsAction(), AppearancePage(), MODULE_COPY, paletteDescKey() (+4 more)

### Community 57 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 59 - "engines"
Cohesion: 0.67
Nodes (3): engines, node, pnpm

### Community 64 - "sync-color-theme.mjs"
Cohesion: 0.22
Nodes (8): ref_node_fs, ref_node_module, ref_node_path, ref_node_url, outPath, require, root, { toPitsThemeCssVars }

### Community 65 - "appearance/actions.ts"
Cohesion: 0.27
Nodes (9): milestoneService, tenantTermsService, TenantTerms, DEFAULT_MILESTONE_SETTINGS, MilestoneAchieved, MilestoneSettings, MilestoneType, parseMilestoneSettings() (+1 more)

### Community 66 - "app/layout.tsx"
Cohesion: 0.25
Nodes (6): app_globals, inter, jetbrainsMono, metadata, plusJakarta, ToastProvider()

### Community 67 - "class_types/page.tsx"
Cohesion: 0.26
Nodes (12): createClassTypeAction(), deleteClassTypeAction(), parseClassTypeForm(), toggleClassTypeStatusAction(), updateClassTypeAction(), ClassTypesPage(), CLASS_TYPES, ClassType (+4 more)

### Community 68 - "dashboard/layout.tsx"
Cohesion: 0.13
Nodes (16): CommunityPage(), NavItem, NavLinkItem, NavParentItem, NavSection, NavSubItem, NotificationsPage(), Recipient (+8 more)

### Community 69 - "auth-callback.ts"
Cohesion: 0.30
Nodes (9): AuthCallbackHandler(), handleCallback(), checkSession(), ALLOWED_NEXT_PATHS, AUTH_CALLBACK_NEXT_PATHS, AuthCallbackNextPath, establishSessionFromAuthCallbackUrl(), resolveAuthCallbackFailPath() (+1 more)

### Community 70 - "member-payment-status.ts"
Cohesion: 0.29
Nodes (6): asBool(), MemberPaymentReason, MemberPaymentStatus, MemberPaymentStatusKind, OverdueMemberToday, parseMemberPaymentStatus()

### Community 71 - "accountability/page.tsx"
Cohesion: 0.36
Nodes (5): useAccountability(), AccountabilityPage(), BalanceCard(), formatMoney(), MONTHS

### Community 72 - "cron/expire/route.ts"
Cohesion: 0.67
Nodes (3): GET(), POST(), supabaseAdmin

### Community 73 - "parsePlatformPlanId"
Cohesion: 0.36
Nodes (8): AskAiQuota, currentAiPeriodYm(), defaultAiMonthlyQuestions(), nextAiPeriodResetIso(), resolveAiMonthlyQuestions(), parsePlatformPlanId(), ConsumeResult, normalizeTenant()

### Community 74 - "notify-founder.ts"
Cohesion: 0.31
Nodes (9): getSignupAlertEmail(), bodyFor(), escapeHtml(), formatVet(), FounderNotifyEvent, FounderNotifyPayload, notifyFounder(), TODO: add WhatsApp channel once a provider is chosen. (+1 more)

### Community 75 - "dashboard/wods/page.tsx"
Cohesion: 0.33
Nodes (6): errorText(), isUniqueViolation(), localDateKey(), readWodContent(), WodEditorPage(), date-fns

## Knowledge Gaps
- **382 isolated node(s):** `INCOME_KEYS`, `EXPENSE_KEYS`, `STATUS_KEYS`, `PLAN_HINT`, `TenantAdmin` (+377 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 455 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `translations.ts`, `validate.ts`, `read-proof/route.ts`, `onboarding/page.tsx`, `rate-limit.ts`, `StaffLoginPage.tsx`, `react`, `booking/page.tsx`, `requireStaffApi`, `dashboard/page.tsx`, `push.ts`, `hqFinancialsService.ts`, `useTenant`, `setup/route.ts`, `payroll/page.tsx`, `setup/page.tsx`, `useLanguage`, `package.json`, `auth.ts`, `payment_methods/page.tsx`, `platform-plans.ts`, `sentry-scrub.ts`, `gym-signup/route.ts`, `provision-tenant.ts`, `salary/page.tsx`, `personal_records/page.tsx`, `profiles/route.ts`, `trial-lifecycle/route.ts`, `useToast`, `requireAdminTenantId`, `athletes/page.tsx`, `appearance/actions.ts`, `app/layout.tsx`, `class_types/page.tsx`, `dashboard/layout.tsx`, `auth-callback.ts`, `cron/expire/route.ts`, `dashboard/wods/page.tsx`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `read-proof/route.ts`, `onboarding/page.tsx`, `financialService.ts`, `StaffLoginPage.tsx`, `insights/page.tsx`, `booking/page.tsx`, `dashboard/page.tsx`, `hqFinancialsService.ts`, `useTenant`, `gym.ts`, `expenses/page.tsx`, `payroll/page.tsx`, `setup/page.tsx`, `useLanguage`, `package.json`, `payment_methods/page.tsx`, `platform-plans.ts`, `sentry-scrub.ts`, `dashboard/financials/page.tsx`, `tenant-terms.ts`, `salary/page.tsx`, `pilot/page.tsx`, `personal_records/page.tsx`, `TenantContext.tsx`, `CreateClassModal.tsx`, `supabase.ts`, `useToast`, `athletes/page.tsx`, `useFinancials.ts`, `appearance/page.tsx`, `class_types/page.tsx`, `dashboard/layout.tsx`, `auth-callback.ts`, `accountability/page.tsx`, `dashboard/wods/page.tsx`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `useLanguage()` connect `useLanguage` to `read-proof/route.ts`, `onboarding/page.tsx`, `financialService.ts`, `StaffLoginPage.tsx`, `react`, `insights/page.tsx`, `booking/page.tsx`, `dashboard/page.tsx`, `hqFinancialsService.ts`, `useTenant`, `gym.ts`, `expenses/page.tsx`, `payroll/page.tsx`, `setup/page.tsx`, `payment_methods/page.tsx`, `platform-plans.ts`, `dashboard/financials/page.tsx`, `tenant-terms.ts`, `salary/page.tsx`, `pilot/page.tsx`, `personal_records/page.tsx`, `supabase.ts`, `useToast`, `requireAdminTenantId`, `athletes/page.tsx`, `useFinancials.ts`, `appearance/page.tsx`, `class_types/page.tsx`, `dashboard/layout.tsx`, `accountability/page.tsx`, `dashboard/wods/page.tsx`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `INCOME_KEYS`, `EXPENSE_KEYS`, `STATUS_KEYS` to the rest of the system?**
  _382 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `validate.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `read-proof/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12433862433862433 - nodes in this community are weakly interconnected._
- **Should `rate-limit.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12100840336134454 - nodes in this community are weakly interconnected._
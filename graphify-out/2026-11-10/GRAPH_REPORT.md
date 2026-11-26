# Graph Report - admin  (2026-11-10)

## Corpus Check
- 285 files · ~202,169 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: .mdc 5, (none) 3, .css 2)

## Summary
- 1541 nodes · 4469 edges · 73 communities (68 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3f367c1b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- translations.ts
- validate.ts
- dashboard/page.tsx
- onboarding/page.tsx
- athletes/page.tsx
- gym-signup/route.ts
- appearance/page.tsx
- auth.ts
- community/page.tsx
- insights/page.tsx
- booking/page.tsx
- requireStaffApi
- AI Payment Proof Enhancements - Test Plan
- hqFinancialsService.ts
- push.ts
- super-admin/financials/page.tsx
- ScheduleWeekCalendar.tsx
- TenantContext.tsx
- gym.ts
- expenses/page.tsx
- payroll/page.tsx
- setup/page.tsx
- useLanguage
- package.json
- forgot-password/route.ts
- payment_methods/page.tsx
- smtp.ts
- platform-plans.ts
- parsePlatformPlanId
- compilerOptions
- sentry-scrub.ts
- users/[id]/route.ts
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
- currency.ts
- devDependencies
- profiles/route.ts
- trial-lifecycle/route.ts
- CreateClassModal.tsx
- profile/page.tsx
- useToast
- colorTokens.js
- CurrencyType
- requireAdminTenantId
- supabase.ts
- useTenant
- scripts
- appearance/actions.ts
- coachBriefService.ts
- README.md
- techniques.ts
- engines
- postcss.config.mjs
- vercel.json
- sync-color-theme.mjs
- milestoneService.ts
- app/layout.tsx
- class_types/page.tsx
- dashboard/layout.tsx
- trackProductEvent
- member-payment-status.ts
- accountability/page.tsx
- cron/expire/route.ts

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
- `SuperAdminLayout()` --calls--> `useLanguage()`  [EXTRACTED]
  app/(hq)/super-admin/layout.tsx → components/LanguageContext.tsx
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

## Communities (73 total, 5 thin omitted)

### Community 0 - "translations.ts"
Cohesion: 0.15
Nodes (24): authorizeProvisioning(), POST(), resolvePlanIdForTenant(), resolveTenantId(), POST(), addDays(), POST(), startOfDay() (+16 more)

### Community 1 - "validate.ts"
Cohesion: 0.07
Nodes (55): GET(), ImportJobRow, loadTenantContext(), lookupEmails(), maxDuration, POST(), RouteContext, runValidation() (+47 more)

### Community 2 - "dashboard/page.tsx"
Cohesion: 0.08
Nodes (37): mediaTypeFromPath(), PaymentRow, POST(), DashboardDetailModal(), DashboardDetailModalProps, DashboardModalItem, DashboardModalItem, ApiResponse (+29 more)

### Community 3 - "onboarding/page.tsx"
Cohesion: 0.23
Nodes (15): saveOnboardingRequiredAction(), GROUPS, OnboardingSettingsPage(), asObject(), boolFlag(), DEFAULT_ONBOARDING_REQUIRED, isLockedOnboardingField(), LOCKED_ONBOARDING_FIELD_IDS (+7 more)

### Community 4 - "athletes/page.tsx"
Cohesion: 0.12
Nodes (22): SortDir, SortKey, useAthletes(), AthleteDetailPage(), ConfirmKind, AthletesPage(), AddToClassModalProps, AthleteOption (+14 more)

### Community 5 - "gym-signup/route.ts"
Cohesion: 0.11
Nodes (38): GET(), json(), OPTIONS(), GET(), json(), OPTIONS(), cors(), OPTIONS() (+30 more)

### Community 6 - "appearance/page.tsx"
Cohesion: 0.14
Nodes (24): getMilestoneSettingsAction(), saveMilestoneSettingsAction(), saveTenantFeaturesAction(), saveTenantPaletteAction(), saveTenantTermsAction(), AppearancePage(), MODULE_COPY, paletteDescKey() (+16 more)

### Community 7 - "auth.ts"
Cohesion: 0.05
Nodes (61): GET(), AuthCallbackHandler(), handleCallback(), ResetPasswordPage(), WelcomePage(), PageProps, AuthPageShell(), AuthPageShellProps (+53 more)

### Community 8 - "community/page.tsx"
Cohesion: 0.39
Nodes (6): CommunityPage(), communityService, CreatePostInput, Post, PostType, Profile

### Community 9 - "insights/page.tsx"
Cohesion: 0.08
Nodes (29): BadgeTone, EVENT_LABELS, FinancialInsightsPage(), interventionCopy(), OUTCOME_LABELS, PRIORITY_LABELS, PRIORITY_ORDER, PRIORITY_TONE (+21 more)

### Community 10 - "booking/page.tsx"
Cohesion: 0.12
Nodes (38): saveBookingSettingsAction(), saveOverdueSettingsAction(), BookingSettingsPage(), CloseWindowEditor(), fullWindowLabel(), isPresetMinutes(), isReminderPresetMinutes(), minutesToParts() (+30 more)

### Community 11 - "requireStaffApi"
Cohesion: 0.10
Nodes (27): GET(), HistoryItem, parseHistory(), POST(), DELETE(), PATCH(), POST(), DELETE() (+19 more)

### Community 12 - "AI Payment Proof Enhancements - Test Plan"
Cohesion: 0.05
Nodes (39): Acceptance Criteria, AI Payment Proof Enhancements - Test Plan, Database Verification, Edge Cases, Feature 1: Bank Extraction, Feature 2: Plan Price Comparison, Feature 3: Duplicate Detection, Feature 4: Combined Scenarios (+31 more)

### Community 13 - "hqFinancialsService.ts"
Cohesion: 0.10
Nodes (24): GET(), DELETE(), GET(), POST(), caracasYmd(), emptySeries(), ExpenseRow, hqFinancialsService (+16 more)

### Community 14 - "push.ts"
Cohesion: 0.15
Nodes (28): addDays(), daysBetween(), GET(), POST(), startOfDay(), drain(), GET(), POST() (+20 more)

### Community 15 - "super-admin/financials/page.tsx"
Cohesion: 0.16
Nodes (24): categoryMixItems(), EXPENSE_KEYS, formatUsd(), INCOME_KEYS, IncomeExpenseChart(), KpiCard(), ledgerLabel(), methodMixItems() (+16 more)

### Community 16 - "ScheduleWeekCalendar.tsx"
Cohesion: 0.28
Nodes (12): Coach, getCaracasHourMinute(), getDurationMinutes(), HOURS, ScheduleWeekCalendar(), ScheduleWeekCalendarProps, useSchedule(), SchedulePage() (+4 more)

### Community 17 - "TenantContext.tsx"
Cohesion: 0.31
Nodes (7): TenantContext, TenantContextValue, DEFAULT_TENANT_CURRENCIES, TenantCurrencyConfig, tenantCurrencyService, DEFAULT_TENANT_FEATURES, SignupSource

### Community 18 - "gym.ts"
Cohesion: 0.17
Nodes (19): classService, ClassUpdateFields, mapClassOccupancy(), occupancyCount(), GuestBooking, guestService, Booking, BookingStatus (+11 more)

### Community 19 - "expenses/page.tsx"
Cohesion: 0.11
Nodes (25): expenseCategoryKey(), ExpensesPage(), expenseStatusKey(), isCashMethod(), useFinancials(), CATEGORIES, IncomePage(), isLocalCurrency() (+17 more)

### Community 20 - "payroll/page.tsx"
Cohesion: 0.07
Nodes (59): POST(), bulkUpdateClassPayrollStatusAction(), requireAdminTenant(), updateClassPayrollStatusAction(), VALID_STATUSES, blockStyles(), classDurationMinutes(), FilterMode (+51 more)

### Community 21 - "setup/page.tsx"
Cohesion: 0.11
Nodes (24): GET(), isSetupStep(), loadFacts(), PATCH(), TrialFounderBanner(), saveGymNameAction(), GymSetupPage(), SetupPayload (+16 more)

### Community 22 - "useLanguage"
Cohesion: 0.11
Nodes (23): AuthConfirmContent(), ForgotPasswordForm(), ForgotPasswordPage(), AskAiPage(), ChatMessage, SUGGESTIONS, CoachEvaluation, Feedback (+15 more)

### Community 23 - "package.json"
Cohesion: 0.09
Nodes (21): eslintConfig, name, packageManager, pnpm, onlyBuiltDependencies, private, version, babel-plugin-react-compiler (+13 more)

### Community 24 - "forgot-password/route.ts"
Cohesion: 0.20
Nodes (16): POST(), RouteContext, POST(), findUserByEmail(), POST(), sendMobilePasswordReset(), POST(), getPasswordResetRedirectUrl() (+8 more)

### Community 25 - "payment_methods/page.tsx"
Cohesion: 0.19
Nodes (19): createPaymentMethodAction(), deletePaymentMethodAction(), readStructuredFields(), togglePaymentMethodStatusAction(), updatePaymentMethodAction(), currencySelectValue(), PaymentMethodsPage(), currencyOptionLabel() (+11 more)

### Community 26 - "smtp.ts"
Cohesion: 0.23
Nodes (16): buildGymSignupVerifyEmailHtml(), isGymSignupEmailConfigured(), sendGymSignupVerifyEmail(), isMemberInviteEmailConfigured(), createTransporter(), EmailAttachment, formatFromAddress(), isSmtpConfigured() (+8 more)

### Community 27 - "platform-plans.ts"
Cohesion: 0.17
Nodes (12): PLAN_HINT, planBadgeClass(), SuperAdminTenantsPage(), caracasYmd(), DEFAULT_PLATFORM_PLAN, PLATFORM_PLAN_IDS, PLATFORM_PLANS, PlatformPlanDef (+4 more)

### Community 28 - "parsePlatformPlanId"
Cohesion: 0.16
Nodes (17): AskAiQuota, currentAiPeriodYm(), defaultAiMonthlyQuestions(), nextAiPeriodResetIso(), resolveAiMonthlyQuestions(), parsePlatformPlanId(), PlatformPlanId, Counts (+9 more)

### Community 29 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 30 - "sentry-scrub.ts"
Cohesion: 0.20
Nodes (10): onRouterTransitionStart, onRequestError, register(), AUTH_PATH_MARKERS, getSentryDsn(), getSentryInitOptions(), isAuthRelatedUrl(), scrubSentryEvent() (+2 more)

### Community 31 - "users/[id]/route.ts"
Cohesion: 0.23
Nodes (11): DELETE(), GET(), PUT(), resolveUnlimitedPlanId(), supabaseAdmin, validatePlanForTenant(), POST(), resolveDefaultPlanId() (+3 more)

### Community 32 - "dashboard/financials/page.tsx"
Cohesion: 0.12
Nodes (15): CurrencyPanelProps, FinancialsPage(), formatExportRange(), MetricRowProps, parseRangeDate(), Period, ReconInputProps, StatCardProps (+7 more)

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
Cohesion: 0.16
Nodes (21): checkDailyMilestones(), GET(), POST(), RouteContext, GET(), POST(), resolveUnlimitedPlanId(), RouteContext (+13 more)

### Community 39 - "fx-cache.ts"
Cohesion: 0.46
Nodes (6): fxCacheKey(), getCachedFxRate(), getFxCacheTtlSeconds(), setCachedFxRate(), getUpstashRedis(), @upstash/redis

### Community 40 - "pilot/page.tsx"
Cohesion: 0.24
Nodes (5): EMPTY_METRICS, PilotPage(), PilotBaseline, PilotMetrics, pilotProgramService

### Community 41 - "personal_records/page.tsx"
Cohesion: 0.25
Nodes (15): createPrMovementAction(), deletePrMovementAction(), parseMovementForm(), togglePrMovementStatusAction(), updatePrMovementAction(), defaultForm, PersonalRecordsPage(), slugify() (+7 more)

### Community 42 - "currency.ts"
Cohesion: 0.17
Nodes (14): applyRateMargin(), computeEffectiveRate(), CURRENCY_NAMES, CURRENCY_SYMBOLS, CUSTOM_CURRENCY_VALUE, DEFAULT_EXCHANGE_RATE_CONFIG, exchangeRateEndpoint(), ExchangeRateSource (+6 more)

### Community 43 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, babel-plugin-react-compiler, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/nodemailer (+4 more)

### Community 44 - "profiles/route.ts"
Cohesion: 0.23
Nodes (12): applyProfileFilters(), DB_SORT_COLUMNS, enrichWithEmails(), GET(), getLastPaymentDates(), parseSolvencyFilter(), parseSortDir(), parseSortKey() (+4 more)

### Community 45 - "trial-lifecycle/route.ts"
Cohesion: 0.24
Nodes (11): authorize(), GET(), hasEvent(), POST(), runTrialLifecycle(), DashboardLayout(), slugFromPath(), TenantProvider() (+3 more)

### Community 46 - "CreateClassModal.tsx"
Cohesion: 0.27
Nodes (11): ClassFormPrefill, ClassModalMode, Coach, computeEndFromStart(), CreateClassModal(), CreateClassModalProps, DAYS_OF_WEEK, defaultDurationMinutes() (+3 more)

### Community 47 - "profile/page.tsx"
Cohesion: 0.22
Nodes (12): CheckinPrintPage(), getInitials(), ProfilePage(), roleLabel(), StaffProfile, toSupportWhatsAppUrl(), buildMobileJoinDeepLink(), buildPublicCheckinUrl() (+4 more)

### Community 48 - "useToast"
Cohesion: 0.11
Nodes (21): PLAN_HINT, SuperAdminTenantDetailPage(), TenantAdmin, NewsItem, NewsPage(), DashboardPage(), CreateNewsModal(), CreateNewsModalProps (+13 more)

### Community 49 - "colorTokens.js"
Cohesion: 0.18
Nodes (11): camelToKebab(), PITS_COLORS, PITS_FONTS, PITS_LEGACY, PITS_SEMANTIC, PITS_THEME_COLORS, lib_constants_colortokens_pitstailwindcolors, toPitsTailwindColors() (+3 more)

### Community 50 - "CurrencyType"
Cohesion: 0.18
Nodes (11): CurrencyType, ARS, BRL, CLP, COP, EUR, GBP, MXN (+3 more)

### Community 51 - "requireAdminTenantId"
Cohesion: 0.36
Nodes (10): createMembershipPlanAction(), deleteMembershipPlanAction(), getMemberCountForPlan(), parseLimitType(), parseOptionalInt(), parsePlanForm(), toggleMembershipPlanStatusAction(), updateMembershipPlanAction() (+2 more)

### Community 52 - "supabase.ts"
Cohesion: 0.14
Nodes (19): SuperAdminLayout(), AddAthleteModal(), AddAthleteModalProps, EditAthleteModal(), EditAthleteModalProps, canAssignProfileRole(), isStaffProfileRole(), ensureRowTenantId() (+11 more)

### Community 53 - "useTenant"
Cohesion: 0.19
Nodes (13): useAttendance(), AttendancePage(), bookingStatusKey(), classTime(), AddGuestModal(), AddGuestModalProps, AddToClassModal(), useTenant() (+5 more)

### Community 54 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, prebuild, predev, start, sync:theme

### Community 55 - "appearance/actions.ts"
Cohesion: 0.22
Nodes (12): TenantLayout(), TenantWodsPage(), tenantFeaturesService, tenantTermsService, asObject(), boolFlag(), parseTenantFeatures(), patchTenantFeaturesSettings() (+4 more)

### Community 56 - "coachBriefService.ts"
Cohesion: 0.15
Nodes (10): AthleteProfile, BookingProfileJoin, CoachBrief, CoachBriefAthlete, coachBriefService, normalize(), Pr, Result (+2 more)

### Community 57 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 59 - "engines"
Cohesion: 0.67
Nodes (3): engines, node, pnpm

### Community 64 - "sync-color-theme.mjs"
Cohesion: 0.22
Nodes (8): ref_node_fs, ref_node_module, ref_node_path, ref_node_url, outPath, require, root, { toPitsThemeCssVars }

### Community 65 - "milestoneService.ts"
Cohesion: 0.33
Nodes (7): milestoneService, DEFAULT_MILESTONE_SETTINGS, MilestoneAchieved, MilestoneSettings, MilestoneType, parseMilestoneSettings(), patchMilestoneSettings()

### Community 66 - "app/layout.tsx"
Cohesion: 0.25
Nodes (6): app_globals, inter, jetbrainsMono, metadata, plusJakarta, ToastProvider()

### Community 67 - "class_types/page.tsx"
Cohesion: 0.26
Nodes (12): createClassTypeAction(), deleteClassTypeAction(), parseClassTypeForm(), toggleClassTypeStatusAction(), updateClassTypeAction(), ClassTypesPage(), CLASS_TYPES, ClassType (+4 more)

### Community 68 - "dashboard/layout.tsx"
Cohesion: 0.13
Nodes (15): NavItem, NavLinkItem, NavParentItem, NavSection, NavSubItem, NotificationsPage(), Recipient, errorText() (+7 more)

### Community 69 - "trackProductEvent"
Cohesion: 0.36
Nodes (7): POST(), cors(), OPTIONS(), POST(), PUBLIC_EVENTS, ProductEventName, trackProductEvent()

### Community 70 - "member-payment-status.ts"
Cohesion: 0.29
Nodes (6): asBool(), MemberPaymentReason, MemberPaymentStatus, MemberPaymentStatusKind, OverdueMemberToday, parseMemberPaymentStatus()

### Community 71 - "accountability/page.tsx"
Cohesion: 0.36
Nodes (5): useAccountability(), AccountabilityPage(), BalanceCard(), formatMoney(), MONTHS

### Community 72 - "cron/expire/route.ts"
Cohesion: 0.67
Nodes (3): GET(), POST(), supabaseAdmin

## Knowledge Gaps
- **382 isolated node(s):** `INCOME_KEYS`, `EXPENSE_KEYS`, `STATUS_KEYS`, `PLAN_HINT`, `TenantAdmin` (+377 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 455 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `translations.ts`, `validate.ts`, `dashboard/page.tsx`, `onboarding/page.tsx`, `athletes/page.tsx`, `gym-signup/route.ts`, `auth.ts`, `community/page.tsx`, `booking/page.tsx`, `requireStaffApi`, `hqFinancialsService.ts`, `push.ts`, `super-admin/financials/page.tsx`, `ScheduleWeekCalendar.tsx`, `payroll/page.tsx`, `setup/page.tsx`, `useLanguage`, `package.json`, `forgot-password/route.ts`, `payment_methods/page.tsx`, `platform-plans.ts`, `sentry-scrub.ts`, `users/[id]/route.ts`, `provision-tenant.ts`, `salary/page.tsx`, `personal_records/page.tsx`, `profiles/route.ts`, `trial-lifecycle/route.ts`, `useToast`, `requireAdminTenantId`, `supabase.ts`, `appearance/actions.ts`, `app/layout.tsx`, `class_types/page.tsx`, `dashboard/layout.tsx`, `trackProductEvent`, `cron/expire/route.ts`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Why does `react` connect `useLanguage` to `dashboard/page.tsx`, `onboarding/page.tsx`, `athletes/page.tsx`, `appearance/page.tsx`, `auth.ts`, `community/page.tsx`, `insights/page.tsx`, `booking/page.tsx`, `super-admin/financials/page.tsx`, `ScheduleWeekCalendar.tsx`, `TenantContext.tsx`, `gym.ts`, `expenses/page.tsx`, `payroll/page.tsx`, `setup/page.tsx`, `package.json`, `payment_methods/page.tsx`, `platform-plans.ts`, `sentry-scrub.ts`, `dashboard/financials/page.tsx`, `tenant-terms.ts`, `salary/page.tsx`, `pilot/page.tsx`, `personal_records/page.tsx`, `CreateClassModal.tsx`, `profile/page.tsx`, `useToast`, `supabase.ts`, `useTenant`, `class_types/page.tsx`, `dashboard/layout.tsx`, `accountability/page.tsx`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `useLanguage()` connect `useLanguage` to `dashboard/page.tsx`, `onboarding/page.tsx`, `athletes/page.tsx`, `appearance/page.tsx`, `auth.ts`, `community/page.tsx`, `insights/page.tsx`, `booking/page.tsx`, `super-admin/financials/page.tsx`, `ScheduleWeekCalendar.tsx`, `gym.ts`, `expenses/page.tsx`, `payroll/page.tsx`, `setup/page.tsx`, `payment_methods/page.tsx`, `platform-plans.ts`, `dashboard/financials/page.tsx`, `tenant-terms.ts`, `salary/page.tsx`, `pilot/page.tsx`, `personal_records/page.tsx`, `trial-lifecycle/route.ts`, `profile/page.tsx`, `useToast`, `requireAdminTenantId`, `supabase.ts`, `useTenant`, `class_types/page.tsx`, `dashboard/layout.tsx`, `accountability/page.tsx`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `INCOME_KEYS`, `EXPENSE_KEYS`, `STATUS_KEYS` to the rest of the system?**
  _382 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `translations.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14789915966386555 - nodes in this community are weakly interconnected._
- **Should `validate.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06836158192090395 - nodes in this community are weakly interconnected._
- **Should `dashboard/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0797979797979798 - nodes in this community are weakly interconnected._
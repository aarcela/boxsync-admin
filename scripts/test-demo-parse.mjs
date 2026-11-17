// Parser tests for the HQ demo factory (no test framework in the repo).
// Run: pnpm test:demo   (= node --import ./scripts/ts-alias-register.mjs --test scripts/test-demo-parse.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDemoInput } from '../lib/demo-factory/parse.ts';
import { expandSessions, mondayOf, isoWeekday } from '../lib/demo-factory/seed.ts';
import { isValidSlugFormat, isReservedSlug } from '../lib/reserved-slugs.ts';

const NOW = new Date('2026-11-17T15:00:00Z'); // Tuesday

const VALID = `estudio: Pulse Studio
fuente: instagram.com/pulsestudio
paleta: girly
vence: 2026-12-01
tz: America/Caracas
capacidad: 12
planes:
  Plan 8 clases | 40 | 8 clases / 30 dias
  Ilimitado | 60 | ilimitado
  Tres | $35 | 3 por semana
horario:
  Lun,Mie,Vie 06:00 Indoor Bike 50 cap=14 coach=Ana María
  Lun,Mie,Vie 18:30 Pilates 55
  Mar,Jue 07:00 Funcional
  Sáb 09:00 Indoor Bike 50`;

test('valid block', () => {
  const r = parseDemoInput(VALID, NOW);
  assert.deepEqual(r.errors, []);
  assert.equal(r.input.name, 'Pulse Studio');
  assert.equal(r.input.paletteId, 'girly');
  assert.equal(r.input.expiresOn, '2026-12-01');
  assert.equal(r.input.sessions.length, 4);
  assert.deepEqual(r.input.sessions[0], {
    days: [1, 3, 5], time: '06:00', className: 'Indoor Bike', minutes: 50, capacity: 14, coach: 'Ana María',
  });
  assert.equal(r.input.sessions[2].minutes, 60);
  assert.equal(r.input.sessions[2].capacity, 12);
  assert.deepEqual(r.input.sessions[3].days, [6]);
  assert.equal(r.input.plans[0].limitType, 'period');
  assert.equal(r.input.plans[0].sessionLimit, 8);
  assert.equal(r.input.plans[0].validityDays, 30);
  assert.equal(r.input.plans[1].limitType, 'none');
  assert.equal(r.input.plans[2].limitType, 'weekly');
  assert.equal(r.input.plans[2].priceUsd, 35);
  assert.equal(r.input.plansInvented, false);
});

test('no plans → invented plan + warning, default expiry 14 days', () => {
  const r = parseDemoInput('estudio: X\nhorario:\n  Lun 07:00 Yoga', NOW);
  assert.deepEqual(r.errors, []);
  assert.equal(r.input.plansInvented, true);
  assert.equal(r.input.plans.length, 1);
  assert.ok(r.warnings.some((w) => w.code === 'invented_plan'));
  assert.ok(r.warnings.some((w) => w.code === 'missing_source'));
  assert.equal(r.input.expiresOn, '2026-12-01');
});

test('bad time blocks', () => {
  const r = parseDemoInput('estudio: X\nhorario:\n  Lun 25:00 Yoga', NOW);
  assert.equal(r.input, undefined);
  assert.equal(r.errors[0].code, 'bad_time');
  assert.equal(r.errors[0].line, 3);
});

test('unknown day blocks', () => {
  const r = parseDemoInput('estudio: X\nhorario:\n  Lnu 07:00 Yoga', NOW);
  assert.equal(r.errors[0].code, 'unknown_day');
});

test('invalid palette → default with warning', () => {
  const r = parseDemoInput('estudio: X\npaleta: purple\nhorario:\n  Lun 07:00 Yoga', NOW);
  assert.deepEqual(r.errors, []);
  assert.equal(r.input.paletteId, 'default');
  assert.ok(r.warnings.some((w) => w.code === 'bad_palette'));
});

test('per-class cap, ranges, english days, am/pm', () => {
  const r = parseDemoInput('estudio: X\ncapacidad: 8\nhorario:\n  Mon-Fri 6:30pm Spin cap=20\n  Sat 9am Yoga 75', NOW);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.input.sessions[0].days, [1, 2, 3, 4, 5]);
  assert.equal(r.input.sessions[0].time, '18:30');
  assert.equal(r.input.sessions[0].capacity, 20);
  assert.equal(r.input.sessions[1].time, '09:00');
  assert.equal(r.input.sessions[1].capacity, 8);
  assert.equal(r.input.sessions[1].minutes, 75);
});

test('expiry over 30 days is clamped, past expiry blocks', () => {
  const far = parseDemoInput('estudio: X\nvence: 2027-03-01\nhorario:\n  Lun 07:00 Yoga', NOW);
  assert.equal(far.input.expiresOn, '2026-12-17');
  const past = parseDemoInput('estudio: X\nvence: 2026-11-01\nhorario:\n  Lun 07:00 Yoga', NOW);
  assert.equal(past.errors[0].code, 'expiry_past');
});

test('missing name / schedule / bad plan', () => {
  const r = parseDemoInput('planes:\n  Algo | gratis | ilimitado', NOW);
  const codes = r.errors.map((e) => e.code).sort();
  assert.deepEqual(codes, ['bad_price', 'missing_name', 'missing_schedule']);
});

test('schedule expansion: this week from Monday, gym-local → UTC', () => {
  const { input } = parseDemoInput(VALID, NOW);
  assert.equal(isoWeekday('2026-11-17'), 2);
  assert.equal(mondayOf('2026-11-17'), '2026-11-16');
  const rows = expandSessions({
    tenantId: 't', sessions: input.sessions, tz: 'America/Caracas',
    fromDate: '2026-11-16', toDate: '2026-11-22', coachIds: new Map([['ana maría', 'c1']]),
  });
  // Mon/Wed/Fri ×2 + Tue/Thu ×1 + Sat ×1 = 9
  assert.equal(rows.length, 9);
  const first = rows[0];
  assert.equal(first.start_time, '2026-11-16T10:00:00.000Z'); // 06:00 Caracas (UTC-4)
  assert.equal(first.end_time, '2026-11-16T10:50:00.000Z');
  assert.equal(first.coach_id, 'c1');
  assert.equal(first.max_capacity, 14);
});

test('demo- prefix is reserved for self-serve but allowed for the factory', () => {
  assert.equal(isReservedSlug('demo-pulse'), true);
  assert.equal(isValidSlugFormat('demo-pulse'), false);
  assert.equal(isValidSlugFormat('demo-pulse', { allowReserved: true }), true);
  assert.equal(isValidSlugFormat('pulse'), true);
  assert.equal(isValidSlugFormat('Demo Pulse', { allowReserved: true }), false);
});

import type { SupabaseClient } from '@supabase/supabase-js';
/**
 * Each gym's local timezone (IANA name) lives in `tenants.settings.timezone`.
 * Missing or invalid values fall back to Caracas, which is what every gym used before.
 */
export const DEFAULT_GYM_TIMEZONE = 'America/Caracas';

/** Common zones for current and near-term markets; any valid IANA name is still accepted. */
export const GYM_TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'America/Caracas', label: 'Venezuela (Caracas)' },
  { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
  { value: 'America/Lima', label: 'Perú (Lima)' },
  { value: 'America/Guayaquil', label: 'Ecuador (Guayaquil)' },
  { value: 'America/Panama', label: 'Panamá' },
  { value: 'America/Santo_Domingo', label: 'República Dominicana' },
  { value: 'America/Puerto_Rico', label: 'Puerto Rico' },
  { value: 'America/Mexico_City', label: 'México (CDMX)' },
  { value: 'America/Costa_Rica', label: 'Costa Rica' },
  { value: 'America/Santiago', label: 'Chile (Santiago)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'America/Sao_Paulo', label: 'Brasil (São Paulo)' },
  { value: 'America/New_York', label: 'USA – Eastern (Miami, New York)' },
  { value: 'America/Chicago', label: 'USA – Central (Houston, Chicago)' },
  { value: 'America/Denver', label: 'USA – Mountain (Denver)' },
  { value: 'America/Los_Angeles', label: 'USA – Pacific (Los Angeles)' },
  { value: 'Europe/Madrid', label: 'España (Madrid)' },
];

export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function parseGymTimezone(settings: unknown): string {
  const raw =
    settings && typeof settings === 'object'
      ? (settings as Record<string, unknown>).timezone
      : undefined;
  return isValidTimezone(raw) ? raw : DEFAULT_GYM_TIMEZONE;
}

export function patchGymTimezone(settings: unknown, timezone: string): Record<string, unknown> {
  const base =
    settings && typeof settings === 'object' ? { ...(settings as Record<string, unknown>) } : {};
  return { ...base, timezone };
}

/** Reads a gym's timezone on the server (falls back to Caracas on any problem). */
export async function fetchGymTimezone(
  client: SupabaseClient,
  tenantId: string | null | undefined,
): Promise<string> {
  if (!tenantId) return DEFAULT_GYM_TIMEZONE;
  const { data } = await client.from('tenants').select('settings').eq('id', tenantId).maybeSingle();
  return parseGymTimezone(data?.settings);
}

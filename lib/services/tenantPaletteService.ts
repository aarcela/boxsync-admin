import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_PALETTE_ID,
  parsePaletteId,
  resolvePaletteId,
  type PaletteId,
} from '../constants/appPalettes';
import { supabase } from '../supabase';

export const tenantPaletteService = {
  async getForTenant(
    tenantId: string,
    client: SupabaseClient = supabase
  ): Promise<PaletteId> {
    const { data, error } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) throw error;
    return parsePaletteId(data?.settings);
  },

  async updateForTenant(
    tenantId: string,
    paletteId: string,
    client: SupabaseClient = supabase
  ): Promise<PaletteId> {
    const nextId = resolvePaletteId(paletteId);

    const { data: existing, error: readError } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    if (readError) throw readError;

    const currentSettings =
      existing?.settings && typeof existing.settings === 'object'
        ? (existing.settings as Record<string, unknown>)
        : {};

    const { data, error } = await client
      .from('tenants')
      .update({ settings: { ...currentSettings, paletteId: nextId } })
      .eq('id', tenantId)
      .select('settings')
      .single();

    if (error) throw error;
    return parsePaletteId(data?.settings) || DEFAULT_PALETTE_ID;
  },
};

import { supabase } from '../supabase';
import { PrMovement } from '../types/pr';

export const prMovementService = {
  async getPrMovements(): Promise<PrMovement[]> {
    const { data, error } = await supabase
      .from('pr_movements')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return data as PrMovement[];
  },
};

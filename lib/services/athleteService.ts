import { supabase } from '../supabase';
import { Profile, AthletePlan } from '../types/gym';
import { financialService } from './financialService';

export const athleteService = {
  /**
   * Fetches all user profiles, including limited booking history and payment info.
   */
  async getProfiles(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select(`*, bookings!left(status, created_at)`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const profilesData = data as Profile[];
    
    // Fetch last payment dates for all athletes
    const userIds = profilesData.map(p => p.id);
    const lastPaymentDates = await financialService.getLastPaymentDates(userIds);
    
    return profilesData.map(p => ({
      ...p,
      last_payment_date: lastPaymentDates[p.id]
    }));
  },

  /**
   * Toggles the solvency (active access) status of an athlete.
   */
  async updateSolvency(id: string, is_solvent: boolean): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ is_solvent })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Updates an athlete's membership plan.
   */
  async updatePlan(id: string, plan: AthletePlan | string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ plan })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Toggles whether an athlete's inscription (registration fee) has been paid.
   */
  async updateInscriptionStatus(id: string, inscription_paid: boolean): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ inscription_paid })
      .eq('id', id);

    if (error) throw error;
  }
};

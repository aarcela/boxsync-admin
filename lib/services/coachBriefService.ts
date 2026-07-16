import { supabase } from '../supabase';
import { getCaracasDateFromIso } from '../utils/date';

export type CoachBriefAthlete = {
  userId: string;
  name: string;
  level: string | null;
  suggestedLoad: string | null;
  scalingNote: string;
  pacingTarget: string;
  healthCaution: string | null;
  explanation: string[];
};

export type CoachBrief = {
  wodTitle: string | null;
  wodSummary: string | null;
  athletes: CoachBriefAthlete[];
  notice: string;
};

type Wod = {
  id: string;
  title: string | null;
  content: string | null;
  score_type: string | null;
};

type AthleteProfile = {
  id: string;
  full_name: string | null;
  level: string | null;
  has_injury: boolean | null;
  injury_text: string | null;
  has_medical_condition: boolean | null;
  medical_condition_text: string | null;
  has_allergies: boolean | null;
  allergies_text: string | null;
};

type BookingProfileJoin = {
  profiles: AthleteProfile | AthleteProfile[] | null;
};

type Pr = {
  user_id: string;
  movement_slug: string;
  movement_name: string | null;
  record_type: string;
  value: number;
  unit: string;
};

type Result = {
  user_id: string;
  score_display: string;
  division: string;
  created_at: string;
  wods: { id: string; title: string | null } | null;
};

const normalize = (value: string | null | undefined) =>
  (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function parseWodContent(content: string | null) {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.map((section) => `${section.title || ''} ${section.content || ''}`).join(' ');
    }
    return [parsed.technique, parsed.strength, parsed.metcon, parsed.workout, parsed.stimulus]
      .filter(Boolean)
      .join(' ');
  } catch {
    return content;
  }
}

function suggestedLoad(trainingText: string, prs: Pr[]) {
  const percentage = [...trainingText.matchAll(/(?:@|at)?\s*(\d{2,3}(?:\.\d+)?)\s*%/gi)]
    .map((match) => Number(match[1]))
    .find((value) => value >= 20 && value <= 100);
  if (!percentage) return null;

  const normalizedText = normalize(trainingText);
  const pr = [...prs]
    .filter((record) => record.record_type === 'weight')
    .sort((a, b) => (b.movement_name?.length || 0) - (a.movement_name?.length || 0))
    .find((record) => {
      const name = normalize(record.movement_name);
      const slug = normalize(record.movement_slug.replace(/_/g, ' '));
      return (name && normalizedText.includes(name)) || (slug && normalizedText.includes(slug));
    });
  if (!pr) return null;

  const increment = pr.unit === 'kg' ? 0.5 : 1;
  const load = Math.round(((pr.value * percentage) / 100) / increment) * increment;
  return {
    text: `${load} ${pr.unit} (${percentage}% of ${pr.movement_name || pr.movement_slug} PR ${pr.value} ${pr.unit})`,
    reason: `${percentage}% in the WOD matched the athlete's saved ${pr.movement_name || pr.movement_slug} PR.`,
  };
}

function scalingNote(level: string | null) {
  if (level === 'Advanced') return 'Advanced: preserve the intended stimulus; verify mechanics and sustainable pace before using the prescribed option.';
  if (level === 'Intermediate') return 'Intermediate: use a repeatable load and movement option that avoids technical breakdown.';
  return 'Beginner or level not set: prioritize mechanics and coach-led movement/load selection for the full workout.';
}

function healthCaution(profile: AthleteProfile) {
  const details = [
    profile.has_injury && profile.injury_text?.trim()
      ? `Reported injury: ${profile.injury_text.trim()}`
      : null,
    profile.has_medical_condition && profile.medical_condition_text?.trim()
      ? `Reported medical condition: ${profile.medical_condition_text.trim()}`
      : null,
    profile.has_allergies && profile.allergies_text?.trim()
      ? `Reported allergy: ${profile.allergies_text.trim()}`
      : null,
  ].filter(Boolean);
  if (!details.length) return null;
  return `${details.join(' · ')}. Staff caution only: this does not diagnose, assess readiness, or replace medical advice. Speak privately with the athlete before class, avoid interpreting the condition, and direct medical questions to a qualified healthcare professional.`;
}

export const coachBriefService = {
  async getForClass(classId: string): Promise<CoachBrief> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required.');

    const { data: staff, error: staffError } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single();
    if (staffError || !staff || !['coach', 'manager', 'admin'].includes(staff.role)) {
      throw new Error('Coach brief is restricted to staff.');
    }

    const { data: classRow, error: classError } = await supabase
      .from('classes')
      .select('start_time, tenant_id')
      .eq('id', classId)
      .single();
    if (classError) throw classError;
    if (classRow.tenant_id !== staff.tenant_id) throw new Error('Class is outside your tenant.');

    const classDate = getCaracasDateFromIso(classRow.start_time);
    const [{ data: wodData, error: wodError }, { data: bookingData, error: bookingError }] =
      await Promise.all([
        supabase
          .from('wods')
          .select('id, title, content, score_type')
          .eq('tenant_id', classRow.tenant_id)
          .eq('date', classDate)
          .maybeSingle(),
        supabase
          .from('bookings')
          .select(`
            user_id,
            profiles:user_id (
              id, full_name, level,
              has_injury, injury_text,
              has_medical_condition, medical_condition_text,
              has_allergies, allergies_text
            )
          `)
          .eq('class_id', classId)
          .in('status', ['booked', 'attended']),
      ]);
    if (wodError) throw wodError;
    if (bookingError) throw bookingError;

    const wod = (wodData as Wod | null);
    const profiles = ((bookingData || []) as unknown as BookingProfileJoin[])
      .map((booking) =>
        Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles,
      )
      .filter(Boolean) as AthleteProfile[];
    const userIds = profiles.map((profile) => profile.id);
    const trainingText = parseWodContent(wod?.content || null);

    let prs: Pr[] = [];
    let results: Result[] = [];
    if (userIds.length) {
      const [{ data: prData, error: prError }, { data: resultData, error: resultError }] =
        await Promise.all([
          supabase
            .from('v_personal_record_bests')
            .select('user_id, movement_slug, movement_name, record_type, value, unit')
            .in('user_id', userIds),
          supabase
            .from('wod_results')
            .select('user_id, score_display, division, created_at, wods!inner(id, title)')
            .in('user_id', userIds)
            .order('created_at', { ascending: false })
            .limit(500),
        ]);
      if (prError) throw prError;
      if (resultError) throw resultError;
      prs = (prData || []) as Pr[];
      results = (resultData || []) as unknown as Result[];
    }

    return {
      wodTitle: wod?.title || null,
      wodSummary: trainingText || null,
      notice: 'Private staff brief. Health details are self-reported and must not be shared outside authorized staff. Guidance is deterministic and is not a diagnosis or medical clearance.',
      athletes: profiles.map((profile) => {
        const load = wod
          ? suggestedLoad(trainingText, prs.filter((pr) => pr.user_id === profile.id))
          : null;
        const prior = wod
          ? results.find(
              (result) =>
                result.user_id === profile.id &&
                result.wods?.id !== wod.id &&
                normalize(result.wods?.title) === normalize(wod.title),
            )
          : null;
        return {
          userId: profile.id,
          name: profile.full_name || 'Athlete',
          level: profile.level,
          suggestedLoad: load?.text || null,
          scalingNote: scalingNote(profile.level),
          pacingTarget: prior
            ? `Previous comparable result: ${prior.score_display} (${prior.division}). Use as a reference only; coach repeatable splits and a controlled start.`
            : 'No comparable prior result found. Coach a conservative start and repeatable splits.',
          healthCaution: healthCaution(profile),
          explanation: [
            load?.reason || 'No matching PR and WOD percentage were both available; no numeric load was calculated.',
            `Scaling note uses recorded level: ${profile.level || 'not set'}.`,
            prior
              ? 'Pacing references the most recent result with the same WOD title.'
              : 'No same-title prior result was available.',
          ],
        };
      }),
    };
  },
};

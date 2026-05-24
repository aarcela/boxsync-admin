import type { TranslationKey } from '@/lib/translations';

export type PrCategory =
  | 'weightlifting'
  | 'gymnastics'
  | 'conditioning'
  | 'benchmark_wods'
  | 'bodyweight';

export type PrRecordType = 'weight' | 'reps' | 'time';

export interface PrMovement {
  slug: string;
  name: string;
  category: PrCategory;
  record_type: PrRecordType;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export const PR_CATEGORIES: { value: PrCategory; label: TranslationKey }[] = [
  { value: 'weightlifting', label: 'Weightlifting' },
  { value: 'gymnastics', label: 'Gymnastics' },
  { value: 'conditioning', label: 'Conditioning' },
  { value: 'benchmark_wods', label: 'Benchmark WODs' },
  { value: 'bodyweight', label: 'Bodyweight' },
];

export const PR_RECORD_TYPES: { value: PrRecordType; label: TranslationKey }[] = [
  { value: 'weight', label: 'Weight' },
  { value: 'reps', label: 'Reps' },
  { value: 'time', label: 'Time' },
];

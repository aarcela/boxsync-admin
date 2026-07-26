/** Legacy defaults used when seeding a new tenant. Runtime pickers load from `class_types`. */
export const CLASS_TYPES = [
  'CrossFit',
  'Halterofilia',
  'Gymnastic',
  'Open Box',
  'Endurance',
] as const;

export type ClassType = (typeof CLASS_TYPES)[number];

export const DEFAULT_CLASS_TYPE_SEEDS: {
  name: string;
  color_hex: string;
  default_duration_min: number;
  is_open_box: boolean;
  sort_order: number;
  is_active: boolean;
}[] = [
  { name: 'CrossFit', color_hex: '#ef4444', default_duration_min: 60, is_open_box: false, sort_order: 0, is_active: true },
  { name: 'Halterofilia', color_hex: '#2563eb', default_duration_min: 60, is_open_box: false, sort_order: 1, is_active: true },
  { name: 'Gymnastic', color_hex: '#9333ea', default_duration_min: 60, is_open_box: false, sort_order: 2, is_active: true },
  { name: 'Open Box', color_hex: '#6b7280', default_duration_min: 120, is_open_box: true, sort_order: 3, is_active: true },
  { name: 'Endurance', color_hex: '#f97316', default_duration_min: 60, is_open_box: false, sort_order: 4, is_active: true },
];

export const FALLBACK_CLASS_TYPE_COLOR = '#ef4444';

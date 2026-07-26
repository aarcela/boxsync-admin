import { FALLBACK_CLASS_TYPE_COLOR } from '@/lib/constants/classTypes';
import type { ClassTypeRow } from '@/lib/types/gym';
import type { CSSProperties } from 'react';

export function classTypeColorMap(types: Pick<ClassTypeRow, 'name' | 'color_hex'>[]): Record<string, string> {
  return types.reduce<Record<string, string>>((acc, row) => {
    acc[row.name] = row.color_hex || FALLBACK_CLASS_TYPE_COLOR;
    return acc;
  }, {});
}

export function classTypeDurationMap(
  types: Pick<ClassTypeRow, 'name' | 'default_duration_min'>[]
): Record<string, number> {
  return types.reduce<Record<string, number>>((acc, row) => {
    acc[row.name] = row.default_duration_min || 60;
    return acc;
  }, {});
}

/** Inline badge style from hex (works for arbitrary custom types). */
export function classTypeBadgeStyle(colorHex?: string): CSSProperties {
  const bg = colorHex || FALLBACK_CLASS_TYPE_COLOR;
  return {
    backgroundColor: bg,
    color: '#fff',
    borderColor: bg,
  };
}

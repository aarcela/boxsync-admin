/** Athlete-app palettes. Keep in sync with app/constants/palettes.js */

export const DEFAULT_PALETTE_ID = 'default' as const;

export const PALETTE_IDS = [
  'default',
  'intense',
  'vibe',
  'ember',
  'forest',
  'midnight',
  'soft',
  'ice',
  'sand',
  'mono',
  'girly',
  'nude',
] as const;

export type PaletteId = (typeof PALETTE_IDS)[number];

export type PaletteScheme = 'dark' | 'light';

export type PaletteColors = {
  primary: string;
  primaryDark: string;
  secondary: string;
  gunmetal: string;
  grey: string;
  card: string;
  black: string;
  darkGrey: string;
  border: string;
  textMain: string;
  textSub: string;
  accent: string;
  background: string;
  darkText: string;
};

export type AppPalette = {
  scheme: PaletteScheme;
  colors: PaletteColors;
};

export const PALETTES: Record<PaletteId, AppPalette> = {
  default: {
    scheme: 'dark',
    colors: {
      primary: '#D7FF00',
      primaryDark: '#A8C400',
      secondary: '#A8C400',
      gunmetal: '#6E6E6E',
      grey: '#C9C9C9',
      card: '#1A1A1C',
      black: '#000000',
      darkGrey: '#151515',
      border: '#2D2D30',
      textMain: '#F5F5F5',
      textSub: '#9BA1A6',
      accent: '#9BA1A6',
      background: '#0D0D0D',
      darkText: '#0D0D0D',
    },
  },
  intense: {
    scheme: 'dark',
    colors: {
      primary: '#2F62FF',
      primaryDark: '#1D4ED8',
      secondary: '#38BDF8',
      gunmetal: '#475569',
      grey: '#64748B',
      card: '#18181C',
      black: '#000000',
      darkGrey: '#111113',
      border: '#26262B',
      textMain: '#F8FAFC',
      textSub: '#94A3B8',
      accent: '#10B981',
      background: '#080809',
      darkText: '#FFFFFF',
    },
  },
  vibe: {
    scheme: 'dark',
    colors: {
      primary: '#FF3CAC',
      primaryDark: '#E11D8F',
      secondary: '#C026D3',
      gunmetal: '#6E6E6E',
      grey: '#C9C9C9',
      card: '#1A1A1C',
      black: '#000000',
      darkGrey: '#151515',
      border: '#2D2D30',
      textMain: '#F5F5F5',
      textSub: '#9BA1A6',
      accent: '#E879F9',
      background: '#0D0D0D',
      darkText: '#FFFFFF',
    },
  },
  ember: {
    scheme: 'dark',
    colors: {
      primary: '#FF5A1F',
      primaryDark: '#C2410C',
      secondary: '#FB923C',
      gunmetal: '#78716C',
      grey: '#D6D3D1',
      card: '#1C1917',
      black: '#000000',
      darkGrey: '#14110F',
      border: '#292524',
      textMain: '#FAFAF9',
      textSub: '#A8A29E',
      accent: '#FBBF24',
      background: '#0C0A09',
      darkText: '#FFFFFF',
    },
  },
  forest: {
    scheme: 'dark',
    colors: {
      primary: '#22C55E',
      primaryDark: '#15803D',
      secondary: '#4ADE80',
      gunmetal: '#64748B',
      grey: '#CBD5E1',
      card: '#17201B',
      black: '#000000',
      darkGrey: '#0F1612',
      border: '#1F2A24',
      textMain: '#F0FDF4',
      textSub: '#86A394',
      accent: '#A3E635',
      background: '#0A0F0C',
      darkText: '#052E16',
    },
  },
  midnight: {
    scheme: 'dark',
    colors: {
      primary: '#F5C518',
      primaryDark: '#CA8A04',
      secondary: '#60A5FA',
      gunmetal: '#64748B',
      grey: '#CBD5E1',
      card: '#121826',
      black: '#000000',
      darkGrey: '#0B1020',
      border: '#1E293B',
      textMain: '#F8FAFC',
      textSub: '#94A3B8',
      accent: '#38BDF8',
      background: '#070B14',
      darkText: '#0B1020',
    },
  },
  soft: {
    scheme: 'light',
    colors: {
      primary: '#6B8E00',
      primaryDark: '#536F00',
      secondary: '#4E7300',
      gunmetal: '#646A72',
      grey: '#4B5158',
      card: '#FFFFFF',
      black: '#000000',
      darkGrey: '#E3E5E8',
      border: '#D9DCE1',
      textMain: '#15171A',
      textSub: '#5A6068',
      accent: '#5A6068',
      background: '#EDEEF0',
      darkText: '#0D0D0D',
    },
  },
  ice: {
    scheme: 'light',
    colors: {
      primary: '#0284C7',
      primaryDark: '#0369A1',
      secondary: '#38BDF8',
      gunmetal: '#64748B',
      grey: '#475569',
      card: '#FFFFFF',
      black: '#000000',
      darkGrey: '#E2E8F0',
      border: '#CBD5E1',
      textMain: '#0F172A',
      textSub: '#475569',
      accent: '#0EA5E9',
      background: '#F1F5F9',
      darkText: '#FFFFFF',
    },
  },
  sand: {
    scheme: 'light',
    colors: {
      primary: '#C2410C',
      primaryDark: '#9A3412',
      secondary: '#EA580C',
      gunmetal: '#78716C',
      grey: '#57534E',
      card: '#FFFCFA',
      black: '#000000',
      darkGrey: '#E7E5E4',
      border: '#D6D3D1',
      textMain: '#1C1917',
      textSub: '#57534E',
      accent: '#D97706',
      background: '#F5F0EB',
      darkText: '#FFFFFF',
    },
  },
  mono: {
    scheme: 'dark',
    colors: {
      primary: '#F5F5F5',
      primaryDark: '#D4D4D4',
      secondary: '#A3A3A3',
      gunmetal: '#737373',
      grey: '#A3A3A3',
      card: '#171717',
      black: '#000000',
      darkGrey: '#0A0A0A',
      border: '#262626',
      textMain: '#FAFAFA',
      textSub: '#A3A3A3',
      accent: '#E5E5E5',
      background: '#050505',
      darkText: '#0A0A0A',
    },
  },
  girly: {
    scheme: 'light',
    colors: {
      primary: '#F472B6',
      primaryDark: '#DB2777',
      secondary: '#E879F9',
      gunmetal: '#9D8189',
      grey: '#6B4C56',
      card: '#FFFFFF',
      black: '#000000',
      darkGrey: '#FCE7F3',
      border: '#F9CBE3',
      textMain: '#3F2A32',
      textSub: '#8C6B75',
      accent: '#C084FC',
      background: '#FDF2F8',
      darkText: '#FFFFFF',
    },
  },
  nude: {
    scheme: 'light',
    colors: {
      primary: '#C4A07A',
      primaryDark: '#A67C52',
      secondary: '#D4B5A0',
      gunmetal: '#9A8B7A',
      grey: '#6B5B4F',
      card: '#FFF9F5',
      black: '#000000',
      darkGrey: '#EDE0D4',
      border: '#E6D5C8',
      textMain: '#3E2723',
      textSub: '#7A6558',
      accent: '#D4A5A5',
      background: '#F6EDE6',
      darkText: '#3E2723',
    },
  },
};

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === 'string' && (PALETTE_IDS as readonly string[]).includes(value);
}

export function resolvePaletteId(value: unknown): PaletteId {
  return isPaletteId(value) ? value : DEFAULT_PALETTE_ID;
}

export function parsePaletteId(settings: unknown): PaletteId {
  if (!settings || typeof settings !== 'object') return DEFAULT_PALETTE_ID;
  return resolvePaletteId((settings as { paletteId?: unknown }).paletteId);
}

export function getPalette(id: unknown): AppPalette {
  return PALETTES[resolvePaletteId(id)];
}

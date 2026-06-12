// Light admin theme — high contrast for data-dense screens.
// Brand lime is darkened so it stays readable as text/icons on light surfaces.
const PITS_COLORS = {
  primary: "#6B8E00",
  primaryDark: "#536F00",
  secondary: "#4E7300",
  gunmetal: "#646A72",
  grey: "#4B5158",
  card: "#FFFFFF",
  black: "#000000",
  darkGrey: "#E3E5E8",
  border: "#D9DCE1",
  textMain: "#15171A",
  textSub: "#5A6068",
  accent: "#5A6068",
  background: "#EDEEF0",
  darkText: "#0D0D0D",
};

// const PITS_COLORS = {
//   primary: "#2F62FF",
//   primaryDark: "#1D4ED8",
//   secondary: "#38BDF8",
//   gunmetal: "#475569",
//   grey: "#64748B",
//   card: "#18181C",
//   black: "#000000",
//   darkGrey: "#111113",
//   border: "#26262B",
//   textMain: "#F8FAFC",
//   textSub: "#94A3B8",
//   accent: "#10B981",
//   background: "#080809",
//   darkText: "#0F172A",
// };

/** Dashboard / layout semantic tokens derived from the base palette */
const PITS_SEMANTIC = {
  panel: PITS_COLORS.card,
  surface: PITS_COLORS.background,
  surfaceElevated: PITS_COLORS.card,
  surfaceMuted: "#E7E9ED",
  edge: PITS_COLORS.border,
  ink: PITS_COLORS.textMain,
  inkMuted: PITS_COLORS.textSub,
  primarySoft: "#EFF5D8",
  redDark: "#B00500",
  error: "#B00500",
  /* Dark app chrome (sidebar + header) — original dark theme values */
  shell: "#1A1A1C",
  shellEdge: "#2D2D30",
  shellInk: "#F5F5F5",
  shellInkMuted: "#9BA1A6",
  shellAccent: "#D7FF00",
};

/** Legacy class names used across existing components (bg-pits-red, text-pits-dim, …) */
const PITS_LEGACY = {
  bg: PITS_COLORS.darkGrey,
  text: PITS_COLORS.textMain,
  dim: PITS_COLORS.gunmetal,
  red: PITS_COLORS.primary,
  success: PITS_COLORS.secondary,
};

/** Full pits-* theme: base + semantic + legacy aliases */
const PITS_THEME_COLORS = {
  ...PITS_COLORS,
  ...PITS_SEMANTIC,
  ...PITS_LEGACY,
};

const PITS_FONTS = {
  sans: "Inter_400Regular",
  inter: "Inter_400Regular",
  interSemiBold: "Inter_600SemiBold",
  heading: "PlusJakartaSans_700Bold",
  jakarta: "PlusJakartaSans_700Bold",
  mono: "JetBrainsMono_400Regular",
};

function camelToKebab(key) {
  return key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

/** Map theme keys to Tailwind `pits-*` color names (kebab-case) */
function toPitsTailwindColors(colors) {
  return Object.fromEntries(
    Object.entries(colors).map(([key, value]) => [camelToKebab(key), value])
  );
}

/** Build `@theme { --color-pits-*: …; }` lines — keep in sync with tailwind.config.ts */
function toPitsThemeCssVars(colors = PITS_THEME_COLORS) {
  return Object.entries(colors)
    .map(([key, value]) => `  --color-pits-${camelToKebab(key)}: ${value};`)
    .join("\n");
}

module.exports = {
  PITS_COLORS,
  PITS_SEMANTIC,
  PITS_LEGACY,
  PITS_THEME_COLORS,
  PITS_FONTS,
  pitsTailwindColors: toPitsTailwindColors(PITS_THEME_COLORS),
  toPitsThemeCssVars,
  camelToKebab,
};

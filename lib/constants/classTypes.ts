export const CLASS_TYPES = [
  'CrossFit',
  'Halterofilia',
  'Gymnastic',
  'Open Box',
  'Endurance',
] as const;

export type ClassType = (typeof CLASS_TYPES)[number];

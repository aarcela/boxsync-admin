import type { SVGProps } from 'react';

/**
 * Spotter's mark: arrow-based, from the WODUS logo. Swap SPOTTER_MARK to try another option.
 * swoosh = logo arc · wrise = W that takes off · spot = arrow lifted by a cupped hand
 * lift = arrow off a barbell · pulse = heartbeat into an arrow · talkup = chat bubble + arrow
 */
const MARKS = {
  swoosh: ['M3.5 18.5C9 18 14 14 18.5 6', 'M13 5.5 19 5l.5 6'],
  wrise: ['M3 7l3.5 10L11 9.5 15.5 17 21 5', 'M16.5 5H21v4.5'],
  spot: ['M4.5 13.5a7.5 7.5 0 0 0 15 0', 'M12 15V4', 'M8 8l4-4 4 4'],
  lift: ['M3 19h18', 'M5.5 16v6M18.5 16v6', 'M12 15V3.5', 'M8 7.5l4-4 4 4'],
  pulse: ['M2.5 13.5h4l2.5-5 3.5 9 2.5-6h2L20.5 5', 'M16 5h4.5v4.5'],
  talkup: ['M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z', 'M8.5 13l6-6', 'M10 7h4.5v4.5'],
} as const;

export type SpotterMarkVariant = keyof typeof MARKS;
export const SPOTTER_MARK: SpotterMarkVariant = 'wrise';

type Props = Omit<SVGProps<SVGSVGElement>, 'ref'> & {
  size?: number | string;
  strokeWidth?: number | string;
  variant?: SpotterMarkVariant;
  /** draw = strokes draw on once · loop = draw/erase loop (thinking) */
  animate?: 'draw' | 'loop';
};

export default function SpotterMark({
  size = 24,
  strokeWidth = 2.4,
  variant = SPOTTER_MARK,
  animate,
  className = '',
  ...rest
}: Props) {
  const motion = animate === 'draw' ? 'spotter-draw' : animate === 'loop' ? 'spotter-loop' : '';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`spotter-mark ${motion} ${className}`.trim()}
      {...rest}
    >
      {MARKS[variant].map((d) => (
        <path key={d} d={d} pathLength={1} />
      ))}
    </svg>
  );
}

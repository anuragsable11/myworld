/** Playful accent colours; each profile section has its own. Full class names keep Tailwind's scanner happy. */
export type Tone = 'sky' | 'violet' | 'amber' | 'emerald' | 'pink' | 'orange' | 'teal' | 'indigo';

export const TONES: Record<Tone, { chip: string; bar: string; soft: string; text: string }> = {
  sky: { chip: 'bg-sky-200', bar: 'bg-sky-400', soft: 'bg-sky-100', text: 'text-sky-800' },
  violet: { chip: 'bg-violet-200', bar: 'bg-violet-400', soft: 'bg-violet-100', text: 'text-violet-800' },
  amber: { chip: 'bg-amber-200', bar: 'bg-amber-400', soft: 'bg-amber-100', text: 'text-amber-800' },
  emerald: { chip: 'bg-emerald-200', bar: 'bg-emerald-400', soft: 'bg-emerald-100', text: 'text-emerald-800' },
  pink: { chip: 'bg-pink-200', bar: 'bg-pink-400', soft: 'bg-pink-100', text: 'text-pink-800' },
  orange: { chip: 'bg-orange-200', bar: 'bg-orange-400', soft: 'bg-orange-100', text: 'text-orange-800' },
  teal: { chip: 'bg-teal-200', bar: 'bg-teal-400', soft: 'bg-teal-100', text: 'text-teal-800' },
  indigo: { chip: 'bg-indigo-200', bar: 'bg-indigo-400', soft: 'bg-indigo-100', text: 'text-indigo-800' },
};

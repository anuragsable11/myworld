import type { ReactNode } from 'react';
import { Banknote, BookOpen, Building2, ClipboardList, Images, Landmark, Mountain, Users, type LucideIcon } from 'lucide-react';
import type { Tone } from '../ui/tones';

/** Each section's glyph and colour, in the manner of the icons in iOS Settings. */
const GLYPHS: Record<string, { icon: LucideIcon; color: string }> = {
  overview: { icon: BookOpen, color: '#007aff' },
  photos: { icon: Images, color: '#ff2d55' },
  basics: { icon: ClipboardList, color: '#5856d6' },
  government: { icon: Landmark, color: '#ff9500' },
  geography: { icon: Mountain, color: '#34c759' },
  people: { icon: Users, color: '#af52de' },
  economy: { icon: Banknote, color: '#30b0c7' },
  cities: { icon: Building2, color: '#32ade6' },
};

/** Stand-in colours for a section without its own glyph. */
const TONE_COLORS: Record<Tone, string> = {
  sky: '#32ade6',
  violet: '#af52de',
  amber: '#ff9500',
  emerald: '#34c759',
  pink: '#ff2d55',
  orange: '#ff9500',
  teal: '#30b0c7',
  indigo: '#5856d6',
};

export function Section({
  id,
  title,
  emoji,
  tone,
  order = 0,
  source,
  children,
}: {
  id: string;
  title: string;
  /** Shown in the icon tile when the section has no glyph of its own. */
  emoji: string;
  tone: Tone;
  /** Position in the profile; staggers the entrance animation. */
  order?: number;
  source?: ReactNode;
  children: ReactNode;
}) {
  const glyph = GLYPHS[id];
  return (
    <section
      id={`section-${id}`}
      data-section={id}
      aria-labelledby={`section-${id}-title`}
      className="glass-soft animate-rise scroll-mt-16 rounded-[24px] p-5"
      style={{ animationDelay: `${80 + order * 70}ms` }}
    >
      <header className="mb-4 flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-[30px] shrink-0 place-items-center rounded-[8px] text-[17px] text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.45),0_1px_2px_rgb(0_0_0/0.12)]"
          style={{ background: glyph?.color ?? TONE_COLORS[tone] }}
        >
          {glyph ? <glyph.icon className="size-[18px]" strokeWidth={2.2} /> : emoji}
        </span>
        <h3 id={`section-${id}-title`} className="ios-title text-[20px]">
          {title}
        </h3>
      </header>
      {children}
      {source && <p className="mt-5 border-t border-hairline pt-3 text-[12px] leading-snug text-secondary">Source: {source}</p>}
    </section>
  );
}

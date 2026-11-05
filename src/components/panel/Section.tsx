import type { ReactNode } from 'react';
import clsx from 'clsx';
import { TONES, type Tone } from '../ui/tones';

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
  emoji: string;
  tone: Tone;
  /** Position in the profile; staggers the entrance animation. */
  order?: number;
  source?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={`section-${id}`}
      data-section={id}
      aria-labelledby={`section-${id}-title`}
      className="toon animate-rise scroll-mt-16 rounded-3xl bg-white p-5"
      style={{ animationDelay: `${80 + order * 70}ms` }}
    >
      <header className="mb-4 flex items-center gap-3">
        <span
          aria-hidden
          className={clsx(
            'grid size-11 shrink-0 place-items-center rounded-2xl border-2 border-ink text-[22px] shadow-[0_2px_6px_rgba(30,27,75,0.16)]',
            TONES[tone].chip,
          )}
        >
          {emoji}
        </span>
        <h3 id={`section-${id}-title`} className="toon-title text-[21px]">
          {title}
        </h3>
      </header>
      {children}
      {source && (
        <p className="mt-5 border-t-2 border-dashed border-indigo-100 pt-3 text-[11.5px] font-semibold leading-snug text-slate-400">
          Source: {source}
        </p>
      )}
    </section>
  );
}

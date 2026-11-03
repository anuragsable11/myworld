import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function Section({
  id,
  title,
  icon: Icon,
  source,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  source?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={`section-${id}`}
      data-section={id}
      aria-labelledby={`section-${id}-title`}
      className="scroll-mt-14 rounded-2xl border border-white/[0.06] bg-ink-850/70 p-5"
    >
      <header className="mb-4 flex items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brass-400/10 text-brass-300">
          <Icon className="size-[15px]" />
        </span>
        <h3 id={`section-${id}-title`} className="font-display text-[17px] font-medium tracking-tight text-mist-50">
          {title}
        </h3>
      </header>
      {children}
      {source && (
        <p className="mt-5 border-t border-white/[0.05] pt-3 text-[11px] leading-snug text-mist-500">Source: {source}</p>
      )}
    </section>
  );
}

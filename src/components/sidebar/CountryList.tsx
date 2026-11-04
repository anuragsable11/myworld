import { memo, useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import type { Country } from '../../types';
import { groupLetter } from '../../lib/format';
import { scrollWithin } from '../../lib/scroll';
import { isSovereign } from '../../hooks/queries';
import { Flag } from '../ui/Flag';

interface CountryListProps {
  id: string;
  countries: Country[];
  grouped: boolean;
  selectedId: string | null;
  activeId?: string;
  onSelect: (id: string) => void;
  emptyMessage: string;
}

export const CountryList = memo(function CountryList({
  id,
  countries,
  grouped,
  selectedId,
  activeId,
  onSelect,
  emptyMessage,
}: CountryListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    if (!grouped) return [{ letter: '', items: countries }];
    const out: { letter: string; items: Country[] }[] = [];
    for (const c of countries) {
      const letter = groupLetter(c.name);
      if (out.at(-1)?.letter !== letter) out.push({ letter, items: [] });
      out.at(-1)!.items.push(c);
    }
    return out;
  }, [countries, grouped]);

  // Keep the selected (or keyboard-active) row in view.
  useEffect(() => {
    const target = activeId ?? selectedId;
    if (!target) return;
    const container = scrollRef.current;
    const el = container?.querySelector<HTMLElement>(`[data-code="${target}"]`);
    if (container && el) scrollWithin(container, el, { offset: grouped ? 36 : 0 });
  }, [selectedId, activeId, grouped]);

  if (!countries.length) {
    return <p className="px-6 py-10 text-center text-[14px] font-bold text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain pb-3">
      <ul id={id} role="listbox" aria-label="Countries" className="px-2">
        {groups.map((g) => (
          <li key={g.letter || 'results'} role="presentation">
            {g.letter && (
              <div role="presentation" className="sticky top-0 z-10 bg-white px-2 pb-1.5 pt-3">
                <span className="grid size-7 place-items-center rounded-full border-2 border-ink bg-sky-200 font-display text-[14px] font-semibold text-ink">
                  {g.letter}
                </span>
              </div>
            )}
            <ul role="presentation">
              {g.items.map((c) => {
                const selected = c.cca3 === selectedId;
                return (
                  <li
                    key={c.cca3}
                    id={`country-${c.cca3}`}
                    data-code={c.cca3}
                    role="option"
                    aria-selected={selected}
                    onClick={() => onSelect(c.cca3)}
                    className={clsx(
                      'group relative flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-3 py-1.5 transition-all duration-200',
                      selected
                        ? 'border-ink bg-sun shadow-[3px_3px_0_0_var(--color-ink)]'
                        : c.cca3 === activeId
                          ? 'border-ink/30 bg-amber-50'
                          : 'border-transparent hover:translate-x-1 hover:bg-sky-50',
                    )}
                  >
                                        <Flag country={c} className="h-[20px] w-[30px] shrink-0 rounded-md border-2 border-ink transition-transform duration-300 group-hover:-rotate-6" />
                    <span className="min-w-0 flex-1">
                      <span className={clsx('block truncate text-[13.5px]', selected ? 'font-extrabold text-ink' : 'font-bold text-ink')}>
                        {c.name}
                      </span>
                      <span className={clsx('block truncate text-[12px] font-semibold', selected ? 'text-ink/70' : 'text-slate-400')}>
                        {c.capitals[0]?.name ?? c.subregion ?? c.region}
                      </span>
                    </span>
                    {!isSovereign(c) && (
                      <span
                        className={clsx(
                          'shrink-0 rounded-full border-2 border-ink px-1.5 py-px text-[9.5px] font-black uppercase tracking-wide text-ink',
                          selected ? 'bg-white' : 'bg-pink-200',
                        )}
                      >
                        {c.status === 'disputed' ? 'Disputed' : 'Territory'}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
});

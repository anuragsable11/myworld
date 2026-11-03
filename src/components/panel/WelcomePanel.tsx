import { useMemo } from 'react';
import { Compass, Shuffle } from 'lucide-react';
import type { Country } from '../../types';
import { isSovereign, type CountryIndex } from '../../hooks/queries';
import { formatArea, formatPopulation } from '../../lib/format';
import { Flag } from '../ui/Flag';
import { Skeleton } from '../ui/primitives';

/** Shown in the right column on desktop before any country is selected. */
export function WelcomePanel({ index, onSelect }: { index: CountryIndex | undefined; onSelect: (id: string) => void }) {
  const lists = useMemo(() => {
    if (!index) return null;
    const sovereign = index.sorted.filter(isSovereign);
    const top = (key: 'population' | 'area') =>
      sovereign
        .filter((c) => c[key])
        .sort((a, b) => b[key]! - a[key]!)
        .slice(0, 5);
    return { sovereign, populous: top('population'), largest: top('area') };
  }, [index]);

  const surprise = () => {
    if (!lists) return;
    onSelect(lists.sovereign[Math.floor(Math.random() * lists.sovereign.length)].cca3);
  };

  return (
    <div className="h-full overflow-y-auto bg-ink-900 px-6 py-7">
      <span className="grid size-10 place-items-center rounded-xl bg-brass-400/10 text-brass-300">
        <Compass className="size-5" />
      </span>
      <h2 className="mt-5 font-display text-[28px] font-medium leading-tight tracking-tight text-mist-50">Explore the world</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-mist-400">
        Select any country on the map or in the list to open its profile: geography, people, government and economy.
      </p>

      <button
        type="button"
        onClick={surprise}
        disabled={!lists}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brass-400 px-4 py-2.5 text-[13.5px] font-semibold text-ink-950 shadow-lg shadow-brass-400/10 transition-colors hover:bg-brass-300 disabled:opacity-50"
      >
        <Shuffle className="size-4" />
        Surprise me
      </button>

      {lists ? (
        <>
          <dl className="mt-7 grid grid-cols-2 gap-3">
            <Stat label="Sovereign states" value={index!.sovereignCount} />
            <Stat label="Territories" value={index!.sorted.length - index!.sovereignCount} />
          </dl>
          <Ranking title="Most populous" countries={lists.populous} value={(c) => formatPopulation(c.population!)} onSelect={onSelect} />
          <Ranking title="Largest by area" countries={lists.largest} value={(c) => formatArea(c.area!)} onSelect={onSelect} />
        </>
      ) : (
        <div className="mt-7 space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      )}

      <div className="mt-8 rounded-xl border border-white/[0.06] p-4 text-[12.5px] text-mist-400">
        <div className="mb-2 font-medium text-mist-300">Shortcuts</div>
        <ul className="space-y-1.5">
          {[
            ['/', 'Search countries'],
            ['G', 'Toggle map and globe'],
            ['Esc', 'Close the profile'],
          ].map(([key, label]) => (
            <li key={key} className="flex items-center justify-between">
              <span>{label}</span>
              <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 font-sans text-[11px] text-mist-300">{key}</kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-ink-850/70 px-4 py-3">
      <dt className="text-[11px] uppercase tracking-[0.08em] text-mist-500">{label}</dt>
      <dd className="tabular mt-1 font-display text-[24px] text-mist-50">{value}</dd>
    </div>
  );
}

function Ranking({
  title,
  countries,
  value,
  onSelect,
}: {
  title: string;
  countries: Country[];
  value: (c: Country) => string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="mt-7">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-mist-400">{title}</h3>
      <ol className="space-y-0.5">
        {countries.map((c, i) => (
          <li key={c.cca3}>
            <button
              type="button"
              onClick={() => onSelect(c.cca3)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
            >
              <span className="tabular w-4 text-[12px] text-mist-500">{i + 1}</span>
              <Flag country={c} className="h-[14px] w-[21px] rounded-[2px] ring-1 ring-white/10" />
              <span className="flex-1 truncate text-[13.5px] text-mist-100">{c.name}</span>
              <span className="tabular text-[12px] text-mist-400">{value(c)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

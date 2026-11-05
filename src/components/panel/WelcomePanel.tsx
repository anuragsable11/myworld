import { useMemo, type ReactNode } from 'react';
import clsx from 'clsx';
import type { Country } from '../../types';
import { isSovereign, type CountryIndex } from '../../hooks/queries';
import { formatArea, formatInteger, formatPopulation } from '../../lib/format';
import { Mascot } from '../game/Mascot';
import { InstallButton } from '../layout/Install';
import { Flag } from '../ui/Flag';
import { Skeleton } from '../ui/primitives';
import { TONES, type Tone } from '../ui/tones';

/** Shown in the right card on desktop before any country is selected. Every figure is computed from the data. */
export function WelcomePanel({
  index,
  onSelect,
  onSurprise,
  onPlay,
}: {
  index: CountryIndex | undefined;
  onSelect: (id: string) => void;
  onSurprise: () => void;
  onPlay: () => void;
}) {
  const facts = useMemo(() => {
    if (!index) return null;
    const sovereign = index.sorted.filter(isSovereign);
    const by = (key: 'population' | 'area', dir: 1 | -1) =>
      sovereign.filter((c) => c[key]).sort((a, b) => dir * (b[key]! - a[key]!));
    return {
      populous: by('population', 1).slice(0, 5),
      largest: by('area', 1)[0],
      smallest: by('area', -1)[0],
      mostNeighbours: [...sovereign].sort((a, b) => b.borders.length - a.borders.length)[0],
      languages: new Set(index.sorted.flatMap((c) => c.languages)).size,
      currencies: new Set(index.sorted.flatMap((c) => c.currencies.map((x) => x.code))).size,
    };
  }, [index]);

  return (
    <div className="dots-bg h-full overflow-y-auto px-5 pb-8 pt-6">
      <span className="toon-sm inline-flex animate-pop items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[13px] font-extrabold text-ink">
        <span aria-hidden className="inline-block origin-[70%_70%] animate-wave">
          👋
        </span>
        Hey explorer!
      </span>
      <h2 className="toon-title mt-4 animate-rise text-[40px] leading-[1.02]">
        Where to{' '}
        <span className="relative inline-block">
          <span aria-hidden className="absolute inset-x-[-4px] bottom-1 top-[45%] -z-0 -rotate-2 rounded-md bg-sun" />
          <span className="relative">next?</span>
        </span>
      </h2>
      <p className="mt-3 animate-rise text-[15px] font-semibold leading-relaxed text-slate-600 [animation-delay:60ms]">
        Spin the globe, tap any country or search for one. Every country has a full profile packed with fun facts!
      </p>

      <div className="mt-5 flex animate-rise flex-wrap items-center gap-3 [animation-delay:120ms]">
        <button
          type="button"
          onClick={onSurprise}
          disabled={!facts}
          className="toon toon-press group inline-flex items-center gap-2 rounded-2xl bg-sun px-5 py-3 font-display text-[17px] font-semibold text-ink disabled:opacity-50"
        >
          <span aria-hidden className="text-[20px] transition-transform duration-500 group-hover:rotate-[360deg]">
            🎲
          </span>
          Surprise me!
        </button>
        <InstallButton />
      </div>

      <button
        type="button"
        onClick={onPlay}
        disabled={!facts}
        className="toon toon-press mt-6 flex w-full animate-rise items-center gap-3 rounded-3xl bg-[linear-gradient(135deg,#d9f99d_0%,#fde68a_100%)] p-3 pr-4 text-left disabled:opacity-50 [animation-delay:160ms]"
      >
        <Mascot mood="idle" className="w-16 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="toon-title block text-[19px]">Flag quiz 🎮</span>
          <span className="mt-0.5 block text-[13px] font-semibold leading-snug text-slate-600">
            10 flags, from easy to impossible. How far can you get?
          </span>
        </span>
        <span className="toon-sm shrink-0 rounded-full bg-sun px-3 py-1 font-display text-[15px] font-semibold text-ink">Play</span>
      </button>

      {facts ? (
        <>
          <dl className="mt-7 grid grid-cols-2 gap-3">
            <Stat tone="sky" emoji="🗺️" label="Countries" value={index!.sovereignCount} order={0} tilt="-rotate-2" />
            <Stat tone="pink" emoji="🏝️" label="Territories" value={index!.sorted.length - index!.sovereignCount} order={1} tilt="rotate-1" />
            <Stat tone="amber" emoji="🗣️" label="Languages" value={facts.languages} order={2} tilt="rotate-1" />
            <Stat tone="emerald" emoji="💸" label="Currencies" value={facts.currencies} order={3} tilt="-rotate-2" />
          </dl>

          <h3 className="toon-title mb-3 mt-8 text-[19px]">World records 🌟</h3>
          <div className="grid grid-cols-2 gap-3">
            <Record tone="sky" emoji="🏆" title="Largest" country={facts.largest} detail={formatArea(facts.largest.area!)} onSelect={onSelect} />
            <Record tone="emerald" emoji="🐜" title="Smallest" country={facts.smallest} detail={formatArea(facts.smallest.area!)} onSelect={onSelect} />
            {/* Population can be missing when its source (World Bank) is down. */}
            {facts.populous[0] && (
              <Record
                tone="violet"
                emoji="👥"
                title="Most people"
                country={facts.populous[0]}
                detail={formatPopulation(facts.populous[0].population!)}
                onSelect={onSelect}
              />
            )}
            <Record
              tone="orange"
              emoji="🤝"
              title="Most neighbours"
              country={facts.mostNeighbours}
              detail={`${facts.mostNeighbours.borders.length} borders`}
              onSelect={onSelect}
            />
          </div>

          {facts.populous.length > 0 && <h3 className="toon-title mb-3 mt-8 text-[19px]">Most populous 🏙️</h3>}
          {facts.populous.length > 0 && (
            <ol className="toon overflow-hidden rounded-3xl bg-white p-1.5">
              {facts.populous.map((c, i) => (
                <li key={c.cca3}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.cca3)}
                    className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors hover:bg-sun/40"
                  >
                    <span className="tabular grid size-7 place-items-center rounded-full border-2 border-ink bg-sun font-display text-[13px] font-semibold text-ink">
                      {i + 1}
                    </span>
                    <Flag country={c} className="h-[18px] w-[27px] rounded-[5px] border-2 border-ink" />
                    <span className="flex-1 truncate text-[15px] font-bold text-ink">{c.name}</span>
                    <span className="tabular text-[12.5px] font-extrabold text-slate-500">{formatPopulation(c.population!)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <div className="mt-7 space-y-3">
          <Skeleton className="h-24 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
      )}

      <div className="toon mt-8 rounded-3xl bg-white p-4 text-[13px] font-semibold text-slate-600">
        <div className="toon-title mb-2 text-[16px]">Shortcuts ⌨️</div>
        <ul className="space-y-2">
          {[
            ['/', 'Search countries'],
            ['G', 'Switch globe and map'],
            ['N', 'Live day & night'],
            ['Q', 'Flag quiz'],
            ['Esc', 'Close the profile'],
          ].map(([key, label]) => (
            <li key={key} className="flex items-center justify-between">
              <span>{label}</span>
              <Kbd>{key}</Kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-lg border-2 border-ink bg-white px-2 py-0.5 font-sans text-[11px] font-black text-ink shadow-[0_2px_0_0_var(--color-ink)]">
      {children}
    </kbd>
  );
}

function Stat({
  tone,
  emoji,
  label,
  value,
  order,
  tilt,
}: {
  tone: Tone;
  emoji: string;
  label: string;
  value: number;
  order: number;
  tilt: string;
}) {
  return (
    <div className="animate-pop" style={{ animationDelay: `${160 + order * 80}ms` }}>
      <div className={clsx('toon rounded-3xl px-4 py-3 transition-transform duration-300 hover:rotate-0 hover:scale-105', tilt, TONES[tone].soft)}>
        <dt className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wide text-ink">
          <span aria-hidden className="text-[17px]">
            {emoji}
          </span>
          {label}
        </dt>
        <dd className="tabular toon-title mt-1 text-[30px] leading-none">{formatInteger(value)}</dd>
      </div>
    </div>
  );
}

function Record({
  tone,
  emoji,
  title,
  country,
  detail,
  onSelect,
}: {
  tone: Tone;
  emoji: string;
  title: string;
  country: Country;
  detail: string;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(country.cca3)}
      className="toon toon-press min-w-0 rounded-3xl bg-white p-3 text-left"
    >
      <span className={clsx('inline-flex items-center gap-1 rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-black text-ink', TONES[tone].chip)}>
        <span aria-hidden>{emoji}</span>
        {title}
      </span>
      <span className="mt-2.5 flex items-center gap-2">
        <Flag country={country} className="h-[18px] w-[27px] shrink-0 rounded-[5px] border-2 border-ink" />
        <span className="truncate font-display text-[16px] font-semibold text-ink">{country.name}</span>
      </span>
      <span className="tabular mt-0.5 block truncate text-[12.5px] font-bold text-slate-500">{detail}</span>
    </button>
  );
}

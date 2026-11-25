import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import clsx from 'clsx';
import { Check, ChevronRight, Coins, Dices, Flag as FlagIcon, Flame, Languages, Map as MapIcon, Plane, TreePalm, type LucideIcon } from 'lucide-react';
import type { Country } from '../../types';
import { isSovereign, type CountryIndex } from '../../hooks/queries';
import { discovered, MILESTONES, subscribeDiscoveries } from '../../lib/discoveries';
import { formatArea, formatInteger, formatPopulation } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import { gameOn, MAX_GUESSES, mysteryDay, mysteryRecord, mysteryStatus, streakOn, subscribeMystery } from '../../lib/mystery';
import { sounds } from '../../lib/sounds';
import { Mascot } from '../game/Mascot';
import { InstallButton } from '../layout/Install';
import { Flag } from '../ui/Flag';
import { Skeleton } from '../ui/primitives';

/** Shown in the right card on desktop before any country is selected. Every figure is computed from the data. */
export function WelcomePanel({
  index,
  onSelect,
  onSurprise,
  onPlay,
  onFly,
  onMystery,
  onTour,
}: {
  index: CountryIndex | undefined;
  onSelect: (id: string) => void;
  onSurprise: () => void;
  /** Opens the flag quiz. */
  onPlay: () => void;
  /** Opens the flight planner. */
  onFly: () => void;
  /** Opens the day's Mystery Country. */
  onMystery: () => void;
  /** Opens Globy's choice of continents to tour. */
  onTour: () => void;
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
    <div className="h-full overflow-y-auto px-5 pb-8 pt-7">
      <p className="animate-rise text-[13px] font-semibold uppercase tracking-[0.06em] text-secondary">Welcome, explorer</p>
      <h2 className="ios-title mt-1 animate-rise text-[34px] leading-[1.06]">Where to next?</h2>
      <p className="mt-2.5 animate-rise text-[15px] leading-relaxed text-secondary [animation-delay:60ms]">
        Spin the globe, tap any country or search for one. Every country has a full profile packed with facts.
      </p>

      <div className="mt-5 flex animate-rise flex-wrap items-center gap-2.5 [animation-delay:120ms]">
        <button
          type="button"
          onClick={onSurprise}
          disabled={!facts}
          className="ios-press inline-flex items-center gap-2 rounded-full bg-tint px-5 py-2.5 text-[16px] font-semibold text-white shadow-[0_4px_14px_rgb(0_122_255/0.3)] disabled:opacity-50"
        >
          <Dices aria-hidden className="size-[19px]" strokeWidth={2.2} />
          Surprise Me
        </button>
        <InstallButton />
      </div>

      <MysteryCard disabled={!facts} onOpen={onMystery} />

      {/* The other things to do, side by side */}
      <div className="mt-3 grid animate-rise grid-cols-3 gap-2.5 [animation-delay:190ms]">
        <Tile
          art={<Mascot mood="happy" className="w-11" />}
          title="Flag Quiz"
          text="10 flags, easy to impossible"
          disabled={!facts}
          onClick={() => {
            sounds.tap();
            haptics.tap();
            onPlay();
          }}
        />
        <Tile
          art={<Mascot mood="idle" className="w-11" />}
          title="Globy's Tour"
          text="A trip round a continent"
          disabled={!facts}
          // The menu and the planner make their own sounds as they open.
          onClick={() => {
            haptics.tap();
            onTour();
          }}
        />
        <Tile
          art={
            <span className="grid size-11 place-items-center rounded-[13px] bg-[linear-gradient(160deg,#64d2ff,#007aff)] text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.5)]">
              <Plane className="size-[22px]" strokeWidth={1.9} />
            </span>
          }
          title="Flight Path"
          text="Fly between two countries"
          disabled={!facts}
          onClick={() => {
            haptics.tap();
            onFly();
          }}
        />
      </div>

      {index && <ExploredCard total={index.sorted.length} />}

      {facts ? (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-3">
            <Stat icon={FlagIcon} color="#007aff" label="Countries" value={index!.sovereignCount} order={0} />
            <Stat icon={TreePalm} color="#ff9500" label="Territories" value={index!.sorted.length - index!.sovereignCount} order={1} />
            <Stat icon={Languages} color="#af52de" label="Languages" value={facts.languages} order={2} />
            <Stat icon={Coins} color="#34c759" label="Currencies" value={facts.currencies} order={3} />
          </dl>

          <GroupTitle>World records</GroupTitle>
          <div className="grid grid-cols-2 gap-3">
            <Record color="#007aff" title="Largest" country={facts.largest} detail={formatArea(facts.largest.area!)} onSelect={onSelect} />
            <Record color="#34c759" title="Smallest" country={facts.smallest} detail={formatArea(facts.smallest.area!)} onSelect={onSelect} />
            {/* Population can be missing when its source (World Bank) is down. */}
            {facts.populous[0] && (
              <Record
                color="#af52de"
                title="Most people"
                country={facts.populous[0]}
                detail={formatPopulation(facts.populous[0].population!)}
                onSelect={onSelect}
              />
            )}
            <Record
              color="#ff9500"
              title="Most neighbours"
              country={facts.mostNeighbours}
              detail={`${facts.mostNeighbours.borders.length} borders`}
              onSelect={onSelect}
            />
          </div>

          {facts.populous.length > 0 && (
            <>
              <GroupTitle>Most populous</GroupTitle>
              {/* An iOS inset grouped list */}
              <ol className="glass-soft overflow-hidden rounded-[22px]">
                {facts.populous.map((c, i) => (
                  <li key={c.cca3}>
                    <button
                      type="button"
                      onClick={() => onSelect(c.cca3)}
                      className="flex w-full items-center gap-3 pl-4 text-left transition-colors hover:bg-control active:bg-control-strong"
                    >
                      <span className="tabular w-4 text-[15px] font-semibold text-secondary">{i + 1}</span>
                      <Flag country={c} className="h-[18px] w-[27px] rounded-[4px] shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)]" />
                      {/* The separator starts after the flag, as iOS insets it. */}
                      <span className={clsx('flex min-w-0 flex-1 items-center gap-2 py-3 pr-3', i > 0 && 'border-t border-hairline')}>
                        <span className="flex-1 truncate text-[15px] font-medium text-label">{c.name}</span>
                        <span className="tabular text-[14px] text-secondary">{formatPopulation(c.population!)}</span>
                        <ChevronRight aria-hidden className="size-4 text-tertiary" strokeWidth={2.4} />
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      ) : (
        <div className="mt-7 space-y-3">
          <Skeleton className="h-24 w-full rounded-[22px]" />
          <Skeleton className="h-40 w-full rounded-[22px]" />
        </div>
      )}

      <GroupTitle>Keyboard shortcuts</GroupTitle>
      <ul className="glass-soft overflow-hidden rounded-[22px] text-[15px] text-label">
        {[
          ['/', 'Search countries'],
          ['G', 'Switch globe and map'],
          ['N', 'Live day & night'],
          ['M', "Today's mystery country"],
          ['Q', 'Flag quiz'],
          ['T', "Globy's tour"],
          ['F', 'Flight path'],
          ['Esc', 'Close the profile'],
        ].map(([key, label], i) => (
          <li key={key} className="pl-4">
            <span className={clsx('flex items-center justify-between py-2.5 pr-4', i > 0 && 'border-t border-hairline')}>
              <span>{label}</span>
              <Kbd>{key}</Kbd>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Today's Mystery Country: whether it is still to play, under way or done, and the streak it is keeping up. */
function MysteryCard({ disabled, onOpen }: { disabled: boolean; onOpen: () => void }) {
  const record = useSyncExternalStore(subscribeMystery, mysteryRecord);
  const day = mysteryDay();
  const status = mysteryStatus(day, record);
  const streak = streakOn(day, record);
  const used = gameOn(day, record).guesses.length;
  return (
    <button
      type="button"
      onClick={() => {
        // The game makes its own sound as it slides open.
        haptics.tap();
        onOpen();
      }}
      disabled={disabled}
      className="glass-soft ios-press mt-6 flex w-full animate-rise items-center gap-3 rounded-[24px] p-3 pr-4 text-left disabled:opacity-50 [animation-delay:160ms]"
    >
      <Mascot mood={status === 'won' ? 'party' : status === 'lost' ? 'sad' : 'think'} className="w-14 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[17px] font-semibold tracking-[-0.01em] text-label">Mystery Country</span>
          {streak > 0 && (
            <span className="tabular flex shrink-0 items-center gap-0.5 rounded-full bg-ios-orange/15 px-2 py-0.5 text-[12px] font-bold text-[#b25f00]" title="Days solved in a row">
              <Flame aria-hidden className="size-3.5 fill-ios-orange text-ios-orange" strokeWidth={2} />
              {streak}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-secondary">
          {status === 'new'
            ? 'Globy is hiding in a country today. Can you find it in 6 guesses?'
            : status === 'playing'
              ? `${used} of ${MAX_GUESSES} guesses used. Globy is still hiding!`
              : status === 'won'
                ? 'Found it! Globy hides somewhere new tomorrow.'
                : 'It got away today. A new mystery comes tomorrow.'}
        </span>
      </span>
      {status === 'won' ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-ios-green/15 px-3 py-1.5 text-[14px] font-semibold text-[#248a3d]">
          <Check aria-hidden className="size-4" strokeWidth={3} />
          Solved
        </span>
      ) : (
        <span className="relative shrink-0 rounded-full bg-tint px-4 py-1.5 text-[14px] font-semibold text-white">
          {status === 'new' ? 'Play' : status === 'playing' ? 'Go on' : 'See'}
          {status === 'new' && <span aria-hidden className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-ios-red ring-2 ring-white" />}
        </span>
      )}
    </button>
  );
}

/** Something else to do, as a small tile: a picture, its name and a few words. */
function Tile({ art, title, text, disabled, onClick }: { art: ReactNode; title: string; text: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="glass-soft ios-press flex min-w-0 flex-col items-start rounded-[20px] p-2.5 text-left disabled:opacity-50">
      <span aria-hidden className="grid h-12 place-items-end">
        {art}
      </span>
      <span className="mt-1.5 block max-w-full truncate text-[14px] font-semibold tracking-[-0.01em] text-label">{title}</span>
      <span className="mt-0.5 block text-[12px] leading-tight text-secondary">{text}</span>
    </button>
  );
}

/** How much of the world has been explored, and how far it is to the next milestone. */
function ExploredCard({ total }: { total: number }) {
  const explored = useSyncExternalStore(subscribeDiscoveries, discovered).size;
  const next = MILESTONES.find((m) => m > explored && m < total) ?? total;
  return (
    <div className="glass-soft mt-3 animate-rise rounded-[24px] p-4 [animation-delay:200ms]">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="grid size-[30px] shrink-0 place-items-center rounded-[8px] bg-tint text-white">
          <MapIcon className="size-[18px]" strokeWidth={2.2} />
        </span>
        <span className="flex-1 text-[17px] font-semibold tracking-[-0.01em] text-label">Your world map</span>
        <span className="tabular text-[15px] font-semibold text-tint">
          {explored} / {total}
        </span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-control"
        role="progressbar"
        aria-label="Countries explored"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={explored}
      >
        <div className="h-full rounded-full bg-tint transition-[width] duration-700 ease-out" style={{ width: `${(explored / total) * 100}%` }} />
      </div>
      <p className="mt-2 text-[13px] text-secondary">
        {explored === 0
          ? 'Open any country to start filling in your map.'
          : explored >= total
            ? 'You have explored every country. Amazing!'
            : `${next - explored} more to reach ${next === total ? 'the whole world' : next}.`}
      </p>
    </div>
  );
}

/** The small caption above a group, as in iOS Settings. */
function GroupTitle({ children }: { children: ReactNode }) {
  return <h3 className="ios-title mb-2.5 mt-8 text-[20px]">{children}</h3>;
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="min-w-7 rounded-[7px] bg-white/90 px-2 py-0.5 text-center font-sans text-[12px] font-semibold text-label shadow-[0_0_0_0.5px_rgb(0_0_0/0.1),0_1px_1px_rgb(0_0_0/0.08)]">
      {children}
    </kbd>
  );
}

/** A widget-like tile: a tinted glyph, a caption and a big figure. */
function Stat({ icon: Icon, color, label, value, order }: { icon: LucideIcon; color: string; label: string; value: number; order: number }) {
  return (
    <div className="animate-pop" style={{ animationDelay: `${160 + order * 80}ms` }}>
      <div className="glass-soft rounded-[22px] px-4 py-3.5">
        <dt className="flex items-center gap-1.5 text-[13px] font-semibold text-secondary">
          <Icon aria-hidden className="size-[17px]" style={{ color }} strokeWidth={2.3} />
          {label}
        </dt>
        <dd className="tabular mt-1 text-[30px] font-bold leading-none tracking-[-0.03em] text-label">{formatInteger(value)}</dd>
      </div>
    </div>
  );
}

function Record({
  color,
  title,
  country,
  detail,
  onSelect,
}: {
  color: string;
  title: string;
  country: Country;
  detail: string;
  onSelect: (id: string) => void;
}) {
  return (
    <button type="button" onClick={() => onSelect(country.cca3)} className="glass-soft ios-press min-w-0 rounded-[22px] p-3.5 text-left">
      <span className="text-[12px] font-semibold uppercase tracking-[0.04em]" style={{ color }}>
        {title}
      </span>
      <span className="mt-2 flex items-center gap-2">
        <Flag country={country} className="h-[18px] w-[27px] shrink-0 rounded-[4px] shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)]" />
        <span className="truncate text-[16px] font-semibold tracking-[-0.01em] text-label">{country.name}</span>
      </span>
      <span className="tabular mt-0.5 block truncate text-[13px] text-secondary">{detail}</span>
    </button>
  );
}

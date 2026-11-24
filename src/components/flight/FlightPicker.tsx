import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { Dices, Plane, X } from 'lucide-react';
import type { Country } from '../../types';
import { isSovereign, type CountryIndex } from '../../hooks/queries';
import { useChangeSound } from '../../hooks/useChangeSound';
import { discovered, subscribeDiscoveries } from '../../lib/discoveries';
import type { FlightPlan } from '../../lib/flight';
import { planFlight } from '../../lib/flightPlan';
import type { World } from '../../lib/geo';
import { haptics } from '../../lib/haptics';
import { sounds } from '../../lib/sounds';
import { CountryPicker, withFamous } from '../ui/CountryPicker';
import { Flag } from '../ui/Flag';

/**
 * Choosing the two ends of a flight. Opened from a country's profile it already knows where the
 * flight leaves from, and asks only where to; opened from the map it asks for both. Choosing the
 * destination is the take-off: the dialog closes and the plane flies on the globe.
 */
export default function FlightPicker({
  open,
  from,
  index,
  world,
  onClose,
  onFly,
}: {
  open: boolean;
  /** The country it was opened from, which the flight leaves; null to choose both ends here. */
  from: string | null;
  index: CountryIndex;
  world: World | undefined;
  onClose: () => void;
  onFly: (plan: FlightPlan) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  useChangeSound(open, sounds.open, sounds.close);
  const [origin, setOrigin] = useState<string | null>(from);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setOrigin(from);
      dialog.showModal();
    } else if (!open && dialog.open) dialog.close();
  }, [open, from]);

  const a = origin ? index.byId.get(origin) : undefined;
  // The places they have already been to come first (the latest first), then well-known countries.
  const explored = useSyncExternalStore(subscribeDiscoveries, discovered);
  const visited = useMemo(() => [...explored].reverse().filter((id) => id !== a?.cca3 && index.byId.has(id)).slice(0, 6), [explored, a, index]);
  const suggestions = useMemo(() => withFamous(index, visited, a?.cca3), [index, visited, a]);

  const pick = (id: string) => {
    if (!a) {
      haptics.select();
      sounds.select();
      setOrigin(id);
      scrollRef.current?.scrollTo({ top: 0 });
      return;
    }
    const b = index.byId.get(id);
    const plan = b ? planFlight(a, b, world) : null;
    if (plan) onFly(plan);
  };

  const surprise = () => {
    const pool = index.sorted.filter((c) => isSovereign(c) && c.cca3 !== a?.cca3);
    if (pool.length) pick(pool[Math.floor(Math.random() * pool.length)].cca3);
  };

  return (
    <dialog ref={ref} aria-label="Plan a flight" className="quiz-dialog" onClose={() => open && onClose()}>
      {/* A full-height iOS sheet on the grouped background */}
      <div className="flex h-full animate-sheet-up flex-col bg-[#f2f2f7] text-label">
        <header className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 pb-2 pt-[max(14px,env(safe-area-inset-top))]">
          <h2 className="ios-title flex-1 text-[34px]">Flight Path</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ios-press grid size-9 place-items-center rounded-full bg-control text-label hover:bg-control-strong"
          >
            <X className="size-[18px]" strokeWidth={2.6} />
          </button>
        </header>
        <main ref={scrollRef} className="mx-auto w-full max-w-2xl min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
          <p className="text-[15px] leading-snug text-secondary">Pick two countries and watch a plane fly between them on the globe.</p>

          {/* The two ends of the flight, filling in as they are chosen */}
          <div className="mt-3 flex items-stretch gap-2 rounded-[22px] bg-white p-2.5">
            <End
              label="From"
              country={a}
              waiting={!a}
              onChange={
                a
                  ? () => {
                      sounds.tap();
                      haptics.tap();
                      setOrigin(null);
                    }
                  : undefined
              }
            />
            <span aria-hidden className="grid size-9 shrink-0 place-items-center self-center rounded-full bg-tint/12 text-tint">
              <Plane className="size-[18px] rotate-45" strokeWidth={2.3} />
            </span>
            <End label="To" waiting={!!a} />
          </div>

          <CountryPicker
            // A fresh search for each end of the flight.
            key={a ? 'to' : 'from'}
            index={index}
            exclude={a?.cca3}
            suggestions={suggestions}
            caption={visited.length ? 'Places you explored, then well-known ones' : 'Well-known countries'}
            title={a ? `Fly from ${a.name} to…` : 'Where does the flight start?'}
            inputId="flight-search"
            action={
              <button
                type="button"
                onClick={surprise}
                className="ios-press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-tint/12 px-3 py-1 text-[13px] font-semibold text-tint"
              >
                <Dices aria-hidden className="size-4" strokeWidth={2.3} />
                Surprise Me
              </button>
            }
            onPick={pick}
          />
        </main>
      </div>
    </dialog>
  );
}

/** One end of the flight in the strip at the top: the country chosen, or the gap waiting for one. */
function End({ label, country, waiting, onChange }: { label: string; country?: Country; waiting: boolean; onChange?: () => void }) {
  const caption = <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-secondary">{label}</span>;
  if (country) {
    return (
      <button
        type="button"
        onClick={onChange}
        title={`Change where the flight starts (${country.name})`}
        className="ios-press flex min-w-0 flex-1 items-center gap-2.5 rounded-[14px] bg-[#f2f2f7] px-2.5 py-2 text-left sm:px-3"
      >
        <Flag country={country} className="h-6 w-9 shrink-0 rounded-[5px] shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)]" />
        <span className="min-w-0 flex-1">
          {caption}
          <span className="block truncate text-[16px] font-semibold tracking-[-0.01em]">{country.name}</span>
        </span>
        {/* Phones have no room for the word; the whole thing is the button. */}
        <span className="shrink-0 text-[13px] font-semibold text-tint max-sm:hidden">Change</span>
      </button>
    );
  }
  return (
    <div
      className={clsx(
        'flex min-w-0 flex-1 items-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed px-2.5 py-2 transition-colors duration-300 sm:px-3',
        waiting ? 'border-tint/60 bg-tint/[0.06]' : 'border-tertiary',
      )}
    >
      <span
        aria-hidden
        className={clsx(
          'grid h-6 w-9 shrink-0 place-items-center rounded-[5px] text-[14px] font-bold max-[379px]:hidden',
          waiting ? 'bg-tint/15 text-tint' : 'bg-control text-secondary',
        )}
      >
        ?
      </span>
      <span className="min-w-0 flex-1">
        {caption}
        <span className={clsx('block truncate text-[16px] font-semibold tracking-[-0.01em]', waiting ? 'text-tint' : 'text-tertiary')}>
          {waiting ? 'Pick one' : 'Then here'}
        </span>
      </span>
    </div>
  );
}

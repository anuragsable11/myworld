import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowRight, ArrowUp, Check, ChevronLeft, Earth, Flag as FlagIcon, Flame, Landmark, Lock, MapPinned, Ruler, Users, X, type LucideIcon } from 'lucide-react';
import type { Country } from '../../types';
import type { CountryIndex } from '../../hooks/queries';
import { useChangeSound } from '../../hooks/useChangeSound';
import { formatDuration } from '../../lib/flight';
import { formatInteger } from '../../lib/format';
import type { World } from '../../lib/geo';
import { haptics } from '../../lib/haptics';
import {
  cluesFor,
  gameOn,
  guess,
  HEAT,
  hintFor,
  MAX_GUESSES,
  mysteryDay,
  mysteryFor,
  mysteryPool,
  mysteryRecord,
  streakOn,
  subscribeMystery,
  untilNextMystery,
  type Clue,
  type Hint,
} from '../../lib/mystery';
import { sounds } from '../../lib/sounds';
import { CountryPicker } from '../ui/CountryPicker';
import { Flag } from '../ui/Flag';
import { Mascot, type Mood } from './Mascot';
import { Bubble, Confetti } from './shared';

const CLUE_ICONS: Record<Clue['id'], [LucideIcon, string]> = {
  where: [Earth, '#007aff'],
  continent: [MapPinned, '#34c759'],
  size: [Ruler, '#ff9500'],
  neighbours: [Users, '#af52de'],
  flag: [FlagIcon, '#ff2d55'],
  capital: [Landmark, '#5856d6'],
};

/** What Globy says about how the hunt is going, and the face it makes. */
function globySays(answer: Country, guesses: Country[], hints: Hint[], result: 'won' | 'lost' | null): { text: string; mood: Mood } {
  const n = guesses.length;
  if (result === 'won') {
    return { mood: 'party', text: n === 1 ? `Wow, first try! I was hiding in ${answer.name}.` : `You found me in ${n} guesses! I was hiding in ${answer.name}.` };
  }
  if (result === 'lost') return { mood: 'sad', text: `I was hiding in ${answer.name}! Come back tomorrow: I'll hide somewhere new.` };
  if (!n) return { mood: 'think', text: `I'm hiding in a country today. Guess where, and I'll tell you if you're hot or cold. You get ${MAX_GUESSES} tries!` };

  const hint = hints[n - 1];
  const before = hints[n - 2] as Hint | undefined;
  const warmer = !!before && hint.km < before.km;
  const colder = !!before && hint.km > before.km;
  const where = `${formatInteger(hint.km)} km to the ${hint.direction} of ${guesses[n - 1].name}`;
  if (hint.neighbour) return { mood: 'shock', text: `So close! I'm right next door to ${guesses[n - 1].name}. Look ${hint.direction}!` };
  switch (hint.heat.id) {
    case 'boiling':
      return { mood: 'shock', text: `Boiling hot! I'm only ${where}.` };
    case 'hot':
      return { mood: 'happy', text: `${warmer ? 'Warmer! ' : ''}You're hot! I'm ${where}.` };
    case 'warm':
      return { mood: 'happy', text: `${warmer ? 'Warmer! ' : colder ? 'A bit colder. ' : ''}Getting warm: I'm ${where}.` };
    case 'lukewarm':
      return { mood: 'idle', text: `${warmer ? 'Warmer! ' : colder ? 'Colder. ' : ''}Lukewarm: I'm ${where}.` };
    case 'cold':
      return { mood: 'think', text: `${warmer ? 'A little warmer, but still cold' : colder ? 'Colder' : 'Cold'}! I'm ${where}.` };
    default:
      return { mood: 'sad', text: `${warmer ? 'Warmer, but still freezing' : 'Brr, freezing'}! I'm ${where}. That's far!` };
  }
}

/**
 * Mystery Country, the daily game: Globy hides in one country, and each guess is told how far off
 * it is and which way to look, while clues about the country open one by one. Six guesses; solving
 * it day after day builds a streak. It fills the screen, like the flag quiz.
 */
export default function MysteryGame({
  open,
  index,
  world,
  onClose,
  onShowCountry,
}: {
  open: boolean;
  index: CountryIndex;
  world: World | undefined;
  onClose: () => void;
  /** Leave the game to see a country in the atlas. */
  onShowCountry: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  useChangeSound(open, sounds.open, sounds.close);
  const record = useSyncExternalStore(subscribeMystery, mysteryRecord);
  const [day, setDay] = useState(mysteryDay);
  /** Choosing a country to guess, rather than looking at the board. */
  const [picking, setPicking] = useState(false);
  /** Solved during this visit, so there is confetti. */
  const [celebrate, setCelebrate] = useState(false);
  const [untilNext, setUntilNext] = useState(untilNextMystery);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setDay(mysteryDay());
      setPicking(false);
      setCelebrate(false);
      dialog.showModal();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  // The countdown to the next mystery; and at midnight the next mystery itself.
  useEffect(() => {
    if (!open) return;
    const tick = () => {
      setUntilNext(untilNextMystery());
      setDay(mysteryDay());
    };
    tick();
    const timer = window.setInterval(tick, 20_000);
    return () => window.clearInterval(timer);
  }, [open]);

  const answer = useMemo(() => mysteryFor(day, index), [day, index]);
  const pool = useMemo(() => mysteryPool(index), [index]);
  const game = gameOn(day, record);
  const guesses = useMemo(() => game.guesses.map((id) => index.byId.get(id)).filter((c): c is Country => !!c), [game.guesses, index]);
  const hints = useMemo(() => (answer ? guesses.map((g) => hintFor(g, answer, world)) : []), [guesses, answer, world]);
  const clues = useMemo(() => (answer ? cluesFor(answer, index, world) : []), [answer, index, world]);
  const left = useMemo(() => pool.filter((c) => !game.guesses.includes(c.cca3)), [pool, game.guesses]);

  if (!answer) return <dialog ref={ref} aria-label="Mystery Country" className="quiz-dialog" onClose={() => open && onClose()} />;

  const wrong = guesses.length - (game.result === 'won' ? 1 : 0);
  const unlocked = game.result ? clues.length : Math.min(clues.length, 1 + wrong);
  const globy = globySays(answer, guesses, hints, game.result);
  const streak = streakOn(day, record);

  const submit = (id: string) => {
    const country = index.byId.get(id);
    if (!country || game.result || game.guesses.includes(id)) return;
    const before = hints[hints.length - 1] as Hint | undefined;
    const used = guesses.length + 1;
    guess(day, id, answer.cca3);
    setPicking(false);
    scrollRef.current?.scrollTo({ top: 0 });
    if (id === answer.cca3) {
      setCelebrate(true);
      // The fewer guesses it took, the bigger the fanfare.
      const score = used <= 2 ? 10 : used <= 4 ? 8 : 6;
      sounds.fanfare(score);
      haptics.win(score);
    } else if (used >= MAX_GUESSES) {
      sounds.wrong();
      haptics.wrong();
    } else {
      const hint = hintFor(country, answer, world);
      sounds.heat(1 - HEAT.indexOf(hint.heat) / (HEAT.length - 1), before ? Math.sign(before.km - hint.km) : 0);
      haptics.select();
    }
  };

  return (
    <dialog
      ref={ref}
      aria-label="Mystery Country"
      className="quiz-dialog"
      onCancel={(e) => {
        // Esc or back: from choosing a country, back to the board first.
        if (picking) {
          e.preventDefault();
          setPicking(false);
        }
      }}
      onClose={() => open && onClose()}
    >
      <div className="relative flex h-full animate-sheet-up flex-col bg-[#f2f2f7] text-label">
        {celebrate && <Confetti />}
        <header className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pb-1 pt-[max(14px,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => {
              if (picking) {
                sounds.tap();
                setPicking(false);
              } else onClose();
            }}
            aria-label={picking ? 'Back to the clues' : 'Close'}
            className="ios-press grid size-9 shrink-0 place-items-center rounded-full bg-control text-label hover:bg-control-strong"
          >
            {picking ? <ChevronLeft className="size-5" strokeWidth={2.6} /> : <X className="size-[18px]" strokeWidth={2.6} />}
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="ios-title truncate text-[22px] leading-tight">Mystery Country</h2>
            <p className="truncate text-[13px] text-secondary">
              No. {day + 1} · {new Date().toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <span
            className={clsx(
              'flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[15px] font-semibold tabular-nums shadow-[0_0_0_0.5px_rgb(0_0_0/0.06)]',
              streak ? 'bg-white text-label' : 'bg-white/60 text-secondary',
            )}
            aria-label={`${streak} ${streak === 1 ? 'day' : 'days'} solved in a row`}
            title="Days solved in a row"
          >
            <Flame aria-hidden className={clsx('size-4', streak ? 'fill-ios-orange text-ios-orange' : 'text-tertiary')} strokeWidth={2} />
            {streak}
          </span>
        </header>

        <main ref={scrollRef} className="mx-auto min-h-0 w-full max-w-xl flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-5">
          {picking ? (
            <CountryPicker
              index={index}
              pool={left}
              suggestions={left}
              caption="Every country, A to Z"
              title="Where is Globy hiding?"
              inputId="mystery-search"
              onPick={submit}
            />
          ) : (
            <>
              <div className="mt-3 flex items-end gap-2">
                <Mascot key={globy.mood} mood={globy.mood} talking className="w-24 shrink-0" />
                <Bubble key={`${day}-${guesses.length}-${game.result}`} text={globy.text} />
              </div>

              {game.result && (
                <div className="animate-pop rounded-[24px] bg-white p-4 text-center">
                  <Flag
                    country={answer}
                    variant="full"
                    eager
                    className="mx-auto h-20 w-auto max-w-full rounded-[10px] object-contain shadow-[0_0_0_0.5px_rgb(0_0_0/0.12),0_6px_18px_rgb(0_0_0/0.14)]"
                  />
                  <p className="ios-title mt-3 text-[28px] leading-tight">{answer.name}</p>
                  <p className="mt-0.5 text-[15px] text-secondary">
                    {game.result === 'won'
                      ? `Found in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}`
                      : 'Out of guesses this time'}
                    {answer.capitals[0] ? ` · capital ${answer.capitals[0].name}` : ''}
                  </p>
                  <dl className="mt-4 grid grid-cols-3 gap-2">
                    <Tally label="Streak" value={streak} icon={<Flame aria-hidden className="size-[18px] fill-ios-orange text-ios-orange" strokeWidth={2} />} />
                    <Tally label="Best" value={record.best} />
                    <Tally label="Solved" value={`${record.won}/${record.played}`} />
                  </dl>
                  <button
                    type="button"
                    onClick={() => onShowCountry(answer.cca3)}
                    className="ios-press mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-tint px-5 py-3 text-[17px] font-semibold text-white shadow-[0_4px_14px_rgb(0_122_255/0.3)]"
                  >
                    <span className="truncate">Explore {answer.name}</span>
                    <ArrowRight aria-hidden className="size-[18px] shrink-0" strokeWidth={2.5} />
                  </button>
                  <p className="mt-3 text-[14px] text-secondary">
                    A new mystery in <b className="font-semibold tabular-nums text-label">{formatDuration(Math.max(1, Math.round(untilNext / 60_000)))}</b>
                  </p>
                </div>
              )}

              {/* The six guesses: each one used shows how warm it was */}
              <div className="mt-4 flex items-center gap-2" role="img" aria-label={`${guesses.length} of ${MAX_GUESSES} guesses used`}>
                {Array.from({ length: MAX_GUESSES }, (_, i) => {
                  const hint = hints[i] as Hint | undefined;
                  const found = game.result === 'won' && i === guesses.length - 1;
                  return (
                    <span
                      key={i}
                      className={clsx(
                        'grid size-7 place-items-center rounded-full text-white transition-colors duration-300',
                        !hint && (i === guesses.length && !game.result ? 'bg-white shadow-[0_0_0_2px_#007aff]' : 'bg-white/70 shadow-[0_0_0_1px_rgb(60_60_67/0.16)]'),
                      )}
                      style={hint ? { backgroundColor: found ? '#34c759' : hint.heat.color } : undefined}
                    >
                      {found && <Check className="size-4" strokeWidth={3.2} />}
                    </span>
                  );
                })}
                <span className="ml-auto text-[14px] font-medium text-secondary">
                  {game.result ? 'Game over' : `${MAX_GUESSES - guesses.length} ${MAX_GUESSES - guesses.length === 1 ? 'guess' : 'guesses'} left`}
                </span>
              </div>

              {guesses.length > 0 && (
                <ol className="mt-3 space-y-2" aria-label="Your guesses, the latest first">
                  {[...guesses].reverse().map((country, shown) => {
                    const i = guesses.length - 1 - shown;
                    const hint = hints[i];
                    const found = country.cca3 === answer.cca3;
                    return (
                      <li key={country.cca3} className={clsx('flex items-center gap-3 rounded-[16px] bg-white px-3 py-2.5', shown === 0 && 'animate-pop')}>
                        <Flag country={country} className="h-6 w-9 shrink-0 rounded-[5px] shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-semibold tracking-[-0.01em]">{country.name}</span>
                          {found ? (
                            <span className="block text-[13px] text-secondary">That's where Globy was!</span>
                          ) : (
                            <span className="flex items-center gap-1 text-[13px] text-secondary">
                              <span className="tabular-nums">{formatInteger(hint.km)} km</span>
                              <span aria-hidden>·</span>
                              <ArrowUp aria-hidden className="size-3.5 shrink-0 text-label" strokeWidth={2.8} style={{ transform: `rotate(${hint.bearing}deg)` }} />
                              <span className="truncate">{hint.neighbour ? `next door, ${hint.direction}` : hint.direction}</span>
                            </span>
                          )}
                        </span>
                        <span
                          className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold text-white"
                          style={{ backgroundColor: found ? '#34c759' : hint.heat.color }}
                        >
                          {found ? 'Found' : hint.heat.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}

              <h3 className="ml-1 mt-6 text-[13px] font-semibold uppercase tracking-[0.04em] text-secondary">
                Clues{game.result ? '' : ' · a new one after every guess'}
              </h3>
              <ul className="mt-2 space-y-2">
                {clues.map((clue, i) => {
                  const [Icon, color] = CLUE_ICONS[clue.id];
                  const shown = i < unlocked;
                  // The clue the last guess opened arrives with a pop.
                  const fresh = shown && !game.result && i === unlocked - 1 && i > 0;
                  return (
                    <li key={clue.id} className={clsx('flex items-start gap-3 rounded-[16px] px-3 py-2.5', shown ? 'bg-white' : 'bg-white/45', fresh && 'animate-pop')}>
                      <span
                        aria-hidden
                        className="mt-0.5 grid size-[30px] shrink-0 place-items-center rounded-[8px] text-white"
                        style={{ backgroundColor: shown ? color : 'rgb(60 60 67 / 0.22)' }}
                      >
                        {shown ? <Icon className="size-[18px]" strokeWidth={2.2} /> : <Lock className="size-4" strokeWidth={2.4} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-secondary">
                          {clue.title}
                          {fresh && <span className="rounded-full bg-tint px-1.5 py-px text-[10px] tracking-normal text-white">New</span>}
                        </span>
                        {shown ? (
                          <>
                            <span className="mt-0.5 block text-[15px] leading-snug text-label">{clue.text}</span>
                            {clue.id === 'flag' && <BlurredFlag country={answer} sharp={!!game.result} />}
                          </>
                        ) : (
                          <span className="mt-0.5 block text-[15px] text-tertiary">Opens after guess {i}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </main>

        {!picking && !game.result && (
          <footer className="mx-auto w-full max-w-xl px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2">
            <button
              type="button"
              onClick={() => {
                sounds.tap();
                haptics.tap();
                setPicking(true);
                scrollRef.current?.scrollTo({ top: 0 });
              }}
              className="ios-press w-full rounded-full bg-tint px-5 py-3.5 text-[17px] font-semibold text-white shadow-[0_4px_14px_rgb(0_122_255/0.3)]"
            >
              Guess a Country
              <span className="ml-2 font-medium text-white/75">
                {guesses.length + 1} of {MAX_GUESSES}
              </span>
            </button>
          </footer>
        )}
      </div>
    </dialog>
  );
}

/** The flag clue: the mystery country's flag, too blurred to read but not to guess from (and sharp once the game is over). */
function BlurredFlag({ country, sharp }: { country: Country; sharp: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="mt-1 block text-[13px] text-secondary">The flag couldn't be loaded.</span>;
  return (
    <span className="mt-2 block h-16 w-24 overflow-hidden rounded-[8px] bg-control shadow-[0_0_0_0.5px_rgb(0_0_0/0.12)]">
      <img
        src={country.flag.svg}
        alt=""
        draggable={false}
        onError={() => setFailed(true)}
        className={clsx('h-full w-full object-cover transition-[filter,transform] duration-700', !sharp && 'scale-125 blur-[9px]')}
      />
    </span>
  );
}

function Tally({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-[16px] bg-[#f2f2f7] px-1 py-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-secondary">{label}</dt>
      <dd className="mt-0.5 flex items-center justify-center gap-1 text-[20px] font-bold tabular-nums tracking-[-0.02em] text-label">
        {icon}
        {value}
      </dd>
    </div>
  );
}

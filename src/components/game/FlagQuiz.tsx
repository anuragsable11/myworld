import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import clsx from 'clsx';
import { Check, Flame, Lightbulb, Share, Star, Target, Timer, Trophy, X, Zap } from 'lucide-react';
import type { Country } from '../../types';
import { costumeFor } from '../../data/costumes';
import { useChangeSound } from '../../hooks/useChangeSound';
import { formatShortCount } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import { sounds } from '../../lib/sounds';
import { Figure } from '../panel/dress/Figure';
import { Flag } from '../ui/Flag';
import { Mascot, type Look, type Mood } from './Mascot';
import { Bubble, Confetti, SPARK_COLOURS } from './shared';
import { buildQuiz, type Level, type Question } from './quiz';
import { rankOf, recordRound, type QuizStats } from './stats';

interface LevelStyle {
  n: number;
  label: string;
  emoji: string;
  /** Points for getting a question of this level right. */
  xp: number;
  tagline: string;
  /** Globy's face on the level's intro card. */
  mood: Mood;
  chip: string;
  bar: string;
  banner: string;
}

const LEVELS: Record<Level, LevelStyle> = {
  easy: { n: 1, label: 'Easy', emoji: '🌱', xp: 10, tagline: "Let's warm up with famous flags!", mood: 'happy', chip: 'bg-ios-green/15 text-[#248a3d]', bar: '#34c759', banner: 'bg-[linear-gradient(160deg,#34c759,#30b0c7)] text-white' },
  medium: { n: 2, label: 'Medium', emoji: '🔥', xp: 20, tagline: 'Neighbours join in now. Trickier!', mood: 'happy', chip: 'bg-[#ffcc00]/25 text-[#8a6100]', bar: '#ffcc00', banner: 'bg-[linear-gradient(160deg,#ffcc00,#ff9500)] text-white' },
  hard: { n: 3, label: 'Hard', emoji: '💪', xp: 30, tagline: 'These flags look a lot alike. Look closely!', mood: 'think', chip: 'bg-ios-orange/15 text-[#b25f00]', bar: '#ff9500', banner: 'bg-[linear-gradient(160deg,#ff9500,#ff3b30)] text-white' },
  impossible: { n: 4, label: 'Impossible', emoji: '💀', xp: 60, tagline: 'Almost nobody gets this one. Good luck!', mood: 'shock', chip: 'bg-ios-purple/30 text-[#e5c2ff]', bar: '#af52de', banner: 'bg-[linear-gradient(160deg,#1c1c1e,#3a1d5c)] text-white' },
};
const LEVEL_ORDER: Level[] = ['easy', 'medium', 'hard', 'impossible'];

const ASK: Record<Level, string> = {
  easy: 'Which country’s flag is this?',
  medium: 'Hmm… which one is it?',
  hard: 'Look closely. Which country?',
  impossible: 'Good luck… which flag is this?! 😰',
};
const PRAISE = ['Nailed it! 🎯', 'You’re a flag pro!', 'Yesss! 🙌', 'Brilliant!', 'Spot on! ⭐'];
const COMFORT = ['So close!', 'Tricky one!', 'Oops! 😅', 'The next one’s yours!'];
/** Streaks worth a cheer. */
const MILESTONES: Record<number, string> = { 3: '🔥 3 in a row! Combo +5', 5: '😎 5 in a row! Combo +10', 8: '🚀 8 in a row! Unstoppable!' };

/** Answer right within this long for a speed bonus. */
const SPEED_MS = 6000;
/** The question sliding away before the next one comes in. */
const LEAVE_MS = 220;
/** When the results' stars pop in. */
const STAR_DELAY = 900;
const STAR_GAP = 380;

interface Gain {
  total: number;
  base: number;
  combo: number;
  speed: number;
  hint: boolean;
}

type Phase = 'level' | 'ask' | 'checked' | 'done';
type OptionState = 'idle' | 'picked' | 'right' | 'wrong' | 'dim' | 'gone';
type Outcome = { before: QuizStats; after: QuizStats; newBest: boolean };

const pickOne = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/**
 * For a ref: focuses the element once it has been painted. (Focusing it straight away, as the
 * autofocus attribute does, makes the browser lay out the whole screen before the first frame.)
 */
const focusAfterPaint = (el: HTMLElement | null) => {
  if (el) requestAnimationFrame(() => el.focus({ preventScroll: true }));
};
const starsFor = (score: number) => (score >= 9 ? 3 : score >= 6 ? 2 : score >= 3 ? 1 : 0);

/**
 * The flag quiz: ten flags, from easy to impossible, hosted by Globy. A full-screen dialog, so the
 * back button and Esc work as everywhere else (after asking before a round in progress is lost).
 */
export default function FlagQuiz({
  open,
  countries,
  onClose,
  onShowCountry,
}: {
  open: boolean;
  countries: Country[];
  onClose: () => void;
  /** Leave the quiz to see a country in the atlas. */
  onShowCountry: (id: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  /** When the current question could first be answered (for the speed bonus). */
  const askedAt = useRef(0);
  const leaveTimer = useRef(0);
  const [run, setRun] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('level');
  const [picked, setPicked] = useState<string | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [gains, setGains] = useState<Gain[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [line, setLine] = useState('');
  const [confirmQuit, setConfirmQuit] = useState(false);
  // The quit sheet rising and falling, and the whole quiz sliding away (its opening has its own fanfare).
  useChangeSound(confirmQuit, sounds.open, sounds.close);
  useChangeSound(open, () => {}, sounds.close);
  /** Played again from the results, rather than just opened: no slide-up then. */
  const [replay, setReplay] = useState(false);
  /** The answered question is sliding away. */
  const [leaving, setLeaving] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  /** Wrong answers taken away by the 50/50 hint. */
  const [hidden, setHidden] = useState<string[]>([]);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [shareLabel, setShareLabel] = useState('Share my score');

  const start = useCallback(() => {
    window.clearTimeout(leaveTimer.current);
    setQuestions(buildQuiz(countries));
    setRun((n) => n + 1);
    setStep(0);
    setPhase('level');
    setPicked(null);
    setAnswers([]);
    setGains([]);
    setStreak(0);
    setBestStreak(0);
    setConfirmQuit(false);
    setLeaving(false);
    setHintUsed(false);
    setHidden([]);
    setToast(null);
    setOutcome(null);
    setShareLabel('Share my score');
    sounds.levelUp();
    haptics.levelUp();
  }, [countries]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setReplay(false);
      start();
      dialog.showModal();
    } else if (!open && dialog.open) {
      window.clearTimeout(leaveTimer.current);
      dialog.close();
    }
  }, [open, start]);

  // Fetch every flag of the round up front, so none pops in late.
  useEffect(() => {
    for (const question of questions) {
      const img = new Image();
      img.decoding = 'async';
      img.src = question.answer.flag.svg;
    }
  }, [questions]);

  // Each level's intro card moves on by itself (or with a tap).
  const q = questions[step] as Question | undefined;
  useEffect(() => {
    if (!open || phase !== 'level' || !q || confirmQuit) return;
    const timer = window.setTimeout(() => setPhase('ask'), q.level === 'impossible' ? 2600 : 1800);
    return () => window.clearTimeout(timer);
  }, [open, phase, q, confirmQuit]);

  // The clock for the speed bonus starts when a question can be answered.
  useEffect(() => {
    if (phase === 'ask') askedAt.current = performance.now();
  }, [phase, step]);

  // Keys work wherever focus is while the quiz is open (buttons that vanish take focus with them).
  useEffect(() => {
    if (!open) return;
    const listener = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [open]);

  // Each new question takes focus back into the quiz, so Tab carries on from there.
  useEffect(() => {
    if (!open || phase !== 'ask') return;
    const frame = requestAnimationFrame(() => rootRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open, phase, step]);

  // Streak cheers go away by themselves.
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1900);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const results = answers.map((id, i) => id === questions[i]?.answer.cca3);
  const score = results.filter(Boolean).length;
  const xp = gains.reduce((sum, gain) => sum + gain.total, 0);
  const stars = starsFor(score);
  const inProgress = phase !== 'done' && answers.length > 0;

  // The results' stars ring in one by one.
  useEffect(() => {
    if (phase !== 'done') return;
    const timers = Array.from({ length: stars }, (_, i) =>
      window.setTimeout(() => {
        sounds.star(i);
        haptics.star();
      }, STAR_DELAY + i * STAR_GAP),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [phase, run, stars]);

  // Two people from a country the player got right cheer at the end.
  const fan = useMemo(() => {
    if (phase !== 'done') return null;
    const right = questions.filter((question, i) => answers[i] === question.answer.cca3).map((question) => question.answer);
    return pickOne(right.length ? right : questions.map((question) => question.answer));
  }, [phase, questions, answers]);

  if (!q && phase !== 'done') {
    // Before the first round is dealt.
    return <dialog ref={dialogRef} aria-label="Flag quiz" className="quiz-dialog" onClose={() => open && onClose()} />;
  }

  const level = q ? LEVELS[q.level] : LEVELS.easy;
  const impossible = q?.level === 'impossible' && phase !== 'done';
  const right = phase === 'checked' && picked === q?.answer.cca3;
  const last = step === questions.length - 1;
  const lastGain = gains[gains.length - 1] as Gain | undefined;

  const choose = (id: string) => {
    if (phase !== 'ask' || leaving || hidden.includes(id) || !q) return;
    setPicked(id);
    sounds.option(q.options.findIndex((c) => c.cca3 === id));
    haptics.tap();
  };

  /** 50/50: two wrong answers vanish, once per round, for half the points. */
  const takeHint = () => {
    if (!q || phase !== 'ask' || hintUsed || leaving) return;
    const wrong = q.options.map((c) => c.cca3).filter((id) => id !== q.answer.cca3);
    const gone = wrong.sort(() => Math.random() - 0.5).slice(0, 2);
    setHidden(gone);
    setHintUsed(true);
    if (picked && gone.includes(picked)) setPicked(null);
    sounds.poof();
    haptics.hint();
  };

  const check = () => {
    if (phase !== 'ask' || !picked || !q || leaving) return;
    const ok = picked === q.answer.cca3;
    const hinted = hidden.length > 0;
    let gain: Gain = { total: 0, base: 0, combo: 0, speed: 0, hint: hinted };
    if (ok) {
      const inARow = streak + 1;
      const base = hinted ? Math.round(LEVELS[q.level].xp / 2) : LEVELS[q.level].xp;
      const combo = inARow >= 5 ? 10 : inARow >= 3 ? 5 : 0;
      const speed = !hinted && performance.now() - askedAt.current <= SPEED_MS ? 5 : 0;
      gain = { total: base + combo + speed, base, combo, speed, hint: hinted };
      setStreak(inARow);
      setBestStreak((best) => Math.max(best, inARow));
      setLine(inARow >= 3 ? `On fire! ${inARow} in a row 🔥` : pickOne(PRAISE));
      sounds.correct(inARow);
      if (MILESTONES[inARow]) {
        setToast({ id: Date.now(), text: MILESTONES[inARow] });
        sounds.combo(inARow);
        haptics.combo();
      } else haptics.correct();
    } else {
      setStreak(0);
      setLine(pickOne(COMFORT));
      sounds.wrong();
      haptics.wrong();
    }
    setAnswers((list) => [...list, picked]);
    setGains((list) => [...list, gain]);
    setPhase('checked');
  };

  const finish = () => {
    setPhase('done');
    setOutcome(recordRound({ score, xp }));
    sounds.fanfare(score);
    haptics.win(score);
  };

  const next = () => {
    if (phase !== 'checked' || !q || leaving) return;
    sounds.swish();
    setLeaving(true);
    leaveTimer.current = window.setTimeout(() => {
      setLeaving(false);
      if (last) return finish();
      const upcoming = questions[step + 1];
      setStep(step + 1);
      setPicked(null);
      setHidden([]);
      if (upcoming.level === q.level) return setPhase('ask');
      setPhase('level');
      if (upcoming.level === 'impossible') {
        sounds.danger();
        haptics.danger();
      } else {
        sounds.levelUp();
        haptics.levelUp();
      }
    }, LEAVE_MS);
  };

  const leave = () => {
    if (inProgress) setConfirmQuit(true);
    else onClose();
  };

  const share = async () => {
    const grid = LEVEL_ORDER.map(
      (lvl) => LEVELS[lvl].emoji + questions.map((question, i) => (question.level === lvl ? (answers[i] === question.answer.cca3 ? '🟩' : '🟥') : '')).join(''),
    ).join(' ');
    const text = `I got ${score}/10 in the World Atlas flag quiz! ${'⭐'.repeat(stars)}\n${grid}\n${location.origin}${location.pathname}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setShareLabel('Copied! ✅');
      }
    } catch {
      // The share sheet was closed.
    }
  };

  // 1–4 pick an answer, H takes the hint, Enter checks, moves on and skips a level card. (Enter on
  // a focused button presses that button instead.)
  onKey.current = (e) => {
    if (confirmQuit || e.altKey || e.ctrlKey || e.metaKey) return;
    if (phase === 'ask' && q && /^[1-4]$/.test(e.key)) choose(q.options[Number(e.key) - 1].cca3);
    else if (phase === 'ask' && e.key.toLowerCase() === 'h') takeHint();
    else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      if (phase === 'ask') check();
      else if (phase === 'checked') next();
      else if (phase === 'level') setPhase('ask');
    }
  };

  const optionState = (id: string): OptionState => {
    if (hidden.includes(id) && phase === 'ask') return 'gone';
    if (phase === 'ask' || phase === 'level') return id === picked ? 'picked' : 'idle';
    if (id === q?.answer.cca3) return 'right';
    if (id === picked) return 'wrong';
    return 'dim';
  };

  const mood: Mood = phase === 'checked' ? (right ? 'happy' : 'sad') : q?.level === 'impossible' ? 'shock' : q?.level === 'hard' ? 'think' : 'idle';
  const look: Look | null = phase === 'ask' && picked ? 'down' : null;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Flag quiz"
      className="quiz-dialog"
      onCancel={(e) => {
        // Esc or back: ask before a round in progress is thrown away.
        if (inProgress) {
          e.preventDefault();
          setConfirmQuit(true);
        }
      }}
      onClose={() => open && onClose()}
    >
      <div
        key={run}
        ref={rootRef}
        tabIndex={-1}
        className={clsx(
          'relative flex h-full flex-col outline-none',
          replay ? 'animate-fade-in' : 'animate-sheet-up',
          impossible ? 'bg-[#1c1c1e] text-white' : 'bg-[#f2f2f7] text-label',
        )}
      >
        {/* Top bar: quit, progress, points */}
        <header className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pt-[max(14px,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={leave}
            aria-label="Quit the quiz"
            className={clsx(
              'ios-press grid size-9 shrink-0 place-items-center rounded-full',
              impossible ? 'bg-white/15 text-white' : 'bg-control text-label',
            )}
          >
            <X className="size-[18px]" strokeWidth={2.6} />
          </button>
          <Progress value={phase === 'done' ? questions.length : answers.length} total={questions.length} color={level.bar} />
          <span className="relative shrink-0">
            <span
              className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[15px] font-semibold tabular-nums text-label shadow-[0_0_0_0.5px_rgb(0_0_0/0.06)]"
              aria-label={`${xp} points`}
            >
              <Zap aria-hidden className="size-4 fill-ios-orange text-ios-orange" strokeWidth={2} />
              <CountUp value={xp} />
            </span>
            {phase === 'checked' && lastGain && lastGain.total > 0 && (
              <span
                key={`gain-${run}-${step}`}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 animate-float-up whitespace-nowrap text-[17px] font-bold text-ios-green [text-shadow:0_1px_3px_rgb(255_255_255/0.9)]"
              >
                +{lastGain.total}
              </span>
            )}
          </span>
        </header>

        {/* A streak cheer */}
        {toast && (
          <div key={toast.id} role="status" className="pointer-events-none absolute inset-x-0 top-[calc(max(14px,env(safe-area-inset-top))+58px)] z-10 flex justify-center px-4">
            <span className="animate-toast rounded-full bg-ios-orange px-4 py-1.5 text-[15px] font-semibold text-white shadow-[0_6px_20px_rgb(255_149_0/0.4)]">{toast.text}</span>
          </div>
        )}

        <main className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-4">
          {phase === 'done' ? (
            <Results
              questions={questions}
              answers={answers}
              score={score}
              xp={xp}
              bestStreak={bestStreak}
              outcome={outcome}
              fan={fan}
              shareLabel={shareLabel}
              onShare={share}
              onShowCountry={onShowCountry}
            />
          ) : (
            q && (
              <div
                key={`question-${run}-${step}-${phase === 'level' ? 'waiting' : 'on'}`}
                className={clsx('flex flex-col', leaving ? 'animate-slide-out' : 'animate-slide-in')}
              >
                <div className="mt-4 flex items-center gap-2">
                  <span className={clsx('rounded-full px-2.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.04em]', level.chip)}>{level.label}</span>
                  <span className={clsx('min-w-0 truncate text-[13px] font-medium', impossible ? 'text-white/60' : 'text-secondary')}>
                    Question {step + 1} of {questions.length}
                  </span>
                  <button
                    type="button"
                    onClick={takeHint}
                    disabled={hintUsed || phase !== 'ask'}
                    aria-label={hintUsed ? 'Hint already used this round' : 'Hint: take away two wrong answers (once per round, half points)'}
                    className="ios-press ml-auto flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-tint disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Lightbulb aria-hidden className="size-3.5" strokeWidth={2.4} />
                    {hintUsed ? 'Used' : '50/50'}
                  </button>
                </div>

                <div className="mt-2 flex items-end gap-1">
                  <Mascot
                    key={`mascot-${phase}`}
                    mood={mood}
                    talking
                    look={look}
                    fire={streak >= 3 && phase !== 'level'}
                    cool={streak >= 5}
                    className="w-[84px] shrink-0 sm:w-[104px] [@media(max-height:700px)]:w-[64px]"
                  />
                  <Bubble key={`bubble-${phase}-${line}`} text={phase === 'checked' ? line : ASK[q.level]} />
                </div>

                <MysteryFlag country={q.answer} glow={impossible} />
                {phase !== 'level' && <SpeedBar running={phase === 'ask' && !leaving} forfeited={hidden.length > 0} />}

                <ul className="mt-3 grid gap-2.5" aria-label="Choose a country">
                  {q.options.map((c, i) => (
                    <Option key={c.cca3} index={i} country={c} state={optionState(c.cca3)} onPick={() => choose(c.cca3)} />
                  ))}
                </ul>
              </div>
            )
          )}
        </main>

        {/* Bottom: Check, then the verdict and Continue; Play again at the end */}
        {phase === 'checked' && q ? (
          <footer
            role="status"
            className={clsx(
              'rounded-t-[28px] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 text-label shadow-[0_-8px_30px_rgb(0_0_0/0.12)]',
              right ? 'bg-[#e8f8ec]' : 'bg-[#fdeceb]',
              leaving ? 'animate-feedback-out' : 'animate-feedback-in',
            )}
          >
            <div className="mx-auto max-w-xl">
              <div className="flex items-center gap-3">
                <span
                  className={clsx('grid size-11 shrink-0 animate-pop place-items-center rounded-full text-white', right ? 'bg-ios-green' : 'bg-ios-red')}
                >
                  {right ? <Check className="size-6" strokeWidth={3} /> : <X className="size-6" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={clsx('ios-title text-[22px] leading-tight', right ? 'text-[#248a3d]' : 'text-[#d70015]')}>
                    {right ? 'Correct!' : 'Not quite'}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[15px] font-semibold">
                    <Flag country={q.answer} className="h-4 w-6 shrink-0 rounded-[3px] shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)]" />
                    <span className="truncate">
                      {right ? q.answer.name : `It’s ${q.answer.name}`}
                      {q.answer.capitals[0] && <span className="font-normal text-secondary"> · capital {q.answer.capitals[0].name}</span>}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-secondary">
                    {q.answer.subregion ?? q.answer.region}
                    {q.answer.population ? ` · ${formatShortCount(q.answer.population)} people` : ''}
                  </p>
                </div>
              </div>
              {right && lastGain && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <GainChip>⚡ +{lastGain.base} XP</GainChip>
                  {lastGain.combo > 0 && <GainChip>🔥 +{lastGain.combo} combo</GainChip>}
                  {lastGain.speed > 0 && <GainChip>⏱️ +{lastGain.speed} quick</GainChip>}
                  {lastGain.hint && <GainChip>💡 half points</GainChip>}
                </div>
              )}
              <button
                type="button"
                ref={focusAfterPaint}
                onClick={next}
                className={clsx('ios-press mt-3.5 w-full rounded-[14px] py-3.5 text-[17px] font-semibold text-white', right ? 'bg-ios-green' : 'bg-ios-red')}
              >
                {last ? 'See My Score' : 'Continue'}
              </button>
            </div>
          </footer>
        ) : phase === 'done' ? (
          <footer className="border-t border-hairline bg-white/70 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
            <div className="mx-auto flex max-w-xl gap-3">
              <button type="button" onClick={onClose} className="ios-press flex-1 rounded-[14px] bg-control py-3.5 text-[17px] font-semibold text-tint">
                Back to Map
              </button>
              <button
                type="button"
                ref={focusAfterPaint}
                onClick={() => {
                  setReplay(true);
                  start();
                }}
                className="ios-press flex-[1.4] rounded-[14px] bg-tint py-3.5 text-[17px] font-semibold text-white"
              >
                Play Again
              </button>
            </div>
          </footer>
        ) : (
          <footer
            className={clsx(
              'border-t px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl',
              impossible ? 'border-white/10 bg-black/30' : 'border-hairline bg-white/70',
            )}
          >
            <button
              type="button"
              onClick={check}
              disabled={!picked}
              className="ios-press mx-auto block w-full max-w-xl rounded-[14px] bg-tint py-3.5 text-[17px] font-semibold text-white disabled:pointer-events-none disabled:bg-control disabled:text-tertiary"
            >
              Check
            </button>
          </footer>
        )}

        {/* Level intro card */}
        {phase === 'level' && q && (
          <button
            type="button"
            onClick={() => setPhase('ask')}
            className={clsx('absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden px-6 text-center', level.banner)}
          >
            {impossible && <span aria-hidden className="pointer-events-none absolute inset-0 animate-flash bg-[#ff3b5c]" />}
            <Mascot mood={level.mood} className="w-36 animate-banner-in" />
            <span className="mt-5 animate-banner-in rounded-full bg-white/90 px-4 py-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-label [animation-delay:80ms]">
              Level {level.n} of 4
            </span>
            <span role="status" className="mt-3 block animate-banner-in font-display text-[46px] font-bold leading-none tracking-[-0.03em] [animation-delay:140ms]">
              {level.emoji} {level.label}
            </span>
            <span className="mt-3 block max-w-xs animate-banner-in text-[16px] font-bold opacity-80 [animation-delay:200ms]">{level.tagline}</span>
            <span className="mt-10 block text-[12px] font-semibold uppercase tracking-widest opacity-60">Tap to start</span>
          </button>
        )}

        {/* Quit? */}
        {confirmQuit && (
          <div className="absolute inset-0 z-30 flex items-end bg-black/40" onClick={() => setConfirmQuit(false)}>
            <div
              role="alertdialog"
              aria-label="Quit the quiz?"
              onClick={(e) => e.stopPropagation()}
              className="mx-auto w-full max-w-xl animate-feedback-in rounded-t-[30px] bg-white px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 text-center text-label shadow-[0_-8px_30px_rgb(0_0_0/0.15)]"
            >
              <Mascot mood="sad" className="mx-auto w-24" />
              <p className="ios-title mt-2 text-[22px]">Leaving already?</p>
              <p className="mt-1 text-[15px] text-secondary">You’ll lose your progress in this round.</p>
              <button
                type="button"
                ref={focusAfterPaint}
                onClick={() => setConfirmQuit(false)}
                className="ios-press mt-4 w-full rounded-[14px] bg-tint py-3.5 text-[17px] font-semibold text-white"
              >
                Keep Playing
              </button>
              <button type="button" onClick={onClose} className="mt-2 w-full rounded-[14px] py-3 text-[17px] font-semibold text-ios-red">
                Quit
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}

/** A number that rolls to its new value. */
function CountUp({ value, from, duration = 600, delay = 0, onTick }: { value: number; from?: number; duration?: number; delay?: number; onTick?: () => void }) {
  const [shown, setShown] = useState(from ?? value);
  const current = useRef(from ?? value);
  const tick = useRef(onTick);
  tick.current = onTick;
  useEffect(() => {
    const start = current.current;
    if (start === value) return;
    let frame = 0;
    let lastTick = 0;
    const began = performance.now() + delay;
    const step = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - began) / duration));
      const v = Math.round(start + (value - start) * (1 - Math.pow(1 - t, 3)));
      current.current = v;
      setShown(v);
      if (tick.current && t > 0 && t < 1 && now - lastTick > 85) {
        lastTick = now;
        tick.current();
      }
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, delay]);
  return <>{shown}</>;
}

function Progress({ value, total, color }: { value: number; total: number; color: string }) {
  return (
    <div
      role="progressbar"
      aria-label="Questions answered"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-control"
    >
      <div
        className="relative h-full overflow-hidden rounded-full transition-[width,background-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ width: `${(value / total) * 100}%`, background: color }}
      >
        {/* A shine sweeping along it each time it grows */}
        <span key={value} aria-hidden className="absolute inset-y-0 -left-1/2 w-1/2 animate-shine bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.75),transparent)]" />
      </div>
      {/* Where each level ends */}
      {[3, 6, 9].map((n) => (
        <span key={n} aria-hidden className="absolute inset-y-0 w-0.5 bg-white/70" style={{ left: `${(n / total) * 100}%` }} />
      ))}
    </div>
  );
}

function MysteryFlag({ country, glow }: { country: Country; glow: boolean }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  return (
    // A flex box with a set height, so the flag scales down to fit it whatever its shape.
    <div
      className={clsx(
        'relative mt-1 flex w-full shrink-0 animate-flip-in items-center justify-center overflow-hidden rounded-[24px] bg-white p-4',
        glow ? 'shadow-[0_0_0_3px_#af52de,0_0_44px_rgb(175_82_222/0.55)]' : 'shadow-[0_0_0_0.5px_rgb(0_0_0/0.05),0_4px_18px_rgb(0_0_0/0.08)]',
      )}
      style={{ height: 'clamp(118px, 25vh, 220px)' }}
    >
      {state === 'failed' ? (
        <p className="px-3 text-center text-[15px] text-secondary">This flag needs an internet connection. Take a guess anyway!</p>
      ) : (
        <>
          {state === 'loading' && <span aria-hidden className="skeleton absolute inset-4 rounded-xl" />}
          <img
            src={country.flag.svg}
            alt="The mystery flag"
            draggable={false}
            onLoad={() => setState('loaded')}
            onError={() => setState('failed')}
            className={clsx(
              // A faint edge, so flags with white stripes don't melt into the white card
              'relative max-h-full max-w-full rounded-[4px] object-contain shadow-[0_0_0_0.5px_rgb(0_0_0/0.15),0_2px_8px_rgb(0_0_0/0.12)]',
              state === 'loaded' ? 'animate-pop' : 'opacity-0',
            )}
          />
        </>
      )}
    </div>
  );
}

/** Drains while the question waits: answer right before it empties for a speed bonus. */
function SpeedBar({ running, forfeited }: { running: boolean; forfeited: boolean }) {
  return (
    <div aria-hidden className={clsx('mt-2.5 flex items-center gap-2 transition-opacity duration-300', forfeited && 'opacity-25')}>
      <Timer className="size-3.5 text-secondary" strokeWidth={2.4} />
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-control">
        <div
          className="h-full origin-left animate-drain rounded-full bg-[linear-gradient(90deg,#ffcc00,#ff9500)]"
          style={{ animationDuration: `${SPEED_MS}ms`, animationPlayState: running ? 'running' : 'paused' }}
        />
      </div>
    </div>
  );
}

const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const reach = 46 + (i % 3) * 16;
  return { dx: Math.cos(angle) * reach * 1.9, dy: Math.sin(angle) * reach * 0.75, colour: SPARK_COLOURS[i % SPARK_COLOURS.length], size: 6 + (i % 3) * 2 };
});

/** A burst of sparks from the right answer. */
function Burst() {
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
      {SPARKS.map((spark, i) => (
        <span
          key={i}
          className="absolute animate-burst rounded-full"
          style={
            {
              width: spark.size,
              height: spark.size,
              marginLeft: -spark.size / 2,
              marginTop: -spark.size / 2,
              background: spark.colour,
              '--dx': `${spark.dx}px`,
              '--dy': `${spark.dy}px`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

function Option({ index, country, state, onPick }: { index: number; country: Country; state: OptionState; onPick: () => void }) {
  const locked = state !== 'idle' && state !== 'picked';
  return (
    <li className="animate-rise" style={{ animationDelay: `${140 + index * 70}ms` }}>
      <button
        type="button"
        onClick={onPick}
        disabled={locked}
        aria-pressed={state === 'picked'}
        aria-hidden={state === 'gone' || undefined}
        className={clsx(
          'relative flex min-h-14 w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left text-label transition-[transform,box-shadow,background-color,opacity] duration-200 [@media(max-height:700px)]:min-h-12 [@media(max-height:700px)]:py-2',
          state === 'idle' && 'ios-press bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.04),0_1px_2px_rgb(0_0_0/0.05)]',
          state === 'picked' && 'bg-[#e5f1ff] shadow-[0_0_0_2px_#007aff]',
          state === 'right' && 'animate-tada bg-[#e3f7e8] shadow-[0_0_0_2px_#34c759]',
          state === 'wrong' && 'animate-shake bg-[#fde7e6] shadow-[0_0_0_2px_#ff3b30]',
          state === 'dim' && 'bg-white opacity-45',
          state === 'gone' && 'animate-poof bg-white',
        )}
      >
        <span
          className={clsx(
            'grid size-8 shrink-0 place-items-center rounded-full text-[15px] font-semibold',
            state === 'picked' ? 'bg-tint text-white' : state === 'right' ? 'bg-ios-green text-white' : state === 'wrong' ? 'bg-ios-red text-white' : 'bg-control text-secondary',
          )}
        >
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 text-[17px] font-medium leading-snug">{country.name}</span>
        {state === 'right' && <Check className="size-6 shrink-0 text-ios-green" strokeWidth={3} />}
        {state === 'wrong' && <X className="size-6 shrink-0 text-ios-red" strokeWidth={3} />}
        {state === 'right' && <Burst />}
      </button>
    </li>
  );
}

function GainChip({ children }: { children: ReactNode }) {
  return <span className="animate-pop rounded-full bg-white/90 px-2.5 py-0.5 text-[13px] font-semibold text-label shadow-[0_0_0_0.5px_rgb(0_0_0/0.05)]">{children}</span>;
}

const TITLES: [number, string][] = [
  [10, 'Perfect Score!'],
  [8, 'Amazing!'],
  [6, 'Great Job!'],
  [4, 'Nice Try!'],
  [0, 'Keep Exploring!'],
];

function Results({
  questions,
  answers,
  score,
  xp,
  bestStreak,
  outcome,
  fan,
  shareLabel,
  onShare,
  onShowCountry,
}: {
  questions: Question[];
  answers: string[];
  score: number;
  xp: number;
  bestStreak: number;
  outcome: Outcome | null;
  fan: Country | null;
  shareLabel: string;
  onShare: () => void;
  onShowCountry: (id: string) => void;
}) {
  const title = TITLES.find(([min]) => score >= min)![1];
  const stars = starsFor(score);
  const costume = fan ? costumeFor(fan) : null;
  const before = outcome ? rankOf(outcome.before.totalXp) : null;
  const after = outcome ? rankOf(outcome.after.totalXp) : null;
  const rankedUp = !!before && !!after && before.rank.name !== after.rank.name;
  // The rank bar fills up from where it was before this round.
  const [fill, setFill] = useState(rankedUp ? 0 : (before?.progress ?? 0));
  const target = after?.progress;
  useEffect(() => {
    if (target === undefined) return;
    const timer = window.setTimeout(() => setFill(target), 700);
    return () => window.clearTimeout(timer);
  }, [target]);

  return (
    <div className="flex flex-col items-center pb-2 pt-4 text-center">
      {score >= 6 && <Confetti />}
      <div className="flex items-end justify-center">
        {costume && (
          <div className="h-[132px] w-[70px] animate-rise">
            <Figure outfit={costume.man} skin={costume.skin[0]} hairColor={costume.hair[0]} female={false} wave="left" happy />
          </div>
        )}
        <Mascot mood={score >= 4 ? 'party' : 'happy'} cool={bestStreak >= 5} className="mx-1 w-32" />
        {costume && (
          <div className="h-[132px] w-[70px] animate-rise [animation-delay:120ms]">
            <Figure outfit={costume.woman} skin={costume.skin[1]} hairColor={costume.hair[1]} female wave="right" happy delay={1.3} />
          </div>
        )}
      </div>
      {fan && (
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-secondary">
          Cheering from <Flag country={fan} className="h-3 w-[18px] rounded-[2px] shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)]" /> {fan.name}
        </p>
      )}

      <h2 className="ios-title mt-3 animate-pop text-[34px] leading-tight">{title}</h2>
      <div className="mt-2 flex items-end gap-1.5" role="img" aria-label={`${stars} of 3 stars`}>
        {[0, 1, 2].map((i) => (
          <Star
            key={i}
            aria-hidden
            className={clsx(
              i === 1 ? 'mb-2 size-12' : 'size-10',
              i < stars ? 'animate-star-pop fill-[#ffcc00] text-[#ffcc00]' : 'fill-control text-transparent',
            )}
            strokeWidth={1.5}
            style={i < stars ? { animationDelay: `${STAR_DELAY + i * STAR_GAP}ms` } : undefined}
          />
        ))}
      </div>
      <p className="mt-1 text-[16px] text-secondary">
        You got <span className="font-semibold text-label">{score}</span> of {questions.length} flags right
      </p>
      {outcome && (outcome.newBest || outcome.after.dayStreak >= 2) && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {outcome.newBest && (
            <span className="flex animate-pop items-center gap-1.5 rounded-full bg-[#ffcc00]/25 px-3 py-1 text-[14px] font-semibold text-[#8a6100]">
              <Trophy aria-hidden className="size-4" strokeWidth={2.3} />
              New best score
            </span>
          )}
          {outcome.after.dayStreak >= 2 && (
            <span className="flex animate-pop items-center gap-1.5 rounded-full bg-ios-orange/15 px-3 py-1 text-[14px] font-semibold text-[#b25f00] [animation-delay:120ms]">
              <Flame aria-hidden className="size-4" strokeWidth={2.3} />
              {outcome.after.dayStreak}-day streak
            </span>
          )}
        </div>
      )}

      <dl className="mt-5 grid w-full grid-cols-3 gap-3">
        <Stat
          label="Points"
          icon={<Zap aria-hidden className="size-4 fill-ios-orange text-ios-orange" strokeWidth={2} />}
          value={<CountUp value={xp} from={0} duration={1100} delay={350} onTick={sounds.count} />}
        />
        <Stat
          label="Accuracy"
          icon={<Target aria-hidden className="size-4 text-ios-green" strokeWidth={2.4} />}
          value={`${Math.round((score / questions.length) * 100)}%`}
        />
        <Stat label="Best streak" icon={<Flame aria-hidden className="size-4 text-ios-red" strokeWidth={2.4} />} value={bestStreak} />
      </dl>

      {after && outcome && (
        <div className="mt-5 w-full animate-rise rounded-[22px] bg-white p-4 text-left [animation-delay:250ms]">
          <div className="flex items-center gap-3">
            <span aria-hidden className={clsx('text-[38px] leading-none', rankedUp && 'animate-star-pop [animation-delay:1500ms]')}>
              {after.rank.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-secondary">{rankedUp ? 'Rank up!' : 'Your rank'}</p>
              <p className="ios-title text-[20px] leading-tight">{after.rank.name}</p>
            </div>
            <span className="text-[15px] font-semibold tabular-nums text-label">{outcome.after.totalXp} XP</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-control">
            <div
              className="h-full origin-left rounded-full bg-[linear-gradient(90deg,#34c759,#ffcc00)] transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: `scaleX(${fill})` }}
            />
          </div>
          <p className="mt-1.5 text-[13px] text-secondary">
            {after.next ? `${after.next.min - outcome.after.totalXp} XP to ${after.next.emoji} ${after.next.name}` : 'Top rank reached!'}
            {' · '}
            {outcome.after.games} {outcome.after.games === 1 ? 'round' : 'rounds'} played
          </p>
        </div>
      )}

      <button type="button" onClick={onShare} className="ios-press mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[15px] font-semibold text-tint">
        <Share aria-hidden className="size-4" strokeWidth={2.3} />
        {shareLabel}
      </button>

      <h3 className="mt-6 self-start text-[17px] font-semibold tracking-[-0.01em] text-label">Your flags · tap one to explore it</h3>
      <ol className="mt-3 grid w-full grid-cols-5 gap-2.5">
        {questions.map((question, i) => {
          const ok = answers[i] === question.answer.cca3;
          return (
            <li key={question.answer.cca3} className="animate-rise" style={{ animationDelay: `${400 + i * 45}ms` }}>
              <button
                type="button"
                onClick={() => onShowCountry(question.answer.cca3)}
                aria-label={`${question.answer.name}: ${ok ? 'right' : 'missed'}. Show it in the atlas`}
                className="ios-press relative block w-full rounded-[12px] bg-white p-1.5 shadow-[0_0_0_0.5px_rgb(0_0_0/0.05),0_1px_3px_rgb(0_0_0/0.06)]"
              >
                <Flag country={question.answer} className="aspect-[3/2] w-full rounded-[4px] shadow-[0_0_0_0.5px_rgb(0_0_0/0.12)]" />
                <span
                  aria-hidden
                  className={clsx(
                    'absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full text-white ring-2 ring-[#f2f2f7]',
                    ok ? 'bg-ios-green' : 'bg-ios-red',
                  )}
                >
                  {ok ? <Check className="size-3" strokeWidth={3.5} /> : <X className="size-3" strokeWidth={3.5} />}
                </span>
                <span className="mt-1 block truncate text-[10px] font-medium text-label">{question.answer.name}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Stat({ label, icon, value }: { label: string; icon: ReactNode; value: ReactNode }) {
  return (
    <div className="animate-rise rounded-[18px] bg-white px-1 py-3">
      <dt className="text-[12px] font-semibold uppercase tracking-[0.04em] text-secondary">{label}</dt>
      <dd className="mt-1 flex items-center justify-center gap-1 text-[22px] font-bold tabular-nums tracking-[-0.02em] text-label">
        {icon}
        {value}
      </dd>
    </div>
  );
}

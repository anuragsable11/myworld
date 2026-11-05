import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import clsx from 'clsx';
import { Check, X } from 'lucide-react';
import type { Country } from '../../types';
import { costumeFor } from '../../data/costumes';
import { formatShortCount } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import { sounds } from '../../lib/sounds';
import { Figure } from '../panel/dress/Figure';
import { Flag } from '../ui/Flag';
import { Mascot, type Look, type Mood } from './Mascot';
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
  easy: { n: 1, label: 'Easy', emoji: '🌱', xp: 10, tagline: "Let's warm up with famous flags!", mood: 'happy', chip: 'bg-emerald-200', bar: '#4ade80', banner: 'bg-[#d9f99d] text-ink' },
  medium: { n: 2, label: 'Medium', emoji: '🔥', xp: 20, tagline: 'Neighbours join in now. Trickier!', mood: 'happy', chip: 'bg-amber-200', bar: '#fbbf24', banner: 'bg-[#fde68a] text-ink' },
  hard: { n: 3, label: 'Hard', emoji: '💪', xp: 30, tagline: 'These flags look a lot alike. Look closely!', mood: 'think', chip: 'bg-orange-300', bar: '#fb923c', banner: 'bg-[#fdba74] text-ink' },
  impossible: { n: 4, label: 'Impossible', emoji: '💀', xp: 60, tagline: 'Almost nobody gets this one. Good luck!', mood: 'shock', chip: 'bg-violet-300', bar: '#a78bfa', banner: 'bg-[#221a3d] text-white' },
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
          impossible ? 'bg-[#221a3d] bg-[radial-gradient(#ffffff26_1px,transparent_1.4px)] bg-[length:22px_22px] text-white' : 'dots-bg bg-paper text-ink',
        )}
      >
        {/* Top bar: quit, progress, points */}
        <header className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pt-[max(14px,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={leave}
            aria-label="Quit the quiz"
            className="toon-sm toon-press-sm grid size-10 shrink-0 place-items-center rounded-full bg-white text-ink"
          >
            <X className="size-5" strokeWidth={3} />
          </button>
          <Progress value={phase === 'done' ? questions.length : answers.length} total={questions.length} color={level.bar} />
          <span className="relative shrink-0">
            <span className="toon-sm block rounded-full bg-white px-2.5 py-1 font-display text-[14px] font-bold tabular-nums text-ink" aria-label={`${xp} points`}>
              ⚡ <CountUp value={xp} />
            </span>
            {phase === 'checked' && lastGain && lastGain.total > 0 && (
              <span
                key={`gain-${run}-${step}`}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 animate-float-up whitespace-nowrap font-display text-[17px] font-bold text-emerald-500 [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff]"
              >
                +{lastGain.total}
              </span>
            )}
          </span>
        </header>

        {/* A streak cheer */}
        {toast && (
          <div key={toast.id} role="status" className="pointer-events-none absolute inset-x-0 top-[calc(max(14px,env(safe-area-inset-top))+58px)] z-10 flex justify-center px-4">
            <span className="toon animate-toast rounded-full bg-[#ff8a3d] px-4 py-1.5 font-display text-[16px] font-bold text-white">{toast.text}</span>
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
                  <span className={clsx('toon-sm rounded-full px-2.5 py-0.5 font-display text-[13px] font-bold uppercase tracking-wide text-ink', level.chip)}>
                    {level.emoji} {level.label}
                  </span>
                  <span className={clsx('min-w-0 truncate text-[13px] font-extrabold', impossible ? 'text-white/70' : 'text-slate-500')}>
                    Question {step + 1} of {questions.length}
                  </span>
                  <button
                    type="button"
                    onClick={takeHint}
                    disabled={hintUsed || phase !== 'ask'}
                    aria-label={hintUsed ? 'Hint already used this round' : 'Hint: take away two wrong answers (once per round, half points)'}
                    className="toon-sm toon-press-sm ml-auto shrink-0 rounded-full bg-white px-2.5 py-0.5 font-display text-[13px] font-bold text-ink disabled:pointer-events-none disabled:opacity-40"
                  >
                    💡 {hintUsed ? 'Used' : '50/50'}
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
              'border-t-[3px] border-ink px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 text-ink',
              right ? 'bg-[#cdf5a8]' : 'bg-[#ffd0d4]',
              leaving ? 'animate-feedback-out' : 'animate-feedback-in',
            )}
          >
            <div className="mx-auto max-w-xl">
              <div className="flex items-center gap-3">
                <span
                  className={clsx(
                    'grid size-12 shrink-0 animate-pop place-items-center rounded-full border-[3px] border-ink text-white',
                    right ? 'bg-emerald-500' : 'bg-rose-500',
                  )}
                >
                  {right ? <Check className="size-7" strokeWidth={4} /> : <X className="size-7" strokeWidth={4} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="toon-title text-[22px] leading-tight">{right ? 'Correct!' : 'Not quite!'}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[14.5px] font-bold">
                    <Flag country={q.answer} className="h-4 w-6 shrink-0 rounded-[3px] border border-ink/30" />
                    <span className="truncate">
                      {right ? q.answer.name : `It’s ${q.answer.name}`}
                      {q.answer.capitals[0] && <span className="font-semibold opacity-70"> · capital {q.answer.capitals[0].name}</span>}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] font-semibold opacity-65">
                    📍 {q.answer.subregion ?? q.answer.region}
                    {q.answer.population ? ` · 👥 ${formatShortCount(q.answer.population)} people` : ''}
                  </p>
                </div>
              </div>
              {right && lastGain && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <GainChip className="bg-white">⚡ +{lastGain.base} XP</GainChip>
                  {lastGain.combo > 0 && <GainChip className="bg-[#ffd8b5]">🔥 +{lastGain.combo} combo</GainChip>}
                  {lastGain.speed > 0 && <GainChip className="bg-[#fff1a8]">⏱️ +{lastGain.speed} quick</GainChip>}
                  {lastGain.hint && <GainChip className="bg-white/70">💡 half points</GainChip>}
                </div>
              )}
              <button
                type="button"
                ref={focusAfterPaint}
                onClick={next}
                className={clsx('toon toon-press mt-3.5 w-full rounded-2xl py-3.5 font-display text-[19px] font-semibold text-ink', right ? 'bg-emerald-400' : 'bg-rose-400')}
              >
                {last ? 'See my score' : 'Continue'}
              </button>
            </div>
          </footer>
        ) : phase === 'done' ? (
          <footer className="border-t-2 border-ink/10 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
            <div className="mx-auto flex max-w-xl gap-3">
              <button type="button" onClick={onClose} className="toon toon-press flex-1 rounded-2xl bg-white py-3.5 font-display text-[17px] font-semibold text-ink">
                Back to map
              </button>
              <button
                type="button"
                ref={focusAfterPaint}
                onClick={() => {
                  setReplay(true);
                  start();
                }}
                className="toon toon-press flex-[1.4] rounded-2xl bg-sun py-3.5 font-display text-[17px] font-semibold text-ink"
              >
                Play again 🔁
              </button>
            </div>
          </footer>
        ) : (
          <footer className={clsx('border-t-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3', impossible ? 'border-white/10' : 'border-ink/10')}>
            <button
              type="button"
              onClick={check}
              disabled={!picked}
              className="toon toon-press mx-auto block w-full max-w-xl rounded-2xl bg-sun py-3.5 font-display text-[19px] font-semibold text-ink disabled:pointer-events-none disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
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
            <span className="toon-sm mt-5 animate-banner-in rounded-full bg-white px-4 py-1 text-[13px] font-black uppercase tracking-[0.14em] text-ink [animation-delay:80ms]">
              Level {level.n} of 4
            </span>
            <span role="status" className="mt-3 block animate-banner-in font-display text-[46px] font-bold leading-none [animation-delay:140ms]">
              {level.emoji} {level.label}
            </span>
            <span className="mt-3 block max-w-xs animate-banner-in text-[16px] font-bold opacity-80 [animation-delay:200ms]">{level.tagline}</span>
            <span className="mt-10 block text-[12px] font-extrabold uppercase tracking-widest opacity-50">Tap to start</span>
          </button>
        )}

        {/* Quit? */}
        {confirmQuit && (
          <div className="absolute inset-0 z-30 flex items-end bg-indigo-950/45" onClick={() => setConfirmQuit(false)}>
            <div
              role="alertdialog"
              aria-label="Quit the quiz?"
              onClick={(e) => e.stopPropagation()}
              className="mx-auto w-full max-w-xl animate-feedback-in rounded-t-[28px] border-x-[3px] border-t-[3px] border-ink bg-paper px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 text-center text-ink"
            >
              <Mascot mood="sad" className="mx-auto w-24" />
              <p className="toon-title mt-2 text-[22px]">Leaving already? 🥺</p>
              <p className="mt-1 text-[14.5px] font-semibold text-slate-600">You’ll lose your progress in this round.</p>
              <button
                type="button"
                ref={focusAfterPaint}
                onClick={() => setConfirmQuit(false)}
                className="toon toon-press mt-4 w-full rounded-2xl bg-sun py-3.5 font-display text-[18px] font-semibold text-ink"
              >
                Keep playing
              </button>
              <button type="button" onClick={onClose} className="mt-2 w-full rounded-2xl py-3 font-display text-[16px] font-semibold text-rose-600">
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
      className="relative h-5 min-w-0 flex-1 overflow-hidden rounded-full border-[2.5px] border-ink bg-white"
    >
      <div
        className="relative h-full overflow-hidden rounded-full transition-[width,background-color] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{ width: `${(value / total) * 100}%`, background: color }}
      >
        <div className="mx-2 mt-[3px] h-1 rounded-full bg-white/55" />
        {/* A shine sweeping along it each time it grows */}
        <span key={value} aria-hidden className="absolute inset-y-0 -left-1/2 w-1/2 animate-shine bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.75),transparent)]" />
      </div>
      {/* Where each level ends */}
      {[3, 6, 9].map((n) => (
        <span key={n} aria-hidden className="absolute inset-y-0 w-0.5 bg-ink/15" style={{ left: `${(n / total) * 100}%` }} />
      ))}
    </div>
  );
}

/** Globy's speech bubble; the words pop in one after another as it talks. */
function Bubble({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <p className="toon-sm relative mb-7 min-w-0 flex-1 animate-pop rounded-2xl bg-white px-4 py-3 font-display text-[17px] font-semibold leading-snug text-ink">
      <span aria-hidden className="absolute -left-[9px] bottom-4 size-4 rotate-45 border-b-2 border-l-2 border-ink bg-white" />
      <span className="relative">
        {words.map((word, i) => (
          <span key={i}>
            {i > 0 && ' '}
            <span className="inline-block animate-word" style={{ animationDelay: `${110 + i * 55}ms` }}>
              {word}
            </span>
          </span>
        ))}
      </span>
    </p>
  );
}

function MysteryFlag({ country, glow }: { country: Country; glow: boolean }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  return (
    // A flex box with a set height, so the flag scales down to fit it whatever its shape.
    <div
      className={clsx(
        'toon relative mt-1 flex w-full shrink-0 animate-flip-in items-center justify-center overflow-hidden rounded-3xl bg-white p-4',
        glow && 'shadow-[0_0_0_5px_#a78bfa,5px_5px_0_5px_#1e1b4b]',
      )}
      style={{ height: 'clamp(118px, 25vh, 220px)' }}
    >
      {state === 'failed' ? (
        <p className="px-3 text-center text-[14px] font-bold text-slate-500">🏳️ This flag needs an internet connection. Take a guess anyway!</p>
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
              'relative max-h-full max-w-full rounded-[3px] object-contain shadow-[0_0_0_1px_rgba(30,27,75,0.14),0_3px_0_rgba(30,27,75,0.14)]',
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
      <span className="text-[13px] leading-none">⏱️</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
        <div
          className="h-full origin-left animate-drain rounded-full bg-[linear-gradient(90deg,#fbbf24,#fb923c)]"
          style={{ animationDuration: `${SPEED_MS}ms`, animationPlayState: running ? 'running' : 'paused' }}
        />
      </div>
    </div>
  );
}

const SPARK_COLOURS = ['#ffd23f', '#ff7ab6', '#4cb8f5', '#7ed957', '#a78bfa', '#ff7a59'];
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
          'toon-sm relative flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-ink transition-[transform,box-shadow,background-color,opacity] duration-200 [@media(max-height:700px)]:min-h-12 [@media(max-height:700px)]:py-2',
          state === 'idle' && 'toon-press-sm bg-white',
          state === 'picked' && '-translate-x-0.5 -translate-y-0.5 bg-sky-200 shadow-[4px_4px_0_0_var(--color-ink)]',
          state === 'right' && 'animate-tada bg-emerald-300',
          state === 'wrong' && 'animate-shake bg-rose-300',
          state === 'dim' && 'bg-white opacity-45',
          state === 'gone' && 'animate-poof bg-white',
        )}
      >
        <span
          className={clsx(
            'grid size-8 shrink-0 place-items-center rounded-xl border-2 font-display text-[15px] font-bold',
            state === 'idle' || state === 'dim' || state === 'gone' ? 'border-ink/20 text-ink/50' : 'border-ink bg-white',
          )}
        >
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 font-display text-[17px] font-semibold leading-snug">{country.name}</span>
        {state === 'right' && <Check className="size-6 shrink-0" strokeWidth={3.4} />}
        {state === 'wrong' && <X className="size-6 shrink-0" strokeWidth={3.4} />}
        {state === 'right' && <Burst />}
      </button>
    </li>
  );
}

function GainChip({ className, children }: { className: string; children: ReactNode }) {
  return <span className={clsx('animate-pop rounded-full border-2 border-ink px-2 py-0.5 font-display text-[13px] font-bold text-ink', className)}>{children}</span>;
}

const TITLES: [number, string][] = [
  [10, 'Perfect score! 🏆'],
  [8, 'Amazing! 🌟'],
  [6, 'Great job! 🎉'],
  [4, 'Nice try! 👍'],
  [0, 'Keep exploring! 🧭'],
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
        <p className="mt-1 flex items-center gap-1.5 text-[12px] font-bold text-slate-500">
          Cheering from <Flag country={fan} className="h-3 w-[18px] rounded-[2px] border border-ink/30" /> {fan.name}
        </p>
      )}

      <h2 className="toon-title mt-3 animate-pop text-[34px] leading-tight">{title}</h2>
      <div className="mt-2 flex items-end gap-1" role="img" aria-label={`${stars} of 3 stars`}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className={clsx('inline-block leading-none', i === 1 ? 'mb-2 text-[48px]' : 'text-[38px]', i < stars ? 'animate-star-pop' : 'opacity-20 grayscale')}
            style={i < stars ? { animationDelay: `${STAR_DELAY + i * STAR_GAP}ms` } : undefined}
          >
            ⭐
          </span>
        ))}
      </div>
      <p className="mt-1 text-[16px] font-bold text-slate-600">
        You got <span className="text-ink">{score}</span> of {questions.length} flags right
      </p>
      {outcome && (outcome.newBest || outcome.after.dayStreak >= 2) && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {outcome.newBest && <span className="toon-sm animate-pop rounded-full bg-sun px-3 py-1 font-display text-[14px] font-bold text-ink">🏅 New best score!</span>}
          {outcome.after.dayStreak >= 2 && (
            <span className="toon-sm animate-pop rounded-full bg-[#ffd8b5] px-3 py-1 font-display text-[14px] font-bold text-ink [animation-delay:120ms]">
              🔥 {outcome.after.dayStreak}-day streak!
            </span>
          )}
        </div>
      )}

      <dl className="mt-5 grid w-full grid-cols-3 gap-3">
        <Stat
          label="Points"
          value={
            <>
              ⚡ <CountUp value={xp} from={0} duration={1100} delay={350} onTick={sounds.count} />
            </>
          }
          tone="bg-amber-100"
          tilt="-rotate-2"
        />
        <Stat label="Accuracy" value={`🎯 ${Math.round((score / questions.length) * 100)}%`} tone="bg-emerald-100" tilt="rotate-1" />
        <Stat label="Best streak" value={`🔥 ${bestStreak}`} tone="bg-rose-100" tilt="-rotate-1" />
      </dl>

      {after && outcome && (
        <div className="toon mt-5 w-full animate-rise rounded-3xl bg-white p-4 text-left [animation-delay:250ms]">
          <div className="flex items-center gap-3">
            <span aria-hidden className={clsx('text-[38px] leading-none', rankedUp && 'animate-star-pop [animation-delay:1500ms]')}>
              {after.rank.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{rankedUp ? 'Rank up! 🎉' : 'Your rank'}</p>
              <p className="toon-title text-[20px] leading-tight">{after.rank.name}</p>
            </div>
            <span className="font-display text-[15px] font-bold tabular-nums text-ink">{outcome.after.totalXp} XP</span>
          </div>
          <div className="mt-3 h-3.5 overflow-hidden rounded-full border-2 border-ink bg-slate-100">
            <div
              className="h-full origin-left rounded-full bg-[linear-gradient(90deg,#4ade80,#fbbf24)] transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: `scaleX(${fill})` }}
            />
          </div>
          <p className="mt-1.5 text-[12px] font-bold text-slate-500">
            {after.next ? `${after.next.min - outcome.after.totalXp} XP to ${after.next.emoji} ${after.next.name}` : 'Top rank reached! 👑'}
            {' · '}
            {outcome.after.games} {outcome.after.games === 1 ? 'round' : 'rounds'} played
          </p>
        </div>
      )}

      <button type="button" onClick={onShare} className="toon-sm toon-press-sm mt-4 rounded-full bg-white px-4 py-2 font-display text-[15px] font-semibold text-ink">
        📤 {shareLabel}
      </button>

      <h3 className="toon-title mt-6 self-start text-[17px]">Your flags · tap one to explore it 🗺️</h3>
      <ol className="mt-3 grid w-full grid-cols-5 gap-2.5">
        {questions.map((question, i) => {
          const ok = answers[i] === question.answer.cca3;
          return (
            <li key={question.answer.cca3} className="animate-rise" style={{ animationDelay: `${400 + i * 45}ms` }}>
              <button
                type="button"
                onClick={() => onShowCountry(question.answer.cca3)}
                aria-label={`${question.answer.name}: ${ok ? 'right' : 'missed'}. Show it in the atlas`}
                className="toon-sm toon-press-sm relative block w-full rounded-xl bg-white p-1.5"
              >
                <Flag country={question.answer} className="aspect-[3/2] w-full rounded-md" />
                <span
                  aria-hidden
                  className={clsx(
                    'absolute -right-2 -top-2 grid size-5 place-items-center rounded-full border-2 border-ink text-white',
                    ok ? 'bg-emerald-500' : 'bg-rose-500',
                  )}
                >
                  {ok ? <Check className="size-3" strokeWidth={4} /> : <X className="size-3" strokeWidth={4} />}
                </span>
                <span className="mt-1 block truncate text-[10px] font-extrabold text-ink">{question.answer.name}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Stat({ label, value, tone, tilt }: { label: string; value: ReactNode; tone: string; tilt: string }) {
  return (
    <div className={clsx('toon animate-rise rounded-2xl px-1 py-3', tone, tilt)}>
      <dt className="text-[11px] font-black uppercase tracking-wide text-ink/55">{label}</dt>
      <dd className="mt-1 font-display text-[20px] font-bold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.7,
        duration: 2.2 + Math.random() * 1.6,
        size: 7 + Math.random() * 6,
        drift: (Math.random() - 0.5) * 140,
        spin: 360 + Math.random() * 720,
        colour: SPARK_COLOURS[i % SPARK_COLOURS.length],
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 animate-confetti-fall rounded-[2px]"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.6,
              background: p.colour,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

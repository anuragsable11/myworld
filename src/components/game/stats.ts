/**
 * The flag quiz's progress on this device: the best round, points over all rounds (which earn a
 * rank), rounds played and a streak of days played in a row.
 */

const KEY = 'atlas:quiz';
/** Where an earlier version kept only the best round. */
const OLD_KEY = 'atlas:quiz-best';

export interface Round {
  score: number;
  xp: number;
}

export interface QuizStats {
  best: Round | null;
  totalXp: number;
  games: number;
  /** Days in a row with at least one round played. */
  dayStreak: number;
  lastDay: string | null;
}

const EMPTY: QuizStats = { best: null, totalXp: 0, games: 0, dayStreak: 0, lastDay: null };

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

export function readStats(): QuizStats {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return { ...EMPTY, ...JSON.parse(saved) };
    const old = JSON.parse(localStorage.getItem(OLD_KEY) ?? 'null');
    if (old && typeof old.score === 'number' && typeof old.xp === 'number') return { ...EMPTY, best: old, totalXp: old.xp, games: 1 };
  } catch {
    // Nothing saved, or it can't be read.
  }
  return { ...EMPTY };
}

/** Adds a finished round. */
export function recordRound(round: Round): { before: QuizStats; after: QuizStats; newBest: boolean } {
  const before = readStats();
  const now = new Date();
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const dayStreak = before.lastDay === today ? Math.max(1, before.dayStreak) : before.lastDay === yesterday ? before.dayStreak + 1 : 1;
  const better = !before.best || round.score > before.best.score || (round.score === before.best.score && round.xp > before.best.xp);
  const after: QuizStats = {
    best: better ? round : before.best,
    totalXp: before.totalXp + round.xp,
    games: before.games + 1,
    dayStreak,
    lastDay: today,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(after));
  } catch {
    // It simply isn't remembered.
  }
  return { before, after, newBest: better && round.score > 0 };
}

/** Whether no round has been finished here yet (the Play button wears a "new" sticker until then). */
export const quizIsNew = () => readStats().games === 0;

export const RANKS = [
  { min: 0, name: 'Flag Rookie', emoji: '🐣' },
  { min: 150, name: 'Flag Explorer', emoji: '🧭' },
  { min: 500, name: 'Flag Expert', emoji: '🎓' },
  { min: 1200, name: 'Flag Master', emoji: '🏅' },
  { min: 2500, name: 'Flag Legend', emoji: '👑' },
] as const;

/** The rank for a points total, the next one, and how far along the way to it (0–1). */
export function rankOf(totalXp: number) {
  let i = 0;
  while (i + 1 < RANKS.length && totalXp >= RANKS[i + 1].min) i++;
  const rank = RANKS[i];
  const next = RANKS[i + 1] ?? null;
  return { rank, next, progress: next ? (totalXp - rank.min) / (next.min - rank.min) : 1 };
}

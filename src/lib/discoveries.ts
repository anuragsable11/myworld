/**
 * The countries someone has opened, kept in this browser. The first visit to each country is a
 * small celebration, and the count grows towards every country on the map, with bigger ones at
 * milestones along the way.
 */

const KEY = 'atlas:discovered';

/** Counts that earn a bigger celebration (as does opening every country there is). */
export const MILESTONES = [5, 10, 25, 50, 100, 150, 200];

let found: ReadonlySet<string> = (() => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set<string>();
  }
})();
const listeners = new Set<() => void>();

/** The opened countries; a new set each time it grows, so it can be watched with useSyncExternalStore. */
export const discovered = () => found;

export function subscribeDiscoveries(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Records that a country was opened. `first` is true only the very first time. */
export function discover(id: string): { first: boolean; count: number } {
  if (found.has(id)) return { first: false, count: found.size };
  found = new Set(found).add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...found]));
  } catch {
    // It still counts for this visit; it just won't be remembered.
  }
  listeners.forEach((fn) => fn());
  return { first: true, count: found.size };
}

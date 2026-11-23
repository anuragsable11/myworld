import { useEffect, useState, type CSSProperties } from 'react';
import clsx from 'clsx';
import { Sparkles, Trophy } from 'lucide-react';

export interface Discovery {
  /** New for each celebration, so a fresh one restarts the toast. */
  key: number;
  name: string;
  count: number;
  total: number;
  /** A milestone (or the whole world): a bigger celebration. */
  milestone: boolean;
}

/** "New country discovered!": a glass toast with how many countries are explored so far. */
export function DiscoveryToast({ discovery, style }: { discovery: Discovery | null; style: CSSProperties }) {
  const [shown, setShown] = useState<Discovery | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!discovery) return;
    setShown(discovery);
    setLeaving(false);
    const hold = discovery.milestone ? 3800 : 2800;
    const leave = window.setTimeout(() => setLeaving(true), hold);
    const gone = window.setTimeout(() => setShown(null), hold + 320);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(gone);
    };
  }, [discovery]);

  if (!shown) return null;
  const everything = shown.count >= shown.total;
  const Icon = shown.milestone ? Trophy : Sparkles;
  return (
    <div role="status" className="pointer-events-none fixed z-[55] flex justify-center px-4" style={style}>
      <div
        key={shown.key}
        className={clsx(
          'glass w-[min(340px,100%)] rounded-[22px] p-3 pr-4',
          leaving ? '-translate-y-1.5 opacity-0 transition-[opacity,transform] duration-300' : 'animate-pop',
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={clsx(
              'grid size-10 shrink-0 place-items-center rounded-full text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.5)]',
              shown.milestone ? 'bg-[linear-gradient(160deg,#ffcc00,#ff9500)]' : 'bg-[linear-gradient(160deg,#64d2ff,#007aff)]',
            )}
          >
            <Icon aria-hidden className="size-5" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-label">
              {everything ? 'You explored the whole world!' : shown.milestone ? `${shown.count} countries explored!` : 'New country discovered!'}
            </span>
            <span className="tabular block truncate text-[13px] text-secondary">
              {shown.name} · {shown.count} of {shown.total} explored
            </span>
          </span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-control">
          <div className="h-full origin-left animate-grow rounded-full bg-tint" style={{ width: `${(shown.count / shown.total) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

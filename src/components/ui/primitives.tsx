import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={clsx('skeleton block rounded-md', className ?? 'h-4 w-24')} />;
}

export function Chip({
  children,
  onClick,
  title,
  tone = 'default',
  leading,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  tone?: 'default' | 'accent';
  leading?: ReactNode;
}) {
  const cls = clsx(
    'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] leading-tight',
    tone === 'accent'
      ? 'border-brass-500/30 bg-brass-400/10 text-brass-200'
      : 'border-white/[0.07] bg-white/[0.035] text-mist-200',
    onClick && 'transition-colors hover:border-brass-400/40 hover:bg-brass-400/10 hover:text-brass-200',
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} className={cls}>
        {leading}
        <span className="truncate">{children}</span>
      </button>
    );
  }
  return (
    <span title={title} className={cls}>
      {leading}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function ChipList({ items, limit = 18 }: { items: string[]; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, limit);
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((item) => {
        const short = item.replace(/\s*\([^)]*\)/g, '').trim() || item;
        return (
          <Chip key={item} title={short !== item ? item : undefined}>
            {short}
          </Chip>
        );
      })}
      {items.length > limit && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="rounded-full px-2.5 py-1 text-[12.5px] text-brass-300 hover:text-brass-200"
        >
          {all ? 'Show less' : `+${items.length - limit} more`}
        </button>
      )}
    </div>
  );
}

/** Long Factbook prose, clamped to a few lines with a toggle when it overflows. */
export function ExpandableText({ text, lines = 4 }: { text: string; lines?: number }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [text, open]);

  return (
    <div>
      <p
        ref={ref}
        className="whitespace-pre-line text-[13.5px] leading-relaxed text-mist-200"
        style={open ? undefined : { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines, overflow: 'hidden' }}
      >
        {text}
      </p>
      {(overflows || open) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-[12.5px] font-medium text-brass-300 hover:text-brass-200"
        >
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

export function Missing({ children = 'Not available' }: { children?: ReactNode }) {
  return <span className="text-[13px] italic text-mist-500">{children}</span>;
}

/** A labelled fact. `value === undefined` while `loading` shows a skeleton; otherwise "Not available". */
export function Fact({
  label,
  children,
  loading,
  hint,
  wide,
}: {
  label: string;
  children?: ReactNode;
  loading?: boolean;
  hint?: ReactNode;
  wide?: boolean;
}) {
  const empty = children === undefined || children === null || children === '' || children === false;
  return (
    <div className={clsx('min-w-0', wide && 'col-span-full')}>
      <dt className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-mist-500">{label}</dt>
      <dd className="text-[14px] leading-snug text-mist-100">
        {empty ? loading ? <Skeleton className="h-4 w-3/4 max-w-40" /> : <Missing /> : children}
        {!empty && hint && <div className="mt-0.5 text-[12px] leading-snug text-mist-400">{hint}</div>}
      </dd>
    </div>
  );
}

export function FactGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">{children}</dl>;
}

export function SubHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-6 flex items-baseline justify-between gap-3 first:mt-0">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mist-400">{children}</h4>
      {aside && <span className="text-[11.5px] text-mist-500">{aside}</span>}
    </div>
  );
}

/** Horizontal bars for shares and rankings (religions, cities, rivers). */
export function BarList({
  items,
  format,
  max,
}: {
  items: { key: string; label: ReactNode; value: number; detail?: ReactNode; highlight?: boolean }[];
  format: (v: number) => string;
  max?: number;
}) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.key} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
            <span
              title={typeof item.label === 'string' ? item.label : undefined}
              className={clsx('min-w-0 truncate', item.highlight ? 'text-brass-200' : 'text-mist-100')}
            >
              {item.label}
            </span>
            <span className="tabular shrink-0 text-[12.5px] text-mist-300">{format(item.value)}</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className={clsx('h-full rounded-full', item.highlight ? 'bg-brass-400' : 'bg-brass-400/55')}
              style={{ width: `${Math.max(2, (item.value / top) * 100)}%` }}
            />
          </div>
          {item.detail && <div className="mt-1 text-[11.5px] leading-snug text-mist-500">{item.detail}</div>}
        </li>
      ))}
    </ul>
  );
}

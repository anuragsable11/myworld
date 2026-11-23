import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { sounds } from '../../lib/sounds';
import { TONES, type Tone } from './tones';

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={clsx('skeleton block rounded-lg', className ?? 'h-4 w-24')} />;
}

export function Chip({
  children,
  onClick,
  title,
  leading,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  leading?: ReactNode;
}) {
  const cls = clsx(
    'inline-flex max-w-full items-center gap-1.5 rounded-full bg-control px-2.5 py-1 text-[13px] font-medium leading-snug text-label',
    onClick && 'ios-press hover:bg-control-strong',
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
          onClick={() => {
            sounds.tap();
            setAll((v) => !v);
          }}
          className="rounded-full px-2.5 py-1 text-[13px] font-semibold text-tint hover:opacity-70"
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
        className="whitespace-pre-line text-[15px] leading-relaxed text-label/90"
        style={open ? undefined : { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines, overflow: 'hidden' }}
      >
        {text}
      </p>
      {(overflows || open) && (
        <button
          type="button"
          onClick={() => {
            sounds.tap();
            setOpen((v) => !v);
          }}
          className="mt-1.5 text-[14px] font-semibold text-tint hover:opacity-70"
        >
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

export function Missing({ children = 'Not available' }: { children?: ReactNode }) {
  return <span className="text-[14px] text-tertiary">{children}</span>;
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
      <dt className="mb-0.5 text-[13px] text-secondary">{label}</dt>
      <dd className="text-[16px] font-medium leading-snug text-label">
        {empty ? loading ? <Skeleton className="h-4 w-3/4 max-w-40" /> : <Missing /> : children}
        {!empty && hint && <div className="mt-0.5 text-[13px] font-normal leading-snug text-secondary">{hint}</div>}
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
      <h4 className="text-[16px] font-semibold tracking-[-0.01em] text-label">{children}</h4>
      {aside && <span className="text-[12px] text-secondary">{aside}</span>}
    </div>
  );
}

/** Rounded bars for shares and rankings (religions, cities, rivers). */
export function BarList({
  items,
  format,
  max,
  tone = 'indigo',
}: {
  items: { key: string; label: ReactNode; value: number; detail?: ReactNode; highlight?: boolean }[];
  format: (v: number) => string;
  max?: number;
  tone?: Tone;
}) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 text-[15px]">
            <span title={typeof item.label === 'string' ? item.label : undefined} className="min-w-0 truncate font-medium text-label">
              {item.label}
            </span>
            <span className="tabular shrink-0 text-[13px] text-secondary">{format(item.value)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-control">
            <div
              className={clsx('h-full origin-left animate-grow rounded-full', item.highlight ? 'bg-tint' : TONES[tone].bar)}
              style={{ width: `${Math.max(4, (item.value / top) * 100)}%` }}
            />
          </div>
          {item.detail && <div className="mt-1 text-[12px] leading-snug text-secondary">{item.detail}</div>}
        </li>
      ))}
    </ul>
  );
}

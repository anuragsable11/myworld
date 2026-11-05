import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import clsx from 'clsx';

export const SHEET_PEEK_PX = 300;

/** Left drawer used for the country list on tablet and mobile. */
export function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={clsx(
          'fixed inset-0 z-40 bg-indigo-950/25 backdrop-blur-[3px] transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        aria-label="Countries"
        aria-hidden={!open}
        inert={!open}
        className={clsx(
          'toon-lg fixed inset-y-3 left-3 z-50 w-[min(84vw,340px)] overflow-hidden rounded-[28px] bg-white transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
          open ? 'translate-x-0' : '-translate-x-[110%]',
        )}
      >
        {children}
      </aside>
    </>
  );
}

/** Interactive elements inside the sheet keep their own taps. */
const isControl = (target: EventTarget | null) => target instanceof Element && !!target.closest('button, a, input, select, textarea, [role="button"]');

/**
 * Phone bottom sheet. It peeks with the country header just above the tab bar and slides up to
 * nearly full height when tapped or dragged, and slides away before it closes. It only ever moves
 * with transforms, so it glides at full frame rate. While it peeks, a drag anywhere on it moves it;
 * once open, the content scrolls and the handle moves it.
 */
export function BottomSheet({
  open,
  expanded,
  onExpandedChange,
  onDismiss,
  peek,
  bottom,
  children,
}: {
  open: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onDismiss: () => void;
  /** Height shown while it peeks. */
  peek: number;
  /** Space below it (the tab bar). */
  bottom: number;
  children: (handle: ReactNode) => ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; moved: number; active: boolean; pointer: number } | null>(null);

  // Slide in from below on open; slide out before unmounting on close.
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Reopened mid-exit: drop the swipe-away position.
      if (sheetRef.current) sheetRef.current.style.transform = '';
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
      return () => cancelAnimationFrame(frame);
    }
    setEntered(false);
    const timer = window.setTimeout(() => setMounted(false), 420);
    return () => window.clearTimeout(timer);
  }, [open]);

  const base = !entered ? '100%' : expanded ? '0px' : `calc(100% - ${peek}px)`;
  const place = (dy: number) => {
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(calc(${base} + ${dy}px))`;
  };

  const start = (e: React.PointerEvent, immediate: boolean) => {
    drag.current = { y: e.clientY, moved: 0, active: immediate, pointer: e.pointerId };
    if (immediate) {
      e.currentTarget.setPointerCapture(e.pointerId);
      if (sheetRef.current) sheetRef.current.style.transition = 'none';
    }
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    d.moved = e.clientY - d.y;
    if (!d.active) {
      // Taps on the header's buttons stay taps; only a real drag moves the sheet.
      if (Math.abs(d.moved) < 8) return;
      d.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      if (sheetRef.current) sheetRef.current.style.transition = 'none';
    }
    // Resist being pulled above its open height.
    place(expanded ? Math.max(d.moved, -12) : d.moved < 0 ? Math.max(d.moved, -window.innerHeight) : d.moved);
  };
  const end = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    const dismiss = d.active && d.moved > 60 && !expanded;
    if (sheetRef.current) {
      sheetRef.current.style.transition = '';
      // Swiped away: carry on down from where the finger let go, rather than first springing back.
      sheetRef.current.style.transform = dismiss ? 'translateY(100%)' : '';
    }
    if (!d.active) {
      // A tap: on the handle it toggles, on the peeking sheet it opens.
      if (e.type === 'pointerup' && !isControl(e.target)) onExpandedChange(!expanded);
      return;
    }
    if (dismiss) onDismiss();
    else if (d.moved < -40) onExpandedChange(true);
    else if (d.moved > 60) onExpandedChange(false);
  };

  if (!mounted) return null;

  const handle = (
    <div
      role="button"
      tabIndex={0}
      aria-label={expanded ? 'Collapse details' : 'Expand details'}
      onPointerDown={(e) => {
        e.stopPropagation();
        start(e, true);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onExpandedChange(!expanded)}
      className="flex shrink-0 cursor-grab touch-none justify-center bg-paper pb-1.5 pt-3"
    >
      <span className="h-2 w-12 rounded-full border-2 border-ink bg-sun" />
    </div>
  );

  return (
    <div
      ref={sheetRef}
      data-sheet={expanded ? 'open' : 'peek'}
      onPointerDown={expanded ? undefined : (e) => start(e, false)}
      onPointerMove={expanded ? undefined : move}
      onPointerUp={expanded ? undefined : end}
      onPointerCancel={expanded ? undefined : end}
      className={clsx(
        'sheet-height fixed inset-x-0 z-30 flex flex-col overflow-hidden rounded-t-[30px] border-x-[3px] border-t-[3px] border-ink bg-paper shadow-[0_-4px_0_0_rgba(30,27,75,0.15)] transition-transform duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform',
        !expanded && 'touch-none',
      )}
      style={{ bottom, '--sheet-gap': `${bottom}px`, transform: `translateY(${base})` } as CSSProperties}
    >
      {children(handle)}
    </div>
  );
}

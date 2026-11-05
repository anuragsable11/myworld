import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import clsx from 'clsx';
import { useCloseWatcher } from '../../hooks/useCloseWatcher';
import { haptics } from '../../lib/haptics';

export const SHEET_PEEK_PX = 300;

/** The curve iOS moves its sheets with: a quick start and a long, soft settle. */
const GLIDE = 'cubic-bezier(0.32, 0.72, 0, 1)';
/** How much faster than its average speed that curve starts out. */
const GLIDE_START = 0.72 / 0.32;
/**
 * The sheet reaches this far below its visible bottom edge, hidden behind the tab bar, so pulling it
 * up past its open height never opens a gap underneath.
 */
const OVERHANG = 40;

/**
 * How long a glide over `distance` px takes when it should start at the speed the finger let go at,
 * so a flick carries straight on. Slow releases take the usual time.
 */
function glideMs(distance: number, velocity: number, usual = 420) {
  if (Math.abs(velocity) < 0.05 || Math.sign(distance) !== Math.sign(velocity)) return usual;
  return Math.round(Math.min(usual, Math.max(180, (GLIDE_START * Math.abs(distance)) / Math.abs(velocity))));
}

/** Pulled past its end, a surface gives way less and less, as on iOS. */
const rubber = (overshoot: number, limit: number) =>
  Math.sign(overshoot) * limit * (1 - 1 / ((Math.abs(overshoot) * 0.55) / limit + 1));

/**
 * A finger's speed over its last ~80 ms, in px per ms. Times are the events' own time stamps, so a
 * busy moment on the page doesn't distort them.
 */
function velocityTracker() {
  const samples: { t: number; at: number }[] = [];
  return {
    add(at: number, t: number) {
      samples.push({ t, at });
      while (samples.length > 2 && t - samples[0].t > 80) samples.shift();
    },
    /** Zero if the finger came to rest before letting go at `t`. */
    get(t: number) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      if (!first || last.t === first.t || t - last.t > 80) return 0;
      return (last.at - first.at) / (last.t - first.t);
    },
  };
}

/** Whether a swipe to the left that starts on `target` should scroll something inside `root` instead. */
function scrollsLeft(target: EventTarget | null, root: Element) {
  for (let el = target instanceof Element ? target : null; el && el !== root; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1 && el.scrollLeft + el.clientWidth < el.scrollWidth - 1) {
      const { overflowX } = getComputedStyle(el);
      if (overflowX === 'auto' || overflowX === 'scroll') return true;
    }
  }
  return false;
}

/**
 * Left drawer used for the country list on tablet and mobile. Tapping outside, swiping it back to
 * the left or pressing back closes it.
 */
export function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useCloseWatcher(open, onClose);

  // Once it has slid away, its contents stop rendering (content-visibility: hidden), which also takes
  // them out of the tab order and the accessibility tree. Unlike `inert`, `visibility` or
  // `pointer-events`, switching that doesn't restyle the whole list, which would stall the first
  // frames of the slide. It starts out laid out (and asleep soon after), so even the first opening
  // is quick.
  const [asleep, setAsleep] = useState(false);
  useEffect(() => {
    if (open) {
      setAsleep(false);
      return;
    }
    // Close the keyboard now rather than when the drawer goes to sleep.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && panelRef.current?.contains(focused)) focused.blur();
    const timer = window.setTimeout(() => setAsleep(true), 460);
    return () => window.clearTimeout(timer);
  }, [open]);

  // The swipe follows the finger. It listens to touch events so the list inside still scrolls natively.
  useEffect(() => {
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    if (!open || !panel || !scrim) return;
    let mode: 'idle' | 'deciding' | 'dragging' = 'idle';
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let dx = 0;
    let velocity = velocityTracker();

    const onStart = (e: TouchEvent) => {
      mode = e.touches.length === 1 ? 'deciding' : 'idle';
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = e.timeStamp;
      dx = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (mode === 'idle') return;
      const touch = e.touches[0];
      dx = touch.clientX - x0;
      if (mode === 'deciding') {
        const dy = touch.clientY - y0;
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        // Only a mostly sideways swipe to the left, and not one meant to scroll a row of chips.
        if (dx >= 0 || -dx < Math.abs(dy) || !e.cancelable || scrollsLeft(e.target, panel)) {
          mode = 'idle';
          return;
        }
        mode = 'dragging';
        // From where the finger came down, so even a flick the browser reports as a single move
        // has a speed.
        velocity = velocityTracker();
        velocity.add(0, t0);
        panel.style.transition = 'none';
        scrim.style.transition = 'none';
      }
      e.preventDefault();
      velocity.add(dx, e.timeStamp);
      const x = dx < 0 ? dx : rubber(dx, 24);
      panel.style.transform = `translateX(${x}px)`;
      scrim.style.opacity = String(Math.max(0, 1 + x / panel.offsetWidth));
    };
    const onEnd = (e: TouchEvent) => {
      if (mode !== 'dragging') {
        mode = 'idle';
        return;
      }
      mode = 'idle';
      const width = panel.offsetWidth;
      const v = velocity.get(e.timeStamp);
      const x = Math.min(0, dx);
      // Closes once it's dragged, or flicked, most of the way out.
      const close = x + v * 200 < -width * 0.4;
      const ms = close ? glideMs(-width * 1.1 - x, v) : glideMs(-x, v, 360);
      panel.style.transition = `transform ${ms}ms ${GLIDE}, translate ${ms}ms ${GLIDE}`;
      scrim.style.transition = `opacity ${ms}ms ease`;
      // Hand the position back to the classes; the transition carries on from where the finger left it.
      panel.style.transform = '';
      scrim.style.opacity = '';
      window.setTimeout(() => {
        panel.style.transition = '';
        scrim.style.transition = '';
      }, ms + 40);
      if (close) {
        haptics.tap();
        closeRef.current();
      }
    };

    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: false });
    panel.addEventListener('touchend', onEnd);
    panel.addEventListener('touchcancel', onEnd);
    return () => {
      panel.removeEventListener('touchstart', onStart);
      panel.removeEventListener('touchmove', onMove);
      panel.removeEventListener('touchend', onEnd);
      panel.removeEventListener('touchcancel', onEnd);
    };
  }, [open]);

  return (
    <>
      {/* Above the tab bar, so a tap anywhere outside the drawer closes it. */}
      <div
        ref={scrimRef}
        aria-hidden
        onClick={onClose}
        className={clsx(
          'fixed inset-0 z-[45] bg-indigo-950/35 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        ref={panelRef}
        aria-label="Countries"
        aria-hidden={!open}
        className={clsx(
          'toon-lg fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-[max(12px,env(safe-area-inset-left))] top-[max(12px,env(safe-area-inset-top))] z-50 w-[min(84vw,340px)] overflow-hidden rounded-[28px] bg-white transition-transform duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]',
          open ? 'translate-x-0' : '-translate-x-[110%]',
          asleep && !open && '[content-visibility:hidden]',
        )}
      >
        {children}
      </aside>
    </>
  );
}

/** Interactive elements inside the sheet keep their own taps. */
const isControl = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest('button, a, input, select, textarea, [role="button"]');

interface SheetState {
  expanded: boolean;
  peek: number;
  onExpandedChange: (expanded: boolean) => void;
  onDismiss: () => void;
}

const peekTransform = (peek: number) => `translateY(calc(100% - ${peek + OVERHANG}px))`;

/**
 * Drags of the sheet, by pointer or by touch: it follows the finger, then glides on to the stop that
 * suits where it was let go and how fast it was moving.
 */
function sheetDragger(sheetRef: RefObject<HTMLDivElement | null>, latest: RefObject<SheetState>) {
  let drag: {
    start: number;
    /** Position when the drag began, in px down from the open position. */
    from: number;
    peekAt: number;
    height: number;
    offset: number;
    velocity: ReturnType<typeof velocityTracker>;
  } | null = null;
  let settle = 0;

  return {
    get active() {
      return !!drag;
    },
    /** `y` and `t`: where and when the finger came down. */
    begin(y: number, t: number) {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const height = sheet.offsetHeight;
      const peekAt = height - latest.current.peek - OVERHANG;
      drag = { start: y, from: latest.current.expanded ? 0 : peekAt, peekAt, height, offset: 0, velocity: velocityTracker() };
      // Counted from there, so even a flick the browser reports as a single move has a speed.
      drag.velocity.add(y, t);
      window.clearTimeout(settle);
      sheet.style.transition = 'none';
    },
    move(y: number, t: number) {
      const sheet = sheetRef.current;
      if (!drag || !sheet) return;
      drag.offset = y - drag.start;
      drag.velocity.add(y, t);
      const at = drag.from + drag.offset;
      // Above its open height the sheet gives way less and less.
      sheet.style.transform = `translateY(${at < 0 ? rubber(at, OVERHANG) : at}px)`;
    },
    end(t: number) {
      const sheet = sheetRef.current;
      const d = drag;
      drag = null;
      if (!d || !sheet) return;
      const { expanded, peek, onExpandedChange, onDismiss } = latest.current;
      const v = d.velocity.get(t);
      const at = Math.max(0, d.from + d.offset);
      // Where a flick would carry it decides the stop, so short fast swipes work as well as long drags.
      const aim = at + v * 200;
      const stop = expanded
        ? aim > d.peekAt + 80
          ? 'gone'
          : aim > Math.min(120, d.peekAt * 0.3)
            ? 'peek'
            : 'open'
        : aim < d.peekAt - 60
          ? 'open'
          : aim > d.peekAt + 60
            ? 'gone'
            : 'peek';
      const to = stop === 'open' ? 0 : stop === 'peek' ? d.peekAt : d.height;
      const ms = glideMs(to - at, v);
      sheet.style.transition = `transform ${ms}ms ${GLIDE}`;
      // The same values the sheet renders for each stop, so it carries on from here without a jump.
      sheet.style.transform = stop === 'open' ? 'translateY(0px)' : stop === 'peek' ? peekTransform(peek) : 'translateY(100%)';
      settle = window.setTimeout(() => {
        sheet.style.transition = '';
      }, ms + 40);
      if (stop === (expanded ? 'open' : 'peek')) return;
      haptics.tap();
      if (stop === 'gone') onDismiss();
      else onExpandedChange(stop === 'open');
    },
  };
}

/**
 * Phone bottom sheet. It peeks with the country header just above the tab bar and slides up to
 * nearly full height when tapped, dragged or flicked, and slides away before it closes. It only ever
 * moves with transforms, so it glides at full frame rate. While it peeks, a drag anywhere on it moves
 * it; once open, the content scrolls, and the handle, or pulling down from the top of the content,
 * moves it. Back collapses it.
 *
 * Opening and closing it changes no styles inside it (no touch-action or overflow switching), since
 * each such switch makes the browser restyle every element in the profile and stalls the slide.
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
  /** Renders the content, given the drag handle to put at its top. */
  children: (handle: ReactNode) => ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const latest = useRef<SheetState>({ expanded, peek, onExpandedChange, onDismiss });
  latest.current = { expanded, peek, onExpandedChange, onDismiss };
  const [drag] = useState(() => sheetDragger(sheetRef, latest));
  /** A mouse or pen press that may turn into a drag. */
  const press = useRef<{ id: number; y: number; t: number; dragging: boolean } | null>(null);
  /** After a mouse drag the browser still sends a click; it isn't a tap. */
  const ignoreClickUntil = useRef(0);
  useCloseWatcher(open && expanded, () => onExpandedChange(false));

  // Slide in from below on open; slide out before unmounting on close.
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Reopened mid-exit: start again from below, where the sheet renders before it enters.
      const sheet = sheetRef.current;
      if (sheet) {
        sheet.style.transition = '';
        sheet.style.transform = 'translateY(100%)';
      }
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
      return () => cancelAnimationFrame(frame);
    }
    setEntered(false);
    const timer = window.setTimeout(() => setMounted(false), 460);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Collapsing brings the profile's header back into the peek.
  useEffect(() => {
    if (!expanded) sheetRef.current?.querySelector('[data-sheet-scroll]')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [expanded]);

  // Fingers. While the sheet peeks, a vertical drag anywhere on it moves it. Once open, the content
  // scrolls natively; the handle moves the sheet, and so does pulling down from the top of the
  // content. Touch events rather than pointer events, because only they can take a drag over before
  // the browser starts scrolling, which spares the sheet from switching `touch-action`.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    /** `swallowing`: a sideways swipe on a peeking sheet, which must not scroll its hidden content. */
    let mode: 'idle' | 'deciding' | 'dragging' | 'swallowing' = 'idle';
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    /** Started in the open sheet's content, at its top: only a pull down moves the sheet. */
    let pullOnly = false;
    let scroller: HTMLElement | null = null;

    const onStart = (e: TouchEvent) => {
      mode = 'idle';
      const target = e.target instanceof Element ? e.target : null;
      if (e.touches.length !== 1 || drag.active || !target || target.closest('dialog')) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = e.timeStamp;
      scroller = target.closest<HTMLElement>('[data-sheet-scroll]');
      pullOnly = latest.current.expanded && !!scroller;
      // Further down the open content, a pull just scrolls back up.
      if (!pullOnly || scroller!.scrollTop <= 0) mode = 'deciding';
    };
    const onMove = (e: TouchEvent) => {
      if (mode === 'idle') return;
      if (mode === 'swallowing') {
        if (e.cancelable) e.preventDefault();
        return;
      }
      const touch = e.touches[0];
      const dy = touch.clientY - y0;
      if (mode === 'deciding') {
        const dx = touch.clientX - x0;
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (!e.cancelable) {
          mode = 'idle';
          return;
        }
        if (Math.abs(dy) <= Math.abs(dx) || (pullOnly && dy <= 0)) {
          // In the open content that's a scroll (or a row of tabs or photos sliding sideways); on a
          // peeking sheet nothing should move at all.
          mode = pullOnly ? 'idle' : 'swallowing';
          if (mode === 'swallowing') e.preventDefault();
          return;
        }
        mode = 'dragging';
        drag.begin(y0, t0);
      }
      e.preventDefault();
      if (pullOnly && scroller) {
        // Pushed back up past where it started: scroll the content instead.
        scroller.scrollTop = Math.max(0, -dy);
        drag.move(Math.max(y0, touch.clientY), e.timeStamp);
      } else drag.move(touch.clientY, e.timeStamp);
    };
    const onEnd = (e: TouchEvent) => {
      if (mode === 'dragging') drag.end(e.timeStamp);
      mode = 'idle';
    };
    // While it peeks, a mouse wheel doesn't scroll the hidden content; scrolling down opens it.
    const onWheel = (e: WheelEvent) => {
      if (latest.current.expanded) return;
      e.preventDefault();
      if (e.deltaY > 0) latest.current.onExpandedChange(true);
    };

    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', onEnd);
    sheet.addEventListener('touchcancel', onEnd);
    sheet.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', onEnd);
      sheet.removeEventListener('touchcancel', onEnd);
      sheet.removeEventListener('wheel', onWheel);
    };
  }, [mounted, drag]);

  // A mouse or pen: drags anywhere on a peeking sheet, and on the handle once it's open.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || !e.isPrimary || drag.active) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target || target.closest('dialog') || (expanded && !target.closest('[data-sheet-handle]'))) return;
    press.current = { id: e.pointerId, y: e.clientY, t: e.timeStamp, dragging: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (!p.dragging) {
      // Clicks stay clicks; only a real drag moves the sheet.
      if (Math.abs(e.clientY - p.y) < 8) return;
      p.dragging = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.begin(p.y, p.t);
    }
    drag.move(e.clientY, e.timeStamp);
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    if (!p.dragging) return;
    drag.end(e.timeStamp);
    ignoreClickUntil.current = performance.now() + 400;
  };
  // Taps and clicks: the handle toggles; the rest of a peeking sheet, apart from its buttons, opens it.
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (performance.now() < ignoreClickUntil.current) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target || target.closest('dialog')) return;
    if (target.closest('[data-sheet-handle]') || (!expanded && !isControl(target))) {
      haptics.tap();
      onExpandedChange(!expanded);
    }
  };

  if (!mounted) return null;

  const base = !entered ? '100%' : expanded ? '0px' : `calc(100% - ${peek + OVERHANG}px)`;

  const handle = (
    <div
      role="button"
      tabIndex={0}
      data-sheet-handle
      aria-label={expanded ? 'Collapse details' : 'Expand details'}
      aria-expanded={expanded}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onExpandedChange(!expanded);
      }}
      className="flex shrink-0 cursor-grab touch-none justify-center bg-paper pb-2 pt-3 active:cursor-grabbing"
    >
      <span className="h-2 w-12 rounded-full border-2 border-ink bg-sun" />
    </div>
  );

  return (
    <div
      ref={sheetRef}
      data-sheet={expanded ? 'open' : 'peek'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClick={onClick}
      className="sheet-height fixed inset-x-0 z-30 flex touch-manipulation flex-col overflow-hidden rounded-t-[30px] border-x-[3px] border-t-[3px] border-ink bg-paper shadow-[0_-4px_0_0_rgba(30,27,75,0.15)] transition-transform duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform"
      style={{ bottom: bottom - OVERHANG, '--sheet-gap': `${bottom - OVERHANG}px`, transform: `translateY(${base})` } as CSSProperties}
    >
      {children(handle)}
    </div>
  );
}

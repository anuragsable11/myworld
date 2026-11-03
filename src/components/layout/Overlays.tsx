import { useRef, type ReactNode } from 'react';
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
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        aria-label="Countries"
        aria-hidden={!open}
        inert={!open}
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-[min(88vw,340px)] border-r border-white/[0.07] bg-ink-900 shadow-2xl shadow-black/60 transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {children}
      </aside>
    </>
  );
}

/** Mobile bottom sheet: peeks with the country header, drags or taps up to full height. */
export function BottomSheet({
  expanded,
  onExpandedChange,
  onDismiss,
  children,
}: {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onDismiss: () => void;
  children: (handle: ReactNode) => ReactNode;
}) {
  const drag = useRef<{ y: number; moved: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, moved: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !sheetRef.current) return;
    drag.current.moved = e.clientY - drag.current.y;
    sheetRef.current.style.transform = `translateY(${Math.max(expanded ? 0 : -40, drag.current.moved)}px)`;
  };
  const onPointerUp = () => {
    const moved = drag.current?.moved ?? 0;
    drag.current = null;
    if (sheetRef.current) {
      sheetRef.current.style.transition = '';
      sheetRef.current.style.transform = '';
    }
    if (Math.abs(moved) < 6) onExpandedChange(!expanded);
    else if (moved < -40) onExpandedChange(true);
    else if (moved > 60) (expanded ? onExpandedChange(false) : onDismiss());
  };

  const handle = (
    <div
      role="button"
      tabIndex={0}
      aria-label={expanded ? 'Collapse details' : 'Expand details'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onExpandedChange(!expanded)}
      className="flex shrink-0 cursor-grab touch-none justify-center bg-ink-900 pb-1 pt-2.5"
    >
      <span className="h-1 w-10 rounded-full bg-white/20" />
    </div>
  );

  return (
    <div
      ref={sheetRef}
      className="fixed inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-2xl border-t border-white/10 shadow-[0_-12px_40px_rgba(0,0,0,0.55)] transition-[height,transform] duration-300 ease-out"
      style={{ height: expanded ? 'calc(100dvh - 72px)' : SHEET_PEEK_PX }}
    >
      {children(handle)}
    </div>
  );
}

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
      className="flex shrink-0 cursor-grab touch-none justify-center bg-paper pb-1.5 pt-3"
    >
      <span className="h-2 w-12 rounded-full border-2 border-ink bg-sun" />
    </div>
  );

  return (
    <div
      ref={sheetRef}
      className="fixed inset-x-0 bottom-0 z-30 flex animate-rise flex-col overflow-hidden rounded-t-[30px] border-x-[3px] border-t-[3px] border-ink bg-paper shadow-[0_-4px_0_0_rgba(30,27,75,0.15)] transition-[height,transform] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
      style={{ height: expanded ? 'calc(100dvh - 72px)' : SHEET_PEEK_PX }}
    >
      {children(handle)}
    </div>
  );
}

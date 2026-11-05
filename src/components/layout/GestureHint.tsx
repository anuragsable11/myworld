import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { ViewMode } from '../map/MapStage';

const KEY = 'atlas:hinted';

function seen() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function remember() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // It may show once more next time.
  }
}

/**
 * A one-time tip on phones and tablets: how to move the map and open a country. It shows a moment
 * after the map first appears and goes away for good at the first touch.
 */
export function GestureHint({ ready, view, top }: { ready: boolean; view: ViewMode; top: number }) {
  const [phase, setPhase] = useState<'off' | 'on' | 'leaving'>('off');
  const done = useRef(seen());

  useEffect(() => {
    if (!ready || done.current) return;
    const timer = window.setTimeout(() => setPhase('on'), 1400);
    return () => window.clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (phase !== 'on') return;
    const hide = () => {
      done.current = true;
      remember();
      setPhase('leaving');
    };
    if (!ready) return hide();
    const timer = window.setTimeout(hide, 9000);
    window.addEventListener('pointerdown', hide, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', hide, true);
    };
  }, [phase, ready]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const timer = window.setTimeout(() => setPhase('off'), 320);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === 'off') return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-20 flex justify-center px-4" style={{ top }} role="status">
      <p
        className={clsx(
          'toon-sm flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13.5px] font-extrabold text-ink',
          phase === 'on' ? 'animate-pop' : 'opacity-0 transition-opacity duration-300',
        )}
      >
        <span aria-hidden className="inline-block animate-nudge text-[18px] leading-none">
          👆
        </span>
        {view === 'globe' ? 'Drag to spin the globe' : 'Drag to move the map'} · Tap a country
      </p>
    </div>
  );
}

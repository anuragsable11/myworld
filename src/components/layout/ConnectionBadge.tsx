import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useOnline } from '../../hooks/usePwa';

/** A sticker that appears while offline, and briefly once the connection is back. */
export function ConnectionBadge() {
  const online = useOnline();
  const wasOnline = useRef(online);
  const [reconnected, setReconnected] = useState(false);

  useEffect(() => {
    const was = wasOnline.current;
    wasOnline.current = online;
    if (!online || was) return;
    setReconnected(true);
    const timer = setTimeout(() => setReconnected(false), 3000);
    return () => clearTimeout(timer);
  }, [online]);

  return (
    <div role="status" className="pointer-events-none">
      {(!online || reconnected) && (
        <span
          className={clsx(
            'toon-sm inline-flex -rotate-2 animate-pop items-center gap-1.5 rounded-full px-3.5 py-1 text-[13px] font-extrabold',
            online ? 'bg-emerald-200 text-ink' : 'bg-ink text-white',
          )}
        >
          {online ? (
            <>
              <span aria-hidden>🎉</span> Back online!
            </>
          ) : (
            <>
              <span aria-hidden>📴</span> Offline mode
              <span className="hidden font-semibold text-white/75 min-[380px]:inline">· saved countries still work</span>
            </>
          )}
        </span>
      )}
    </div>
  );
}

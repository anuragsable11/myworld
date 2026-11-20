import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Wifi, WifiOff } from 'lucide-react';
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
            'inline-flex animate-pop items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgb(0_0_0/0.15)] backdrop-blur-xl',
            online ? 'bg-ios-green/90' : 'bg-black/70',
          )}
        >
          {online ? (
            <>
              <Wifi aria-hidden className="size-4" strokeWidth={2.4} /> Back online
            </>
          ) : (
            <>
              <WifiOff aria-hidden className="size-4" strokeWidth={2.4} /> Offline
              <span className="hidden font-normal text-white/75 min-[380px]:inline">· saved countries still work</span>
            </>
          )}
        </span>
      )}
    </div>
  );
}

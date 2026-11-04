import { useEffect, useState } from 'react';

const currentMinute = () => Math.floor(Date.now() / 60_000);

/** The current minute since the epoch, updating while `enabled` (drives the live day/night shading). */
export function useMinute(enabled: boolean): number {
  const [minute, setMinute] = useState(currentMinute);
  useEffect(() => {
    if (!enabled) return;
    setMinute(currentMinute());
    const timer = setInterval(() => setMinute(currentMinute()), 15_000);
    return () => clearInterval(timer);
  }, [enabled]);
  return minute;
}

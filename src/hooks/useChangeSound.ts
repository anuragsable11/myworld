import { useEffect, useRef } from 'react';

/**
 * Plays a sound when `value` changes (never when it first appears): `onTrue` as it turns true,
 * `onFalse` as it turns false, for example a dialog's opening and closing. Remembering the last
 * value keeps React's doubled effects in development from playing anything twice.
 */
export function useChangeSound(value: boolean, onTrue: () => void, onFalse: () => void) {
  const last = useRef(value);
  const play = useRef({ onTrue, onFalse });
  play.current = { onTrue, onFalse };
  useEffect(() => {
    if (last.current === value) return;
    last.current = value;
    if (value) play.current.onTrue();
    else play.current.onFalse();
  }, [value]);
}

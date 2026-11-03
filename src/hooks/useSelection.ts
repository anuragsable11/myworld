import { useCallback, useEffect, useState } from 'react';

const parse = (hash: string) => /^#\/([A-Za-z]{3})$/.exec(hash)?.[1].toUpperCase() ?? null;

/** The selected country lives in the URL hash (#/FRA) so it can be shared and survives reloads. */
export function useSelection() {
  const [selectedId, setSelectedId] = useState(() => parse(window.location.hash));

  useEffect(() => {
    const sync = () => setSelectedId(parse(window.location.hash));
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const select = useCallback((id: string | null) => {
    const hash = id ? `#/${id}` : '';
    if (hash !== window.location.hash) {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    }
    setSelectedId(id);
  }, []);

  return [selectedId, select] as const;
}

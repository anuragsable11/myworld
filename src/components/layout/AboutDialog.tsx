import { useEffect, useRef } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import type { CountryIndex } from '../../hooks/queries';

const SOURCES = [
  {
    name: 'REST Countries',
    href: 'https://restcountries.com',
    what: 'Names, codes, capitals, languages, currencies, calling codes, domains, time zones, borders, area and population.',
  },
  {
    name: 'mledoze/countries',
    href: 'https://github.com/mledoze/countries',
    what: 'The open dataset REST Countries was built on; used when no REST Countries API key is configured.',
  },
  {
    name: 'CIA World Factbook',
    href: 'https://github.com/factbook/factbook.json',
    what: 'Government, independence, land boundaries, rivers, climate, terrain, resources, religions, industries and cities.',
  },
  {
    name: 'Wikidata',
    href: 'https://www.wikidata.org',
    what: 'Current heads of state and government, national anthems and their recordings.',
  },
  { name: 'Wikipedia', href: 'https://en.wikipedia.org', what: 'Country overviews.' },
  { name: 'World Bank', href: 'https://data.worldbank.org', what: 'GDP, GDP per capita, growth and population.' },
  {
    name: 'Natural Earth',
    href: 'https://www.naturalearthdata.com',
    what: 'Country boundaries (1:50m) and notable peaks and mountain ranges.',
  },
];

export function AboutDialog({ open, onClose, index }: { open: boolean; onClose: () => void; index: CountryIndex | undefined }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(92vw,560px)] rounded-2xl border border-white/10 bg-ink-900 p-0 text-mist-200 shadow-2xl shadow-black/60 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="max-h-[85dvh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-[22px] font-medium text-mist-50">About this atlas</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-mist-400">
              Every country profile is assembled live from public sources. Nothing is written by hand for individual
              countries.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-mist-400 hover:bg-white/5 hover:text-mist-100"
          >
            <X className="size-4" />
          </button>
        </div>

        {index && (
          <div className="mt-5 rounded-xl border border-white/[0.07] bg-ink-850 p-4 text-[13px]">
            <div className="font-medium text-mist-100">
              Country records:{' '}
              {index.provider === 'restcountries' ? 'REST Countries v5 API' : 'open mledoze/countries dataset'}
            </div>
            {index.notice && <p className="mt-1 leading-relaxed text-mist-400">{index.notice}</p>}
            {index.provider === 'open' && (
              <p className="mt-2 leading-relaxed text-mist-500">
                To use the REST Countries API, set <code className="text-brass-300">VITE_RESTCOUNTRIES_API_KEY</code> in{' '}
                <code className="text-brass-300">.env</code> and allow this site's hostname for the key.
              </p>
            )}
          </div>
        )}

        <ul className="mt-5 divide-y divide-white/[0.06]">
          {SOURCES.map((s) => (
            <li key={s.name} className="py-3">
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[13.5px] font-medium text-mist-100 hover:text-brass-300"
              >
                {s.name}
                <ArrowUpRight className="size-3.5" />
              </a>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-mist-400">{s.what}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] leading-relaxed text-mist-500">
          Boundaries follow Natural Earth's de facto conventions and do not imply endorsement of any territorial claim.
        </p>
      </div>
    </dialog>
  );
}

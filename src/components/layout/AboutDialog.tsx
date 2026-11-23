import { useEffect, useRef, useSyncExternalStore } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import type { CountryIndex } from '../../hooks/queries';
import { useChangeSound } from '../../hooks/useChangeSound';
import { haptics, hapticsEnabled, hapticsSupported, setHapticsEnabled, subscribeHaptics } from '../../lib/haptics';
import { setSoundEnabled, soundEnabled, sounds, subscribeSound } from '../../lib/sounds';
import { InstallCard } from './Install';

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
  {
    name: 'Wikipedia',
    href: 'https://en.wikipedia.org',
    what: 'Country overviews, the photos each country’s article uses, and the lists of national animals, birds, flowers, trees and dishes.',
  },
  {
    name: 'Wikimedia Commons',
    href: 'https://commons.wikimedia.org',
    what: 'The photos themselves, all freely licensed. Open one to see who took it and under which licence.',
  },
  { name: 'World Bank', href: 'https://data.worldbank.org', what: 'GDP, GDP per capita, growth and population.' },
  {
    name: 'Natural Earth',
    href: 'https://www.naturalearthdata.com',
    what: 'Country boundaries (1:50m) and notable peaks and mountain ranges.',
  },
];

export function AboutDialog({ open, onClose, index }: { open: boolean; onClose: () => void; index: CountryIndex | undefined }) {
  const ref = useRef<HTMLDialogElement>(null);
  useChangeSound(open, sounds.open, sounds.close);

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
      // An iOS sheet with Settings-style grouped cards.
      className="m-auto w-[min(92vw,560px)] animate-pop rounded-[30px] border-0 bg-[rgb(242_242_247/0.9)] p-0 text-label shadow-[0_24px_70px_rgb(0_0_0/0.3)] backdrop-blur-2xl backdrop-saturate-150 backdrop:bg-black/30 backdrop:backdrop-blur-sm"
    >
      <div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="ios-title text-[28px]">About This Atlas</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-secondary">
              Every country profile is assembled live from public sources. Nothing is written by hand for individual
              countries.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ios-press grid size-9 shrink-0 place-items-center rounded-full bg-control text-label hover:bg-control-strong"
          >
            <X className="size-[18px]" strokeWidth={2.6} />
          </button>
        </div>

        {index && (
          <div className="mt-5 rounded-[18px] bg-white/85 p-4 text-[14px]">
            <div className="font-semibold text-label">
              Country records:{' '}
              {index.provider === 'restcountries' ? 'REST Countries v5 API' : 'open mledoze/countries dataset'}
            </div>
            {index.notice && <p className="mt-1 leading-relaxed text-secondary">{index.notice}</p>}
            {index.provider === 'open' && (
              <p className="mt-2 leading-relaxed text-secondary">
                To use the REST Countries API, set <code className="font-medium text-tint">VITE_RESTCOUNTRIES_API_KEY</code> in{' '}
                <code className="font-medium text-tint">.env</code> and allow this site's hostname for the key.
              </p>
            )}
          </div>
        )}

        <InstallCard />
        <div className="mt-5 divide-y divide-hairline rounded-[18px] bg-white/85 px-4">
          <SoundSetting />
          <VibrationSetting />
        </div>

        <h3 className="mb-2 ml-4 mt-6 text-[13px] font-semibold uppercase tracking-[0.04em] text-secondary">Data sources</h3>
        <ul className="divide-y divide-hairline rounded-[18px] bg-white/85 px-4">
          {SOURCES.map((s) => (
            <li key={s.name} className="py-3">
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[16px] font-semibold text-tint hover:opacity-70"
              >
                {s.name}
                <ArrowUpRight className="size-4" strokeWidth={2.3} />
              </a>
              <p className="mt-0.5 text-[13px] leading-relaxed text-secondary">{s.what}</p>
            </li>
          ))}
        </ul>
        <p className="mx-4 mt-3 text-[12px] leading-relaxed text-secondary">
          Boundaries follow Natural Earth's de facto conventions, except India, which is drawn as on the Government of
          India's official map: all of Jammu and Kashmir and Ladakh, including Gilgit-Baltistan, Aksai Chin and the
          Shaksgam valley.
        </p>
      </div>
    </dialog>
  );
}

function SoundSetting() {
  const on = useSyncExternalStore(subscribeSound, soundEnabled, () => true);
  return (
    <SettingSwitch
      title="Sounds"
      detail="Clicks as the globe turns, a whoosh and a chime when you shuffle, pops on buttons."
      on={on}
      onChange={(next) => {
        // The switch is heard either way: before muting, or once sound is back on.
        if (!next) sounds.toggle(false);
        setSoundEnabled(next);
        if (next) sounds.toggle(true);
      }}
    />
  );
}

/** Only on phones and tablets that can vibrate. */
function VibrationSetting() {
  const on = useSyncExternalStore(subscribeHaptics, hapticsEnabled, () => true);
  if (!hapticsSupported || !window.matchMedia('(pointer: coarse)').matches) return null;
  return (
    <SettingSwitch
      title="Vibration"
      detail="A tick as the globe turns under your finger or spins, and a bump when it lands."
      on={on}
      onChange={(next) => {
        sounds.toggle(next);
        setHapticsEnabled(next);
        if (next) haptics.select();
      }}
    />
  );
}

function SettingSwitch({ title, detail, on, onChange }: { title: string; detail: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3.5">
      <span>
        <span className="block text-[16px] font-medium text-label">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-secondary">{detail}</span>
      </span>
      {/* The iOS switch: green when on, a white knob with a soft shadow */}
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="relative h-[31px] w-[51px] shrink-0 cursor-pointer appearance-none rounded-full bg-[rgb(120_120_128/0.2)] transition-colors duration-300 before:absolute before:left-[2px] before:top-[2px] before:size-[27px] before:rounded-full before:bg-white before:shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06)] before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.32,0.72,0,1)] checked:bg-ios-green checked:before:translate-x-5"
      />
    </label>
  );
}

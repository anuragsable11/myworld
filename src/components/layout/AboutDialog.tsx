import { useEffect, useRef, useSyncExternalStore } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import type { CountryIndex } from '../../hooks/queries';
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
      className="toon-lg m-auto w-[min(92vw,560px)] animate-pop rounded-[28px] bg-paper p-0 text-slate-700 backdrop:bg-indigo-950/30 backdrop:backdrop-blur-sm"
    >
      <div className="max-h-[85dvh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="toon-title text-[28px]">About this atlas 📚</h2>
            <p className="mt-1.5 text-[14px] font-semibold leading-relaxed text-slate-600">
              Every country profile is assembled live from public sources. Nothing is written by hand for individual
              countries.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="toon-sm toon-press-sm grid size-10 shrink-0 place-items-center rounded-full bg-white text-ink hover:bg-pink-200"
          >
            <X className="size-4" />
          </button>
        </div>

        {index && (
          <div className="toon mt-5 rounded-2xl bg-sky-100 p-4 text-[13.5px]">
            <div className="font-extrabold text-ink">
              Country records:{' '}
              {index.provider === 'restcountries' ? 'REST Countries v5 API' : 'open mledoze/countries dataset'}
            </div>
            {index.notice && <p className="mt-1 font-semibold leading-relaxed text-ink/70">{index.notice}</p>}
            {index.provider === 'open' && (
              <p className="mt-2 font-semibold leading-relaxed text-ink/60">
                To use the REST Countries API, set <code className="font-semibold text-indigo-700">VITE_RESTCOUNTRIES_API_KEY</code> in{' '}
                <code className="font-semibold text-indigo-700">.env</code> and allow this site's hostname for the key.
              </p>
            )}
          </div>
        )}

        <InstallCard />
        <div className="toon mt-5 divide-y-2 divide-dashed divide-indigo-100 rounded-2xl bg-white px-4">
          <SoundSetting />
          <VibrationSetting />
        </div>

        <ul className="mt-5 divide-y-2 divide-dashed divide-indigo-100">
          {SOURCES.map((s) => (
            <li key={s.name} className="py-3">
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-display text-[16px] font-semibold text-ink hover:text-indigo-600"
              >
                {s.name}
                <ArrowUpRight className="size-3.5" />
              </a>
              <p className="mt-0.5 text-[13px] font-semibold leading-relaxed text-slate-500">{s.what}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] font-semibold leading-relaxed text-slate-400">
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
      title="🔊 Sounds"
      detail="Clicks as the globe turns, a whoosh and a chime when you shuffle, pops on buttons."
      on={on}
      onChange={(next) => {
        setSoundEnabled(next);
        if (next) sounds.pop();
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
      title="📳 Vibration"
      detail="A tick as the globe turns under your finger or spins, and a bump when it lands."
      on={on}
      onChange={(next) => {
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
        <span className="block font-display text-[16px] font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] font-semibold leading-snug text-slate-500">{detail}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-ink bg-slate-200 transition-colors duration-300 before:absolute before:left-0.5 before:top-0.5 before:size-5 before:rounded-full before:border-2 before:border-ink before:bg-white before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.34,1.56,0.64,1)] checked:bg-emerald-400 checked:before:translate-x-5"
      />
    </label>
  );
}

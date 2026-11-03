import clsx from 'clsx';
import { Info, Search } from 'lucide-react';
import type { CountryProviderId } from '../../types';

interface HeaderProps {
  provider: CountryProviderId | undefined;
  showSearchButton: boolean;
  onOpenSearch: () => void;
  onOpenAbout: () => void;
}

export function Header({ provider, showSearchButton, onOpenSearch, onOpenAbout }: HeaderProps) {
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-ink-900 px-3 sm:px-4">
      {showSearchButton && (
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search countries"
          className="grid size-9 place-items-center rounded-lg border border-white/[0.08] text-mist-300 hover:bg-white/5 hover:text-mist-50"
        >
          <Search className="size-4" />
        </button>
      )}
      <a href="#" className="flex items-center gap-2.5" aria-label="World Atlas home">
        <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
          <circle cx="16" cy="16" r="12.5" fill="none" stroke="#d9b26f" strokeWidth="1.6" />
          <ellipse cx="16" cy="16" rx="5.5" ry="12.5" fill="none" stroke="#d9b26f" strokeWidth="1.3" />
          <path d="M4 12.2h24M4 19.8h24" stroke="#d9b26f" strokeWidth="1.3" />
        </svg>
        <span className="leading-none">
          <span className="block font-display text-[18px] font-medium tracking-tight text-mist-50">World Atlas</span>
          <span className="mt-0.5 hidden text-[10.5px] uppercase tracking-[0.16em] text-mist-500 sm:block">
            Countries explorer
          </span>
        </span>
      </a>

      <div className="ml-auto flex items-center gap-2">
        {provider && (
          <button
            type="button"
            onClick={onOpenAbout}
            className="hidden items-center gap-2 rounded-full border border-white/[0.08] px-3 py-1 text-[11.5px] text-mist-400 transition-colors hover:text-mist-200 sm:flex"
          >
            <span
              className={clsx('size-1.5 rounded-full', provider === 'restcountries' ? 'bg-emerald-400' : 'bg-brass-400')}
            />
            {provider === 'restcountries' ? 'REST Countries API' : 'Open country dataset'}
          </button>
        )}
        <button
          type="button"
          onClick={onOpenAbout}
          aria-label="About this atlas and its data sources"
          className="grid size-9 place-items-center rounded-lg text-mist-400 hover:bg-white/5 hover:text-mist-100"
        >
          <Info className="size-[18px]" />
        </button>
      </div>
    </header>
  );
}

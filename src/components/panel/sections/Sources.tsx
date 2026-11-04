import { ArrowUpRight } from 'lucide-react';
import { factbookPageUrl } from '../../../lib/sources/factbook';
import { worldBankCountryUrl } from '../../../lib/sources/worldBank';
import type { CountryDetails } from '../details';

export function Sources({ country, index, wikidata, wikipedia }: CountryDetails) {
  const links = [
    index.provider === 'restcountries'
      ? { label: 'REST Countries', href: 'https://restcountries.com' }
      : { label: 'mledoze/countries (open data)', href: 'https://github.com/mledoze/countries' },
    { label: 'CIA World Factbook', href: factbookPageUrl(country.cca3) },
    { label: 'Wikidata', href: wikidata.data ? `https://www.wikidata.org/wiki/${wikidata.data.id}` : undefined },
    { label: 'Wikipedia', href: wikipedia.data?.url },
    { label: 'Wikimedia Commons (photos)', href: 'https://commons.wikimedia.org' },
    { label: 'World Bank', href: worldBankCountryUrl(country.cca3) },
    { label: 'Natural Earth', href: 'https://www.naturalearthdata.com' },
  ].filter((l): l is { label: string; href: string } => !!l.href);

  return (
    <footer className="px-1 pb-2 pt-1 text-[11.5px] leading-relaxed text-slate-400">
      <p>
        Figures come from several independent sources and can differ in date and method. Population, GDP and leaders update
        live; boundaries follow Natural Earth, with India as shown on its official map.
      </p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {links.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-slate-500 hover:text-indigo-600">
            {l.label}
            <ArrowUpRight className="size-3" />
          </a>
        ))}
      </div>
    </footer>
  );
}

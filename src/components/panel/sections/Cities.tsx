import { Building2 } from 'lucide-react';
import { formatPopulation } from '../../../lib/format';
import { BarList, Missing, Skeleton } from '../../ui/primitives';
import type { CountryDetails } from '../details';
import { Section } from '../Section';

export function Cities({ country, factbook }: CountryDetails) {
  const fb = factbook.data;
  const cities = fb?.cities ?? [];

  return (
    <Section
      id="cities"
      title="Important cities"
      icon={Building2}
      source={cities.length ? `CIA World Factbook — urban agglomerations${fb?.citiesYear ? `, ${fb.citiesYear}` : ''}` : undefined}
    >
      {factbook.loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : cities.length ? (
        <BarList
          items={cities.map((c) => ({
            key: c.name,
            label: (
              <>
                {c.name}
                {c.capital && (
                  <span className="ml-2 rounded border border-brass-400/30 px-1 py-px align-[1px] text-[10px] uppercase tracking-wide text-brass-300">
                    Capital
                  </span>
                )}
              </>
            ),
            value: c.value,
            highlight: c.capital,
          }))}
          format={formatPopulation}
        />
      ) : country.capitals.length ? (
        <p className="text-[13.5px] text-mist-200">
          {country.capitals.map((c) => c.name).join(', ')}{' '}
          <span className="text-mist-500">(capital — no urban population figures available)</span>
        </p>
      ) : (
        <Missing />
      )}
    </Section>
  );
}

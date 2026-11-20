import { formatPopulation } from '../../../lib/format';
import { BarList, Missing, Skeleton } from '../../ui/primitives';
import type { CountryDetails } from '../details';
import { Section } from '../Section';

export function Cities({ country, factbook }: CountryDetails) {
  const fb = factbook.data;
  const cities = fb?.cities ?? [];

  return (
    <Section tone="teal" order={6}
      id="cities"
      title="Important cities"
      emoji="🏙️"
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
          tone="teal"
          items={cities.map((c) => ({
            key: c.name,
            label: (
              <>
                {c.name}
                {c.capital && (
                  <span className="ml-2 rounded-full bg-tint/12 px-2 py-0.5 align-[1px] text-[11px] font-semibold text-tint">
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
        <p className="text-[13.5px] text-label">
          {country.capitals.map((c) => c.name).join(', ')}{' '}
          <span className="text-secondary">(capital — no urban population figures available)</span>
        </p>
      ) : (
        <Missing />
      )}
    </Section>
  );
}

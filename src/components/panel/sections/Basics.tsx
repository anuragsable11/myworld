import { useEffect, useState } from 'react';
import {
  formatArea,
  formatAreaMiles,
  formatCoordinates,
  formatInteger,
  formatPopulation,
  ordinal,
} from '../../../lib/format';
import { capitalZone, compareOffsets, offsetsFor } from '../../../lib/timezones';
import { Chip, Fact, FactGrid } from '../../ui/primitives';
import { capitalize, type CountryDetails } from '../details';
import { Section } from '../Section';

export function populationOf({ country, factbook, worldBank }: CountryDetails) {
  if (country.population) return { value: country.population, source: country.populationSource };
  const fb = factbook.data?.population;
  if (fb) return { value: fb.value, source: `CIA World Factbook${fb.year ? `, ${fb.year} est.` : ''}` };
  const wb = worldBank.data?.population;
  if (wb) return { value: wb.value, source: `World Bank, ${wb.year}` };
  return undefined;
}

function LocalTime({ zone }: { zone: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  try {
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    }).format(now);
    return <>Local time {time} · {zone.replace(/_/g, ' ')}</>;
  } catch {
    return null;
  }
}

export function Basics(details: CountryDetails) {
  const { country, index, factbook } = details;
  const fb = factbook.data;
  const rank = index.ranks.get(country.cca3);
  const population = populationOf(details);
  const largest = fb?.cities[0];
  const capital = country.capitals[0];
  const capitalCoords =
    capital?.lat != null && capital.lng != null
      ? ([capital.lat, capital.lng] as [number, number])
      : fb?.capital?.coordinates;
  const nativeOfficial = country.nativeNames.find((n) => n.official && n.official !== country.officialName)?.official;
  const capitalOffset = /UTC\s*[+\-−]\s*\d+(?::\d{2})?|UTC/.exec(fb?.capital?.timeDifference ?? '')?.[0];
  const offsets = (country.timezones.length ? [...country.timezones] : offsetsFor(country.cca2)).sort(compareOffsets);
  if (!offsets.length && capitalOffset) offsets.push(capitalOffset.replace(/\s+/g, ''));
  const zone = capitalZone(country.cca2, capital?.name, fb?.capital?.timeDifference);
  const density = population && country.area ? population.value / country.area : undefined;

  return (
    <Section tone="violet" order={1} id="basics" title="Basic information" emoji="📋" source="REST Countries data, CIA World Factbook, IANA time zone database">
      <FactGrid>
        <Fact label="Official name" hint={nativeOfficial} wide>
          {country.officialName}
        </Fact>
        <Fact label="Capital" hint={capitalCoords ? formatCoordinates(...capitalCoords) : undefined} loading={factbook.loading}>
          {country.capitals.length ? country.capitals.map((c) => c.name).join(' · ') : fb?.capital?.name}
        </Fact>
        <Fact
          label="Largest city"
          loading={factbook.loading}
          hint={largest ? `Urban area · ${formatPopulation(largest.value)}${fb?.citiesYear ? ` (${fb.citiesYear})` : ''}` : undefined}
        >
          {largest?.name}
        </Fact>
        <Fact
          label="Total area"
          hint={
            country.area
              ? [formatAreaMiles(country.area), rank?.area && `${ordinal(rank.area.rank)} largest of ${rank.area.of} states`]
                  .filter(Boolean)
                  .join(' · ')
              : undefined
          }
          loading={factbook.loading}
        >
          {country.area ? formatArea(country.area) : fb?.area?.total}
        </Fact>
        <Fact
          label="Population"
          loading={factbook.loading || details.worldBank.loading}
          hint={
            population
              ? [
                  population.source,
                  rank?.population && `${ordinal(rank.population.rank)} of ${rank.population.of}`,
                  density != null && `${formatInteger(density)} per km²`,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : undefined
          }
        >
          {population && <span className="tabular">{formatInteger(population.value)}</span>}
        </Fact>
        <Fact
          label="Nationality"
          loading={factbook.loading}
          hint={fb?.nationality?.noun ? `Noun: ${fb.nationality.noun}` : undefined}
        >
          {country.demonym ?? fb?.nationality?.adjective}
        </Fact>
        <Fact label="Official languages" wide>
          {country.languages.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {country.languages.map((l) => (
                <Chip key={l}>{l}</Chip>
              ))}
            </div>
          )}
        </Fact>
        <Fact label="Currency" wide>
          {country.currencies.length > 0 && (
            <div className="space-y-0.5">
              {country.currencies.map((c) => (
                <div key={c.code}>
                  {c.name}{' '}
                  <span className="text-slate-500">
                    ({c.code}
                    {c.symbol ? ` · ${c.symbol}` : ''})
                  </span>
                </div>
              ))}
            </div>
          )}
        </Fact>
        <Fact label="Calling code">{country.callingCodes.join(', ')}</Fact>
        <Fact label="Internet domain">{country.tlds.join(', ')}</Fact>
        <Fact label="Time zones" wide loading={factbook.loading} hint={zone ? <LocalTime zone={zone} /> : undefined}>
          {offsets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {offsets.map((o) => (
                <Chip key={o}>{o.replace('-', '−')}</Chip>
              ))}
            </div>
          )}
        </Fact>
        {country.drivingSide && <Fact label="Drives on the">{capitalize(country.drivingSide)}</Fact>}
      </FactGrid>
    </Section>
  );
}

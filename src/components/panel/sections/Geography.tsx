import { formatCoordinates, formatInteger } from '../../../lib/format';
import { Flag } from '../../ui/Flag';
import { BarList, Chip, ChipList, ExpandableText, Fact, FactGrid, Missing, Skeleton, SubHeading } from '../../ui/primitives';
import { resolveCountryName, type CountryDetails } from '../details';
import { Section } from '../Section';

export function Geography({ country, index, factbook, mountains, onSelect }: CountryDetails) {
  const fb = factbook.data;
  const peaks = mountains.data?.peaks ?? [];
  const ranges = mountains.data?.ranges ?? [];
  const highest = fb?.elevation?.highest;
  const lowest = fb?.elevation?.lowest;

  // Neighbours: REST Countries border codes, enriched with Factbook border lengths.
  const lengths = new Map<string, number>();
  for (const b of fb?.landBoundaries?.borders ?? []) {
    const code = resolveCountryName(index, b.name);
    if (code && b.value) lengths.set(code, (lengths.get(code) ?? 0) + b.value);
  }
  const neighbors = country.borders
    .map((code) => index.byId.get(code))
    .filter((c) => c !== undefined)
    .sort((a, b) => (lengths.get(b.cca3) ?? 0) - (lengths.get(a.cca3) ?? 0) || a.name.localeCompare(b.name));

  return (
    <Section tone="emerald" order={3}
      id="geography"
      title="Geography"
      emoji="🏔️"
      source="CIA World Factbook, Natural Earth (peaks and ranges), REST Countries data"
    >
      <FactGrid>
        <Fact label="Continent">{country.continents.join(', ')}</Fact>
        <Fact label="Subregion">{country.subregion ?? country.region}</Fact>
        <Fact label="Coordinates" hint="Geographic centre">
          {country.latlng ? formatCoordinates(...country.latlng) : fb?.coordinates && formatCoordinates(...fb.coordinates)}
        </Fact>
        <Fact label="Coastline" loading={factbook.loading} hint={country.landlocked ? 'Landlocked' : undefined}>
          {fb?.coastline ?? (country.landlocked ? '0 km' : undefined)}
        </Fact>
        <Fact
          label="Land boundaries"
          loading={factbook.loading}
          hint={neighbors.length ? `${neighbors.length} bordering ${neighbors.length === 1 ? 'country' : 'countries'}` : undefined}
        >
          {fb?.landBoundaries?.total ?? (country.borders.length === 0 ? 'None' : undefined)}
        </Fact>
        <Fact label="Land / water area" loading={factbook.loading}>
          {fb?.area?.land && (
            <>
              {fb.area.land}
              {fb.area.water && <div className="mt-0.5 text-[12px] text-slate-500">Water: {fb.area.water}</div>}
            </>
          )}
        </Fact>
      </FactGrid>

      <SubHeading aside={lengths.size ? 'Shared border length' : undefined}>Neighbouring countries</SubHeading>
      {neighbors.length ? (
        <div className="flex flex-wrap gap-1.5">
          {neighbors.map((n) => (
            <Chip
              key={n.cca3}
              onClick={() => onSelect(n.cca3)}
              leading={<Flag country={n} className="h-[11px] w-[16px] shrink-0 rounded-[2px]" />}
            >
              {n.name}
              {lengths.get(n.cca3) ? <span className="tabular ml-1 text-slate-500">{formatInteger(lengths.get(n.cca3)!)} km</span> : null}
            </Chip>
          ))}
        </div>
      ) : (
        <Missing>{country.name} has no land borders.</Missing>
      )}

      <SubHeading>Elevation</SubHeading>
      {factbook.loading ? (
        <Skeleton className="h-4 w-2/3" />
      ) : highest || lowest ? (
        <dl className="grid grid-cols-3 gap-3">
          {[
            ['Highest', highest],
            ['Lowest', lowest],
          ].map(([label, point]) =>
            typeof point === 'object' && point ? (
              <div key={label as string} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-[0.08em] text-slate-400">{label as string}</dt>
                <dd className="mt-0.5 text-[13.5px] leading-snug text-slate-800">
                  {point.value != null && <span className="tabular block font-medium">{formatInteger(point.value)} m</span>}
                  <span className="block truncate text-[12px] text-slate-500" title={point.name}>
                    {point.name}
                  </span>
                </dd>
              </div>
            ) : null,
          )}
          {fb?.elevation?.mean && (
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-slate-400">Mean</dt>
              <dd className="tabular mt-0.5 text-[13.5px] font-medium text-slate-800">{fb.elevation.mean}</dd>
            </div>
          )}
        </dl>
      ) : (
        <Missing />
      )}

      <SubHeading aside={peaks.length ? 'Elevation' : undefined}>Major mountains</SubHeading>
      {mountains.loading ? (
        <Skeleton className="h-4 w-1/2" />
      ) : peaks.length || ranges.length ? (
        <>
          {peaks.length > 0 && (
            <BarList
              tone="emerald"
              items={peaks.slice(0, 6).map((p) => ({ key: p.name, label: p.name, value: p.elevation }))}
              format={(v) => `${formatInteger(v)} m`}
            />
          )}
          {ranges.length > 0 && (
            <div className={peaks.length ? 'mt-3' : undefined}>
              <div className="mb-1.5 text-[11.5px] text-slate-400">Mountain ranges</div>
              <ChipList items={ranges} />
            </div>
          )}
        </>
      ) : highest?.name ? (
        <p className="text-[13.5px] text-slate-700">
          {highest.name}
          {highest.value != null && <span className="text-slate-500"> · {formatInteger(highest.value)} m (highest point)</span>}
        </p>
      ) : (
        <Missing>No major mountains recorded.</Missing>
      )}

      <SubHeading aside={fb?.rivers.length ? 'Length' : undefined}>Major rivers</SubHeading>
      {factbook.loading ? (
        <Skeleton className="h-4 w-1/2" />
      ) : fb?.rivers.length ? (
        <BarList
          tone="sky"
          items={fb.rivers.slice(0, 7).map((r) => ({ key: r.name, label: r.name, value: r.value ?? 0, detail: r.detail }))}
          format={(v) => `${formatInteger(v)} km`}
        />
      ) : (
        <Missing>No major rivers recorded.</Missing>
      )}

      {fb?.lakes.length ? (
        <>
          <SubHeading>Major lakes</SubHeading>
          <BarList
            tone="teal"
            items={fb.lakes.slice(0, 4).map((l) => ({ key: l.name, label: l.name, value: l.value ?? 0, detail: l.detail }))}
            format={(v) => `${formatInteger(v)} km²`}
          />
        </>
      ) : null}

      <SubHeading>Climate</SubHeading>
      {factbook.loading ? <Skeleton className="h-4 w-3/4" /> : fb?.climate ? <ExpandableText text={fb.climate} lines={3} /> : <Missing />}

      <SubHeading>Terrain</SubHeading>
      {factbook.loading ? <Skeleton className="h-4 w-3/4" /> : fb?.terrain ? <ExpandableText text={fb.terrain} lines={3} /> : <Missing />}

      <SubHeading>Natural resources</SubHeading>
      {factbook.loading ? (
        <Skeleton className="h-4 w-2/3" />
      ) : fb?.naturalResources.length ? (
        <ChipList items={fb.naturalResources} />
      ) : (
        <Missing />
      )}

      {fb?.naturalHazards && (
        <>
          <SubHeading>Natural hazards</SubHeading>
          <ExpandableText text={fb.naturalHazards} lines={2} />
        </>
      )}
    </Section>
  );
}

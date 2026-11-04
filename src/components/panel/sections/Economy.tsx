import { formatPercent, formatUsd } from '../../../lib/format';
import { ChipList, ExpandableText, Fact, FactGrid, Missing, Skeleton, SubHeading } from '../../ui/primitives';
import type { CountryDetails } from '../details';
import { Section } from '../Section';

export function Economy({ country, factbook, worldBank }: CountryDetails) {
  const fb = factbook.data;
  const wb = worldBank.data;
  const loading = factbook.loading || worldBank.loading;

  return (
    <Section tone="orange" order={5} id="economy" title="Economy" emoji="💰" source="World Bank (World Development Indicators), CIA World Factbook">
      <FactGrid>
        <Fact
          label="GDP (nominal)"
          loading={loading}
          hint={wb?.gdp ? `Current US$, ${wb.gdp.year}` : fb?.gdpOfficial ? 'Official exchange rate' : undefined}
        >
          {wb?.gdp ? <span className="tabular">{formatUsd(wb.gdp.value)}</span> : fb?.gdpOfficial}
        </Fact>
        <Fact
          label="GDP per capita"
          loading={loading}
          hint={
            wb?.gdpPerCapita
              ? `Current US$, ${wb.gdpPerCapita.year}`
              : fb?.gdpPerCapitaPpp
                ? 'Purchasing power parity'
                : undefined
          }
        >
          {wb?.gdpPerCapita ? <span className="tabular">{formatUsd(wb.gdpPerCapita.value)}</span> : fb?.gdpPerCapitaPpp}
        </Fact>
        <Fact
          label="GDP (PPP)"
          loading={loading}
          hint={
            wb?.gdpPerCapitaPpp
              ? `${formatUsd(wb.gdpPerCapitaPpp.value)} per capita · ${wb.gdpPerCapitaPpp.year}`
              : wb?.gdpPpp
                ? `International $, ${wb.gdpPpp.year}`
                : undefined
          }
        >
          {wb?.gdpPpp ? <span className="tabular">{formatUsd(wb.gdpPpp.value)}</span> : fb?.gdpPpp}
        </Fact>
        <Fact label="GDP growth" loading={loading} hint={wb?.gdpGrowth ? `Annual, ${wb.gdpGrowth.year}` : undefined}>
          {wb?.gdpGrowth ? <span className="tabular">{formatPercent(wb.gdpGrowth.value)}</span> : fb?.gdpGrowth}
        </Fact>
        <Fact label="Inflation" loading={factbook.loading}>
          {fb?.inflation}
        </Fact>
        <Fact label="Unemployment" loading={factbook.loading}>
          {fb?.unemployment}
        </Fact>
        {country.gini && (
          <Fact label="Gini index" hint={`Income inequality, ${country.gini.year}`}>
            <span className="tabular">{country.gini.value}</span>
          </Fact>
        )}
      </FactGrid>

      <SubHeading>Major industries</SubHeading>
      {factbook.loading ? (
        <Skeleton className="h-4 w-2/3" />
      ) : fb?.industries.length ? (
        <ChipList items={fb.industries} />
      ) : fb?.industriesText ? (
        <ExpandableText text={fb.industriesText} lines={3} />
      ) : (
        <Missing />
      )}

      {fb?.agriculturalProducts.length ? (
        <>
          <SubHeading>Agricultural products</SubHeading>
          <ChipList items={fb.agriculturalProducts} limit={12} />
        </>
      ) : null}

      {fb?.exports && (
        <>
          <SubHeading>Main exports</SubHeading>
          <p className="text-[13.5px] leading-relaxed text-slate-700">{fb.exports}</p>
          {fb.exportPartners && <p className="mt-1 text-[12px] text-slate-500">Partners: {fb.exportPartners}</p>}
        </>
      )}

      {fb?.economicOverview && (
        <>
          <SubHeading>Overview</SubHeading>
          <ExpandableText text={fb.economicOverview} lines={3} />
        </>
      )}
    </Section>
  );
}

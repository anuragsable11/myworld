import { BarList, ExpandableText, Fact, FactGrid, Missing, Skeleton, SubHeading } from '../../ui/primitives';
import type { CountryDetails } from '../details';
import { Section } from '../Section';

export function People({ factbook }: CountryDetails) {
  const fb = factbook.data;
  const loading = factbook.loading;

  return (
    <Section tone="pink" order={4} id="people" title="People & society" emoji="👥" source="CIA World Factbook">
      <FactGrid>
        <Fact label="Median age" loading={loading}>
          {fb?.medianAge}
        </Fact>
        <Fact label="Life expectancy" loading={loading}>
          {fb?.lifeExpectancy}
        </Fact>
        <Fact label="Urban population" loading={loading}>
          {fb?.urbanization}
        </Fact>
        <Fact label="Nationality (adjective)" loading={loading}>
          {fb?.nationality?.adjective}
        </Fact>
      </FactGrid>

      <SubHeading aside={fb?.religions.length ? 'Share of population' : undefined}>Major religions</SubHeading>
      {loading ? (
        <Skeleton className="h-4 w-2/3" />
      ) : fb?.religions.length ? (
        <BarList
          max={100}
          tone="pink"
          items={fb.religions.slice(0, 7).map((r) => ({ key: r.name, label: r.name, value: r.value ?? 0, detail: r.detail }))}
          format={(v) => `${v}%`}
        />
      ) : fb?.religionsText ? (
        <ExpandableText text={fb.religionsText} lines={3} />
      ) : (
        <Missing />
      )}

      <SubHeading>Ethnic groups</SubHeading>
      {loading ? <Skeleton className="h-4 w-3/4" /> : fb?.ethnicGroups ? <ExpandableText text={fb.ethnicGroups} lines={3} /> : <Missing />}

      <SubHeading>Languages spoken</SubHeading>
      {loading ? <Skeleton className="h-4 w-3/4" /> : fb?.languages ? <ExpandableText text={fb.languages} lines={3} /> : <Missing />}
    </Section>
  );
}

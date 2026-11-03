import { ArrowUpRight, BookOpen } from 'lucide-react';
import { ExpandableText, Skeleton } from '../../ui/primitives';
import type { CountryDetails } from '../details';
import { Section } from '../Section';

export function Overview({ country, wikipedia, factbook }: CountryDetails) {
  const summary = wikipedia.data;
  const fallback = country.description ?? factbook.data?.background;
  const loading = wikipedia.loading || (!summary && !fallback && factbook.loading);

  return (
    <Section
      id="overview"
      title="Overview"
      icon={BookOpen}
      source={summary ? 'Wikipedia' : fallback ? (country.description ? 'REST Countries' : 'CIA World Factbook') : undefined}
    >
      {summary ? (
        <>
          <ExpandableText text={summary.extract} lines={6} />
          <a
            href={summary.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-brass-300 hover:text-brass-200"
          >
            Read the full article on Wikipedia
            <ArrowUpRight className="size-3.5" />
          </a>
        </>
      ) : loading ? (
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ) : fallback ? (
        <ExpandableText text={fallback} lines={6} />
      ) : (
        <p className="text-[13px] italic text-mist-500">No summary is available for {country.name}.</p>
      )}
    </Section>
  );
}

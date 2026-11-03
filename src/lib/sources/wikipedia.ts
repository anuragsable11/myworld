import { fetchJson } from '../http';

export interface WikipediaSummary {
  title: string;
  description?: string;
  extract: string;
  url: string;
}

interface SummaryResponse {
  type?: string;
  title: string;
  description?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
}

export async function fetchWikipediaSummary(title: string, signal?: AbortSignal): Promise<WikipediaSummary | null> {
  const slug = encodeURIComponent(title.replace(/ /g, '_'));
  const data = await fetchJson<SummaryResponse>(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, {
    signal,
  });
  if (!data.extract || data.type === 'disambiguation') return null;
  return {
    title: data.title,
    description: data.description,
    extract: data.extract,
    url: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${slug}`,
  };
}

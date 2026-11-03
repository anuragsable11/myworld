import { assetUrl, fetchJson } from '../http';

/** Notable peaks and mountain ranges per country, generated from Natural Earth by scripts/build-data.mjs. */

export interface Peak {
  name: string;
  elevation: number;
  lat: number;
  lng: number;
  wikidata?: string;
}

export interface CountryMountains {
  peaks: Peak[];
  ranges: string[];
}

export type MountainIndex = Record<string, CountryMountains>;

export const fetchMountains = (signal?: AbortSignal) =>
  fetchJson<MountainIndex>(assetUrl('data/mountains.json'), { signal });

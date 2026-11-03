/** Political status of an entry, normalised across data providers. */
export type CountryStatus = 'member' | 'observer' | 'partial' | 'territory' | 'disputed';

export interface Capital {
  name: string;
  lat?: number;
  lng?: number;
}

export interface Currency {
  code: string;
  name: string;
  symbol?: string;
}

/** A country record, normalised from whichever country-data provider is active. */
export interface Country {
  cca3: string;
  cca2: string;
  ccn3?: string;
  name: string;
  officialName: string;
  nativeNames: { lang: string; common: string; official: string }[];
  altNames: string[];
  capitals: Capital[];
  region: string;
  subregion?: string;
  continents: string[];
  latlng?: [number, number];
  area?: number;
  population?: number;
  populationSource?: string;
  landlocked?: boolean;
  borders: string[];
  languages: string[];
  currencies: Currency[];
  callingCodes: string[];
  tlds: string[];
  timezones: string[];
  demonym?: string;
  governmentType?: string;
  status: CountryStatus;
  parent?: string;
  flag: { emoji?: string; png: string; svg: string; alt?: string };
  gini?: { year: string; value: number };
  drivingSide?: string;
  description?: string;
  wikipediaUrl?: string;
  /** Pre-normalised text used by the search index. */
  searchText: string;
}

export type CountryProviderId = 'restcountries' | 'open';

export interface CountryDataset {
  countries: Country[];
  provider: CountryProviderId;
  /** Explains why the fallback provider is in use, when it is. */
  notice?: string;
}

export interface RankedValue {
  rank: number;
  of: number;
}

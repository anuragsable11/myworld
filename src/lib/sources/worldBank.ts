import { fetchJson } from '../http';

/** Latest World Bank development indicators (World Development Indicators, source 2). */

const INDICATORS = {
  gdp: 'NY.GDP.MKTP.CD',
  gdpPerCapita: 'NY.GDP.PCAP.CD',
  gdpGrowth: 'NY.GDP.MKTP.KD.ZG',
  gdpPpp: 'NY.GDP.MKTP.PP.CD',
  gdpPerCapitaPpp: 'NY.GDP.PCAP.PP.CD',
  population: 'SP.POP.TOTL',
} as const;

export type IndicatorKey = keyof typeof INDICATORS;
export type Indicators = Partial<Record<IndicatorKey, { value: number; year: string }>>;

interface Row {
  indicator: { id: string };
  value: number | null;
  date: string;
}

export const worldBankCountryUrl = (cca3: string) =>
  `https://data.worldbank.org/country/${cca3 === 'UNK' ? 'XK' : cca3.toLowerCase()}`;

export async function fetchIndicators(cca3: string, signal?: AbortSignal): Promise<Indicators> {
  const code = cca3 === 'UNK' ? 'XKX' : cca3;
  const ids = Object.values(INDICATORS).join(';');
  const json = await fetchJson<unknown[]>(
    `https://api.worldbank.org/v2/country/${code}/indicator/${ids}?source=2&format=json&mrnev=1&per_page=50`,
    { signal },
  );
  // Territories the World Bank does not cover come back as an error message object.
  const rows = Array.isArray(json[1]) ? (json[1] as Row[]) : [];
  const out: Indicators = {};
  for (const [key, id] of Object.entries(INDICATORS) as [IndicatorKey, string][]) {
    const row = rows.find((r) => r.indicator.id === id && r.value != null);
    if (row) out[key] = { value: row.value!, year: row.date };
  }
  return out;
}

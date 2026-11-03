const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const twoDecimals = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatInteger = (n: number) => integer.format(n);

/** 68,720,337 -> "68.72 million"; values under a million are written out in full. */
export function formatPopulation(n: number): string {
  if (n >= 1e9) return `${twoDecimals.format(n / 1e9)} billion`;
  if (n >= 1e6) return `${twoDecimals.format(n / 1e6)} million`;
  return integer.format(n);
}

export function formatShortCount(n: number): string {
  if (n >= 1e9) return `${oneDecimal.format(n / 1e9)}B`;
  if (n >= 1e6) return `${oneDecimal.format(n / 1e6)}M`;
  if (n >= 1e3) return `${oneDecimal.format(n / 1e3)}K`;
  return integer.format(n);
}

export function formatUsd(n: number): string {
  const sign = n < 0 ? '−' : '';
  const v = Math.abs(n);
  if (v >= 1e12) return `${sign}$${twoDecimals.format(v / 1e12)} trillion`;
  if (v >= 1e9) return `${sign}$${twoDecimals.format(v / 1e9)} billion`;
  if (v >= 1e6) return `${sign}$${twoDecimals.format(v / 1e6)} million`;
  return `${sign}$${integer.format(v)}`;
}

export const formatArea = (km2: number) =>
  `${km2 < 10 ? oneDecimal.format(km2) : integer.format(km2)} km²`;

export const formatAreaMiles = (km2: number) => `${integer.format(km2 * 0.386102)} mi²`;

export const formatPercent = (n: number, digits = 1) =>
  `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}%`;

export function formatCoordinates(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lng).toFixed(2)}° ${ew}`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Lower-cases and strips diacritics so "Côte d'Ivoire" matches "cote". */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-'(./])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
}

/** First letter used for alphabetical grouping ("Åland Islands" -> "A"). */
export const groupLetter = (name: string) => normalizeText(name).charAt(0).toUpperCase() || '#';

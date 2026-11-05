import type { Country } from '../../types';
import { isSovereign } from '../../hooks/queries';

/**
 * The flag quiz: ten questions that get harder. Questions 1–3 are easy, 4–6 medium, 7–9 hard and
 * the 10th is "impossible". What makes a level hard is both the flag asked about (famous or
 * obscure) and the wrong answers offered with it (far away and different, or lookalikes).
 */

export type Level = 'easy' | 'medium' | 'hard' | 'impossible';

export const PLAN: readonly Level[] = ['easy', 'easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard', 'hard', 'impossible'];

export interface Question {
  level: Level;
  answer: Country;
  /** Four choices in random order, the answer among them. */
  options: Country[];
}

/** Famous flags. As easy questions their wrong answers come from elsewhere and look nothing alike. */
const EASY = [
  'USA', 'CAN', 'MEX', 'BRA', 'ARG', 'GBR', 'FRA', 'DEU', 'ITA', 'ESP', 'PRT', 'JPN', 'CHN', 'IND', 'KOR', 'AUS', 'RUS',
  'TUR', 'CHE', 'SWE', 'GRC', 'ISR', 'SAU', 'ZAF', 'EGY', 'JAM', 'NPL', 'BGD', 'UKR', 'PAK', 'KEN', 'CUB', 'VNM', 'NZL',
];

/** Fairly well-known flags, asked alongside their neighbours'. */
const MEDIUM = [
  'NOR', 'DNK', 'FIN', 'ISL', 'NLD', 'BEL', 'AUT', 'POL', 'IRL', 'CZE', 'HUN', 'ROU', 'HRV', 'SRB', 'CHL', 'COL', 'PER',
  'VEN', 'URY', 'ECU', 'BOL', 'PRY', 'PHL', 'IDN', 'MYS', 'SGP', 'THA', 'IRN', 'IRQ', 'AFG', 'KAZ', 'LKA', 'MAR', 'DZA',
  'TUN', 'ETH', 'GHA', 'SEN', 'CMR', 'TZA', 'UGA', 'NGA', 'QAT', 'ARE', 'KWT', 'LBN', 'JOR', 'SYR', 'PRK', 'MNG', 'KHM',
  'BHS', 'DOM', 'CRI', 'PAN',
];

/** Flags that look alike (colours and layout): the wrong answers of hard questions. */
const LOOKALIKES: string[][] = [
  ['NOR', 'ISL', 'DNK', 'SWE', 'FIN'], // Nordic crosses
  ['IDN', 'MCO', 'POL', 'AUT', 'LVA', 'PER', 'LBN', 'SGP', 'CAN'], // red and white
  ['ARG', 'URY', 'SLV', 'HND', 'NIC', 'GTM', 'GRC', 'ISR', 'FIN', 'SOM', 'BWA'], // blue and white
  ['GHA', 'SEN', 'MLI', 'GIN', 'CMR', 'ETH', 'BFA', 'TGO', 'BEN', 'GNB', 'COG', 'BOL', 'LTU', 'ZWE', 'GUY'], // green, yellow, red
  ['JOR', 'PSE', 'SDN', 'KWT', 'ARE', 'SYR', 'IRQ', 'EGY', 'YEM', 'LBY', 'SSD'], // red, white, black, green
  ['RUS', 'SRB', 'SVK', 'SVN', 'CZE', 'HRV', 'NLD', 'LUX', 'PRY'], // white, blue, red
  ['ITA', 'MEX', 'IRL', 'CIV', 'NER', 'IND', 'HUN', 'BGR', 'TJK'], // green, white and red or orange
  ['COL', 'ECU', 'VEN', 'ROU', 'TCD', 'AND', 'MDA'], // blue, yellow, red
  ['AUS', 'NZL', 'TUV', 'FJI'], // blue ensigns
  ['TUR', 'TUN', 'AZE', 'PAK', 'MYS', 'SGP', 'MDV', 'LBY', 'DZA', 'MRT', 'COM', 'UZB', 'TKM'], // crescents
  ['USA', 'LBR', 'MYS', 'URY', 'TGO', 'CUB', 'CHL'], // stars and stripes
  ['CHN', 'VNM', 'MAR', 'KGZ', 'MMR'], // red with a star or a sun
  ['NLD', 'LUX', 'PRY', 'HRV', 'THA', 'CRI', 'PRK', 'LAO', 'DOM', 'PAN'], // red, white and blue bands
  ['DEU', 'BEL', 'UGA', 'AGO'], // black, red and yellow
  ['CHE', 'DNK', 'GEO', 'TON', 'MLT'], // crosses
  ['CZE', 'CUB', 'PHL', 'BHS', 'TLS', 'MOZ', 'STP', 'GNQ', 'DJI'], // a triangle at the pole
  ['JPN', 'BGD', 'PLW', 'LAO', 'NER', 'KGZ', 'MKD', 'KAZ'], // a disc or a sun
  ['COG', 'TZA', 'NAM', 'SLB', 'KNA', 'TTO', 'COD'], // diagonal bands
  ['BRA', 'GAB', 'JAM', 'GUY', 'MRT'], // green and yellow
  ['UKR', 'SWE', 'KAZ', 'PLW', 'BIH'], // blue and yellow
  ['KEN', 'MWI', 'SSD', 'AFG'], // black, red and green
];

/**
 * Near-identical flags for the impossible question: it asks about one of the true twins (`pick`),
 * and offers the whole look-alike `set` to choose from.
 */
const TWINS: { pick: string[]; set: string[] }[] = [
  { pick: ['TCD', 'ROU'], set: ['TCD', 'ROU', 'AND', 'MDA'] },
  { pick: ['MCO', 'IDN'], set: ['MCO', 'IDN', 'POL', 'AUT'] },
  { pick: ['CIV', 'IRL'], set: ['CIV', 'IRL', 'ITA', 'NER'] },
  { pick: ['LUX', 'NLD'], set: ['LUX', 'NLD', 'PRY', 'HRV'] },
  { pick: ['TUV', 'FJI'], set: ['TUV', 'FJI', 'NZL', 'AUS'] },
  { pick: ['MLI', 'GIN', 'SEN'], set: ['MLI', 'GIN', 'SEN', 'CMR'] },
  { pick: ['ISL', 'NOR'], set: ['ISL', 'NOR', 'DNK', 'FIN'] },
  { pick: ['ECU', 'COL'], set: ['ECU', 'COL', 'VEN', 'BOL'] },
  { pick: ['HND', 'NIC', 'SLV'], set: ['HND', 'NIC', 'SLV', 'GTM'] },
  { pick: ['SVK', 'SVN'], set: ['SVK', 'SVN', 'RUS', 'SRB'] },
  { pick: ['YEM', 'SYR', 'IRQ'], set: ['YEM', 'EGY', 'SYR', 'IRQ'] },
  { pick: ['PSE', 'SDN', 'JOR'], set: ['PSE', 'SDN', 'JOR', 'KWT'] },
  { pick: ['CRI', 'THA'], set: ['CRI', 'THA', 'PRK', 'LAO'] },
  { pick: ['BOL', 'GHA', 'LTU'], set: ['BOL', 'GHA', 'LTU', 'ETH'] },
];

function shuffle<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A new round of ten questions. Only sovereign states take part: their flags are all different. */
export function buildQuiz(countries: Country[], random: () => number = Math.random): Question[] {
  const pool = countries.filter(isSovereign);
  const byId = new Map(pool.map((c) => [c.cca3, c]));
  const has = (id: string) => byId.has(id);
  const easy = EASY.filter(has);
  const medium = MEDIUM.filter((id) => has(id) && !easy.includes(id));
  const famous = new Set([...easy, ...medium]);
  const hard = pool.map((c) => c.cca3).filter((id) => !famous.has(id));
  const twins = TWINS.map(({ pick, set }) => ({ pick: pick.filter(has), set: set.filter(has) })).filter((t) => t.pick.length && t.set.length >= 4);
  const isTwin = (a: string, b: string) => twins.some(({ set }) => set.includes(a) && set.includes(b));
  const lookalikes = (id: string) => LOOKALIKES.filter((group) => group.includes(id)).flat();
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const used = new Set<string>();

  const question = (level: Level): Question => {
    let answerId: string;
    let choices: string[];

    if (level === 'impossible' && twins.length) {
      // One of a pair of near-twins, with the rest of its look-alike set as the choices. Prefer
      // the obscure twin (Chad rather than Romania).
      const unasked = twins.filter((t) => t.pick.some((id) => !used.has(id)));
      const twin = pick(unasked.length ? unasked : twins);
      const obscure = twin.pick.filter((id) => !famous.has(id) && !used.has(id));
      const fresh = twin.pick.filter((id) => !used.has(id));
      answerId = pick(obscure.length ? obscure : fresh.length ? fresh : twin.pick);
      choices = shuffle(twin.set.filter((id) => id !== answerId), random);
    } else {
      const source = (level === 'easy' ? easy : level === 'medium' ? medium : hard).filter((id) => !used.has(id));
      // (An impossible question without its twin sets falls back to a hard one.)
      answerId = pick(source);
      const answer = byId.get(answerId)!;
      const near = (key: 'subregion' | 'region') => shuffle(pool.filter((c) => c[key] && c[key] === answer[key]).map((c) => c.cca3), random);
      if (level === 'easy') {
        // Familiar names from other parts of the world, with flags that look nothing alike.
        const far = shuffle([...famous], random).filter((id) => byId.get(id)!.region !== answer.region);
        choices = far.filter((id) => !lookalikes(answerId).includes(id));
      } else if (level === 'medium') {
        // Neighbours from the same part of the world, but no near-twins.
        choices = [...near('subregion'), ...near('region')].filter((id) => !isTwin(answerId, id));
      } else {
        // Flags that look like it first, then neighbours.
        choices = [...shuffle(lookalikes(answerId), random), ...near('subregion'), ...near('region')];
      }
    }

    const options = [answerId];
    for (const id of [...choices, ...shuffle(pool.map((c) => c.cca3), random)]) {
      if (options.length === 4) break;
      if (has(id) && !options.includes(id)) options.push(id);
    }
    used.add(answerId);
    return { level, answer: byId.get(answerId)!, options: shuffle(options, random).map((id) => byId.get(id)!) };
  };

  return PLAN.map(question);
}

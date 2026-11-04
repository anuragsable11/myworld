import { fetchJson } from '../http';

/**
 * Photos of a country from its English Wikipedia article: the pictures the article's editors
 * chose for each section, sorted into a few friendly groups by the section they illustrate.
 * Only freely licensed files on Wikimedia Commons are kept, and pictures of wars, atrocities,
 * disasters and other upsetting subjects are left out.
 */

export type PhotoGroup = 'places' | 'history' | 'nature' | 'wildlife' | 'food' | 'culture' | 'people' | 'sports';

export interface Photo {
  /** Commons file name, without the "File:" prefix. */
  file: string;
  thumb: string;
  large: string;
  caption: string;
  group: PhotoGroup;
}

export interface PhotoCredit {
  artist?: string;
  license?: string;
  licenseUrl?: string;
  /** The file's page on Wikimedia Commons. */
  page: string;
  /** A bigger version, up to 1280px wide. */
  large?: string;
}

interface MediaList {
  items?: {
    title?: string;
    type?: string;
    section_id?: number;
    caption?: { text?: string };
    srcset?: { src: string; scale: string }[];
  }[];
}

interface ParsedSections {
  parse?: { sections: { index: string; line: string; toclevel: number }[] };
}

/** Section titles that put a photo in each group, tried on its own section and then the top-level one. */
const GROUP_RULES: [PhotoGroup, RegExp][] = [
  ['food', /cuisine|\bfood|gastronom|\bdrinks?\b|\bdish|\bwines?\b|\bbeer\b|\btea\b|coffee/i],
  ['sports', /\bsports?\b|olympic|football|cricket|athletic/i],
  ['wildlife', /biodiversity|wildlife|fauna|flora|\banimals?\b|\bplants?\b|ecolog/i],
  ['culture', /\bcultur(e|al)\b|\barts?\b|music|dance|literature|cinema|\bfilms?\b|festival|theat|religio|mytholog|folklore|holiday|tradition|craft|clothing|costume|fashion|\bmedia\b/i],
  ['places', /tourism|architecture|landmark|\bcit(y|ies)\b|urban|heritage|monument|sights/i],
  ['people', /demograph|society|\bpeople\b|ethnic|languages?|population|education|lifestyle|daily life/i],
  ['history', /history|historical|ancient|medieval|colonial|independence|prehistor|empire|dynast|\bera\b|period|kingdom|centur(y|ies)|republic|unification|antiquity|origins/i],
  ['nature', /geograph|geolog|climate|topograph|landscape|physical|terrain|environment|nature|\brivers?\b|mountains?|islands?|\bregions?\b|hydrolog|coast/i],
];

/** Sections whose pictures aren't for this tour, whatever section they sit in. */
const SKIPPED_SECTIONS =
  /health|medic|hospital|disease|crime|\blaw\b|military|defen[cs]e|politic|government|elections?|foreign|econom|industr|infrastructure|transport|energy|administrative|science|technology|communication|finance|\btax|corruption|poverty|human rights/i;

/** Famous buildings and sights; culture and people photos showing one go under places. */
const LANDMARK =
  /\b(temples?|mosques?|masjid|cathedrals?|church(es)?|basilicas?|chapels?|monaster(y|ies)|abbey|shrines?|stupas?|pagodas?|palaces?|forts?|fortress|castles?|citadel|towers?|minar|minarets?|gates?|bridges?|monuments?|mausoleum|tombs?|pyramids?|sphinx|statues?|opera house|museums?|skyline|old town|world heritage|unesco|landmarks?|colosseum|acropolis|dargah|gurdwara|synagogue|wat|ruins|amphitheat(er|re)|aqueduct|square)\b/i;

/** Upsetting subjects, matched against the section title, caption and file name. */
const UPSETTING =
  /genocide|massacre|holocaust|\bnazis?\b|hitler|fuhrer|third reich|swastika|skulls?|corpses?|\bbod(y|ies)\b|\bdead\b|\bdeaths?\b|\bkill(s|ed|ing)?\b|execut|\bwars?\b|warfare|\bbattles?\b|bomb|atomic|nuclear|explosion|\battacks?\b|terror|invasion|invaded|soldiers?|troops|\barm(y|ies)\b|military|weapons?|\bguns?\b|\btanks?\b|missiles?|\briots?\b|protest|demonstrat|revolt|revolution|rebellion|uprising|refugees?|famine|slave|\bprison|penal|\bcamps?\b|apartheid|dictator|assassinat|murder|violence|conflict|occupation|surrender|insurgen|militia|\bcoup\b|purge|khmer rouge|gulag|lynch|tortur|hostages?|bloody|victims?|crisis|starvation|epidemic|pandemic|disaster|earthquake|tsunami|\bfloods?\b|cyclone|hurricane|\bwhip|punishment|\bgraves?\b|cemetery|funeral|mumm(y|ies)/i;

/** Maps, charts, flags, money and other pictures that aren't photos of the country. */
const NOT_A_PHOTO =
  /\bmaps?\b|\bflags?\b|emblem|coat of arms|\bseal\b|locator|orthographic|\bcharts?\b|\bgraphs?\b|diagram|population pyramid|koppen|\blogo\b|signature|banknote|\bcoins?\b|\bmohurs?\b|\bstamps?\b|\btopo\b|census|\binr\b|currency|paper money|infographic|statistic|\btrends?\b|temperature|anomal/i;

const MAX_PER_GROUP = 8;

/** Without accents or underscores, so the patterns above match "Exécution" and "LORAN_bombing". */
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/_/g, ' ');
const https = (src: string) => (src.startsWith('//') ? `https:${src}` : src);
const groupOf = (title: string) => GROUP_RULES.find(([, rule]) => rule.test(title))?.[0];

const cleanCaption = (text = '') =>
  text
    .replace(/\[(\d+|[a-z]{1,3}|note \d+|citation needed)\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

/** A readable name from a file name, for photos without a caption; empty if nothing readable is left. */
function nameFromFile(file: string) {
  let name = file.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ');
  if (!name.includes(' ')) name = name.replace(/-/g, ' '); // "Indian-Hockey-Team-Berlin-1936"
  name = name
    .replace(/\([^)]*\)/g, ' ')
    // Camera codes ("A7CR", "Jun24", "DSC0423") and long numbers, but not years, ordinals or ages
    .replace(/\b(?!\d+(st|nd|rd|th)\b)(?=[a-z]*\d)(?=\d*[a-z])[a-z\d]+\b/gi, ' ')
    .replace(/\b(?!(1\d|20)\d\d\b)\d{4,}\b/g, ' ')
    .replace(/\b(img|dsc[fn]?|cropped|crop|edit(ed)?|retouched|copy|final)\b/gi, ' ')
    .replace(/\s\d{1,3}\s*$/, '') // a trailing "03"
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,–-]+|[\s,–-]+$/g, '');
  return (name.match(/[a-z]/gi)?.length ?? 0) >= 5 ? name : '';
}

export async function fetchPhotos(title: string, signal?: AbortSignal): Promise<Photo[]> {
  const slug = encodeURIComponent(title.replace(/ /g, '_'));
  const [media, parsed] = await Promise.all([
    fetchJson<MediaList>(`https://en.wikipedia.org/api/rest_v1/page/media-list/${slug}`, { signal }),
    fetchJson<ParsedSections>(
      `https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&prop=sections&redirects=1&origin=*&page=${slug}`,
      { signal },
    ),
  ]);

  // Each numbered section's title, and the title of the top-level section it sits in.
  const sections = new Map<number, { own: string; top: string }>();
  let top = '';
  for (const s of parsed.parse?.sections ?? []) {
    const own = s.line.replace(/<[^>]+>/g, '');
    if (s.toclevel === 1) top = own;
    if (/^\d+$/.test(s.index)) sections.set(Number(s.index), { own, top });
  }

  const counts = new Map<PhotoGroup, number>();
  const seen = new Set<string>();
  const photos: Photo[] = [];
  for (const item of media.items ?? []) {
    const src = item.srcset?.[0]?.src;
    // The lead section holds the flag, emblem and locator map.
    const section = item.section_id ? sections.get(item.section_id) : undefined;
    if (item.type !== 'image' || !item.title || !src || !section || SKIPPED_SECTIONS.test(section.own)) continue;
    // Files on Wikimedia Commons are freely licensed; the ones kept on Wikipedia itself often aren't.
    if (!src.includes('/wikipedia/commons/')) continue;
    const file = item.title.replace(/^File:/, '');
    if (seen.has(file) || /\.(svg|png|gif|tiff?|webm|ogv|ogg)$/i.test(file)) continue;
    const caption = cleanCaption(item.caption?.text);
    const text = plain(`${file} ${caption}`);
    if (NOT_A_PHOTO.test(text) || UPSETTING.test(`${plain(section.own)} ${text}`)) continue;

    let group = groupOf(section.own) ?? groupOf(section.top);
    if (!group) continue;
    if ((group === 'culture' || group === 'people') && LANDMARK.test(text)) group = 'places';
    const count = counts.get(group) ?? 0;
    if (count >= MAX_PER_GROUP) continue;
    counts.set(group, count + 1);
    seen.add(file);
    const large = item.srcset?.find((s) => s.scale === '2x')?.src ?? src;
    photos.push({ file, thumb: https(src), large: https(large), caption: caption || nameFromFile(file), group });
  }
  return photos;
}

interface ImageInfoResponse {
  query?: {
    pages?: {
      imageinfo?: { thumburl?: string; extmetadata?: Record<string, { value?: string } | undefined> }[];
    }[];
  };
}

/** Plain text of the HTML Commons uses for authors ("<a href=…>Name</a>"). */
const textOf = (html: string | undefined) =>
  html ? new DOMParser().parseFromString(html, 'text/html').body.textContent?.replace(/\s+/g, ' ').trim() || undefined : undefined;

/** Who took a photo and under which licence, for the credit line in the photo viewer. */
export async function fetchPhotoCredit(file: string, signal?: AbortSignal): Promise<PhotoCredit> {
  const title = `File:${file}`;
  const data = await fetchJson<ImageInfoResponse>(
    'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&prop=imageinfo' +
      `&iiprop=extmetadata|url&iiurlwidth=1280&iiextmetadatafilter=Artist|LicenseShortName|LicenseUrl&titles=${encodeURIComponent(title)}`,
    { signal },
  );
  const info = data.query?.pages?.[0]?.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  return {
    artist: textOf(meta.Artist?.value),
    license: meta.LicenseShortName?.value,
    licenseUrl: meta.LicenseUrl?.value,
    page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`,
    large: info?.thumburl,
  };
}

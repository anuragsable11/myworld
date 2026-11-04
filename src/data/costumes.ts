import type { Country } from '../types';

/**
 * Cartoon "traditional dress" for every country, built from a small set of outfit families.
 *
 * Countries listed in COUNTRY_COSTUMES carry the names of garments that are widely documented as
 * their traditional or national dress. Everything else falls back to a family chosen by
 * subregion and is labelled as illustrative. These are simplified cartoons: real traditional
 * dress varies by region and community and is mostly worn for festivals and special occasions.
 */

export type Body = 'shirt-pants' | 'tunic-pants' | 'robe' | 'dress' | 'wrap' | 'kilt' | 'pleated' | 'parka';
export type Pattern = 'stripes' | 'bands' | 'plaid' | 'dots' | 'zigzag' | 'floral' | 'batik' | 'kente' | 'embroidery';
export type OverlayKind =
  | 'pallu'
  | 'dupatta'
  | 'obi'
  | 'bow'
  | 'sash'
  | 'vest'
  | 'jacket'
  | 'poncho'
  | 'apron'
  | 'bodice'
  | 'blanket'
  | 'shawl'
  | 'collar'
  | 'vcollar'
  | 'ribbon'
  | 'gazyri';
export type HeadwearKind =
  | 'kufi'
  | 'fez'
  | 'ghutra'
  | 'headscarf'
  | 'gele'
  | 'turban'
  | 'headwrap'
  | 'sombrero'
  | 'chullo'
  | 'bowler'
  | 'beret'
  | 'conical'
  | 'papakha'
  | 'tall-cap'
  | 'flower-crown'
  | 'kokoshnik'
  | 'mokorotlo'
  | 'flower'
  | 'topi'
  | 'felt-hat'
  | 'straw-hat'
  | 'hood'
  | 'veil'
  | 'lace-cap';
export type Hair = 'short' | 'long' | 'bun' | 'braid' | 'coily' | 'puff';

export interface Layer {
  color: string;
  pattern?: Pattern;
  accent?: string;
}

export interface Outfit {
  body: Body;
  /** Shirt, blouse, tunic or robe colour. */
  top: string;
  /** Trousers or skirt colour (defaults to `top`). */
  bottom?: string;
  /** Pattern on the main garment: the robe, tunic or skirt. */
  pattern?: Pattern;
  /** Pattern on the shirt or blouse. */
  topPattern?: Pattern;
  /** Pattern and trim colour. */
  accent?: string;
  /** How wide a skirt flares, 0–1. */
  flare?: number;
  /** A skirt tied high on the chest, under a short jacket. */
  waist?: 'high';
  /** Puffed sleeves, gathered at the shoulder. */
  sleeves?: 'puff';
  overlays?: (Layer & { kind: OverlayKind })[];
  headwear?: Layer & { kind: HeadwearKind };
  hair?: Hair;
  shoes?: string;
  /** Colour of stockings below a kilt or pleated skirt. */
  legs?: string;
  /** A decorated border along the hem of the skirt, robe or tunic. */
  hem?: Layer;
}

const C = {
  white: '#ffffff',
  cream: '#fff4d6',
  ink: '#1e1b4b',
  gold: '#ffd23f',
  red: '#e63946',
  crimson: '#b8323f',
  pink: '#ff6b81',
  rose: '#ff9fb0',
  orange: '#ff9f1c',
  saffron: '#ff8c32',
  green: '#2ecc71',
  forest: '#2e7d32',
  teal: '#16a085',
  sky: '#7ec8e3',
  blue: '#2e86de',
  navy: '#1e3a8a',
  purple: '#8e44ad',
  lavender: '#c3b1ff',
  brown: '#8b5a2b',
  leather: '#6b4226',
  straw: '#f2d59b',
  black: '#2b2340',
  denim: '#3b5b92',
} as const;

export type Family =
  | 'sari'
  | 'shalwar'
  | 'kimono'
  | 'hanbok'
  | 'qipao'
  | 'aodai'
  | 'kebaya'
  | 'wrap'
  | 'robe'
  | 'gulf'
  | 'kaftan'
  | 'westafrica'
  | 'eastafrica'
  | 'habesha'
  | 'southernafrica'
  | 'andean'
  | 'latin'
  | 'gaucho'
  | 'caribbean'
  | 'europefolk'
  | 'slavic'
  | 'mediterranean'
  | 'caucasus'
  | 'pacific'
  | 'kilt'
  | 'modern'
  | 'parka';

const FAMILIES: Record<Family, { man: Outfit; woman: Outfit; varied?: boolean }> = {
  sari: {
    man: { body: 'tunic-pants', top: C.cream, bottom: C.white, overlays: [{ kind: 'vest', color: C.crimson }] },
    woman: {
      body: 'dress',
      top: C.pink,
      bottom: C.saffron,
      accent: C.gold,
      hem: { color: C.gold, pattern: 'zigzag', accent: C.crimson },
      flare: 0.25,
      overlays: [{ kind: 'pallu', color: C.saffron, pattern: 'embroidery', accent: C.gold }],
      hair: 'bun',
    },
  },
  shalwar: {
    man: { body: 'tunic-pants', top: '#ece4d0', bottom: '#ece4d0', overlays: [{ kind: 'vest', color: C.navy }] },
    woman: {
      body: 'tunic-pants',
      top: C.teal,
      bottom: C.white,
      pattern: 'floral',
      accent: C.gold,
      overlays: [{ kind: 'dupatta', color: C.pink }],
      hair: 'long',
    },
  },
  kimono: {
    man: {
      body: 'robe',
      top: C.navy,
      overlays: [
        { kind: 'vcollar', color: C.white },
        { kind: 'obi', color: '#9aa3c7' },
      ],
    },
    woman: {
      body: 'robe',
      top: C.pink,
      pattern: 'floral',
      accent: C.white,
      overlays: [
        { kind: 'vcollar', color: C.white },
        { kind: 'obi', color: C.gold },
        { kind: 'bow', color: C.gold },
      ],
      hair: 'bun',
    },
  },
  hanbok: {
    man: { body: 'shirt-pants', top: C.sky, bottom: '#f5f0e1', overlays: [{ kind: 'vest', color: '#2f6f8f' }] },
    woman: {
      body: 'dress',
      top: C.gold,
      bottom: C.pink,
      flare: 0.9,
      waist: 'high',
      overlays: [{ kind: 'ribbon', color: C.red }],
      hair: 'bun',
    },
  },
  qipao: {
    man: { body: 'robe', top: '#2e5e8c', overlays: [{ kind: 'collar', color: C.gold }] },
    woman: {
      body: 'dress',
      top: C.red,
      bottom: C.red,
      pattern: 'floral',
      topPattern: 'floral',
      accent: C.gold,
      flare: 0.05,
      overlays: [{ kind: 'collar', color: C.gold }],
      hair: 'bun',
    },
  },
  aodai: {
    man: { body: 'tunic-pants', top: C.blue, bottom: C.white },
    woman: {
      body: 'tunic-pants',
      top: C.gold,
      bottom: C.white,
      pattern: 'floral',
      accent: C.white,
      headwear: { kind: 'conical', color: C.straw },
      hair: 'long',
    },
  },
  kebaya: {
    man: {
      body: 'shirt-pants',
      top: C.brown,
      topPattern: 'batik',
      accent: C.gold,
      bottom: C.black,
      headwear: { kind: 'kufi', color: C.black },
    },
    woman: {
      body: 'dress',
      top: C.rose,
      topPattern: 'floral',
      accent: C.white,
      bottom: C.brown,
      pattern: 'batik',
      flare: 0.05,
      hair: 'bun',
    },
  },
  wrap: {
    man: { body: 'wrap', top: '#f5f0e1', bottom: C.denim, pattern: 'plaid', accent: C.sky },
    woman: {
      body: 'wrap',
      top: C.gold,
      bottom: C.purple,
      pattern: 'stripes',
      accent: C.gold,
      overlays: [{ kind: 'pallu', color: C.gold }],
      hair: 'bun',
    },
  },
  robe: {
    man: {
      body: 'robe',
      top: C.blue,
      accent: C.gold,
      overlays: [{ kind: 'sash', color: C.orange }],
      headwear: { kind: 'tall-cap', color: C.white, accent: C.ink },
      shoes: C.leather,
    },
    woman: {
      body: 'dress',
      top: C.crimson,
      bottom: C.crimson,
      pattern: 'zigzag',
      accent: C.gold,
      flare: 0.3,
      overlays: [{ kind: 'vest', color: C.navy, pattern: 'embroidery', accent: C.gold }],
      hair: 'braid',
    },
  },
  gulf: {
    man: { body: 'robe', top: C.white, headwear: { kind: 'ghutra', color: C.white } },
    woman: { body: 'robe', top: C.black, headwear: { kind: 'headscarf', color: C.black } },
  },
  kaftan: {
    varied: true,
    man: { body: 'robe', top: '#e9dcc0', accent: C.brown, headwear: { kind: 'kufi', color: C.white, pattern: 'embroidery', accent: C.red } },
    woman: {
      body: 'robe',
      top: C.teal,
      accent: C.gold,
      hem: { color: C.gold, pattern: 'embroidery', accent: C.crimson },
      headwear: { kind: 'headscarf', color: C.gold },
    },
  },
  westafrica: {
    varied: true,
    man: {
      body: 'robe',
      top: C.blue,
      pattern: 'embroidery',
      accent: C.gold,
      headwear: { kind: 'kufi', color: C.blue, pattern: 'embroidery', accent: C.gold },
    },
    woman: {
      body: 'dress',
      top: C.orange,
      bottom: C.orange,
      pattern: 'zigzag',
      topPattern: 'zigzag',
      accent: C.forest,
      flare: 0.1,
      headwear: { kind: 'gele', color: C.orange },
    },
  },
  eastafrica: {
    varied: true,
    man: {
      body: 'robe',
      top: C.white,
      overlays: [{ kind: 'jacket', color: C.navy }],
      headwear: { kind: 'kufi', color: C.white, pattern: 'embroidery', accent: C.crimson },
    },
    woman: {
      body: 'dress',
      top: C.teal,
      bottom: C.teal,
      pattern: 'batik',
      topPattern: 'batik',
      accent: C.gold,
      flare: 0.15,
      headwear: { kind: 'headwrap', color: C.orange },
    },
  },
  habesha: {
    man: { body: 'shirt-pants', top: C.white, bottom: C.white, overlays: [{ kind: 'shawl', color: C.white }] },
    woman: {
      body: 'dress',
      top: C.white,
      bottom: C.white,
      accent: C.green,
      hem: { color: C.green, pattern: 'zigzag', accent: C.gold },
      flare: 0.3,
      overlays: [{ kind: 'shawl', color: C.white, accent: C.green }],
      hair: 'braid',
    },
  },
  southernafrica: {
    varied: true,
    man: {
      body: 'shirt-pants',
      top: '#f5f0e1',
      bottom: C.leather,
      overlays: [{ kind: 'blanket', color: C.blue, pattern: 'zigzag', accent: C.gold }],
      headwear: { kind: 'felt-hat', color: C.leather, accent: C.gold },
    },
    woman: {
      body: 'dress',
      top: '#2e5e8c',
      bottom: '#2e5e8c',
      pattern: 'dots',
      topPattern: 'dots',
      accent: C.white,
      flare: 0.5,
      overlays: [{ kind: 'apron', color: C.white }],
      headwear: { kind: 'headwrap', color: C.crimson },
    },
  },
  andean: {
    man: {
      body: 'shirt-pants',
      top: C.white,
      bottom: C.black,
      overlays: [{ kind: 'poncho', color: C.crimson, pattern: 'stripes', accent: C.gold }],
      headwear: { kind: 'chullo', color: C.gold, accent: C.red },
    },
    woman: {
      body: 'dress',
      top: C.white,
      bottom: C.purple,
      flare: 1,
      overlays: [{ kind: 'shawl', color: C.red, pattern: 'stripes', accent: C.gold }],
      headwear: { kind: 'bowler', color: '#4a3b35' },
      hair: 'braid',
    },
  },
  latin: {
    varied: true,
    man: {
      body: 'shirt-pants',
      top: C.white,
      bottom: C.ink,
      overlays: [{ kind: 'sash', color: C.red }],
      headwear: { kind: 'sombrero', color: C.straw, accent: C.red },
    },
    woman: {
      body: 'dress',
      top: C.white,
      topPattern: 'embroidery',
      bottom: C.red,
      pattern: 'stripes',
      accent: C.green,
      flare: 1,
      headwear: { kind: 'flower', color: C.pink },
      hair: 'braid',
    },
  },
  gaucho: {
    man: {
      body: 'shirt-pants',
      top: C.white,
      bottom: '#4a3b35',
      overlays: [{ kind: 'poncho', color: '#8b1e1e', pattern: 'stripes', accent: C.ink }],
      headwear: { kind: 'beret', color: C.ink },
      shoes: C.leather,
    },
    woman: { body: 'dress', top: C.white, bottom: C.blue, pattern: 'floral', accent: C.white, flare: 0.7, hair: 'braid' },
  },
  caribbean: {
    varied: true,
    man: {
      body: 'shirt-pants',
      top: C.white,
      bottom: '#f5f0e1',
      overlays: [{ kind: 'sash', color: C.red, pattern: 'plaid', accent: C.gold }],
      headwear: { kind: 'straw-hat', color: C.straw, accent: C.red },
    },
    woman: {
      body: 'dress',
      top: C.white,
      bottom: C.gold,
      pattern: 'plaid',
      accent: C.red,
      flare: 0.8,
      headwear: { kind: 'headwrap', color: C.gold, pattern: 'plaid', accent: C.red },
    },
  },
  europefolk: {
    varied: true,
    man: {
      body: 'shirt-pants',
      top: C.white,
      bottom: C.leather,
      overlays: [{ kind: 'vest', color: C.forest }],
      headwear: { kind: 'felt-hat', color: C.forest, accent: C.red },
      shoes: C.leather,
    },
    woman: {
      body: 'dress',
      top: C.white,
      bottom: C.blue,
      flare: 0.7,
      overlays: [
        { kind: 'bodice', color: C.red, accent: C.gold },
        { kind: 'apron', color: C.rose },
      ],
      hair: 'braid',
    },
  },
  slavic: {
    varied: true,
    man: {
      body: 'shirt-pants',
      top: C.white,
      topPattern: 'embroidery',
      accent: C.red,
      bottom: C.navy,
      overlays: [{ kind: 'sash', color: C.red }],
      shoes: C.black,
    },
    woman: {
      body: 'dress',
      top: C.white,
      topPattern: 'embroidery',
      accent: C.red,
      bottom: C.red,
      flare: 0.6,
      headwear: { kind: 'flower-crown', color: C.pink },
      hair: 'braid',
    },
  },
  mediterranean: {
    varied: true,
    man: {
      body: 'pleated',
      top: C.white,
      bottom: C.white,
      overlays: [{ kind: 'vest', color: C.navy, pattern: 'embroidery', accent: C.gold }],
      headwear: { kind: 'fez', color: C.red },
      legs: C.white,
    },
    woman: {
      body: 'dress',
      top: C.white,
      bottom: C.navy,
      flare: 0.6,
      overlays: [{ kind: 'vest', color: C.crimson, pattern: 'embroidery', accent: C.gold }],
      headwear: { kind: 'fez', color: C.red },
      hair: 'braid',
    },
  },
  caucasus: {
    man: {
      body: 'robe',
      top: C.ink,
      overlays: [
        { kind: 'gazyri', color: '#d7dbe8' },
        { kind: 'sash', color: '#d7dbe8' },
      ],
      headwear: { kind: 'papakha', color: '#4a3b35' },
    },
    woman: {
      body: 'dress',
      top: C.white,
      bottom: C.white,
      pattern: 'embroidery',
      accent: C.gold,
      flare: 0.6,
      headwear: { kind: 'veil', color: C.white, accent: C.gold },
      hair: 'braid',
    },
  },
  pacific: {
    varied: true,
    man: { body: 'wrap', top: C.orange, topPattern: 'floral', accent: C.white, bottom: C.navy },
    woman: {
      body: 'dress',
      top: C.green,
      topPattern: 'floral',
      bottom: C.green,
      pattern: 'floral',
      accent: C.white,
      flare: 0.1,
      headwear: { kind: 'flower', color: C.pink },
      hair: 'long',
    },
  },
  kilt: {
    man: {
      body: 'kilt',
      top: C.white,
      bottom: C.forest,
      pattern: 'plaid',
      accent: C.navy,
      overlays: [{ kind: 'jacket', color: C.ink }],
      headwear: { kind: 'beret', color: C.ink },
      legs: C.white,
    },
    woman: {
      body: 'dress',
      top: C.white,
      bottom: C.crimson,
      pattern: 'plaid',
      accent: C.forest,
      flare: 0.5,
      overlays: [{ kind: 'pallu', color: C.crimson, pattern: 'plaid', accent: C.forest }],
      hair: 'long',
    },
  },
  modern: {
    man: { body: 'shirt-pants', top: C.blue, bottom: C.denim, overlays: [{ kind: 'jacket', color: C.orange }] },
    woman: { body: 'shirt-pants', top: C.pink, bottom: C.denim, hair: 'long' },
  },
  parka: {
    man: { body: 'parka', top: C.red, bottom: C.ink, headwear: { kind: 'hood', color: C.red } },
    woman: { body: 'parka', top: C.orange, bottom: C.ink, headwear: { kind: 'hood', color: C.orange } },
  },
};

interface CountryCostume {
  family: Family;
  labels?: { man?: string; woman?: string };
  /** Replaces the label line for looks that are a cultural shorthand rather than a dress. */
  note?: string;
  man?: Partial<Outfit>;
  woman?: Partial<Outfit>;
  /** Skin tones [man, woman], where the subregion's don't suit the country. */
  skin?: [string, string];
}

const sari = FAMILIES.sari.woman;

const COUNTRY_COSTUMES: Record<string, CountryCostume> = {
  // South Asia
  IND: { family: 'sari', labels: { man: 'Kurta & pajama', woman: 'Sari' } },
  BGD: {
    family: 'sari',
    labels: { man: 'Panjabi & pajama', woman: 'Sari' },
    woman: { top: C.forest, bottom: C.red, overlays: [{ kind: 'pallu', color: C.red, pattern: 'embroidery', accent: C.gold }] },
  },
  LKA: {
    family: 'sari',
    labels: { man: 'Sarong & shirt', woman: 'Osariya (Kandyan sari)' },
    man: { body: 'wrap', top: C.white, bottom: C.white, pattern: undefined, overlays: [] },
    woman: { top: C.white, bottom: C.white, accent: C.gold, overlays: [{ kind: 'pallu', color: C.white, pattern: 'embroidery', accent: C.gold }] },
  },
  NPL: {
    family: 'shalwar',
    labels: { man: 'Daura-suruwal & dhaka topi', woman: 'Sari' },
    man: { top: C.white, bottom: C.white, overlays: [{ kind: 'vest', color: C.ink }], headwear: { kind: 'topi', color: C.crimson, pattern: 'zigzag', accent: C.gold } },
    woman: { ...sari, pattern: undefined, topPattern: undefined, bottom: C.red, overlays: [{ kind: 'pallu', color: C.red, pattern: 'embroidery', accent: C.gold }] },
  },
  PAK: {
    family: 'shalwar',
    labels: { man: 'Shalwar kameez', woman: 'Shalwar kameez & dupatta' },
    woman: { top: C.forest, overlays: [{ kind: 'dupatta', color: C.white }] },
  },
  AFG: {
    family: 'shalwar',
    labels: { man: 'Perahan tunban', woman: 'Embroidered Afghan dress' },
    woman: { top: C.red, pattern: 'embroidery', overlays: [{ kind: 'dupatta', color: C.black }] },
  },
  BTN: {
    family: 'robe',
    labels: { man: 'Gho', woman: 'Kira' },
    man: { body: 'tunic-pants', top: C.crimson, pattern: 'plaid', accent: C.gold, bottom: C.black, overlays: [{ kind: 'sash', color: C.gold }], headwear: undefined },
    woman: { body: 'dress', top: C.gold, bottom: C.teal, pattern: 'stripes', accent: C.crimson, flare: 0, overlays: [{ kind: 'jacket', color: C.gold }] },
  },
  IRN: { family: 'kaftan' },
  MDV: { family: 'wrap' },

  // East Asia
  JPN: { family: 'kimono', labels: { man: 'Kimono', woman: 'Kimono with obi' } },
  KOR: { family: 'hanbok', labels: { man: 'Hanbok', woman: 'Hanbok' } },
  PRK: { family: 'hanbok', labels: { man: 'Hanbok', woman: 'Hanbok (joseon-ot)' }, woman: { top: C.white, bottom: C.blue } },
  CHN: { family: 'qipao', labels: { man: 'Changshan', woman: 'Qipao' } },
  TWN: { family: 'qipao', labels: { man: 'Changshan', woman: 'Qipao' }, woman: { top: C.blue, bottom: C.blue } },
  HKG: { family: 'qipao', labels: { man: 'Changshan', woman: 'Qipao' }, woman: { top: C.purple, bottom: C.purple } },
  MAC: { family: 'qipao', labels: { man: 'Changshan', woman: 'Qipao' }, woman: { top: C.forest, bottom: C.forest } },
  MNG: {
    family: 'robe',
    labels: { man: 'Deel', woman: 'Deel' },
    man: { headwear: { kind: 'tall-cap', color: C.blue, accent: C.gold } },
    woman: { body: 'robe', top: C.pink, pattern: undefined, overlays: [{ kind: 'sash', color: C.gold }], headwear: { kind: 'tall-cap', color: C.crimson, accent: C.gold } },
  },

  // South-East Asia
  VNM: { family: 'aodai', labels: { man: 'Áo dài', woman: 'Áo dài & nón lá' } },
  THA: { family: 'wrap', labels: { man: 'Chut thai', woman: 'Chut thai' }, man: { bottom: C.navy, pattern: undefined, overlays: [{ kind: 'jacket', color: C.white }] } },
  KHM: { family: 'wrap', labels: { man: 'Sampot', woman: 'Sampot' }, woman: { bottom: C.gold, pattern: 'zigzag', accent: C.crimson } },
  LAO: { family: 'wrap', labels: { woman: 'Sinh' }, woman: { bottom: C.crimson, pattern: 'zigzag', accent: C.gold } },
  MMR: { family: 'wrap', labels: { man: 'Longyi', woman: 'Longyi (htamein)' } },
  IDN: { family: 'kebaya', labels: { man: 'Batik shirt & peci', woman: 'Kebaya & batik' } },
  MYS: {
    family: 'kebaya',
    labels: { man: 'Baju Melayu & songkok', woman: 'Baju kurung' },
    man: { body: 'tunic-pants', top: C.teal, topPattern: undefined, bottom: C.teal, overlays: [{ kind: 'sash', color: C.gold, pattern: 'batik', accent: C.brown }] },
    woman: { body: 'tunic-pants', top: C.pink, topPattern: undefined, pattern: 'floral', bottom: C.pink },
  },
  BRN: {
    family: 'kebaya',
    labels: { man: 'Baju Melayu & songkok', woman: 'Baju kurung' },
    man: { body: 'tunic-pants', top: C.gold, topPattern: undefined, bottom: C.gold, overlays: [{ kind: 'sash', color: C.ink }] },
    woman: { body: 'tunic-pants', top: C.blue, topPattern: undefined, pattern: 'floral', bottom: C.blue },
  },
  PHL: {
    family: 'kebaya',
    labels: { man: 'Barong tagalog', woman: 'Filipiniana (terno)' },
    man: { top: '#f5f0e1', topPattern: 'embroidery', accent: '#c9b98f', bottom: C.black, headwear: undefined },
    woman: { top: C.white, topPattern: undefined, bottom: C.pink, pattern: undefined, flare: 0.6, sleeves: 'puff' },
  },
  TLS: { family: 'wrap', labels: { man: 'Tais', woman: 'Tais' }, man: { bottom: C.crimson, pattern: 'zigzag', accent: C.gold } },
  SGP: { family: 'kebaya' },

  // Central Asia
  KAZ: { family: 'robe', labels: { man: 'Chapan' } },
  KGZ: { family: 'robe', labels: { man: 'Chapan & ak kalpak' } },
  UZB: {
    family: 'robe',
    labels: { man: 'Chapan & doppi', woman: 'Atlas silk dress' },
    man: { pattern: 'stripes', accent: C.gold, headwear: { kind: 'kufi', color: C.black, pattern: 'embroidery', accent: C.white } },
    woman: { top: C.pink, bottom: C.pink, pattern: 'zigzag', accent: C.gold, overlays: [] },
  },
  TJK: { family: 'robe', labels: { man: 'Chapan' } },
  TKM: { family: 'robe', labels: { man: 'Telpek & robe' }, man: { top: C.crimson, headwear: { kind: 'papakha', color: '#f5f0e1' } } },

  // Western Asia and the Caucasus
  SAU: {
    family: 'gulf',
    labels: { man: 'Thobe & shemagh', woman: 'Abaya' },
    man: { headwear: { kind: 'ghutra', color: C.white, pattern: 'plaid', accent: C.red } },
  },
  ARE: { family: 'gulf', labels: { man: 'Kandura & ghutra', woman: 'Abaya' } },
  QAT: { family: 'gulf', labels: { man: 'Thobe & ghutra', woman: 'Abaya' } },
  KWT: { family: 'gulf', labels: { man: 'Thobe & ghutra', woman: 'Abaya' } },
  BHR: { family: 'gulf', labels: { man: 'Thobe & ghutra', woman: 'Abaya' } },
  OMN: {
    family: 'gulf',
    labels: { man: 'Dishdasha & kuma', woman: 'Abaya' },
    man: { headwear: { kind: 'kufi', color: C.white, pattern: 'embroidery', accent: C.teal } },
  },
  YEM: { family: 'gulf' },
  JOR: {
    family: 'kaftan',
    labels: { man: 'Thobe & red shemagh', woman: 'Embroidered thobe' },
    man: { top: C.white, headwear: { kind: 'ghutra', color: C.white, pattern: 'plaid', accent: C.red } },
    woman: { top: C.black, pattern: 'embroidery', accent: C.red, headwear: { kind: 'headscarf', color: C.white } },
  },
  PSE: {
    family: 'kaftan',
    labels: { woman: 'Embroidered thobe (tatreez)' },
    woman: { top: C.black, pattern: 'embroidery', accent: C.red, headwear: { kind: 'headscarf', color: C.white } },
  },
  ISR: { family: 'modern', note: 'No single traditional dress — everyday clothes (illustrative)' },
  TUR: {
    family: 'mediterranean',
    labels: { man: 'Şalvar & yelek', woman: 'Entari' },
    man: { body: 'shirt-pants', bottom: C.navy, overlays: [{ kind: 'vest', color: C.crimson, pattern: 'embroidery', accent: C.gold }, { kind: 'sash', color: C.gold }] },
    woman: { body: 'robe', top: C.crimson, pattern: 'embroidery', accent: C.gold, overlays: [], headwear: { kind: 'headscarf', color: C.white } },
  },
  GEO: { family: 'caucasus', labels: { man: 'Chokha', woman: 'Kartuli' } },
  ARM: {
    family: 'caucasus',
    labels: { man: 'Taraz', woman: 'Taraz' },
    man: { top: C.crimson, overlays: [{ kind: 'sash', color: C.gold }] },
    woman: { top: C.crimson, bottom: C.crimson, accent: C.gold },
  },
  AZE: { family: 'caucasus', labels: { man: 'Chokha & papakha', woman: 'Arkhalig' }, woman: { top: C.blue, bottom: C.crimson } },

  // Northern Africa
  MAR: { family: 'kaftan', labels: { man: 'Djellaba', woman: 'Kaftan' }, man: { top: '#d9c7a3' }, woman: { top: C.forest } },
  DZA: { family: 'kaftan', labels: { man: 'Burnous', woman: 'Karakou' }, man: { top: C.white }, woman: { top: C.crimson } },
  TUN: { family: 'kaftan', labels: { man: 'Jebba & chechia' }, man: { top: C.white, headwear: { kind: 'fez', color: C.red } } },
  EGY: { family: 'kaftan', labels: { man: 'Galabeya', woman: 'Galabeya' } },
  SDN: {
    family: 'kaftan',
    labels: { man: 'Jalabiya & imma', woman: 'Toob' },
    man: { top: C.white, headwear: { kind: 'turban', color: C.white } },
    woman: { body: 'dress', top: C.orange, bottom: C.orange, pattern: 'floral', accent: C.white, flare: 0.1, headwear: { kind: 'headscarf', color: C.orange } },
  },

  // Western Africa
  NGA: {
    family: 'westafrica',
    labels: { man: 'Agbada & fila', woman: 'Iro, buba & gele' },
    man: { top: C.forest, headwear: { kind: 'kufi', color: C.forest, pattern: 'embroidery', accent: C.gold } },
    woman: { top: C.purple, bottom: C.purple, accent: C.gold, headwear: { kind: 'gele', color: C.gold } },
  },
  GHA: {
    family: 'westafrica',
    labels: { man: 'Kente cloth', woman: 'Kente dress' },
    man: { pattern: 'kente', headwear: undefined },
    woman: { pattern: 'kente', topPattern: 'kente', headwear: { kind: 'headwrap', color: C.gold, pattern: 'kente' } },
  },
  SEN: { family: 'westafrica', labels: { man: 'Grand boubou', woman: 'Boubou' }, man: { top: C.sky }, woman: { top: C.green, bottom: C.green } },
  MLI: { family: 'westafrica', labels: { man: 'Boubou', woman: 'Boubou' }, man: { top: C.white, accent: C.blue }, woman: { top: C.blue, bottom: C.blue } },

  // Eastern Africa
  ETH: { family: 'habesha', labels: { man: 'Gabi (cotton shawl)', woman: 'Habesha kemis' } },
  ERI: { family: 'habesha', labels: { woman: 'Zuria' }, woman: { hem: { color: C.blue, pattern: 'zigzag', accent: C.gold } } },
  TZA: { family: 'eastafrica', labels: { man: 'Kanzu & kofia', woman: 'Kanga' } },
  UGA: {
    family: 'eastafrica',
    labels: { man: 'Kanzu', woman: 'Gomesi' },
    woman: { top: C.gold, bottom: C.gold, pattern: undefined, topPattern: undefined, flare: 0.5, overlays: [{ kind: 'sash', color: C.crimson }], headwear: undefined, hair: 'short' },
  },
  RWA: {
    family: 'eastafrica',
    labels: { woman: 'Umushanana' },
    woman: { top: C.cream, bottom: C.cream, pattern: undefined, topPattern: undefined, overlays: [{ kind: 'pallu', color: C.cream, pattern: 'embroidery', accent: C.gold }], headwear: undefined, hair: 'bun' },
  },
  SOM: {
    family: 'eastafrica',
    labels: { man: 'Macawis', woman: 'Dirac' },
    man: { body: 'wrap', top: C.white, bottom: C.crimson, pattern: 'plaid', accent: C.gold, overlays: [] },
    woman: { top: C.pink, bottom: C.pink, pattern: 'floral', topPattern: 'floral', accent: C.gold, headwear: { kind: 'headscarf', color: C.gold } },
  },
  MDG: {
    family: 'eastafrica',
    labels: { man: 'Lamba', woman: 'Lamba' },
    man: { overlays: [{ kind: 'shawl', color: C.white }], headwear: { kind: 'straw-hat', color: C.straw, accent: C.ink } },
    woman: { top: C.white, bottom: C.white, pattern: undefined, topPattern: undefined, overlays: [{ kind: 'shawl', color: C.white }], headwear: undefined, hair: 'bun' },
  },

  // Southern Africa
  LSO: {
    family: 'southernafrica',
    labels: { man: 'Basotho blanket & mokorotlo', woman: 'Seshoeshoe dress & blanket' },
    man: { headwear: { kind: 'mokorotlo', color: C.straw } },
    woman: { overlays: [{ kind: 'shawl', color: C.forest, pattern: 'zigzag', accent: C.gold }] },
  },
  ZAF: { family: 'southernafrica', labels: { woman: 'Shweshwe dress' } },
  SWZ: {
    family: 'southernafrica',
    labels: { man: 'Emahiya', woman: 'Emahiya' },
    man: { body: 'wrap', top: C.red, topPattern: 'dots', bottom: C.red, accent: C.white, overlays: [], headwear: undefined },
    woman: { top: C.red, bottom: C.red, pattern: 'dots', topPattern: 'dots', overlays: [{ kind: 'pallu', color: C.blue, pattern: 'dots', accent: C.white }] },
  },

  // Europe
  DEU: { family: 'europefolk', labels: { man: 'Lederhosen (Bavaria)', woman: 'Dirndl (Bavaria)' } },
  AUT: { family: 'europefolk', labels: { man: 'Lederhosen', woman: 'Dirndl' }, woman: { bottom: C.forest } },
  CHE: {
    family: 'europefolk',
    labels: { man: 'Swiss Tracht', woman: 'Swiss Tracht' },
    man: { overlays: [{ kind: 'vest', color: C.red }], headwear: { kind: 'felt-hat', color: C.ink, accent: C.white } },
    woman: { bottom: C.ink },
  },
  NOR: {
    family: 'europefolk',
    labels: { man: 'Bunad', woman: 'Bunad' },
    man: { bottom: C.ink, overlays: [{ kind: 'vest', color: C.crimson, pattern: 'embroidery', accent: C.gold }], headwear: undefined },
    woman: { bottom: C.ink, overlays: [{ kind: 'bodice', color: C.crimson, accent: C.gold }, { kind: 'apron', color: C.white, pattern: 'embroidery', accent: C.red }] },
  },
  SWE: {
    family: 'europefolk',
    labels: { man: 'Folkdräkt', woman: 'Folkdräkt' },
    man: { bottom: C.gold, overlays: [{ kind: 'vest', color: C.blue }], headwear: undefined },
    woman: { bottom: C.blue, overlays: [{ kind: 'bodice', color: C.blue, accent: C.gold }, { kind: 'apron', color: C.gold }] },
  },
  FIN: {
    family: 'europefolk',
    labels: { man: 'Kansallispuku', woman: 'Kansallispuku' },
    man: { bottom: C.navy, overlays: [{ kind: 'vest', color: C.navy }], headwear: undefined },
    woman: { bottom: C.red, pattern: 'stripes', accent: C.navy, overlays: [{ kind: 'bodice', color: C.navy, accent: C.white }, { kind: 'apron', color: C.white }] },
  },
  ISL: { family: 'europefolk', labels: { woman: 'Þjóðbúningur' }, woman: { bottom: C.black, overlays: [{ kind: 'bodice', color: C.black, accent: C.gold }] } },
  NLD: {
    family: 'europefolk',
    labels: { man: 'Klederdracht & clogs', woman: 'Klederdracht & clogs' },
    man: { bottom: C.ink, overlays: [{ kind: 'jacket', color: C.ink }], headwear: { kind: 'kufi', color: C.ink }, shoes: '#f2d59b' },
    woman: { bottom: C.ink, overlays: [{ kind: 'bodice', color: C.red, pattern: 'floral', accent: C.white }, { kind: 'apron', color: C.blue, pattern: 'stripes', accent: C.white }], headwear: { kind: 'lace-cap', color: C.white }, shoes: '#f2d59b' },
  },
  GBR: { family: 'kilt', labels: { man: 'Kilt (Scottish Highland dress)', woman: 'Tartan dress (Scotland)' } },
  FRA: {
    family: 'modern',
    note: 'A classic French look: the striped Breton marinière and beret (illustrative)',
    man: { top: C.white, topPattern: 'bands', accent: C.navy, overlays: [], headwear: { kind: 'beret', color: C.ink } },
    woman: { body: 'dress', top: C.white, topPattern: 'bands', accent: C.navy, bottom: C.red, flare: 0.4, headwear: { kind: 'beret', color: C.red } },
  },
  ESP: {
    family: 'latin',
    labels: { man: 'Traje corto (Andalusia)', woman: 'Flamenco dress (Andalusia)' },
    man: { top: C.white, bottom: C.ink, overlays: [{ kind: 'jacket', color: C.ink }, { kind: 'sash', color: C.red }], headwear: { kind: 'felt-hat', color: C.ink, accent: C.ink } },
    woman: { top: C.red, topPattern: 'dots', bottom: C.red, pattern: 'dots', accent: C.white, headwear: { kind: 'flower', color: C.white } },
  },
  PRT: {
    family: 'europefolk',
    labels: { woman: 'Traje à vianesa (Minho)' },
    woman: { bottom: C.red, pattern: 'zigzag', accent: C.gold, overlays: [{ kind: 'apron', color: C.ink, pattern: 'floral', accent: C.gold }], headwear: { kind: 'headscarf', color: C.red } },
  },
  GRC: { family: 'mediterranean', labels: { man: 'Fustanella', woman: 'Amalia dress' } },
  ALB: {
    family: 'mediterranean',
    labels: { man: 'Fustanella & qeleshe', woman: 'Xhubleta' },
    man: { headwear: { kind: 'tall-cap', color: C.white, accent: C.white }, overlays: [{ kind: 'vest', color: C.crimson, pattern: 'embroidery', accent: C.gold }] },
    woman: { bottom: C.black, flare: 1, headwear: undefined },
  },
  ROU: { family: 'slavic', labels: { man: 'Cămașă (embroidered shirt)', woman: 'Ie (embroidered blouse)' }, woman: { bottom: C.black, headwear: undefined } },
  MDA: { family: 'slavic', labels: { woman: 'Ie (embroidered blouse)' }, woman: { bottom: C.navy, headwear: undefined } },
  BGR: { family: 'slavic', labels: { man: 'Nosia (folk costume)', woman: 'Nosia (folk costume)' }, woman: { bottom: C.black, overlays: [{ kind: 'apron', color: C.red, pattern: 'stripes', accent: C.gold }] } },
  SRB: { family: 'slavic', labels: { man: 'Šajkača cap & folk costume' }, man: { headwear: { kind: 'kufi', color: '#4a3b35' } } },
  UKR: {
    family: 'slavic',
    labels: { man: 'Vyshyvanka', woman: 'Vyshyvanka & vinok' },
    man: { bottom: C.blue },
    woman: { bottom: C.blue, headwear: { kind: 'flower-crown', color: C.red } },
  },
  BLR: { family: 'slavic', labels: { man: 'Embroidered folk shirt', woman: 'Embroidered folk costume' } },
  RUS: {
    family: 'slavic',
    labels: { man: 'Kosovorotka', woman: 'Sarafan & kokoshnik' },
    man: { top: C.red, topPattern: 'embroidery', accent: C.gold, overlays: [{ kind: 'sash', color: C.gold }] },
    woman: { top: C.white, bottom: C.crimson, pattern: 'embroidery', accent: C.gold, flare: 0.4, headwear: { kind: 'kokoshnik', color: C.crimson, accent: C.gold } },
  },
  POL: {
    family: 'slavic',
    labels: { man: 'Strój krakowski (Kraków)', woman: 'Strój krakowski (Kraków)' },
    man: { overlays: [{ kind: 'jacket', color: C.blue }, { kind: 'sash', color: C.red }], headwear: { kind: 'tall-cap', color: C.red, accent: C.ink } },
    woman: { bottom: C.red, pattern: 'floral', accent: C.gold, overlays: [{ kind: 'bodice', color: C.ink, accent: C.gold }, { kind: 'apron', color: C.white }] },
  },

  // Americas
  MEX: {
    family: 'latin',
    labels: { man: 'Charro suit & sombrero', woman: 'China poblana' },
    skin: ['#c99567', '#d7a274'],
    man: { top: C.white, bottom: C.ink, overlays: [{ kind: 'jacket', color: C.ink }, { kind: 'sash', color: C.red }] },
    woman: { bottom: C.red, pattern: 'zigzag', accent: C.green },
  },
  GTM: { family: 'latin', labels: { woman: 'Huipil & corte' }, woman: { top: C.white, topPattern: 'zigzag', accent: C.purple, bottom: C.navy, pattern: 'stripes', flare: 0.1, headwear: undefined } },
  PAN: {
    family: 'latin',
    labels: { man: 'Montuno & sombrero pintao', woman: 'Pollera' },
    man: { bottom: C.white, overlays: [], headwear: { kind: 'straw-hat', color: C.straw, accent: C.ink } },
    woman: { top: C.white, topPattern: 'floral', accent: C.red, bottom: C.white, pattern: 'floral', headwear: { kind: 'flower', color: C.gold } },
  },
  CUB: {
    family: 'latin',
    labels: { man: 'Guayabera', woman: 'Bata cubana' },
    man: { top: C.white, bottom: '#f5f0e1', overlays: [], headwear: { kind: 'straw-hat', color: C.straw, accent: C.ink } },
    woman: { top: C.white, topPattern: undefined, bottom: C.white, pattern: 'stripes', accent: C.red, headwear: { kind: 'headwrap', color: C.red } },
  },
  COL: {
    family: 'latin',
    labels: { man: 'Sombrero vueltiao', woman: 'Pollera colorá' },
    man: { overlays: [{ kind: 'sash', color: C.red }], headwear: { kind: 'straw-hat', color: C.straw, accent: C.ink } },
    woman: { bottom: C.gold, pattern: 'stripes', accent: C.red },
  },
  VEN: { family: 'latin', labels: { man: 'Liqui liqui' }, man: { overlays: [], headwear: { kind: 'straw-hat', color: C.straw, accent: C.ink } } },
  PER: { family: 'andean', labels: { man: 'Poncho & chullo', woman: 'Pollera & montera' }, woman: { headwear: { kind: 'sombrero', color: C.ink, accent: C.red } } },
  BOL: { family: 'andean', labels: { man: 'Poncho & chullo', woman: 'Pollera & bowler hat' } },
  ECU: { family: 'andean' },
  CHL: {
    family: 'gaucho',
    labels: { man: 'Huaso: chamanto & chupalla', woman: 'China dress' },
    man: { headwear: { kind: 'straw-hat', color: C.straw, accent: C.ink } },
    woman: { bottom: C.red, pattern: 'floral' },
  },
  ARG: { family: 'gaucho', labels: { man: 'Gaucho: poncho & bombachas' } },
  URY: { family: 'gaucho', labels: { man: 'Gaucho: poncho & bombachas' } },
  PRY: { family: 'latin', labels: { woman: "Ao po'i blouse" }, woman: { top: C.white, topPattern: 'embroidery', accent: C.blue, bottom: C.white, pattern: 'stripes' } },
  BRA: {
    family: 'latin',
    labels: { woman: 'Baiana dress (Bahia)' },
    man: { top: C.white, bottom: C.white, overlays: [], headwear: { kind: 'straw-hat', color: C.straw, accent: C.ink } },
    woman: { top: C.white, topPattern: 'embroidery', accent: C.gold, bottom: C.white, pattern: 'embroidery', headwear: { kind: 'headwrap', color: C.white } },
  },
  USA: { family: 'modern', note: 'No single traditional dress — everyday clothes (illustrative)' },
  CAN: { family: 'modern', note: 'No single traditional dress — everyday clothes (illustrative)', man: { overlays: [{ kind: 'jacket', color: C.red, pattern: 'plaid', accent: C.ink }] } },
  GRL: {
    family: 'europefolk',
    labels: { man: 'Kalaallisuut (white anorak)', woman: 'Kalaallisuut' },
    skin: ['#d6a578', '#dcae80'],
    man: { body: 'shirt-pants', top: C.white, bottom: C.black, overlays: [], headwear: undefined },
    woman: {
      body: 'shirt-pants',
      top: C.red,
      bottom: C.black,
      overlays: [{ kind: 'shawl', color: C.blue, pattern: 'dots', accent: C.gold }],
      shoes: C.white,
      hair: 'bun',
    },
  },
  JAM: { family: 'caribbean', labels: { woman: 'Bandana dress' }, woman: { bottom: C.red, accent: C.gold, headwear: { kind: 'headwrap', color: C.red, pattern: 'plaid', accent: C.gold } } },
  DMA: { family: 'caribbean', labels: { woman: 'Wob dwiyet' } },
  LCA: { family: 'caribbean', labels: { woman: 'Wob dwiyet' } },

  // Oceania
  FJI: { family: 'pacific', labels: { man: 'Sulu', woman: 'Sulu jaba' }, man: { top: C.white, topPattern: undefined, bottom: C.navy } },
  WSM: { family: 'pacific', labels: { man: 'Lavalava', woman: 'Puletasi' } },
  TON: {
    family: 'pacific',
    labels: { man: "Ta'ovala", woman: "Ta'ovala" },
    man: { top: C.white, topPattern: undefined, bottom: C.ink, overlays: [{ kind: 'sash', color: C.straw, pattern: 'zigzag', accent: C.brown }] },
    woman: { overlays: [{ kind: 'sash', color: C.straw, pattern: 'zigzag', accent: C.brown }] },
  },
  AUS: { family: 'modern', note: 'No single traditional dress — everyday clothes (illustrative)' },
  NZL: { family: 'modern', note: 'No single traditional dress — everyday clothes (illustrative)' },

  // Antarctica
  ATA: { family: 'parka', note: 'No native population — scientists here wear warm parkas!' },
};

const SUBREGION_FAMILY: Record<string, Family> = {
  'southern asia': 'shalwar',
  'eastern asia': 'qipao',
  'south eastern asia': 'kebaya',
  'central asia': 'robe',
  'western asia': 'kaftan',
  'northern africa': 'kaftan',
  'western africa': 'westafrica',
  'middle africa': 'westafrica',
  'eastern africa': 'eastafrica',
  'southern africa': 'southernafrica',
  'northern europe': 'europefolk',
  'western europe': 'europefolk',
  'central europe': 'slavic',
  'eastern europe': 'slavic',
  'southeast europe': 'slavic',
  'southern europe': 'mediterranean',
  caribbean: 'caribbean',
  'central america': 'latin',
  'south america': 'latin',
  'north america': 'modern',
  'australia and new zealand': 'modern',
  melanesia: 'pacific',
  micronesia: 'pacific',
  polynesia: 'pacific',
};

const REGION_FAMILY: Record<string, Family> = {
  africa: 'westafrica',
  asia: 'kaftan',
  europe: 'europefolk',
  americas: 'latin',
  oceania: 'pacific',
  antarctic: 'parka',
};

/** Broad, illustrative skin and hair tones by subregion: [man, woman]. */
const SKIN: Record<string, [string, string]> = {
  'northern europe': ['#f6d3b3', '#f3cba8'],
  'western europe': ['#f3cba8', '#eabf98'],
  'central europe': ['#f2c9a5', '#f3cba8'],
  'eastern europe': ['#f2c9a5', '#f3cba8'],
  'southeast europe': ['#e9be96', '#eec49e'],
  'southern europe': ['#e5b88f', '#eabf98'],
  'northern africa': ['#d7a274', '#e0ae82'],
  'western asia': ['#d9a679', '#e3b388'],
  'western africa': ['#7a4a2e', '#8a5534'],
  'middle africa': ['#7a4a2e', '#8a5534'],
  'eastern africa': ['#7f4e30', '#8f5a38'],
  'southern africa': ['#8a5534', '#9c6644'],
  'southern asia': ['#c08a5c', '#c99567'],
  'eastern asia': ['#f0c9a0', '#f2cfa8'],
  'south eastern asia': ['#d6a578', '#dcae80'],
  'central asia': ['#e4b78c', '#e9be94'],
  caribbean: ['#8a5534', '#9c6644'],
  'central america': ['#c99567', '#d7a274'],
  'south america': ['#c99567', '#d7a274'],
  'north america': ['#f2c9a5', '#8a5534'],
  'australia and new zealand': ['#f2c9a5', '#c99567'],
  melanesia: ['#8a5534', '#9c6644'],
  micronesia: ['#a8704a', '#b27a52'],
  polynesia: ['#a8704a', '#b27a52'],
};
const HAIR: Record<string, [string, string]> = {
  'northern europe': ['#b07a3a', '#e0b25a'],
  'western europe': ['#5b3a22', '#8a5a2b'],
  'central europe': ['#6b4426', '#a0703a'],
  'eastern europe': ['#6b4426', '#c08a3e'],
  'north america': ['#6b4426', '#2b1a12'],
  'australia and new zealand': ['#a0703a', '#2b1a12'],
};

/** Subregions where the figures get tightly curled hair. */
const COILY = new Set(['western africa', 'middle africa', 'eastern africa', 'southern africa', 'caribbean', 'melanesia']);

const VIVID = ['#ff6b81', '#ffd23f', '#2ecc71', '#2e86de', '#8e44ad', '#ff9f1c', '#16a085', '#e63946'];

const key = (s: string | undefined) =>
  (s ?? '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
const hash = (s: string) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 17);

export interface ResolvedCostume {
  man: Outfit;
  woman: Outfit;
  skin: [string, string];
  hair: [string, string];
  labels?: { man?: string; woman?: string };
  note?: string;
  /** True when no specific garments are named for this country. */
  illustrative: boolean;
  regionName: string;
}

export function costumeFor(country: Country): ResolvedCostume {
  const entry = COUNTRY_COSTUMES[country.cca3];
  const sub = key(country.subregion);
  const family = entry?.family ?? SUBREGION_FAMILY[sub] ?? REGION_FAMILY[key(country.region)] ?? 'modern';
  const base = FAMILIES[family];
  let man: Outfit = { ...base.man, ...entry?.man };
  let woman: Outfit = { ...base.woman, ...entry?.woman };

  // Countries sharing a family without their own entry get their own colours.
  if (!entry && base.varied) {
    const h = hash(country.cca3);
    man = { ...man, top: man.top === '#ffffff' ? man.top : VIVID[h % VIVID.length] };
    woman = { ...woman, bottom: VIVID[(h >> 3) % VIVID.length], top: woman.top === '#ffffff' ? woman.top : VIVID[(h >> 6) % VIVID.length] };
    if (woman.headwear) woman = { ...woman, headwear: { ...woman.headwear, color: VIVID[(h >> 9) % VIVID.length] } };
  }
  if (COILY.has(sub)) {
    if (!man.hair || man.hair === 'short') man = { ...man, hair: 'coily' };
    if (!woman.hair || woman.hair === 'short' || woman.hair === 'bun') woman = { ...woman, hair: 'puff' };
  }

  return {
    man,
    woman,
    skin: entry?.skin ?? SKIN[sub] ?? ['#d7a274', '#e0ae82'],
    hair: HAIR[sub] ?? ['#2b1a12', '#2b1a12'],
    labels: entry?.labels,
    note: entry?.note,
    illustrative: !entry?.labels,
    regionName: country.subregion ?? country.region,
  };
}

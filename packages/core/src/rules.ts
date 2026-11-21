// Feste Regeln statt KI-Schätzung (ENTWURF zur Prüfung durch Max, 21.11.2026; Prüfseite `pnpm regeln`).
// Jede Regel liefert nur dann einen Wert, wenn Typ, Material oder Name ihn eindeutig festlegen – sonst null (dann KI).
// Noch nicht eingebaut: erst nach Max' Okay zur Tabelle.

import type { Care, CareGroup, MaterialPart, Season } from './attributes';
import { fieldsFor } from './fields';
import { colorTrait } from './traits';

export type RuleInput = {
  category: string | null; subcategory: string | null; type: string | null;
  materials: readonly MaterialPart[]; name: string; colors?: readonly string[];
  /** false = Name ist noch eine offene KI-Bildschätzung → keine Wörter daraus (Max 21.11.2026: nur selbst eingetragene oder aus Shop/Etikett übernommene Namen) */
  nameTrusted?: boolean;
};
const nm = (i: RuleInput) => (i.nameTrusted === false ? '' : i.name);
const norm = (s: string) => ` ${s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ')} `;
const has = (name: string, words: readonly string[]) => { const n = norm(name); return words.find((w) => n.includes(` ${w} `)) ?? null; };
/** Material-Anteile (ohne % gleich verteilt), größter zuerst */
function shares(parts: readonly MaterialPart[]) {
  const known = parts.filter((p) => p.pct != null).reduce((a, p) => a + (p.pct ?? 0), 0);
  const open = parts.filter((p) => p.pct == null).length;
  const rest = open ? Math.max(0, 100 - known) / open : 0;
  return parts.map((p) => ({ name: p.name, share: (p.pct ?? rest) / 100 })).sort((a, b) => b.share - a.share);
}
const main = (i: RuleInput) => shares(i.materials)[0]?.name ?? null;
/** Typ vor Unterkategorie nachschlagen */
const pick = <T>(i: RuleInput, byType: Record<string, T>, bySub: Record<string, T>): T | null =>
  (i.type && byType[i.type] !== undefined ? byType[i.type] : i.subcategory && bySub[i.subcategory] !== undefined ? bySub[i.subcategory] : null) ?? null;

// ---------- Saison aus Wärme ----------

export const SEASONS_BY_WARMTH: readonly (readonly Season[])[] = [
  ['spring', 'summer'], ['spring', 'summer', 'autumn'], ['spring', 'autumn', 'winter'], ['autumn', 'winter'],
];
const ALL_SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
/** Saison aus der Wärme; Teile ohne Wetterfeld (Schmuck, Taschen, Brille …) = ganzjährig */
export function seasonsFrom(category: string | null, sub: string | null, warmth: number | null): readonly Season[] | null {
  if (!fieldsFor(category, sub).weather) return category ? ALL_SEASONS : null;
  return warmth == null ? null : SEASONS_BY_WARMTH[warmth] ?? null;
}

// ---------- Verschluss und Kragen aus dem Typ ----------

export const CLOSURE_BY_TYPE: Record<string, string> = {
  zip_hoodie: 'zipper', half_zip_sweater: 'zipper', half_zip_sweatshirt: 'zipper', henley_t_shirt: 'buttons', henley_long_sleeve: 'buttons', short_sleeve_polo: 'buttons', long_sleeve_polo: 'buttons',
  short_sleeve_shirt: 'buttons', long_sleeve_shirt: 'buttons', short_sleeve_blouse: 'buttons', long_sleeve_blouse: 'buttons',
  single_breasted_blazer: 'buttons', double_breasted_blazer: 'buttons', suit_vest: 'buttons', puffer_vest: 'zipper',
  bomber_jacket: 'zipper', harrington_jacket: 'zipper', track_jacket: 'zipper', rain_jacket: 'zipper', thermal_jacket: 'zipper', windbreaker: 'zipper',
  peacoat: 'buttons', chesterfield_coat: 'buttons', covert_coat: 'buttons',
  oxford: 'laces', derby: 'laces', monk_strap: 'buckle', loafer: 'none', moccasin: 'none', boat_shoe: 'laces', wholecut: 'laces',
  espadrille: 'none', slipper: 'none', chelsea_boot: 'none', desert_boot: 'laces', lace_up_boot: 'laces', rain_boot: 'none', sheepskin_boot: 'none',
  low_top_sneaker: 'laces', mid_top_sneaker: 'laces', high_top_sneaker: 'laces', running_shoe: 'laces', tennis_shoe: 'laces', training_shoe: 'laces',
  basketball_shoe: 'laces', football_boot: 'laces', hiking_boot: 'laces', low_hiking_shoe: 'laces', trail_running_shoe: 'laces',
  pool_slide: 'none', flip_flop: 'none', mule: 'none', ballerina: 'none', mary_jane: 'buckle', slingback: 'buckle',
  pump: 'none', heeled_mule: 'none',
};
export const CLOSURE_BY_SUB: Record<string, string> = {
  shirt: 'buttons', blouse: 'buttons', polo: 'buttons', blazer: 'buttons', trucker_jacket: 'buttons',
  sweat_jacket: 'zipper', puffer_jacket: 'zipper', biker_jacket: 'zipper', blouson: 'zipper', varsity_jacket: 'snaps', coach_jacket: 'snaps',
  clog: 'none', slide: 'none', house_shoe: 'none', sweater: 'none', sweatshirt: 'none',
};
/** Wörter im Name gehen vor (z. B. „Mohair Zipper“ bei einer Strickjacke) */
export const CLOSURE_WORDS: readonly [string, readonly string[]][] = [
  ['zipper', ['zip', 'zipper', 'reissverschluss', 'full zip', 'half zip', 'quarter zip']],
  ['snaps', ['druckknopf', 'druckknopfe', 'snap', 'snaps']],
  ['none', ['slip on', 'slip-on', 'laceless']],
];
export function closureFrom(i: RuleInput): { v: string; why: string } | null {
  if (!fieldsFor(i.category, i.subcategory).closure) return null;
  for (const [v, ws] of CLOSURE_WORDS) { const w = has(nm(i), ws); if (w) return { v, why: `Name „${w}“` }; }
  const v = pick(i, CLOSURE_BY_TYPE, CLOSURE_BY_SUB);
  return v ? { v, why: i.type && CLOSURE_BY_TYPE[i.type] ? 'Typ' : 'Unterkategorie' } : null;
}

export const COLLAR_BY_TYPE: Record<string, string> = {
  zip_hoodie: 'hood', half_zip_sweater: 'stand_collar', half_zip_sweatshirt: 'stand_collar', henley_t_shirt: 'placket', henley_long_sleeve: 'placket', short_sleeve_polo: 'polo_collar', long_sleeve_polo: 'polo_collar',
  single_breasted_blazer: 'lapel_collar', double_breasted_blazer: 'lapel_collar', peacoat: 'lapel_collar', chesterfield_coat: 'lapel_collar',
  bomber_jacket: 'stand_collar', track_jacket: 'stand_collar', harrington_jacket: 'stand_collar',
};
export const COLLAR_BY_SUB: Record<string, string> = {
  hoodie: 'hood', polo: 'polo_collar', blazer: 'lapel_collar', trench_coat: 'lapel_collar', biker_jacket: 'lapel_collar',
  trucker_jacket: 'classic_collar', coach_jacket: 'classic_collar',
};
export const COLLAR_WORDS: readonly [string, readonly string[]][] = [
  ['stand_collar', ['half zip', 'halfzip', 'quarter zip', 'quarterzip', '1 4 zip', 'troyer']],
  ['turtleneck', ['turtleneck', 'rollkragen', 'roll neck', 'rollneck', 'mock neck']],
  ['v_neck', ['v neck', 'vneck', 'v ausschnitt']],
  ['crew_neck', ['crewneck', 'crew neck', 'rundhals', 'rundausschnitt']],
  ['hood', ['hoodie', 'kapuze']],
  ['button_down', ['button down', 'buttondown']],
  ['polo_collar', ['polo']],
  ['placket', ['henley']],
];
export function collarFrom(i: RuleInput): { v: string; why: string } | null {
  if (!fieldsFor(i.category, i.subcategory).neckline) return null;
  for (const [v, ws] of COLLAR_WORDS) { const w = has(nm(i), ws); if (w) return { v, why: `Name „${w}“` }; }
  const v = pick(i, COLLAR_BY_TYPE, COLLAR_BY_SUB);
  return v ? { v, why: i.type && COLLAR_BY_TYPE[i.type] ? 'Typ' : 'Unterkategorie' } : null;
}

// ---------- Absatz und Taschengröße aus dem Typ ----------

export const HEEL_BY_TYPE: Record<string, string> = { western_boot: 'mid', stiletto: 'high', platform_heel: 'high', block_heel: 'mid', wedge: 'mid' };
export const HEEL_BY_SUB: Record<string, string> = {
  sneaker: 'none', sports_shoe: 'none', slip_on: 'none', sandal: 'none', slide: 'none', clog: 'none', flat: 'none', house_shoe: 'none',
  hiking_shoe: 'none', dress_shoe: 'low', boot: 'low',
};
export function heelFrom(i: RuleInput): string | null {
  return i.category === 'shoe' ? pick(i, HEEL_BY_TYPE, HEEL_BY_SUB) : null;
}

export const BAG_SIZE_BY_TYPE: Record<string, string> = {
  minaudiere: 'mini', baguette_bag: 'small', half_moon_bag: 'small', saddle_bag: 'small', hobo_bag: 'medium', bowling_bag: 'medium',
  satchel: 'medium', barrel_bag: 'medium', shopper: 'large', jute_bag: 'large', gym_sack: 'medium', weekender: 'large', duffel_bag: 'large',
  sports_bag: 'large', briefcase: 'large', laptop_bag: 'large',
};
export const BAG_SIZE_BY_SUB: Record<string, string> = { clutch: 'small', belt_bag: 'small', backpack: 'large', cloth_bag: 'large', travel_bag: 'large', work_bag: 'large', suitcase: 'large' };
export function bagSizeFrom(i: RuleInput): string | null {
  return i.category === 'bag' ? pick(i, BAG_SIZE_BY_TYPE, BAG_SIZE_BY_SUB) : null;
}

// ---------- Glanz, Oberfläche, Transparenz aus dem Material ----------

/** Glanz 1–5 je Material (Lack/Satin/Pailletten über Stichwörter) */
export const MATERIAL_SHEEN: Record<string, number> = {
  cotton: 1, linen: 1, wool: 1, merino: 1, cashmere: 1, alpaca: 1, mohair: 1, angora: 1, denim: 1, canvas: 1, corduroy: 1, flannel: 1,
  tweed: 1, boucle: 1, fleece: 1, suede: 1, shearling: 1, fur: 2, acrylic: 1, elastane: 2,
  viscose: 2, lyocell: 2, cupro: 2, polyester: 2, nylon: 2, chiffon: 2, mesh: 2, lace: 2, down: 2,
  silk: 3, velvet: 3, leather: 3, faux_leather: 3, plastic_rubber: 3, metal: 4,
};
export const SHEEN_WORDS: readonly [number, readonly string[]][] = [[5, ['patent', 'lack', 'lackleder', 'sequin', 'pailletten', 'metallic']], [4, ['satin', 'glossy', 'shiny', 'glanz']]];
export function sheenFrom(i: RuleInput): { v: number; why: string } | null {
  for (const [v, ws] of SHEEN_WORDS) { const w = has(nm(i), ws); if (w) return { v, why: `Name „${w}“` }; }
  const m = main(i);
  return m && MATERIAL_SHEEN[m] != null ? { v: MATERIAL_SHEEN[m], why: `Material ${m}` } : null;
}

/** Oberfläche nur, wo das Material sie festlegt; sonst Stichwort im Namen oder KI */
export const MATERIAL_SURFACE: Record<string, string> = {
  corduroy: 'ribbed', fleece: 'fuzzy', shearling: 'fuzzy', fur: 'fuzzy', mohair: 'fuzzy', alpaca: 'fuzzy', angora: 'fuzzy', boucle: 'fuzzy',
  flannel: 'brushed', suede: 'brushed', down: 'quilted', silk: 'smooth', chiffon: 'smooth',
};
export const SURFACE_WORDS: readonly [string, readonly string[]][] = [
  ['chunky_knit', ['cable', 'zopf', 'zopfstrick', 'chunky knit', 'grobstrick']],
  ['ribbed', ['rib', 'ribbed', 'ripp', 'gerippt', 'cord']],
  ['quilted', ['quilted', 'stepp', 'gesteppt', 'puffer', 'padded']],
  ['fuzzy', ['teddy', 'sherpa', 'fleece', 'fuzzy', 'flausch']],
  ['technical', ['funktionsstoff', 'tech', 'technical', 'softshell']],
  ['grainy', ['croc', 'kroko', 'python', 'pebble', 'genarbt', 'basket weave']],
];
export function surfaceFrom(i: RuleInput): { v: string; why: string } | null {
  if (i.category === 'jewelry') return null;
  for (const [v, ws] of SURFACE_WORDS) { const w = has(nm(i), ws); if (w) return { v, why: `Name „${w}“` }; }
  const m = main(i);
  return m && MATERIAL_SURFACE[m] ? { v: MATERIAL_SURFACE[m], why: `Material ${m}` } : null;
}

export const MATERIAL_OPACITY: Record<string, string> = {
  denim: 'opaque', wool: 'opaque', merino: 'opaque', cashmere: 'opaque', alpaca: 'opaque', tweed: 'opaque', boucle: 'opaque', fleece: 'opaque',
  corduroy: 'opaque', flannel: 'opaque', canvas: 'opaque', velvet: 'opaque', leather: 'opaque', faux_leather: 'opaque', suede: 'opaque',
  shearling: 'opaque', fur: 'opaque', down: 'opaque', lace: 'semi_sheer', mesh: 'semi_sheer', chiffon: 'sheer',
};
const CLOTHING = new Set(['outerwear', 'top', 'dress', 'pants', 'shorts', 'skirt']);
export function opacityFrom(i: RuleInput): { v: string; why: string } | null {
  if (!CLOTHING.has(i.category ?? '')) return null;
  const w = has(nm(i), ['sheer', 'transparent', 'durchsichtig', 'see through']);
  if (w) return { v: 'sheer', why: `Name „${w}“` };
  const m = main(i);
  return m && MATERIAL_OPACITY[m] ? { v: MATERIAL_OPACITY[m], why: `Material ${m}` } : null;
}

// ---------- Formstabilität aus Typ + Material ----------

export const STRUCTURE_BY_TYPE: Record<string, number> = {
  suit_trousers: 4, chino: 3, track_pants: 1, peacoat: 5, chesterfield_coat: 5, single_breasted_blazer: 4, double_breasted_blazer: 5,
  puffer_vest: 3, suit_vest: 4, knit_vest: 2, zip_hoodie: 2, track_jacket: 2, anorak: 2, windbreaker: 1, rain_jacket: 2,
  oxford: 5, derby: 5, wholecut: 5, monk_strap: 5, loafer: 4, moccasin: 3, boat_shoe: 3, espadrille: 2, chunky_sneaker: 4,
  briefcase: 5, minaudiere: 5, jute_bag: 2, gym_sack: 1,
};
export const STRUCTURE_BY_SUB: Record<string, number> = {
  coat: 4, trench_coat: 4, parka: 3, puffer_jacket: 3, blazer: 4, vest: 3, cardigan: 2, sweat_jacket: 2, overshirt: 3, shearling_jacket: 4,
  blouson: 3, varsity_jacket: 3, coach_jacket: 2, trucker_jacket: 4, biker_jacket: 4, field_jacket: 3, sports_jacket: 2, bolero: 2,
  t_shirt: 2, long_sleeve: 2, sleeveless_shirt: 1, tank_top: 1, strapless_top: 2, crop_top: 2, polo: 2, shirt: 3, blouse: 2,
  sweatshirt: 2, hoodie: 2, sweater: 2, sweater_vest: 2, sports_top: 1, bodysuit: 1, pajama_top: 1,
  jeans: 3, trousers: 3, cargo_pants: 3, sweatpants: 1, leggings: 1, overalls: 3, pajama_pants: 1,
  sports_shorts: 1, cargo_shorts: 3, bermuda_shorts: 3, suit_shorts: 3,
  sneaker: 3, sports_shoe: 2, dress_shoe: 4, slip_on: 2, boot: 4, hiking_shoe: 3, sandal: 2, slide: 2, house_shoe: 1, clog: 4, flat: 2, high_heel: 4,
  handbag: 4, clutch: 4, backpack: 3, belt_bag: 3, cloth_bag: 1, travel_bag: 3, work_bag: 4, suitcase: 5,
};
/** Verschiebung durch das Hauptmaterial (nur Kleidung) */
export const MATERIAL_STRUCTURE: Record<string, number> = {
  leather: 1, faux_leather: 1, canvas: 1, tweed: 1, denim: 0, wool: 0,
  silk: -1, chiffon: -1, viscose: -1, lyocell: -1, cupro: -1, mesh: -1, lace: -1, elastane: -1, mohair: -1,
};
export function structureFrom(i: RuleInput): { v: number; why: string } | null {
  const base = pick(i, STRUCTURE_BY_TYPE, STRUCTURE_BY_SUB);
  if (base == null) return null;
  const m = main(i);
  const d = CLOTHING.has(i.category ?? '') && m ? MATERIAL_STRUCTURE[m] ?? 0 : 0;
  return { v: Math.max(1, Math.min(5, base + d)), why: d ? `Typ ${base} ${d > 0 ? '+' : '−'}${Math.abs(d)} (${m})` : `Typ ${base}` };
}

// ---------- Metallton, Muster, Waschung aus dem Namen ----------

export const METAL_WORDS: readonly [string, readonly string[]][] = [
  ['rose_gold', ['rose gold', 'rosegold', 'rosegold', 'rosegoldfarben']],
  ['gold', ['gold', 'golden', 'goldene', 'goldener', 'goldfarben', 'vergoldet', '14k', '18k', 'gold plated']],
  ['silver', ['silver', 'silber', 'silberne', 'sterling', '925', 'steel', 'edelstahl', 'stainless']],
];
export function metalFrom(i: RuleInput): { v: string; why: string } | null {
  if (!(['outerwear', 'shoe', 'bag', 'jewelry'].includes(i.category ?? '') || (i.category === 'accessory' && i.subcategory === 'belt'))) return null;
  for (const [v, ws] of METAL_WORDS) { const w = has(nm(i), ws); if (w) return { v, why: `Name „${w}“` }; }
  return null;
}

export const PATTERN_WORDS: readonly [string, readonly string[], string?][] = [
  ['striped', ['pinstripe', 'nadelstreifen', 'pin stripe', 'pencil stripe'], 'fine'],
  ['striped', ['stripe', 'striped', 'stripes', 'streifen', 'gestreift', 'breton', 'ringel']],
  ['animal', ['leo', 'leopard', 'zebra', 'snake', 'schlange', 'tiger', 'croc', 'kroko', 'python', 'cow']],
  ['houndstooth', ['houndstooth', 'hahnentritt', 'pepita']],
  ['herringbone', ['herringbone', 'fischgrat']],
  ['gingham', ['gingham', 'vichy']],
  ['plaid', ['check', 'checked', 'kariert', 'karo', 'plaid', 'tartan']],
  ['camouflage', ['camo', 'camouflage']],
  ['floral', ['floral', 'flower', 'flowers', 'blumen', 'geblumt']],
  ['paisley', ['paisley']], ['argyle', ['argyle']], ['tie_dye', ['tie dye', 'batik']],
  ['dotted', ['dot', 'dots', 'polka', 'punkte', 'gepunktet']],
  ['cable_knit', ['cable', 'zopfmuster', 'zopfstrick']],
];
export function patternFrom(i: RuleInput): { v: string; scale?: string; why: string } | null {
  if (!fieldsFor(i.category, i.subcategory).pattern) return null;
  for (const [v, ws, scale] of PATTERN_WORDS) { const w = has(nm(i), ws); if (w) return { v, ...(scale ? { scale } : {}), why: `Name „${w}“` }; }
  return null;
}

export const WASH_WORDS: readonly [string, readonly string[]][] = [
  ['distressed', ['distressed', 'destroyed', 'ripped', 'used', 'vintage wash']],
  ['raw', ['raw', 'rigid', 'unwashed', 'dry denim']],
  ['black', ['black', 'schwarz', 'schwarze', 'washed black']],
  ['light', ['light wash', 'light blue', 'hellblau', 'bleached', 'hell']],
  ['dark', ['dark wash', 'dark blue', 'dunkelblau', 'indigo', 'rinse']],
  ['mid', ['mid wash', 'medium wash', 'mittelblau']],
];
/** Waschung: Name, sonst Schwarz aus der ersten Farbe (Blautöne schätzt die KI am Foto) */
export function washFrom(i: RuleInput): { v: string; why: string } | null {
  const denim = i.subcategory === 'jeans' || i.materials.some((m) => m.name === 'denim');
  if (!denim) return null;
  for (const [v, ws] of WASH_WORDS) { const w = has(nm(i), ws); if (w) return { v, why: `Name „${w}“` }; }
  const c = i.colors?.[0];
  const byColor: Record<string, string> = { black: 'black', charcoal: 'black' };
  return c && byColor[c] ? { v: byColor[c], why: `Farbe ${c}` } : null;
}

// ---------- Pflege aus dem Material (vorsichtig, nie professionell) ----------

type CareRule = Partial<Record<Exclude<CareGroup, 'pro'>, string>>;
const C = (wash: string, dry: string, iron: string): CareRule => ({ wash, bleach: 'nobleach', dry, iron });
export const MATERIAL_CARE: Record<string, CareRule> = {
  cotton: C('w30', 'nodry', 'iron2'), denim: C('w30', 'nodry', 'iron2'), linen: C('w30', 'nodry', 'iron2'), canvas: C('w30', 'nodry', 'iron2'),
  corduroy: C('w30', 'nodry', 'iron2'), flannel: C('w30', 'nodry', 'iron2'),
  polyester: C('w30', 'nodry', 'iron1'), nylon: C('w30', 'nodry', 'iron1'), elastane: C('w30', 'nodry', 'iron1'), acrylic: C('w30', 'nodry', 'iron1'),
  viscose: C('w30', 'nodry', 'iron1'), lyocell: C('w30', 'nodry', 'iron1'), cupro: C('w30', 'nodry', 'iron1'), fleece: C('w30', 'nodry', 'noiron'),
  down: C('w30', 'nodry', 'noiron'), mesh: C('w30', 'nodry', 'noiron'),
  wool: C('hand', 'flat', 'iron1'), merino: C('hand', 'flat', 'iron1'), cashmere: C('hand', 'flat', 'iron1'), alpaca: C('hand', 'flat', 'iron1'),
  mohair: C('hand', 'flat', 'iron1'), angora: C('hand', 'flat', 'iron1'), silk: C('hand', 'flat', 'iron1'), chiffon: C('hand', 'flat', 'iron1'),
  lace: C('hand', 'flat', 'iron1'), tweed: C('hand', 'flat', 'iron1'), boucle: C('hand', 'flat', 'noiron'), velvet: C('hand', 'flat', 'noiron'),
  leather: C('nowash', 'nodry', 'noiron'), faux_leather: C('nowash', 'nodry', 'noiron'), suede: C('nowash', 'nodry', 'noiron'),
  shearling: C('nowash', 'nodry', 'noiron'), fur: C('nowash', 'nodry', 'noiron'),
};
/** Reihenfolge von vorsichtig nach großzügig je Gruppe */
const CARE_ORDER: Record<string, readonly string[]> = {
  wash: ['nowash', 'hand', 'w30', 'w40', 'w60', 'w95'], bleach: ['nobleach', 'nochlor', 'bleach'],
  dry: ['nodry', 'flat', 'line', 'drylow', 'drynorm'], iron: ['noiron', 'iron1', 'iron2', 'iron3'],
};
/** Vorsichtigste Stufe aller Materialien mit mindestens 15 % (Rest wie Hauptmaterial) */
export function careFrom(i: RuleInput): { care: Care; why: string } | null {
  if (!fieldsFor(i.category, i.subcategory).care) return null;
  const parts = shares(i.materials).filter((m, k) => k === 0 || m.share >= 0.15).filter((m) => MATERIAL_CARE[m.name]);
  if (!parts.length) return null;
  const care: Care = {};
  for (const g of ['wash', 'bleach', 'dry', 'iron'] as const) {
    const order = CARE_ORDER[g] ?? [];
    const vs = parts.map((p) => MATERIAL_CARE[p.name]?.[g]).filter((v): v is string => !!v).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    if (vs[0]) care[g] = { v: vs[0], src: 'geschaetzt' };
  }
  return { care, why: parts.map((p) => p.name).join(' + ') };
}

// ---------- Formalität: Rahmen je Typ ----------

/** [unten, oben] auf 1 Freizeit · 2 Casual · 3 Smart Casual · 4 Business · 5 sehr formell; die KI setzt den Bereich innerhalb */
export const FORMALITY_BY_TYPE: Record<string, readonly [number, number]> = {
  suit_trousers: [3, 5], chino: [2, 3], pleated_trousers: [2, 4], track_pants: [1, 1],
  short_sleeve_shirt: [1, 3], long_sleeve_shirt: [2, 5], short_sleeve_polo: [1, 3], long_sleeve_polo: [2, 3], henley_t_shirt: [1, 2], henley_long_sleeve: [1, 3],
  suit_vest: [4, 5], puffer_vest: [1, 2], knit_vest: [2, 3], zip_hoodie: [1, 2], track_jacket: [1, 2], rain_jacket: [1, 2], anorak: [1, 2],
  peacoat: [3, 4], chesterfield_coat: [4, 5], single_breasted_blazer: [3, 5], double_breasted_blazer: [4, 5], bomber_jacket: [1, 3],
  oxford: [4, 5], derby: [3, 5], monk_strap: [3, 5], wholecut: [5, 5], loafer: [2, 4], boat_shoe: [2, 3], moccasin: [2, 3],
  chunky_sneaker: [1, 2], platform_sneaker: [1, 2], chelsea_boot: [2, 4], desert_boot: [2, 3], lace_up_boot: [1, 3], western_boot: [2, 3],
  rain_boot: [1, 1], sheepskin_boot: [1, 2], briefcase: [3, 5], minaudiere: [4, 5],
  half_zip_sweater: [2, 4], half_zip_sweatshirt: [1, 2],
  dress_belt: [3, 5], leather_belt: [1, 4], western_belt: [1, 2], web_belt: [1, 2], braided_belt: [1, 3],
};
export const FORMALITY_BY_SUB: Record<string, readonly [number, number]> = {
  jeans: [1, 3], trousers: [2, 4], cargo_pants: [1, 2], sweatpants: [1, 2], leggings: [1, 2], overalls: [1, 2], pajama_pants: [1, 1],
  sports_shorts: [1, 1], cargo_shorts: [1, 2], bermuda_shorts: [1, 3], suit_shorts: [2, 3],
  t_shirt: [1, 3], long_sleeve: [1, 3], sleeveless_shirt: [1, 2], tank_top: [1, 2], polo: [1, 3], shirt: [2, 4], blouse: [2, 4],
  sweatshirt: [1, 2], hoodie: [1, 2], sweater: [2, 4], sweater_vest: [2, 3], sports_top: [1, 1], pajama_top: [1, 1],
  coat: [3, 5], trench_coat: [3, 4], parka: [1, 3], puffer_jacket: [1, 2], blazer: [3, 5], cardigan: [2, 3], sweat_jacket: [1, 2],
  overshirt: [2, 3], shearling_jacket: [2, 3], blouson: [1, 3], varsity_jacket: [1, 2], coach_jacket: [1, 2], trucker_jacket: [1, 2],
  biker_jacket: [2, 3], field_jacket: [1, 3], sports_jacket: [1, 2],
  sneaker: [1, 3], sports_shoe: [1, 1], dress_shoe: [3, 5], boot: [1, 3], hiking_shoe: [1, 1], sandal: [1, 2], slide: [1, 1], clog: [1, 2],
  flat: [2, 4], high_heel: [3, 5], house_shoe: [1, 1],
  backpack: [1, 2], cloth_bag: [1, 2], belt_bag: [1, 2], handbag: [2, 4], clutch: [4, 5], travel_bag: [1, 2], work_bag: [3, 4],
  belt: [1, 4],
};
/** Lockere Schnitte im Namen senken die Obergrenze um eine Stufe (Max: Barrel-Anzughose ist weniger formell) */
export const RELAXED_WORDS = ['barrel', 'baggy', 'loose', 'wide', 'wide leg', 'oversized', 'oversize', 'relaxed', 'balloon', 'parachute', 'jogger'];
export function formalityFrame(i: RuleInput): { v: readonly [number, number]; why: string } | null {
  const f = pick(i, FORMALITY_BY_TYPE, FORMALITY_BY_SUB);
  if (!f) return null;
  const w = i.category === 'pants' || i.category === 'shorts' ? has(nm(i), RELAXED_WORDS) : null;
  if (w && f[1] > f[0]) return { v: [f[0], f[1] - 1], why: `Typ ${f[0]}–${f[1]}, Name „${w}“ −1 oben` };
  return { v: f, why: `Typ ${f[0]}–${f[1]}` };
}
/** KI-Bereich in den Rahmen schieben (Schnittmenge, sonst nächster Rand) */
export function clampFormality(ai: readonly [number, number] | null, frame: readonly [number, number]): [number, number] {
  if (!ai) return [frame[0], frame[1]];
  const lo = Math.min(Math.max(ai[0], frame[0]), frame[1]);
  const hi = Math.max(Math.min(ai[1], frame[1]), lo);
  return [lo, hi];
}

// ---------- Vielseitigkeit ausrechnen ----------

const LOUD_PATTERNS = new Set(['animal', 'floral', 'tropical', 'paisley', 'camouflage', 'allover_print', 'graphic', 'tie_dye', 'abstract', 'colorblock', 'checkerboard']);
/**
 * Vielseitigkeit 1–5: Start 2,5; nur neutrale Farben +1, eine Akzentfarbe ±0, mehrere Farben −1; unifarben +0,5, lautes Muster −1;
 * Auffälligkeit (KI) 1–2 +0,5, 4 −0,5, 5 −1; Formalitäts-Bereich über ≥ 3 Stufen +0,5, nur eine Stufe −0,5.
 */
/** Typen, die von Natur aus weniger kombinierbar sind (Max 21.11.2026: Westerngürtel) */
export const VERSATILITY_BY_TYPE: Record<string, number> = { western_belt: -1 };
export function versatilityFrom(p: { colors: readonly string[]; pattern: string | null; presence: number | null; formality: readonly [number, number] | null; type?: string | null }): { v: number; why: string[] } | null {
  if (!p.colors.length) return null;
  const why: string[] = []; let v = 2.5;
  const t = p.type ? VERSATILITY_BY_TYPE[p.type] : undefined;
  if (t) { v += t; why.push(`Typ ${t > 0 ? '+' : '−'}${Math.abs(t)}`); }
  const neutral = p.colors.filter((c) => { const t = colorTrait(c); return !!t && (t.neutral || t.wearNeutral); });
  const accents = p.colors.length - neutral.length;
  if (accents === 0) { v += 1; why.push('nur neutrale Farben +1'); } else if (accents >= 2) { v -= 1; why.push('mehrere Farben −1'); }
  if (!p.pattern || p.pattern === 'solid') { v += 0.5; why.push('unifarben +0,5'); } else if (LOUD_PATTERNS.has(p.pattern)) { v -= 1; why.push('lautes Muster −1'); }
  if (p.presence != null) {
    if (p.presence <= 2) { v += 0.5; why.push('unauffällig +0,5'); } else if (p.presence === 4) { v -= 0.5; why.push('auffällig −0,5'); } else if (p.presence >= 5) { v -= 1; why.push('sehr auffällig −1'); }
  }
  if (p.formality) {
    const span = p.formality[1] - p.formality[0];
    if (span >= 2) { v += 0.5; why.push('breite Formalität +0,5'); } else if (span === 0) { v -= 0.5; why.push('nur eine Formalitäts-Stufe −0,5'); }
  }
  return { v: Math.max(1, Math.min(5, Math.ceil(v - 0.5))), why }; // ,5 abrunden: 5 nur mit allen vier Pluspunkten
}

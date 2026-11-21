// Prüfseite „Feste Regeln statt KI“ (Entwurf, Max 21.11.2026).
// Aufruf: pnpm regeln [abzug.json] → docs/ki/regeln/regeln.html (gitignored; Abzug privat, nicht ins Repo)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../../../packages/core/src/rules';
import { KEY_LISTS, label, toMaterialParts, careLabel, SURFACES, OPACITIES, HEELS, BAG_SIZES, METAL_TONES, DENIM_WASHES, PATTERN_SCALES } from '../../../packages/core/src/index';

const here = dirname(fileURLToPath(import.meta.url));
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
type Opt = { key: string; label: string };
const lab = (list: readonly Opt[], k: string | null | undefined) => (k == null ? '–' : list.find((x) => x.key === k)?.label ?? k);
const subLabel = new Map<string, string>(), typeLabel = new Map<string, string>();
for (const c of KEY_LISTS.categories) for (const s of c.subs ?? []) { subLabel.set(s.key, s.label); for (const t of s.types ?? []) typeLabel.set(t.key, t.label); }
const kindLabel = (k: string) => typeLabel.get(k) ?? subLabel.get(k) ?? k;
const mat = (k: string) => label(KEY_LISTS.materials, k) || k;
const SEASON = (s: readonly string[] | null | undefined) => (s?.length ? s.map((x) => label(KEY_LISTS.seasons, x)).join(', ') : '–');
const W = ['sehr leicht', 'leicht', 'mittel', 'warm'];
const SCALE = (n: number | null | undefined) => (n == null ? '–' : String(n));
const FORM = ['', 'Freizeit', 'Casual', 'Smart Casual', 'Business', 'sehr formell'];
const fr = (f: readonly number[] | null | undefined) => (f ? (f[0] === f[1] ? FORM[f[0]] : `${FORM[f[0]]} – ${FORM[f[1]]}`) : '–');
const careText = (c: Record<string, { v: string } | undefined> | null | undefined) =>
  c && Object.keys(c).length ? (['wash', 'bleach', 'dry', 'iron'] as const).filter((g) => c[g]).map((g) => careLabel(g, c[g]!.v)).join(' · ') : '–';

// ---------- Regel-Tabellen ----------
const table = (title: string, rows: [string, string][], note = '') =>
  `<details><summary>${esc(title)} <small>(${rows.length})</small></summary>${note ? `<p class="n">${note}</p>` : ''}<table>${rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table></details>`;
const typeRows = <T>(byType: Record<string, T>, bySub: Record<string, T>, f: (v: T) => string): [string, string][] => [
  ...Object.entries(bySub).map(([k, v]): [string, string] => [`${kindLabel(k)} (alle)`, f(v)]),
  ...Object.entries(byType).map(([k, v]): [string, string] => [kindLabel(k), f(v)]),
];
const closures = KEY_LISTS.closures as readonly Opt[], collars = KEY_LISTS.collars as readonly Opt[];
const words = (list: readonly [string, readonly string[], string?][], f: (k: string) => string) => list.map(([k, ws]): [string, string] => [ws.join(', '), f(k)]);
const tables = [
  table('Saison aus Wärme', R.SEASONS_BY_WARMTH.map((s, i): [string, string] => [W[i], SEASON(s)]), 'Schmuck, Taschen, Brillen, Gürtel usw. (ohne Wetterfeld) = ganzjährig.'),
  table('Verschluss je Typ', typeRows(R.CLOSURE_BY_TYPE, R.CLOSURE_BY_SUB, (v) => lab(closures, v)), 'Typ und Name legen fest; „(alle)“ je Unterkategorie füllt nur leere Felder. Wörter im Namen gehen vor: zip/zipper/Reißverschluss → Reißverschluss, Druckknopf → Druckknöpfe, Slip-On → keiner.'),
  table('Kragen/Ausschnitt je Typ', typeRows(R.COLLAR_BY_TYPE, R.COLLAR_BY_SUB, (v) => lab(collars, v)), 'Wörter im Namen gehen vor: Turtleneck/Rollkragen, V-Neck, Crewneck/Rundhals, Hoodie, Button-Down, Polo, Henley.'),
  table('Absatz je Typ', typeRows(R.HEEL_BY_TYPE, R.HEEL_BY_SUB, (v) => lab(HEELS, v)), 'Absatzschuhe ohne Typ (Pumps, Sandalette …) schätzt weiter die KI.'),
  table('Taschengröße je Typ', typeRows(R.BAG_SIZE_BY_TYPE, R.BAG_SIZE_BY_SUB, (v) => lab(BAG_SIZES, v))),
  table('Glanz je Material (1 matt … 5 stark glänzend)', Object.entries(R.MATERIAL_SHEEN).map(([k, v]): [string, string] => [mat(k), String(v)]), 'Name: Lack/Patent/Pailletten/Metallic → 5, Satin/Glossy → 4.'),
  table('Oberfläche je Material', Object.entries(R.MATERIAL_SURFACE).map(([k, v]): [string, string] => [mat(k), lab(SURFACES, v)]), 'Sonst über den Namen (Zopf → Grobstrick, Rib/Ripp/Cord → Gerippt, Stepp/Puffer → Gesteppt, Teddy/Sherpa → Flauschig, Funktionsstoff → Funktionsstoff, Croc/Basket Weave → Genarbt) oder KI.'),
  table('Transparenz je Material', Object.entries(R.MATERIAL_OPACITY).map(([k, v]): [string, string] => [mat(k), lab(OPACITIES, v)]), 'Baumwolle, Leinen, Seide, Viskose, Polyester usw. schätzt die KI (dünn oder dick sieht man nur auf dem Foto).'),
  table('Formstabilität je Typ (1 fließend … 5 sehr formstabil)', typeRows(R.STRUCTURE_BY_TYPE, R.STRUCTURE_BY_SUB, String), 'Material verschiebt bei Kleidung: Leder, Kunstleder, Canvas, Tweed +1; Seide, Chiffon, Viskose, Lyocell, Cupro, Mesh, Spitze, Elasthan, Mohair −1.'),
  table('Formalität: Rahmen je Typ', typeRows(R.FORMALITY_BY_TYPE, R.FORMALITY_BY_SUB, (v) => fr(v)), 'Die KI setzt den Bereich innerhalb des Rahmens. Bei Hosen/Shorts senkt ein lockerer Schnitt im Namen (Barrel, Baggy, Loose, Wide, Oversized, Relaxed, Balloon, Parachute, Jogger) die Obergrenze um eine Stufe.'),
  table('Pflege je Material (vorsichtig)', Object.entries(R.MATERIAL_CARE).map(([k, v]): [string, string] => [mat(k), (['wash', 'bleach', 'dry', 'iron'] as const).map((g) => (v[g] ? careLabel(g, v[g]!) : '')).join(' · ')]), 'Bei Mischungen gilt je Gruppe die vorsichtigste Stufe aller Materialien ab 15 %. Professionelle Reinigung wird nie geschätzt. Ein Etikett ersetzt jede Schätzung.'),
  table('Muster aus dem Namen', words(R.PATTERN_WORDS, (k) => label(KEY_LISTS.patterns, k) + (k === 'striped' ? '' : '')), 'Nadelstreifen/Pinstripe zusätzlich Mustergröße „Fein“. Rib/Ripp zählt nicht als Muster (nur Oberfläche „Gerippt“).'),
  table('Metallton aus dem Namen', words(R.METAL_WORDS, (k) => lab(METAL_TONES, k)), 'Nur Oberbekleidung, Schuhe, Taschen, Gürtel, Schmuck.'),
  table('Waschung aus dem Namen (Jeans/Denim)', [...words(R.WASH_WORDS, (k) => lab(DENIM_WASHES, k)), ['sonst Farbe Schwarz/Anthrazit', 'Schwarz (Blautöne schätzt die KI am Foto)']]),
];

// ---------- Vergleich mit den Teilen ----------
type Row = { name: string; category: string; subcategory: string | null; item_type: string | null; materials: unknown; warmth: number | null; seasons: string[] | null;
  closure: string | null; collar: string | null; pattern: string | null; colors: string[] | null; care: Record<string, { v: string }> | null; pending: string[];
  profile: Record<string, unknown> | null; thumb: string | null };
const src = process.argv[2];
let compare = '';
if (src) {
  const items = JSON.parse(readFileSync(src, 'utf8')) as Row[];
  const img = 'https://jocjisrmmzzvfnijosgg.supabase.co/storage/v1/object/public/items/';
  const count: Record<string, [number, number]> = {};
  const rows = items.map((it) => {
    const p = it.profile ?? {};
    const i: R.RuleInput = { category: it.category, subcategory: it.subcategory, type: it.item_type, materials: toMaterialParts(it.materials), name: it.name,
      colors: it.colors ?? [], nameTrusted: !it.pending.includes('name') };
    const pend = (k: string) => it.pending.includes(k) || it.pending.some((x) => x.startsWith(`${k}.`));
    const out: string[] = [];
    const add = (field: string, now: string, rule: string | null, why: string, confirmed = false) => {
      if (rule == null) return;
      const same = now === rule;
      count[field] ??= [0, 0]; count[field][same ? 0 : 1]++;
      out.push(`<div class="${same ? 'same' : confirmed ? 'diff conf' : 'diff'}"><b>${field}</b> ${esc(now)}${same ? '' : ` → <em>${esc(rule)}</em>`}<small>${esc(why)}${!same && confirmed ? ' · von dir bestätigt, bleibt' : ''}</small></div>`);
    };
    const s = R.seasonsFrom(it.category, it.subcategory, it.warmth);
    if (s) add('Saison', SEASON(it.seasons), SEASON(s), it.warmth == null ? 'ohne Wetterfeld → ganzjährig' : `Wärme ${W[it.warmth]}`, !pend('seasons') && !!it.seasons?.length);
    const cl = R.closureFrom(i); if (cl && !(cl.why === 'Unterkategorie' && it.closure)) add('Verschluss', lab(closures, it.closure), lab(closures, cl.v), cl.why, !pend('closure') && !!it.closure);
    const co = R.collarFrom(i); if (co && !(co.why === 'Unterkategorie' && it.collar)) add('Kragen', lab(collars, it.collar), lab(collars, co.v), co.why, !pend('collar') && !!it.collar);
    const he = R.heelFrom(i); if (he) add('Absatz', lab(HEELS, p.heel as string), lab(HEELS, he), 'Typ');
    const bs = R.bagSizeFrom(i); if (bs) add('Taschengröße', lab(BAG_SIZES, p.bag_size as string), lab(BAG_SIZES, bs), 'Typ');
    const sh = R.sheenFrom(i); if (sh) add('Glanz', SCALE(p.sheen as number), String(sh.v), sh.why);
    const su = R.surfaceFrom(i); if (su) add('Oberfläche', lab(SURFACES, p.surface as string), lab(SURFACES, su.v), su.why);
    const op = R.opacityFrom(i); if (op) add('Transparenz', lab(OPACITIES, p.opacity as string), lab(OPACITIES, op.v), op.why);
    const st = R.structureFrom(i); if (st && it.category !== 'jewelry' && it.category !== 'headwear' && it.category !== 'accessory') add('Formstabilität', SCALE(p.structure as number), String(st.v), st.why);
    const me = R.metalFrom(i); if (me) add('Metallton', lab(METAL_TONES, p.metal_tone as string), lab(METAL_TONES, me.v), me.why);
    const pa = R.patternFrom(i); if (pa) add('Muster', label(KEY_LISTS.patterns, it.pattern ?? '') || '–', label(KEY_LISTS.patterns, pa.v), pa.why + (pa.scale ? ' · Größe ' + lab(PATTERN_SCALES, pa.scale) : ''), !pend('pattern') && !!it.pattern);
    const wa = R.washFrom(i); if (wa) add('Waschung', lab(DENIM_WASHES, p.denim_wash as string), lab(DENIM_WASHES, wa.v), wa.why);
    const ca = R.careFrom(i); if (ca) { const hand = it.care && Object.values(it.care).some((x) => (x as { src?: string })?.src && (x as { src?: string }).src !== 'geschaetzt'); add('Pflege', careText(it.care), hand ? careText(it.care) : careText(ca.care as never), hand ? 'Etikett/selbst eingetragen – bleibt' : `aus ${ca.why}`); }
    const ff = R.formalityFrame(i);
    const fNow = (p.formality as [number, number] | null) ?? null;
    const fNew = ff ? R.clampFormality(fNow, ff.v) : null;
    if (ff && fNew) add('Formalität', fr(fNow), fr(fNew), `Rahmen ${fr(ff.v)}${ff.why.includes('Name') ? ' (' + ff.why.split(', ')[1] + ')' : ''}`);
    const ve = R.versatilityFrom({ colors: it.colors ?? [], pattern: pa?.v ?? it.pattern, presence: (p.presence as number) ?? null, formality: fNew ?? fNow });
    if (ve) add('Vielseitigkeit', SCALE(p.versatility as number), String(ve.v), ve.why.join(', ') || 'Start 3');
    if (!out.length) return '';
    return `<section><div class="h">${it.thumb ? `<img src="${img}${it.thumb}" loading="lazy">` : ''}<div>${esc(it.name)}<small>${esc(kindLabel(it.item_type ?? it.subcategory ?? it.category))} · ${esc(toMaterialParts(it.materials).map((m) => mat(m.name)).join(', ') || 'kein Material')}${i.nameTrusted ? '' : ' · Name nur KI-Schätzung → keine Wörter'}</small></div></div>${out.join('')}</section>`;
  }).join('');
  const sum = Object.entries(count).map(([k, [a, b]]) => `<tr><td>${k}</td><td>${a}</td><td>${b}</td></tr>`).join('');
  compare = `<h2>Deine Teile: jetzt → nach Regel</h2><p class="n">Grau = gleich, orange = würde sich ändern, durchgestrichen-rosa = von dir bestätigt (bleibt). Profilwerte (Glanz, Formstabilität …) sind bisher alle KI-Schätzungen.</p>
  <table><tr><th>Feld</th><th>gleich</th><th>anders</th></tr>${sum}</table>${rows}`;
}

const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Valet – Regeln statt KI</title>
<style>body{background:#F5F0E8;color:#2a1a1d;font:15px/1.45 -apple-system,system-ui,sans-serif;max-width:900px;margin:auto;padding:16px}h1,h2{color:#722638}h1{font-size:24px}
table{border-collapse:collapse;width:100%;background:#fff;border-radius:14px;overflow:hidden;margin:8px 0 14px}td,th{padding:6px 10px;border-bottom:1px solid #eee;text-align:left;vertical-align:top}th{background:#faf6ef}
details{background:#fff;border-radius:14px;margin:8px 0;padding:10px 14px}summary{font-weight:600;cursor:pointer}details table{margin:8px 0 0}.n{color:#7a6a66;font-size:13px}
small{display:block;color:#7a6a66;font-size:12px}section{background:#fff;border-radius:14px;padding:10px 12px;margin:10px 0}.h{display:flex;gap:10px;align-items:center;margin-bottom:6px;font-weight:600}
img{width:56px;height:56px;object-fit:contain}section div.same,section div.diff{padding:4px 0;border-top:1px solid #f1ece4}.same{color:#9a8f8a}.same small{display:none}
.diff em{font-style:normal;color:#b8430f;font-weight:600}.conf em{color:#b07a8a;text-decoration:line-through}</style></head><body>
<h1>Regeln statt KI-Schätzung</h1>
<p class="n">Regel-Werte werden <b>vorausgewählt</b> (wie Wärme/Regen, Hinweis „aus Regel“), alle anderen Werte bleiben wählbar. Was du selbst gesetzt hast, bleibt. Wörter im Namen zählen nur, wenn du den Namen selbst eingetragen oder aus Shop/Etikett übernommen hast.</p>
<h2>Regeln</h2>${tables.join('')}
${compare}
<p style="text-align:center;color:#722638">valet</p></body></html>`;
writeFileSync(resolve(here, 'regeln.html'), html);
console.log('geschrieben');

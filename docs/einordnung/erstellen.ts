// „So ordnet Valet Teile ein“ – Nachschlagewerk für Max (21.11.2026).
// Aufruf: pnpm einordnung → docs/einordnung/einordnung.html
// Alle Tabellen kommen direkt aus dem Code (packages/core) – nach jeder Regeländerung neu erzeugen, dann bleibt die Seite aktuell.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../../packages/core/src/rules';
import * as Wt from '../../packages/core/src/weather';
import { AI_SURE } from '../../packages/core/src/ruleForm';
import { ORIGIN_RANK } from '../../packages/core/src/ai/origin';
import { NO_SHAFT, SHAFT_BY_SUB, SHAFT_BY_TYPE, SHAFTS, SURFACES, OPACITIES, HEELS, BAG_SIZES, METAL_TONES, DENIM_WASHES, SOLES, HEMS, LEGS, SCALE_WORDS, PROFILE_FIELDS } from '../../packages/core/src/ai/profile';
import { LAYER_BY_CATEGORY, LAYER_BY_SUB, LAYER_BY_TYPE } from '../../packages/core/src/fields';
import { FIT_TERMS } from '../../packages/core/src/categories';
import { FIT_NAME_ALIASES, FIT_NAME_EXTRA, HEM_TERMS, LEG_TERMS } from '../../packages/core/src/fitName';
import { DEFAULT_OUTFIT_CONFIG as C } from '../../packages/core/src/outfit/config';
import { KEY_LISTS, label, careLabel, OCCASIONS } from '../../packages/core/src/index';

const here = dirname(fileURLToPath(import.meta.url));
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
type Opt = { key: string; label: string };
const lab = (list: readonly Opt[], k: string | null | undefined) => (k == null ? '–' : list.find((x) => x.key === k)?.label ?? k);
const subL = new Map<string, string>(), typeL = new Map<string, string>(), catL = new Map<string, string>();
for (const c of KEY_LISTS.categories) { catL.set(c.key, c.label); for (const s of c.subs ?? []) { subL.set(s.key, s.label); for (const t of s.types ?? []) typeL.set(t.key, t.label); } }
const kind = (k: string) => typeL.get(k) ?? subL.get(k) ?? catL.get(k) ?? k;
const mat = (k: string) => label(KEY_LISTS.materials, k) || k;
const W = ['sehr leicht', 'leicht', 'mittel', 'warm'];
const RN = ['schlecht', 'mittel', 'gut'];
const FORM = ['', 'Freizeit', 'Casual', 'Smart Casual', 'Business', 'sehr formell'];
const fr = (f: readonly number[]) => (f[0] === f[1] ? FORM[f[0]] : `${FORM[f[0]]} – ${FORM[f[1]]}`);
const season = (s: readonly string[]) => (s.length === 4 ? 'ganzjährig' : s.map((x) => label(KEY_LISTS.seasons, x)).join(', '));
const LAYER = ['Basis', 'Mittellage', 'Offen darüber', 'Außen'];
const closures = KEY_LISTS.closures as readonly Opt[], collars = KEY_LISTS.collars as readonly Opt[], straps = KEY_LISTS.straps as readonly Opt[];

/** Tabelle aus Zeilen */
const table = (head: string[], rows: (string | number)[][]) =>
  `<table><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;
/** Zum Aufklappen */
const fold = (title: string, inner: string, n?: number) => `<details><summary>${esc(title)}${n != null ? ` <small>(${n})</small>` : ''}</summary>${inner}</details>`;
/** Typ/Unterkategorie-Tabelle: erst Unterkategorien („alle“), dann Typen */
const byKind = <T>(bySub: Record<string, T>, byType: Record<string, T>, f: (v: T) => string, head = 'Wert') =>
  table(['Unterkategorie / Typ', head], [
    ...Object.entries(bySub).map(([k, v]) => [`${kind(k)} (alle)`, f(v)]),
    ...Object.entries(byType).map(([k, v]) => [kind(k), f(v)]),
  ]);
const words = (list: readonly (readonly [string, readonly string[], string?])[], f: (k: string) => string) =>
  table(['Wörter im Namen', 'Ergebnis'], list.map(([k, ws]) => [ws.join(', '), f(k)]));
const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0');

const sections: { id: string; title: string; body: string }[] = [];
const add = (id: string, title: string, body: string) => sections.push({ id, title, body });

// ---------- 1. Grundprinzip ----------
add('prinzip', 'Grundprinzip in drei Sätzen', `
<p class="lead">Jedes Feld eines Teils hat eine <b>Quelle</b>. Valet nimmt immer die verlässlichste, die es gibt – und markiert alles, was du noch nicht bestätigt hast, als <b>offenen Vorschlag</b> (Funkel-Markierung in Bearbeiten). Was du selbst einträgst, wird nie wieder automatisch verändert.</p>
<h3>Rangfolge der Quellen (oben gewinnt)</h3>
<ol>
<li><b>Dein eigener Wert</b> – in Bearbeiten angetippt oder eingetragen. Unantastbar.</li>
<li><b>Etikett</b> (Foto vom Pflegeetikett) – Marke, Material mit %, Größe, Pflege, Artikelnummer.</li>
<li><b>Shopseite oder Screenshot</b> (Link einfügen / Bestellung) – Name, Marke, Kategorie, Material, Preis, Beschreibung.</li>
<li><b>Feste Regeln</b> aus Typ, Material, Wärme (diese Seite) – gleich stark wie Shop-Infos.</li>
<li><b>Wörter im Namen</b> – z. B. „Slim“, „Zip“, „Pinstripe“, „Gabardine“. Nur, wenn der Name von dir oder aus Shop/Etikett stammt, nie wenn die KI ihn selbst erfunden hat.</li>
<li><b>KI-Schätzung aus dem Foto</b> – füllt, was sonst niemand weiß. Ist sie sich sehr sicher (Sicherheit ≥ ${AI_SURE} von 10) und widerspricht einer Regel aus dem Typ, gewinnt bei sichtbaren Dingen (Verschluss, Kragen, Absatz, Oberfläche …) die KI.</li>
</ol>
<p class="note">Interne Rangzahlen (Herkunft offener Werte in <code>items.analysis.src</code>): ${Object.entries(ORIGIN_RANK).map(([k, v]) => `${k} ${v}`).join(' · ')}. Höher schlägt niedriger, gleich schlägt gleich (neuere Info).</p>
<h3>Drei Arten von „bestätigt“</h3>
${table(['Zustand', 'Woran man es erkennt', 'Was Regeln dürfen'], [
  ['Offener Vorschlag', 'Funkel-Markierung, Hinweis „aus Typ und Material berechnet“ o. Ä.', 'Jederzeit neu berechnen und ersetzen'],
  ['KI-Wert übernommen', '„Übernehmen“, „Alle übernehmen“ oder „Ergebnisse prüfen“ (gespeichert in analysis.accepted)', 'Bei klarem Widerspruch korrigieren – das Feld wird dann wieder offen'],
  ['Selbst eingetragen', 'Wert in Bearbeiten angetippt; Profilwerte in analysis.own', 'Nichts – bleibt für immer'],
])}
<h3>Wann wird neu gerechnet?</h3>
<ul><li>Neues Teil anlegen, „Neu analysieren“, Link/Etikett auslesen, Stapellauf „Profile ergänzen“.</li>
<li>In Bearbeiten, sobald sich Kategorie/Typ, Name, Material oder Wärme ändern (nur offene oder übernommene Werte).</li>
<li>Profilwerte (Glanz, Formstabilität, Formalität …) nur bei einer neuen Bildanalyse oder beim Nachrechnen.</li></ul>`);

// ---------- 2. Material ----------
add('material', 'Material und Anteile', `
<p>Fast alle Regeln fragen: <b>Woraus besteht das Teil hauptsächlich?</b> Dafür bekommt jedes Material einen Anteil.</p>
<ul><li>Mit Prozentangabe (Etikett/Shop): genau diese Prozente.</li>
<li>Ohne Prozent: nach Reihenfolge – das zuerst genannte ist das Hauptmaterial. Zwei Materialien ${Wt.ORDER_WEIGHTS[2]!.map((x) => x * 100).join('/')}, drei ${Wt.ORDER_WEIGHTS[3]!.map((x) => x * 100).join('/')}, ab vier 60/20/Rest gleich.</li>
<li>Elasthan ohne Prozent zählt als ${Wt.ELASTANE_GUESS} % (mehr ist es praktisch nie).</li>
<li>Teilweise Prozent: der Rest wird nach Reihenfolge verteilt (z. B. 60 % + zwei ohne → 60/32/8).</li></ul>
<p><b>Wofür:</b> Wärme rechnet alle Anteile gewichtet zusammen (5 % Wolle ändern nichts). Regen, Glanz, Oberfläche, Transparenz, Formstabilität schauen nur aufs Hauptmaterial. Pflege nimmt die vorsichtigste Stufe aller Materialien ab 15 %.</p>
<p class="tip">Tipp: Je mehr Teile echte Prozente haben (über „Links nachtragen“ oder ein Etikettfoto), desto genauer wird alles.</p>`);

// ---------- 2b. Farben ----------
add('farben', 'Farben und Farbanteile', `
<p>Die KI erkennt bis zu ${3} Farben, sortiert nach Fläche, und schätzt seit 21.11.2026 zu jeder Farbe den <b>Flächenanteil</b> in 5er-Schritten (z. B. Schwarz 95 %, Rot 5 %). Gespeichert in der Analyse, gültig nur solange die Farben gleich bleiben.</p>
<ul><li><b>Details</b> (Anteil ≤ 10 %, z. B. Logo, Naht, Knöpfe) zählen nicht für Farbtemperatur, Sättigung, Farbverteilung und Vielseitigkeit – als Akzent für die Farbharmonie im Outfit bleiben sie erhalten (rotes Logo passt zu roten Sneakern).</li>
<li>Die übrigen Farben werden nach ihren echten Anteilen gemittelt.</li>
<li>Ohne Anteile (ältere Analysen) gelten feste Gewichte nach Rang: 70/30 bzw. 60/30/10.</li>
<li>Ob ein Teil „laut“ wirkt, entscheidet vor allem die Auffälligkeit, die die KI am Foto schätzt.</li></ul>`);

// ---------- 3. Wärme ----------
add('waerme', 'Wärme (sehr leicht · leicht · mittel · warm)', `
<p><b>Rechnung:</b> Grundwert aus Typ bzw. Unterkategorie + Verschiebung durch das Material (gewichtet nach Anteil) + 1 bei Futter-Wörtern im Namen → gerundet auf 0–3.</p>
<p><b>Was die Stufen bedeuten</b> (für Outfits): „leicht“ geht praktisch immer; „sehr leicht“ fliegt unter ${C.temp.cool} °C raus; „mittel“ ist bei Hitze abgewertet und ab ${C.temp.veryHot} °C raus; „warm“ ist ab ${C.temp.hot} °C raus.</p>
${fold('Grundwert je Unterkategorie', byKind(Wt.WARMTH_BY_SUB as Record<string, number>, {}, (v) => W[v]!), Object.keys(Wt.WARMTH_BY_SUB).length)}
${fold('Grundwert je Typ (geht vor)', table(['Typ', 'Wärme'], Object.entries(Wt.WARMTH_BY_TYPE).map(([k, v]) => [kind(k), W[v]!])), Object.keys(Wt.WARMTH_BY_TYPE).length)}
${fold('Ohne Unterkategorie: je Kategorie', table(['Kategorie', 'Wärme'], Object.entries(Wt.WARMTH_BY_CATEGORY).map(([k, v]) => [kind(k), W[v]!])))}
${fold('Verschiebung durch Material', table(['Material', 'Verschiebung'], Object.entries(Wt.MATERIAL_WARMTH).map(([k, v]) => [mat(k), sign(v)])) + '<p class="note">Alle anderen Materialien ±0. Beispiel: Pullover (mittel) aus 100 % Wolle → mittel + 1 = warm; aus 20 % Wolle → +0,2 → bleibt mittel.</p>')}
<h3>Sonderregel Anzugstoffe</h3>
<p>Für ${[...Wt.TAILORED_SUBS].map(kind).join(', ')} und die Typen ${[...Wt.TAILORED_TYPES].map(kind).join(', ')} gilt eine eigene Tabelle: Wolle zählt <b>nicht</b> wärmer (Kammgarn trägt man ganzjährig). Wärmer nur durch ${Object.entries(Wt.TAILORED_WARMTH).filter(([, v]) => v > 0).map(([k]) => mat(k)).join(', ')} oder die Wörter ${Wt.TAILORED_WARM_WORDS.join(', ')}; Leinen/Seide eine Stufe leichter.</p>
<h3>Schuhe – nur nach Art</h3>
<p>Material verschiebt bei Schuhen nichts. Zehen offen (Sandalen, Badelatsche, Flip-Flop, Sandalette, Espadrille) = sehr leicht · geschlossen (auch Clogs, Mules, Slingbacks, Ballerinas) = leicht · Stiefel/Wanderstiefel = mittel · gefüttert (Lammfell oder Futter-Wort) = warm.</p>
<h3>Futter-Wörter im Namen (+1, bei Schuhen → warm)</h3><p>${Wt.WARM_WORDS.join(', ')}</p>`);

// ---------- 4. Regen ----------
add('regen', 'Regenschutz (schlecht · mittel · gut)', `
<p><b>Rechnung:</b> Regenschutz des Hauptmaterials – <b>nur bei ${[...Wt.RAIN_BY_MATERIAL_IN].map(kind).join(' und ')}</b>. Hosen und Oberteile bekommen aus dem Material nie Regenschutz (eine Polyester-Stoffhose wird trotzdem nass). Danach heben Typ, Unterkategorie oder Wörter im Namen an.</p>
${fold('Material', table(['Material', 'Regen'], Object.entries(Wt.MATERIAL_RAIN).map(([k, v]) => [mat(k), RN[v]!])) + '<p class="note">Alle anderen Materialien = schlecht (Baumwolle, Wildleder, Mesh, Strick …).</p>')}
${fold('Typ und Unterkategorie (Mindestwert)', table(['Typ', 'mindestens'], [...Object.entries(Wt.RAIN_BY_TYPE), ...Object.entries(Wt.RAIN_BY_SUB)].map(([k, v]) => [kind(k), RN[v]!])))}
${table(['Wörter im Namen', 'Ergebnis'], [[Wt.RAIN_WORDS.proof.join(', '), 'gut'], [Wt.RAIN_WORDS.repellent.join(', '), 'mindestens mittel']])}`);

// ---------- 5. Saison ----------
add('saison', 'Saison', `
<p class="note">Die Saison ist nur noch <b>Anzeige</b>: Schrank-Filter und Statistik („lange nicht getragen“). Für Outfit-Vorschläge zählt ausschließlich die Temperatur des Tages.</p>
${table(['Wärme', 'Saison (Grundregel)'], R.SEASONS_BY_WARMTH.map((s, i) => [W[i]!, season(s)]))}
<h3>Ausnahmen</h3>
<ul>
<li>Kappen, Socken, Strumpfhosen und alles ohne Wetterfeld (Schmuck, Taschen, Brillen, Gürtel …): <b>ganzjährig</b></li>
<li>Bademode: Sommer</li>
<li>Schuhe: offen Frühling + Sommer · geschlossen ganzjährig · Stiefel Frühling, Herbst, Winter · gefüttert Herbst + Winter</li>
<li>Basisteile (T-Shirt, Longsleeve, Hemd, Polo, Bluse, Body, Sporttop) mit Wärme „leicht“: ganzjährig – im Winter als unterste Lage</li>
<li>Hosen bis „mittel“ (auch Jeans): ganzjährig; warme Hosen Herbst + Winter</li>
<li>Warme Außenlage (Mäntel, Daunen): Frühling, Herbst, Winter</li>
<li>Mützen, Schals, Handschuhe, Stulpen ab „mittel“: Herbst + Winter; leichte (Halstuch, Bandana): ganzjährig</li>
</ul>`);

// ---------- 6. Lagen ----------
const layerTxt = (v: readonly number[]) => (v.length ? v.map((i) => LAYER[i]).join(' + ') : 'keine');
add('lagen', 'Lagen (Basis · Mittellage · Offen darüber · Außen)', `
<p>Vorgabe je Unterkategorie/Typ; du kannst sie in Bearbeiten ändern. Die KI schätzt keine Lagen. Bedeutung: <b>Basis</b> = direkt auf der Haut, <b>Mittellage</b> = darüber (Pullover), <b>Offen darüber</b> = offen getragen (Hemdjacke, Blazer), <b>Außen</b> = schützt vor Kälte/Wind/Regen.</p>
${fold('Vorgabe je Unterkategorie', byKind(LAYER_BY_SUB as Record<string, readonly number[]>, {}, layerTxt, 'Lagen'), Object.keys(LAYER_BY_SUB).length)}
${fold('Vorgabe je Typ (geht vor)', table(['Typ', 'Lagen'], Object.entries(LAYER_BY_TYPE).map(([k, v]) => [kind(k), layerTxt(v)])))}
${fold('Ohne Unterkategorie', table(['Kategorie', 'Lagen'], Object.entries(LAYER_BY_CATEGORY).map(([k, v]) => [kind(k), layerTxt(v)])))}`);

// ---------- 7. Passform & Form ----------
add('passform', 'Passform, Beinverlauf, Saum, Schafthöhe', `
<p><b>Passform</b> (Weite/Länge/Leibhöhe) schätzt die KI aus dem Foto. Stehen Begriffe im (vertrauten) Namen, gewinnen sie – solange du die Passform nicht selbst gesetzt hast. In Bearbeiten wird der Name nur als Vorschlag übernommen.</p>
${fold('Begriffe → Passform', table(['Begriff', 'ergibt'], [...Object.entries(FIT_TERMS), ...Object.entries(FIT_NAME_EXTRA)].map(([k, v]) => [k, Object.entries(v).map(([a, b]) => `${a === 'width' ? 'Weite' : a === 'length' ? 'Länge' : 'Leibhöhe'} ${b}`).join(', ')])))}
${fold('Schreibweisen', table(['Im Namen', 'gilt als'], Object.entries(FIT_NAME_ALIASES)))}
${fold('Beinverlauf und Saum (nur Hosen)', table(['Im Namen', 'ergibt'], [...Object.entries(LEG_TERMS).map(([k, v]) => [k, `Bein ${lab(LEGS, v)}`]), ...Object.entries(HEM_TERMS).map(([k, v]) => [k, `Saum ${lab(HEMS, v)}`])]))}
<h3>Schafthöhe</h3>
<p>Kein Feld bei ${NO_SHAFT.map(kind).join(', ')}. Ergibt sich aus dem Typ, dann ebenfalls kein Feld:</p>
${fold('Schafthöhe aus Typ', table(['Typ', 'Schaft'], [...Object.entries(SHAFT_BY_SUB).map(([k, v]) => [`${kind(k)} (alle)`, lab(SHAFTS, v)]), ...Object.entries(SHAFT_BY_TYPE).map(([k, v]) => [kind(k), lab(SHAFTS, v)])]))}
<p class="note">Feld (KI) nur bei Chunky-/Plateau-Sneaker, Basketballschuh, Absatzschuhen, Sonstiges und Schuhen ohne Typ.</p>`);

// ---------- 8. Details aus Typ ----------
add('details', 'Verschluss, Kragen, Trägerart, Absatz, Sohle, Taschengröße', `
<p>Hier legt der Typ den Wert fest. <b>Regel „(alle)“ je Unterkategorie füllt nur leere Felder</b>; ein genauer Typ oder ein Wort im Namen ersetzt auch eine KI-Schätzung – außer die KI ist sich sicher und sieht etwas anderes (z. B. Polo mit Reißverschluss).</p>
${fold('Verschluss', byKind(R.CLOSURE_BY_SUB, R.CLOSURE_BY_TYPE, (v) => lab(closures, v)) + words(R.CLOSURE_WORDS, (k) => lab(closures, k)))}
${fold('Kragen / Ausschnitt', byKind(R.COLLAR_BY_SUB, R.COLLAR_BY_TYPE, (v) => lab(collars, v)) + words(R.COLLAR_WORDS, (k) => lab(collars, k)))}
${fold('Trägerart (Taschen)', byKind(R.STRAP_BY_SUB, R.STRAP_BY_TYPE, (v) => lab(straps, v)) + '<p class="note">Gürteltasche hat keinen passenden Wert → KI.</p>')}
${fold('Absatz', byKind(R.HEEL_BY_SUB, R.HEEL_BY_TYPE, (v) => lab(HEELS, v)) + '<p class="note">Absatzschuhe ohne eindeutigen Typ schätzt die KI.</p>')}
${fold('Sohle', table(['Typ', 'Sohle'], Object.entries(R.SOLE_BY_TYPE).map(([k, v]) => [kind(k), lab(SOLES, v)])) + '<p class="note">Alle anderen: KI.</p>')}
${fold('Taschengröße', byKind(R.BAG_SIZE_BY_SUB, R.BAG_SIZE_BY_TYPE, (v) => lab(BAG_SIZES, v)))}`);

// ---------- 9. Oberfläche ----------
add('oberflaeche', 'Glanz, Oberfläche, Transparenz, Formstabilität', `
<p>Vorgabe aus dem Hauptmaterial (Formstabilität aus Typ + Material). Die KI darf abweichen, wenn sie sich sicher ist – z. B. Lackleder, dünnes weißes Shirt.</p>
${fold('Glanz je Material (1 matt … 5 stark glänzend)', table(['Material', 'Glanz'], Object.entries(R.MATERIAL_SHEEN).map(([k, v]) => [mat(k), `${v} – ${SCALE_WORDS.sheen[v - 1]}`])) + words(R.SHEEN_WORDS.map(([v, ws]) => [String(v), ws] as const), (k) => `Glanz ${k}`))}
${fold('Oberfläche', table(['Material', 'Oberfläche'], Object.entries(R.MATERIAL_SURFACE).map(([k, v]) => [mat(k), lab(SURFACES, v)])) + words(R.SURFACE_WORDS, (k) => lab(SURFACES, k)))}
${fold('Transparenz (nur Kleidung)', table(['Material', 'Transparenz'], Object.entries(R.MATERIAL_OPACITY).map(([k, v]) => [mat(k), lab(OPACITIES, v)])) + '<p class="note">Baumwolle, Leinen, Seide, Viskose, Polyester … schätzt die KI (dünn oder dick sieht man nur auf dem Foto). Wörter „sheer, transparent, durchsichtig“ → durchsichtig.</p>')}
${fold('Formstabilität (1 fließend … 5 sehr formstabil)', byKind(R.STRUCTURE_BY_SUB, R.STRUCTURE_BY_TYPE, String) + table(['Material (nur Kleidung)', 'Verschiebung'], Object.entries(R.MATERIAL_STRUCTURE).filter(([, v]) => v).map(([k, v]) => [mat(k), sign(v)])))}`);

// ---------- 10. Name ----------
add('name', 'Metallton, Muster, Waschung aus dem Namen', `
<p>Nur bei vertrautem Namen (selbst eingetragen oder aus Shop/Etikett). Sonst schätzt die KI am Foto – bei Uhren und Schmuck sagt sie Silber, Gold, Roségold, Schwarz oder Gemischt.</p>
${fold('Metallton (Oberbekleidung, Schuhe, Taschen, Gürtel, Schmuck)', words(R.METAL_WORDS, (k) => lab(METAL_TONES, k)))}
${fold('Muster', words(R.PATTERN_WORDS, (k) => label(KEY_LISTS.patterns, k)) + '<p class="note">Nadelstreifen/Pinstripe zusätzlich Mustergröße „Fein“. Rib/Ripp ist kein Muster, sondern Oberfläche „Gerippt“.</p>')}
${fold('Waschung (Jeans/Denim)', words(R.WASH_WORDS, (k) => lab(DENIM_WASHES, k)) + '<p class="note">Ohne Wort: erste Farbe Schwarz/Anthrazit → Schwarz; Blautöne schätzt die KI.</p>')}`);

// ---------- 11. Formalität & Vielseitigkeit ----------
add('stil', 'Formalität und Vielseitigkeit', `
<h3>Formalität</h3>
<p>Skala: ${FORM.slice(1).map((f, i) => `${i + 1} ${f}`).join(' · ')}. Jedes Teil hat einen <b>Bereich</b> (z. B. „Casual – Business“). Der Typ gibt einen <b>Rahmen</b> vor, die KI setzt den Bereich darin nach dem Foto (z. B. Barrel-Anzughose eher unten). Lockerer Schnitt im Namen bei Hosen/Shorts (${R.RELAXED_WORDS.join(', ')}) senkt die Obergrenze um eine Stufe. Selbst eingestellt bleibt.</p>
${fold('Rahmen je Unterkategorie / Typ', byKind(R.FORMALITY_BY_SUB, R.FORMALITY_BY_TYPE, fr, 'Rahmen'), Object.keys(R.FORMALITY_BY_SUB).length + Object.keys(R.FORMALITY_BY_TYPE).length)}
<p class="note">Ohne Rahmen (z. B. Uhren, Schmuck, Kleider, Röcke) entscheidet die KI frei.</p>
<h3>Vielseitigkeit (1–5) – wird ausgerechnet</h3>
<ul><li>Start 2,5</li><li>nur neutrale Farben +1 · eine Akzentfarbe ±0 · mehrere Farben −1</li><li>unifarben +0,5 · lautes Muster (Animal, Floral, Camouflage, Grafik …) −1</li>
<li>Auffälligkeit (KI) 1–2 +0,5 · 4 −0,5 · 5 −1</li><li>Formalität über ≥ 3 Stufen +0,5 · nur eine Stufe −0,5</li>
<li>Typ: ${Object.entries(R.VERSATILITY_BY_TYPE).map(([k, v]) => `${kind(k)} ${sign(v)}`).join(', ')}</li>
<li>Gerundet, ,5 nach unten – 5 gibt es nur mit allen Pluspunkten.</li></ul>`);

// ---------- 12. Pflege ----------
add('pflege', 'Pflege (geschätzt aus Material)', `
<p>Nur für leere Gruppen, vorsichtig (30 °C statt 40 °C, Trockner „nicht“ statt „niedrig“), professionelle Reinigung wird nie geschätzt. Angezeigt mit Stern und „geschätzt aus Material“. Ein Etikett oder dein eigener Eintrag ersetzt jede Schätzung. Bei Mischungen: je Gruppe die vorsichtigste Stufe aller Materialien ab 15 %.</p>
${fold('Tabelle je Material', table(['Material', 'Waschen', 'Bleichen', 'Trocknen', 'Bügeln'], Object.entries(R.MATERIAL_CARE).map(([k, v]) => [mat(k), ...(['wash', 'bleach', 'dry', 'iron'] as const).map((g) => (v[g] ? careLabel(g, v[g]!) : '–'))])), Object.keys(R.MATERIAL_CARE).length)}`);

// ---------- 13. KI ----------
const aiOnly = PROFILE_FIELDS.filter((f) => !f.hidden && !['sheen', 'surface', 'opacity', 'structure', 'heel', 'bag_size', 'metal_tone', 'denim_wash', 'formality', 'versatility', 'shaft', 'sole', 'leg', 'hem', 'pattern_scale'].includes(f.key));
add('ki', 'Was nur die KI schätzt', `
<p>Alles, was man nur auf dem Foto sieht:</p>
<ul><li>Kategorie/Unterkategorie/Typ, Farben (Reihenfolge = Anteil), Muster (wenn kein Wort im Namen)</li>
<li>${aiOnly.map((f) => esc(f.label)).join(', ')}</li>
<li>Schuhspitze, Sohle (außer Chunky/Plateau), Metallton ohne Wort im Namen (Uhren, Schmuck), Waschung in Blautönen</li>
<li>Name und Marke, wenn es keine Shop-/Etikett-Info gibt</li></ul>
<p class="note">Die KI liefert je Gruppe eine Sicherheit (0–10). Ab ${AI_SURE} darf sie Typ-Regeln bei sichtbaren Details widersprechen.</p>`);

// ---------- 14. Outfits ----------
const occ = Object.entries(C.occasionFormality).map(([k, v]) => [label(OCCASIONS as never, k) || k, fr(v)]);
add('outfits', 'So nutzen Outfit-Vorschläge diese Werte', `
<p class="note">Die Outfit-Logik ist entworfen und getestet, aber noch nicht in der App eingebaut.</p>
<h3>Temperatur (gefühlt) – harte Grenzen</h3>
${table(['Temperatur', 'Regel'], [
  [`ab ${C.temp.veryHot} °C`, 'nur sehr leicht und leicht (Schuhe ausgenommen)'],
  [`${C.temp.hot}–${C.temp.veryHot - 1} °C`, 'leicht ohne Abzug, mittel erlaubt aber abgewertet, warm raus; offen darüber nur Hemden'],
  [`${C.temp.mild}–${C.temp.hot - 1} °C`, `bis mittel`],
  [`${C.temp.cool}–${C.temp.mild - 1} °C`, 'alles; keine Shorts'],
  [`${C.temp.cold}–${C.temp.cool - 1} °C`, `kein „sehr leicht“, Außenlage mindestens ${W[C.outerWarmthMin.cold]}`],
  [`unter ${C.temp.cold} °C`, `Außenlage mindestens ${W[C.outerWarmthMin.freezing]}`],
])}
<h3>Schuhe</h3><p>Zehen offen nicht unter ${C.shoeTemp.openMin} °C, gefüttert nicht über ${C.shoeTemp.linedMax} °C; sonst frei. Stiefel bei Kälte leicht bevorzugt, bei Hitze leicht abgewertet.</p>
<h3>Regen und Schnee (nur mit Schalter „Wetter berücksichtigen“)</h3>
${table(['Wetter', 'Bedingung', 'Regel'], [
  ['Niesel', `unter ${C.rainMm.drizzle} mm/h`, 'nur weicher Abzug für nicht regenfeste Schuhe/Jacken'],
  ['Regen', `${C.rainMm.drizzle}–${C.rainMm.heavy} mm/h, ≥ ${C.rainProb.hard} %`, `Außenlage ≥ ${RN[C.rainMin.rain.outer]}, Schuhe ≥ ${RN[C.rainMin.rain.shoe]}`],
  ['Starkregen', `ab ${C.rainMm.heavy} mm/h oder Gewitter`, `Außenlage ≥ ${RN[C.rainMin.heavy.outer]}, Schuhe ≥ ${RN[C.rainMin.heavy.shoe]}`],
  ['Schnee/Matsch', `Schneefall ≥ ${C.rainProb.hard} %`, `Schuhe mit Schaft ${C.snow.shoeShafts.map((s) => lab(SHAFTS, s)).join('/')} und Regen ≥ ${RN[C.snow.shoeRainMin]}, Außenlage ${W[C.snow.outerWarmthMin]}`],
  ['unsicher', `${C.rainProb.soft}–${C.rainProb.hard - 1} %`, 'nur weicher Abzug'],
])}
<h3>Anlass → passende Formalität</h3>${table(['Anlass', 'Formalität'], occ)}
<h3>Weiche Bewertung (Gewichte)</h3>${table(['Kriterium', 'Gewicht'], Object.entries(C.weights).map(([k, v]) => [({ color: 'Farben', statement: 'Statement-Balance', formality: 'Formalität', proportion: 'Proportion', surface: 'Oberflächen', metal: 'Metalle', variety: 'Abwechslung/Wetter' } as Record<string, string>)[k] ?? k, v]))}
<p class="note">Details: <code>docs/outfits/outfit-zusammenstellung.html</code>.</p>`);

// ---------- 15. Offen ----------
add('offen', 'Offene Punkte und Vermerke', `
<ul>
<li><b>Kleider und Röcke:</b> noch keine Formalitäts-Rahmen, Formstabilität und Saison-Ausnahmen – nachziehen, sobald solche Teile dazukommen.</li>
<li><b>Gold-Set/Eval</b> der KI-Analyse (wie oft liegt die KI richtig) noch offen.</li>
<li><b>Stilprofil</b> (laut/leise) für die Outfit-Gewichte: später.</li>
<li>Diese Seite erzeugt sich aus dem Code: nach jeder Regeländerung <code>pnpm einordnung</code>.</li>
</ul>`);

const nav = sections.map((s, i) => `<a href="#${s.id}">${i + 1}. ${esc(s.title)}</a>`).join('');
const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Valet – So ordnet Valet Teile ein</title>
<style>
:root{--ink:#2a1a1d;--muted:#7a6a66;--acc:#722638;--bg:#F5F0E8;--card:#fff}
body{background:var(--bg);color:var(--ink);font:15.5px/1.55 -apple-system,system-ui,sans-serif;max-width:860px;margin:auto;padding:18px}
h1{font-family:Georgia,serif;color:var(--acc);font-size:30px;margin:8px 0 4px}h2{color:var(--acc);font-size:21px;margin:0 0 10px}h3{font-size:16px;margin:18px 0 6px}
section{background:var(--card);border-radius:18px;padding:16px 18px;margin:16px 0;scroll-margin-top:12px}
nav{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0}nav a{background:var(--card);border-radius:99px;padding:5px 11px;color:var(--acc);text-decoration:none;font-size:13px}
table{border-collapse:collapse;width:100%;margin:8px 0}td,th{padding:6px 8px;border-bottom:1px solid #eee;text-align:left;vertical-align:top;font-size:14px}th{background:#faf6ef}
details{border:1px solid #eee5d8;border-radius:12px;padding:8px 12px;margin:8px 0}summary{cursor:pointer;font-weight:600}
.note{color:var(--muted);font-size:13.5px}.lead{font-size:16.5px}.tip{background:#fbeef2;border-radius:10px;padding:8px 12px}small{color:var(--muted)}code{background:#f3ede4;border-radius:5px;padding:1px 5px;font-size:13px}
</style></head><body>
<h1>So ordnet Valet Teile ein</h1>
<p class="note">Stand: ${new Date().toLocaleDateString('de-DE')} · alle Tabellen direkt aus dem Code erzeugt · zum Nachschlagen und Mitarbeiten</p>
<nav>${nav}</nav>
${sections.map((s, i) => `<section id="${s.id}"><h2>${i + 1}. ${esc(s.title)}</h2>${s.body}</section>`).join('')}
<p style="text-align:center;color:var(--acc);font-family:Georgia,serif">valet</p>
</body></html>`;
writeFileSync(resolve(here, 'einordnung.html'), html);
console.log('geschrieben:', resolve(here, 'einordnung.html'));

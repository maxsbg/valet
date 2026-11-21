// Feste Regeln (rules.ts) im Formular anwenden (Max, 21.11.2026).
// Rangfolge: dein Wert > Wort im Namen (nur vertrauter Name) > KI, wenn sie sicher ist (≥ 8/10) und widerspricht > Regel aus Typ/Material > KI unsicher.
// Saison, Pflege, Vielseitigkeit und Formalitäts-Rahmen sind reine Regeln (das Foto weiß dort nichts Besseres).

import type { EditForm } from './edit';
import { nameTrusted, originsOf, type Origin } from './ai/origin';
import type { ConfidenceGroup, Profile } from './ai/profile';
import type { Care } from './attributes';
import * as R from './rules';

/** Ab dieser Sicherheit (0–10) darf die KI einer Typ-/Material-Regel widersprechen */
export const AI_SURE = 8;

const input = (f: EditForm): R.RuleInput => ({
  category: f.category, subcategory: f.subcategory, type: f.type, materials: f.materials, name: f.name, colors: f.colors, nameTrusted: nameTrusted(f),
});
const sure = (f: EditForm, g: ConfidenceGroup) => (f.confidence?.[g] ?? 0) >= AI_SURE;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const byName = (why: string) => why.startsWith('Name');

/** Steckbrief: Saison, Verschluss, Kragen, Muster (Name), geschätzte Pflege. Läuft bei jeder Änderung von Kategorie, Name, Material, Wärme. */
export function applyRules(f: EditForm): EditForm {
  const i = input(f);
  const src: Record<string, unknown> = { ...originsOf(f) };
  let pending = [...f.aiPending];
  let out: EditForm = f;
  const isOpen = (k: string) => pending.includes(k);
  const set = <K extends keyof EditForm>(k: K, v: EditForm[K], origin: Origin) => {
    if (same(out[k], v) && src[k as string] === origin) return;
    out = { ...out, [k]: v };
    if (!isOpen(k as string)) pending = [...pending, k as string];
    src[k as string] = origin;
  };
  /** Darf ein offener/leerer Wert ersetzt werden? Nie über Shop/Etikett (außer eigene Regel) */
  const replaceable = (k: string, empty: boolean) => {
    if (empty) return true;
    if (!isOpen(k)) return false; // bestätigt
    const o = (src[k] as Origin | undefined) ?? 'image';
    return o === 'image' || o === 'name' || o === 'rule' || o === 'material';
  };

  // Saison aus Wärme (reine Regel; nur nicht über dem Etikett)
  const s = R.seasonsFrom(f.category, f.subcategory, f.warmth);
  if (s && replaceable('seasons', f.seasons.length === 0)) set('seasons', [...s], 'rule');

  // Verschluss und Kragen
  for (const [k, r] of [['closure', R.closureFrom(i)], ['collar', R.collarFrom(i)]] as const) {
    if (!r) continue;
    const cur = out[k];
    if (!replaceable(k, cur == null)) continue;
    if (cur != null && !byName(r.why)) {
      const o = (src[k] as Origin | undefined) ?? 'image';
      if (o === 'image' && cur !== r.v && sure(f, 'shape')) continue; // KI sieht auf dem Foto sicher etwas anderes
      if (r.why === 'Unterkategorie') continue; // Unterkategorie füllt nur leere Felder
    }
    set(k, r.v, byName(r.why) ? 'name' : 'rule');
  }

  // Muster aus dem Namen
  const p = R.patternFrom(i);
  if (p && replaceable('pattern', out.pattern == null)) set('pattern', p.v, 'name');

  // Pflege: leere oder geschätzte Gruppen (nie Etikett oder selbst gesetzt)
  const c = R.careFrom(i);
  if (c) {
    const care: Care = { ...out.care };
    for (const [g, v] of Object.entries(c.care) as [keyof Care, NonNullable<Care[keyof Care]>][]) {
      const cur = care[g];
      if (!cur || cur.src === 'geschaetzt') care[g] = v;
    }
    if (!same(care, out.care)) out = { ...out, care };
  }

  if (out === f) return f;
  return { ...out, aiPending: pending, analysisBase: { ...out.analysisBase, src } };
}

/** Profil-Werte nach einer Bildanalyse (oder beim Nachrechnen): Regel, außer die KI ist sicher und widerspricht */
export function applyProfileRules(f: EditForm): EditForm {
  const i = input(f);
  const p: Profile = { ...f.profile };
  const pick = <K extends keyof Profile>(k: K, r: { v: Profile[K]; why: string } | null, g: ConfidenceGroup) => {
    if (!r || r.v == null) return;
    const ki = p[k];
    if (ki != null && ki !== r.v && !byName(r.why) && sure(f, g)) return;
    p[k] = r.v;
  };
  const simple = <V>(v: V | null) => (v == null ? null : { v, why: 'Typ' });
  pick('heel', simple(R.heelFrom(i)) as never, 'shape');
  pick('bag_size', simple(R.bagSizeFrom(i)) as never, 'shape');
  pick('structure', R.structureFrom(i) as never, 'shape');
  pick('sheen', R.sheenFrom(i) as never, 'surface');
  pick('surface', R.surfaceFrom(i) as never, 'surface');
  pick('opacity', R.opacityFrom(i) as never, 'surface');
  pick('metal_tone', R.metalFrom(i) as never, 'material');
  pick('denim_wash', R.washFrom(i) as never, 'color');
  const pat = R.patternFrom(i);
  if (pat?.scale) p.pattern_scale = pat.scale;
  // Formalität: KI-Bereich in den Rahmen des Typs
  const fr = R.formalityFrame(i);
  if (fr) p.formality = R.clampFormality(p.formality, fr.v);
  // Vielseitigkeit ausrechnen
  const ve = R.versatilityFrom({ colors: f.colors, pattern: f.pattern, presence: p.presence, formality: p.formality });
  if (ve) p.versatility = ve.v;
  return same(p, f.profile) ? f : { ...f, profile: p };
}

/** Hinweis in Bearbeiten: Wert offen und aus einer Regel */
export function ruleNote(f: Pick<EditForm, 'aiPending' | 'analysisBase'>, key: string): string | null {
  if (!f.aiPending.includes(key)) return null;
  const o = originsOf(f)[key];
  if (o === 'rule') return 'Aus Typ, Material oder Wärme abgeleitet. Passt es nicht, wähle selbst – dein Wert gilt dann immer.';
  if (o === 'name') return 'Aus dem Namen abgeleitet. Passt es nicht, wähle selbst.';
  return null;
}

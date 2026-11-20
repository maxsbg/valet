// Herkunft noch unbestätigter KI-Werte (items.analysis.src) und ihr Rang (Spec 6.7, Prüfung 20.11.2026).
// Eigenes Modul, damit edit.ts (Name → Passform) und merge.ts dieselbe Regel nutzen, ohne sich gegenseitig zu laden.

/** Woher eine Info stammt: Text der Produktseite (Link), Bild eines Shops/einer Bestellung, Etikett */
export type InfoSource = 'page' | 'screenshot' | 'label';
/** Herkunft eines noch unbestätigten Werts: Bild, Begriffe im Namen oder eine Info */
export type Origin = 'image' | 'name' | InfoSource;
/** Höher schlägt niedriger: Bild < Begriffe im Namen < Shopseite/Screenshot < Etikett */
export const ORIGIN_RANK: Readonly<Record<Origin, number>> = { image: 0, name: 1, page: 2, screenshot: 2, label: 3 };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isOrigin = (v: unknown): v is Origin => typeof v === 'string' && v in ORIGIN_RANK;

/**
 * Herkunft der unbestätigten Werte aus items.analysis.src (Feld → Origin; Passform je Stufe „fit.width“ usw.,
 * Pflege je Gruppe „care.wash“, Kategorie je Ebene „category.sub“/„category.type“). Fehlt ein Eintrag: Bildschätzung.
 */
export function originsOf(f: { analysisBase: Record<string, unknown> }): Record<string, Origin> {
  const src = isObj(f.analysisBase) ? f.analysisBase.src : null;
  return isObj(src) ? Object.fromEntries(Object.entries(src).filter(([, v]) => isOrigin(v))) as Record<string, Origin> : {};
}

/** Herkunft des offenen Werts eines Felds (ohne Eintrag: Bild) */
export const originOf = (origins: Record<string, Origin>, k: string): Origin => origins[k] ?? 'image';

/**
 * Zählen Begriffe im Namen als eigene Quelle? Nur, wenn der Name nicht selbst eine Bildschätzung der KI ist
 * (sonst schlüge die KI mit „Oversized Hoodie“ ihre eigene Foto-Schätzung): vom Nutzer (bestätigt) oder aus Shop/Etikett.
 */
export const nameTrusted = (f: { aiPending: readonly string[]; analysisBase: Record<string, unknown> }): boolean =>
  !f.aiPending.includes('name') || originOf(originsOf(f), 'name') !== 'image';

// Englische Schlüssel ↔ deutsche Labels (Leitsatz von Max, 19.11.2026):
// Code, Datenbank und KI-Schemas verwenden englische Keys, Deutsch erscheint nur als Label in der Oberfläche.
// Verbindliche Quelle: docs/keys/key-zuordnung.json (Keys und Labels dort nicht ändern).

import mapping from '../../../docs/keys/key-zuordnung.json';

export type KeyLabel = { key: string; label: string };
export type KeyList = readonly KeyLabel[];

export type KeyTypeNode = KeyLabel;
export type KeySubNode = KeyLabel & { types: readonly KeyTypeNode[] };
export type KeyCategoryNode = KeyLabel & { subs: readonly KeySubNode[] };

/** Verbindliche Listen für gespeicherte englische Schlüssel und deutsche Oberflächentexte. */
export const KEY_LISTS: {
  categories: readonly KeyCategoryNode[];
  colors: KeyList; materials: KeyList; patterns: KeyList; styles: KeyList; seasons: KeyList;
  collars: KeyList; closures: KeyList; straps: KeyList; occasions: KeyList;
} = mapping;

/** Liefert den deutschen Anzeigenamen eines Schlüssels (unbekannt → der Wert selbst, leer → ''). */
export function label(list: KeyList, key: string | null | undefined): string {
  return list.find((entry) => entry.key === key)?.label ?? key ?? '';
}

/** Akzeptiert Schlüssel, deutsches Label und übergebene Altwerte; Unbekanntes → null. */
export function toKey(list: KeyList, value: unknown, legacy: Readonly<Record<string, string>> = {}): string | null {
  if (typeof value !== 'string') return null;
  const direct = list.find((entry) => entry.key === value || entry.label === value);
  if (direct) return direct.key;
  const migrated = legacy[value];
  return migrated ? list.find((entry) => entry.key === migrated || entry.label === migrated)?.key ?? null : null;
}

/** Liste von Werten → Keys in gleicher Reihenfolge, ohne Unbekanntes und ohne Doppelte. */
export function toKeys(list: KeyList, values: unknown, legacy: Readonly<Record<string, string>> = {}): string[] {
  const out: string[] = [];
  for (const v of Array.isArray(values) ? values : []) {
    const k = toKey(list, v, legacy);
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}

/** Teilliste in der angegebenen Reihenfolge (Keys müssen in der Liste stehen). */
export function pickKeys(list: KeyList, keys: readonly string[]): KeyList {
  return keys.map((k) => {
    const e = list.find((x) => x.key === k);
    if (!e) throw new Error(`Unbekannter Key ${k}`);
    return e;
  });
}

/** Nur die Keys einer Liste */
export const keysOf = (list: KeyList): string[] => list.map((e) => e.key);

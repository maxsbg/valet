import mapping from '../../../docs/keys/key-zuordnung.json';

export type KeyLabel = { key: string; label: string };
export type KeyList = readonly KeyLabel[];

/** Verbindliche Listen für gespeicherte englische Schlüssel und deutsche Oberflächentexte. */
export const KEY_LISTS = mapping;

/** Liefert den deutschen Anzeigenamen eines Schlüssels. */
export function label(list: KeyList, key: string | null | undefined): string {
  return list.find((entry) => entry.key === key)?.label ?? key ?? '';
}

/** Akzeptiert Schlüssel, deutsches Label und übergebene Altwerte. */
export function toKey(list: KeyList, value: unknown, legacy: Readonly<Record<string, string>> = {}): string | null {
  if (typeof value !== 'string') return null;
  const direct = list.find((entry) => entry.key === value || entry.label === value);
  if (direct) return direct.key;
  const migrated = legacy[value];
  return migrated ? list.find((entry) => entry.key === migrated || entry.label === migrated)?.key ?? null : null;
}


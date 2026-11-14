import { useSyncExternalStore } from 'react';

// Wendeteile, die gerade auf Seite B gedreht sind (Teil-IDs).
// Bewusst nur im Speicher: bleibt beim Seitenwechsel erhalten (Kachel bleibt gedreht, Detailansicht zeigt Seite B),
// nach dem Schließen/Neuladen der App zeigen alle Kacheln wieder ihre Hauptseite.
const flipped = new Set<string>();
const subs = new Set<() => void>();

export const isFlipped = (id: string | undefined) => !!id && flipped.has(id);

export function setFlipped(id: string, on: boolean) {
  if (on === flipped.has(id)) return;
  if (on) flipped.add(id); else flipped.delete(id);
  for (const f of subs) f();
}

/** Ist das Teil gerade umgedreht? (aktualisiert sich, wenn es irgendwo gedreht wird) */
export function useFlipped(id: string | undefined) {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    () => isFlipped(id),
    () => false,
  );
}

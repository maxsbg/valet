import { useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { itemTile, person as personColors } from '@valet/ui';
import { ItemTile, tileHeight, type PersonLook } from './ItemTile';
import { tile } from '@/lib/theme';
import { useSession } from '@/lib/session';
import { personLook, type Tile } from '@/lib/wardrobe';

type Props = {
  items: Tile[];
  width: number;
  selected?: (t: Tile) => boolean;
  onPress?: (t: Tile) => void;
};

/** Angemeldete Person und Darstellung aller Personen für die Kacheln */
export function useTilePeople() {
  const { wardrobe, session } = useSession();
  const persons = wardrobe?.persons;
  const looks = useMemo(() => {
    const m = new Map<string, PersonLook>();
    // Plaketten sind immer hell (Milchglas auf Weiß) → helle Personenfarben, auch im dunklen Modus
    for (const p of persons ?? []) m.set(p.id, personLook(p, itemTile.badge.ink, personColors.light));
    return m;
  }, [persons]);
  const me = persons?.find((p) => p.user_id === session?.user.id)?.id ?? null;
  const person = useCallback((id: string) => looks.get(id), [looks]);
  return { me, person, todayBy: wardrobe?.todayBy ?? {} };
}

/** Mosaik mit 3 Spalten: jede Kachel kommt in die gerade kürzeste Spalte (Reihenfolge bleibt von links oben nach rechts unten). */
export function Mosaic({ items, width, selected, onPress }: Props) {
  const { me, person, todayBy } = useTilePeople();
  const colW = (width - 2 * tile.gap) / 3;
  const cols = useMemo(() => {
    const c: Tile[][] = [[], [], []];
    const h = [0, 0, 0];
    for (const it of items) {
      const i = h.indexOf(Math.min(...h));
      c[i]!.push(it);
      h[i]! += tileHeight(it.size ?? it.kind ?? it.category, colW) + tile.gap;
    }
    return c;
  }, [items, colW]);
  return (
    <View style={s.row}>
      {cols.map((col, ci) => (
        <View key={ci} style={{ width: colW, gap: tile.gap }}>
          {col.map((it) => (
            <ItemTile key={it.id} item={it} width={colW} me={me} person={person} today={!it.isWish && it.id in todayBy ? { person: todayBy[it.id] ?? null } : null}
              selected={selected?.(it)} onPress={() => onPress?.(it)} />
          ))}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({ row: { flexDirection: 'row', gap: tile.gap, alignItems: 'flex-start' } });

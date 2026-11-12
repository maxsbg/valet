import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { ItemTile, tileHeight, type TileStyle } from './ItemTile';
import { tile } from '@/lib/theme';
import type { Tile } from '@/lib/wardrobe';

type Props = {
  items: Tile[];
  width: number;
  ownerOf: (t: Tile) => { letter: string; color: 'pink' | 'red' } | null;
  look?: TileStyle;
  daysLeft?: (t: Tile) => number | undefined;
  onPress?: (t: Tile) => void;
};

/** Mosaik mit 3 Spalten: jede Kachel kommt in die gerade kürzeste Spalte (Reihenfolge bleibt von links oben nach rechts unten). */
export function Mosaic({ items, width, ownerOf, look, daysLeft, onPress }: Props) {
  const colW = (width - 2 * tile.gap) / 3;
  const cols = useMemo(() => {
    const c: Tile[][] = [[], [], []];
    const h = [0, 0, 0];
    for (const it of items) {
      const i = h.indexOf(Math.min(...h));
      c[i].push(it);
      h[i] += tileHeight(it.category, colW) + tile.gap;
    }
    return c;
  }, [items, colW]);
  return (
    <View style={s.row}>
      {cols.map((col, ci) => (
        <View key={ci} style={{ width: colW, gap: tile.gap }}>
          {col.map((it) => (
            <ItemTile key={it.id} item={it} width={colW} owner={ownerOf(it)} look={look} daysLeft={daysLeft?.(it)} onPress={() => onPress?.(it)} />
          ))}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({ row: { flexDirection: 'row', gap: tile.gap, alignItems: 'flex-start' } });

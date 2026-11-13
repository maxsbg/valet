import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { boardLayout, BOARD_AR } from '@valet/core';
import { ItemPicture } from './ItemPicture';
import type { OutfitPiece } from '@/lib/outfits';
import type { Tile } from '@/lib/wardrobe';

type Props = {
  pieces: OutfitPiece[];
  byId: Map<string, Tile>;
  width: number;
  /** großes Bild statt Vorschaubild (Detailseite) */
  full?: boolean;
  radius?: number;
};

/** Outfit-Fläche wie im alten Valet: weiße 4:5-Fläche, Teile nach Körperzonen und Lagen angeordnet */
export function OutfitBoard({ pieces, byId, width, full, radius = 0 }: Props) {
  const placed = useMemo(() => {
    const its = pieces.map((p) => byId.get(p.id)).filter((i): i is Tile => !!i);
    const saved = Object.fromEntries(pieces.map((p) => [p.id, p]));
    return boardLayout(its, saved);
  }, [pieces, byId]);
  const height = Math.round(width * BOARD_AR);
  return (
    <View style={[s.board, { width, height, borderRadius: radius }]}>
      {placed.length === 0 && <Text style={s.empty}>Noch keine Teile</Text>}
      {placed.map((p) => {
        const it = p.item as Tile;
        const uri = full ? it.image ?? it.thumb : it.thumb ?? it.image;
        return (
          <View key={it.id} style={[s.piece, { left: `${p.left}%`, top: `${p.top}%`, width: `${p.width}%`, height: `${p.height}%`, zIndex: p.z, opacity: it.isWish ? 0.5 : 1 }]}>
            {uri ? (
              <Image source={{ uri }} resizeMode="contain" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
            ) : (
              <ItemPicture uri={null} inset={0} category={it.category} color={it.hex ?? '#c4bfb4'} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  board: { position: 'relative', backgroundColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  piece: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 13, color: '#7a7266' },
});

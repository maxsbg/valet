import { Pressable, StyleSheet, View } from 'react-native';
import { occasionSlots } from '@valet/core';
import { itemTile, outfitCard as OC } from '@valet/ui';
import { OutfitBoard } from './OutfitBoard';
import { Glass, Num } from './tile/TileBadge';
import { TileIcon } from './tile/TileIcons';
import type { Outfit } from '@/lib/outfits';
import type { Tile } from '@/lib/wardrobe';

type Props = {
  outfit: Outfit;
  byId: Map<string, Tile>;
  width: number;
  /** heute getragen bzw. für heute geplant: Strichfarbe der Person für den Bügel (ohne Person: ink) */
  today?: { name?: string | null; stroke: string } | null;
  onPress?: () => void;
  /** kleine Karte (z. B. „In n Outfits“ im Teil-Detail): Plaketten, Radius und Abstände genau wie die Schrank-Kachel (× 1) */
  small?: boolean;
};

const T = itemTile;
/** Maße der kleinen Karte = Kachel-Regeln ohne Vergrößerung (Max, 15.11.2026) */
const SMALL = { radius: T.radius, scale: 1, inset: T.badge.inset, overlap: T.badge.ownerOverlap, photoInset: T.photoInset } as const;

/**
 * Outfit-Karte (entschieden 14.11.2026, Entwurf „Valet – Outfits-Tab Überarbeitung“, Variante B):
 * weiße Fläche wie die Kachel, kein Text, keine Fußzeile. Plaketten mit den Kachel-Regeln × 1,5:
 *  - oben links Anlässe: erster in der Ecke obenauf, zweiter rechts darunter (4,5 px überlappend), ab drei „+N“
 *  - unten links Bügel in Personenfarbe, wenn das Outfit heute getragen wird bzw. für heute geplant ist
 */
export function OutfitCard({ outfit, byId, width, today, onPress, small }: Props) {
  const M = small ? SMALL : OC;
  const n = outfit.pieces.filter((p) => byId.has(p.id)).length;
  const slots = occasionSlots(outfit.occasions);
  const boardW = width - 2 * M.photoInset;
  const label = [`Outfit mit ${n} Teilen`, outfit.occasions.length ? outfit.occasions.join(', ') : null, today ? (today.name ? `heute: ${today.name}` : 'heute') : null]
    .filter(Boolean).join(', ');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [s.card, { width, borderRadius: M.radius, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <View style={{ padding: M.photoInset }}>
        <OutfitBoard pieces={outfit.pieces} byId={byId} width={boardW} />
      </View>

      {slots.length > 0 && (
        <View style={[s.tl, { top: M.inset, left: M.inset }]}>
          {slots.map((o, i) => (
            <View key={'more' in o ? '+' : o.icon} style={[i > 0 && { marginLeft: -M.overlap }, { zIndex: slots.length - i }]}>
              <Glass scale={M.scale}>
                {'more' in o ? <Num num={String(o.more)} sym="+" symFirst scale={M.scale} /> : <TileIcon name={o.icon} color={T.badge.ink} scale={M.scale} />}
              </Glass>
            </View>
          ))}
        </View>
      )}

      {today && (
        <View style={[s.bl, { bottom: M.inset, left: M.inset }]}>
          <Glass scale={M.scale}><TileIcon name="wornToday" color={today.stroke} scale={M.scale} /></Glass>
        </View>
      )}

      {/* feine Kante innen, über allem */}
      <View pointerEvents="none" style={[s.edge, { borderRadius: M.radius }]} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: T.bg, overflow: 'hidden' },
  tl: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  bl: { position: 'absolute' },
  edge: { ...StyleSheet.absoluteFill, boxShadow: `inset 0 0 0 ${T.edgeWidth}px ${T.edge}` },
});

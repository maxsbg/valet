// Bild der Detailseite als große Kachel (Spec 2): 358 × 380, Radius 28, Plaketten 40 px mit 8 px Abstand (konzentrisch 28 − 8 = 20).
// Gleiche Plaketten-Regeln wie die Schrank-Kachel (VALET_KACHEL_SPEC.md), nur × 2. Kein randloses Bild.
// Wendbar: Plakette oben rechts dreht das Foto (useFlip aus ItemTile, Zustand geteilt), dazu Punkte und „Seite A / B“.
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { glowFor, ownersFor, priceLabel, tileA11yLabel, topRightFor, wishTagLabel, TILE_STATUS, type ItemStatus, type WishTag } from '@valet/core';
import { detail, itemTile } from '@valet/ui';
import { useTheme } from '@/lib/theme';
import { ItemPicture } from '@/components/ItemPicture';
import { useFlip, type PersonLook } from '@/components/ItemTile';
import { Glass, Mono, Num, Price } from '@/components/tile/TileBadge';
import { TileIcon } from '@/components/tile/TileIcons';
import { TileGlow, glowBoxShadow } from '@/components/tile/TileGlow';

const I = detail.image;
/** Schein auf der großen Bild-Kachel (wie bisher, nur Farbe nach Steckbrief) */
const GLOW = { blur: 52, spread: 8 };
const B = itemTile.badge;
const K = I.badge / B.size; // 2

export type DetailImageItem = {
  id: string; name: string; kind: string; hex: string | null; colors: readonly string[]; status: ItemStatus | null;
  reversible: boolean; qty: number; owners: string[];
  /** Set-Kennung – Set-Plakette oben rechts links neben Wendbar */
  setId?: string | null;
  /** Hauptbild (volle Auflösung) und Bild der anderen Seite */
  image: string | null; imageBack: string | null;
  /** Wunschteil (Kachel-Regeln der Wunschliste × 2): oben links Kategorie, unten links Preis, kein Status, kein Bügel */
  wish?: { tag: WishTag | null; price: number | null } | null;
};

export function DetailImage({ item, width, me, person, today }: {
  item: DetailImageItem; width: number; me: string | null; person: (id: string) => PersonLook | undefined; today?: { person: string | null } | null;
}) {
  const t = useTheme();
  const h = Math.round(width * I.height / I.width);
  const glow = glowFor(item.colors, item.hex);
  const wish = item.wish ?? null;
  const price = wish ? priceLabel(wish.price) : null;
  const tr = topRightFor(item.reversible, item.qty, !!item.setId);
  const owners = ownersFor(item.owners.filter((id) => person(id)), me);
  const todayP = today && !wish ? (today.person ? person(today.person) : undefined) ?? { name: '', stroke: B.ink } : undefined;
  const flip = useFlip(tr?.reversible && item.imageBack ? item.imageBack : null, item.id);
  const label = wish ? [item.name, wish.tag ? wishTagLabel(wish.tag) : null, price ? `${price} Euro` : null].filter(Boolean).join(', ') : tileA11yLabel({
    name: item.name, status: item.status, reversible: item.reversible, set: !!item.setId, qty: item.qty, today: todayP,
    owners: owners.map((o) => ('more' in o ? o : { name: person(o.person)!.name })),
  });
  const inset = Math.round(itemTile.photoInset * K);

  return (
    <View style={{ alignItems: 'center' }}>
      <View accessibilityRole="image" accessibilityLabel={label}
        style={[s.tile, { width, height: h, boxShadow: glowBoxShadow(glow, GLOW.blur, GLOW.spread) }]}>
        <TileGlow glow={glow} radius={I.radius} blur={GLOW.blur} spread={GLOW.spread} />
        <Animated.View style={[StyleSheet.absoluteFill, flip.style]}>
          <View style={[StyleSheet.absoluteFill, flip.back && s.hidden]}>
            <ItemPicture uri={item.image} category={item.kind} color={item.hex ?? itemTile.glow.fallback} inset={inset} />
          </View>
          {flip.loaded && (
            <View style={[StyleSheet.absoluteFill, !flip.back && s.hidden]}>
              <ItemPicture uri={flip.loaded} category={item.kind} color={item.hex ?? itemTile.glow.fallback} inset={inset} />
            </View>
          )}
        </Animated.View>

        {wish?.tag && (
          <View style={s.tl}><Glass scale={K} label={`Kategorie ${wishTagLabel(wish.tag)}`}><TileIcon name={wish.tag} color={B.ink} scale={K} /></Glass></View>
        )}
        {price && (
          <View style={s.bl}><Glass scale={K} shape="pill" label={`Preis ${price} Euro`}><Price label={price} scale={K} /></Glass></View>
        )}
        {!wish && item.status && (
          <View style={s.tl}><Glass scale={K} label={TILE_STATUS[item.status].label}><TileIcon name={item.status} color={B.ink} scale={K} /></Glass></View>
        )}
        {tr && (
          <View style={s.tr}>
            {/* Wendbar in der Ecke und obenauf, Set links dahinter leicht überlappt (wie die Monogramme) */}
            <View style={s.trRow}>
              {tr.set && <View style={{ zIndex: 1 }}><Glass scale={K} label="Set"><TileIcon name="link" color={B.ink} scale={K} /></Glass></View>}
              {tr.reversible && (
                <View style={[tr.set && { marginLeft: -B.ownerOverlap * K }, { zIndex: 2 }]}>
                  {flip.can ? (
                    <Pressable onPress={flip.toggle} hitSlop={4} accessibilityRole="button" accessibilityLabel={flip.back ? 'Wenden, zeigt Seite B' : 'Wenden, zeigt Seite A'}>
                      <Glass scale={K}><Animated.View style={flip.iconStyle}><TileIcon name="reversible" color={B.ink} scale={K} /></Animated.View></Glass>
                    </Pressable>
                  ) : <Glass scale={K} label="Wendbar"><TileIcon name="reversible" color={B.ink} scale={K} /></Glass>}
                </View>
              )}
            </View>
            {tr.count && <Glass scale={K} shape={tr.count.shape} label={`${tr.count.n} Stück`}><Num num={tr.count.num} sym={tr.count.sym} scale={K} /></Glass>}
          </View>
        )}
        {todayP && (
          <View style={s.bl}><Glass scale={K} label={todayP.name ? `heute: ${todayP.name}` : 'heute getragen'}><TileIcon name="wornToday" color={todayP.stroke} scale={K} /></Glass></View>
        )}
        {owners.length > 0 && (
          <View style={s.br}>
            {owners.map((o, i) => (
              <View key={'more' in o ? '+' : o.person} style={[i > 0 && { marginLeft: -B.ownerOverlap * K }, { zIndex: i + 1 }]}>
                {'more' in o
                  ? <Glass scale={K} label={`${o.more} weitere`}><Num num={String(o.more)} sym="+" symFirst scale={K} /></Glass>
                  : <Glass scale={K} label={person(o.person)!.name}><Mono letter={person(o.person)!.letter} color={person(o.person)!.text} scale={K} /></Glass>}
              </View>
            ))}
          </View>
        )}
        <View pointerEvents="none" style={s.edge} />
      </View>
      {flip.can && (
        <View style={s.sides} accessibilityLabel={flip.back ? 'Seite B' : 'Seite A'}>
          {[false, true].map((b) => (
            <Pressable key={String(b)} accessibilityRole="button" accessibilityLabel={b ? 'Seite B' : 'Seite A'} onPress={() => flip.back !== b && flip.toggle()} style={s.dotHit}>
              <View style={[s.dot, { width: flip.back === b ? 18 : 7, backgroundColor: flip.back === b ? t.ink : t.hairline }]} />
            </Pressable>
          ))}
          <Text style={{ fontSize: 13, color: t.inkMuted, marginLeft: 4 }}>{flip.back ? 'Seite B' : 'Seite A'}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  tile: { borderRadius: I.radius, backgroundColor: '#fff', overflow: 'hidden' },
  hidden: { opacity: 0 },
  tl: { position: 'absolute', top: I.inset, left: I.inset },
  tr: { position: 'absolute', top: I.inset, right: I.inset, alignItems: 'flex-end', gap: B.stackGap * K },
  trRow: { flexDirection: 'row', alignItems: 'center' },
  bl: { position: 'absolute', bottom: I.inset, left: I.inset },
  br: { position: 'absolute', bottom: I.inset, right: I.inset, flexDirection: 'row' },
  edge: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: I.radius, boxShadow: 'inset 0 0 0 1px rgba(42,26,29,0.09)' },
  sides: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, marginTop: 10 },
  dotHit: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 7, borderRadius: 4 },
});

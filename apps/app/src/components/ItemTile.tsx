import { useRef, useState } from 'react';
import { isFlipped, setFlipped } from '@/lib/flipped';
import { Animated, Easing, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { layoutKind, glowFor, isAway, ownersFor, priceLabel, tileA11yLabel, topRightFor, wishTagLabel, wishWait, TILE_STATUS, type ItemStatus, type WishTag } from '@valet/core';
import { itemTile, tile } from '@valet/ui';
import { ItemPicture } from './ItemPicture';
import { Glass, Mono, Num, Price, WaitRing } from './tile/TileBadge';
import { TileIcon } from './tile/TileIcons';
import { Icons } from './Icon';

// Schrank-Kachel – verbindlich: docs/design/kachel/VALET_KACHEL_SPEC.md + valet-kachel-referenz.html.
// Kein Text auf der Kachel (außer Monogramm und Zahlen), weiß auch im dunklen Modus, alle Maße aus den Tokens.
//
//  ┌──────────────────────┐
//  │ [Status]     [Wend.] │  oben rechts: Wendbar, darunter Anzahl-Kapsel; ohne Wendbar Anzahl als Kreis
//  │              [ 2× ]  │
//  │        Foto          │
//  │ [Bügel]     [P][M]   │  unten rechts: eigenes Monogramm in der Ecke, obenauf
//  └──────────────────────┘
//
// Offen (Spec 10, mit Max klären – nicht selbst entscheiden):
//  - Sets: früher Bügel unten links. Der Bügel heißt jetzt „heute“. Eine Set-Plakette gibt es derzeit nicht;
//    mögliche Option für später (eigenes Zeichen, Platz noch offen).
//  - Eingelagert vs. aussortiert: beide Kiste (Status „out“).
//  - Farben für Person 3+: Personen ohne Farbe → Monogramm und Bügel in ink (schwarz).
//  - Highlight-Farbe: automatisch aus dem Foto oder manuell im Teil.

const T = itemTile;
const B = T.badge;
const web = Platform.OS === 'web';

/**
 * Seitenverhältnis (Höhe : Breite) im Mosaik je Form (layoutKind) – wie im alten Valet, dazu Kleid, Rock, Kopf.
 * Alle Oberteile (auch Pullover/Sweatshirts) gleich hoch, sonst wirkt der Oberteil-Filter unruhig (Max, 15.11.2026).
 */
export const RATIO: Record<string, number> = { mantel: 1.6, kleid: 1.55, hose: 1.45, jacke: 1.2, pullover: 1.1, oberteil: 1.1, sport: 1.1, rock: 1.05, shorts: 0.95, tasche: 0.95, schuhe: 0.72, kopf: 0.72, accessoire: 0.72 };
/** Kachelhöhe; nimmt die Form (kind) oder notfalls die Kategorie */
export const tileHeight = (kindOrCategory: string, width: number) =>
  Math.round(width * (RATIO[kindOrCategory] ?? RATIO[layoutKind(kindOrCategory)] ?? 0.9));


/** Darstellung einer Person auf der Kachel */
export type PersonLook = {
  name: string;
  /** Monogramm-Buchstabe */
  letter: string;
  /** Strichfarbe des Bügels (Personenfarbe) */
  stroke: string;
  /** Farbe des Monogramm-Buchstabens (dunklere Textvariante) */
  text: string;
};

export type TileItem = {
  /** Teil-ID – damit bleibt eine umgedrehte Kachel beim Seitenwechsel umgedreht */
  id?: string;
  name: string;
  category: string;
  /** Grobe Form (layoutKind) für Höhe und Platzhalter */
  kind?: string;
  /** Hauptfarbe (Farbanalyse) */
  hex: string | null;
  /** zweite, auffällige Farbe am Teil */
  highlight: string | null;
  status: ItemStatus | null;
  reversible: boolean;
  qty: number;
  thumb: string | null;
  /** Wendeteile: Vorschaubild der anderen Seite – Tippen auf „Wendbar“ dreht die Kachel um */
  thumbBack?: string | null;
  /** Besitzer (Personen-IDs) */
  owners: string[];
  isWish: boolean;
  /** Wunschliste: Preis (Kaufpreis bzw. Listenpreis) */
  price?: number | null;
  /** Wunschliste: Tag, an dem das Teil auf die Liste kam (Start der Bedenkzeit) */
  createdAt?: string | null;
  /** Wunschliste: Kategorie (Grail, Watchlist, Next Cop, Someday, Gift) – Plakette oben links */
  wishTag?: WishTag | null;
};

type Props = {
  item: TileItem;
  width: number;
  /** ohne Angabe: Höhe aus der Kategorie (Mosaik) */
  height?: number;
  /** angemeldete Person – ihr Monogramm sitzt rechts in der Ecke und liegt obenauf */
  me: string | null;
  person: (id: string) => PersonLook | undefined;
  /** Teil wird heute getragen bzw. ist für heute reserviert – von dieser Person (null = Person unbekannt → Bügel in ink) */
  today?: { person: string | null } | null;
  /**
   * Outfit-Baukasten: Teil ausgewählt.
   * TODO offen (mit Max klären): Wie die Auswahl auf der neuen Kachel aussieht. Bis dahin unverändert wie bisher
   * (Häkchen oben links statt Status, Rahmen) – das ist NICHT Teil der Kachel-Spec.
   */
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Nur Prüfseite: Fotos mit weißem Hintergrund wie in der Referenz-HTML einblenden. In der App nicht nötig (freigestellt). */
  photoBlend?: 'multiply';
};

export function ItemTile({ item, width, height, me, person, today, selected, onPress, onLongPress, photoBlend }: Props) {
  const h = height ?? tileHeight(item.kind ?? item.category, width);
  const glow = glowFor(item.hex, item.highlight);
  const away = isAway(item.status);
  const tr = topRightFor(item.reversible, item.qty);
  // Wunschliste: Preis unten links, Bedenkzeit oben rechts (vorerst aus, WISH_WAIT; nach Ablauf verschwindet sie)
  const price = item.isWish ? priceLabel(item.price) : null;
  const wait = item.isWish ? wishWait(item.createdAt) : null;
  const owners = ownersFor(item.owners.filter((id) => person(id)), me);
  const todayP = today ? (today.person ? person(today.person) : undefined) ?? { name: '', stroke: B.ink } : undefined;
  const flip = useFlip(tr?.reversible && item.thumbBack ? item.thumbBack : null, item.id);
  const label = tileA11yLabel({
    name: item.name,
    status: item.status,
    reversible: item.reversible,
    qty: item.qty,
    today: todayP,
    owners: owners.map((o) => ('more' in o ? o : { name: person(o.person)!.name })),
  });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected != null ? { selected } : undefined}
      style={({ pressed }) => [
        s.tile,
        { width, height: h, boxShadow: `inset 0 0 ${T.glow.blur}px ${T.glow.spread}px ${glow.css}`, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, away && s.away, away && awayWeb, photoBlend && web ? ({ mixBlendMode: photoBlend } as ViewStyle) : null, flip.style]}>
        <View style={[StyleSheet.absoluteFill, flip.back && s.hidden]}>
          <ItemPicture uri={item.thumb} category={item.kind ?? item.category} color={item.hex ?? T.glow.fallback} inset={T.photoInset} />
        </View>
        {/* Rückseite erst nach dem ersten Tippen laden, dann beide behalten (kein Aufblitzen beim Zurückdrehen) */}
        {flip.loaded && (
          <View style={[StyleSheet.absoluteFill, !flip.back && s.hidden]}>
            <ItemPicture uri={flip.loaded} category={item.kind ?? item.category} color={item.hex ?? T.glow.fallback} inset={T.photoInset} />
          </View>
        )}
      </Animated.View>

      {/* oben links: Status bzw. bei Wunschteilen die Kategorie (bzw. vorläufig Auswahl im Baukasten) */}
      {selected ? (
        <View style={s.tl}><Glass style={s.sel}><Icons.check color={tile.select.on} size={B.icon.size} /></Glass></View>
      ) : item.isWish && item.wishTag ? (
        <View style={s.tl}><Glass label={wishTagLabel(item.wishTag) ?? undefined}><TileIcon name={item.wishTag} color={B.ink} /></Glass></View>
      ) : item.status ? (
        <View style={s.tl}><Glass label={TILE_STATUS[item.status].label}><TileIcon name={item.status} color={B.ink} /></Glass></View>
      ) : null}

      {/* oben rechts: Wunschliste → Bedenkzeit; sonst Wendbar, Anzahl */}
      {wait ? (
        <View style={s.tr}><Glass label={`Bedenkzeit: noch ${wait.left} ${wait.left === 1 ? 'Tag' : 'Tage'}`}><WaitRing {...wait} /></Glass></View>
      ) : tr && (
        <View style={s.tr}>
          {tr.reversible && (flip.can ? (
            <Pressable onPress={flip.toggle} hitSlop={B.inset} accessibilityRole="button"
              accessibilityLabel={flip.back ? 'Wendbar – Vorderseite zeigen' : 'Wendbar – andere Seite zeigen'}>
              <Glass><Animated.View style={flip.iconStyle}><TileIcon name="reversible" color={B.ink} /></Animated.View></Glass>
            </Pressable>
          ) : <Glass label="Wendbar"><TileIcon name="reversible" color={B.ink} /></Glass>)}
          {tr.count && (
            <Glass shape={tr.count.shape} label={`${tr.count.n} Stück`}>
              <Num num={tr.count.num} sym={tr.count.sym} />
            </Glass>
          )}
        </View>
      )}

      {/* unten links: Wunschliste → Preis; sonst Bügel = heute getragen oder für heute reserviert */}
      {price ? (
        <View style={s.bl}><Glass shape="pill" label={`${price} Euro`}><Price label={price} /></Glass></View>
      ) : todayP && (
        <View style={s.bl}><Glass label={todayP.name ? `heute: ${todayP.name}` : 'heute getragen'}><TileIcon name="hanger" color={todayP.stroke} /></Glass></View>
      )}

      {/* unten rechts: Besitzer, links → rechts, rechts liegt obenauf */}
      {owners.length > 0 && (
        <View style={s.br}>
          {owners.map((o, i) => (
            <View key={'more' in o ? '+' : o.person} style={[s.owner, i > 0 && s.overlap, { zIndex: i + 1 }]}>
              {'more' in o ? (
                <Glass label={`${o.more} weitere`}><Num num={String(o.more)} sym="+" symFirst /></Glass>
              ) : (
                <Glass label={person(o.person)!.name}><Mono letter={person(o.person)!.letter} color={person(o.person)!.text} /></Glass>
              )}
            </View>
          ))}
        </View>
      )}

      {/* feine Kante innen, über allem */}
      <View pointerEvents="none" style={s.edge} />
      {selected && <View pointerEvents="none" style={s.selRing} />}
    </Pressable>
  );
}

/**
 * Wendeteil umdrehen: Foto dreht sich um die senkrechte Achse bis zur Kante (90°), dann wird das Bild getauscht
 * und es dreht von der anderen Seite zurück. Das Wendbar-Zeichen dreht sich dabei einmal mit.
 */
export function useFlip(backUri: string | null, id: string | undefined) {
  // Zustand bis zum Neuladen der App gemerkt (lib/flipped.ts) – Seiten werden beim Wechsel abgebaut
  const [back, setBack] = useState(() => isFlipped(id));
  const [loaded, setLoaded] = useState<string | null>(() => (isFlipped(id) ? backUri : null));
  const v = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(isFlipped(id) ? 1 : 0)).current;
  const busy = useRef(false);
  const native = !web;
  const toggle = () => {
    if (!backUri || busy.current) return;
    busy.current = true;
    setLoaded(backUri);
    const to = back ? 0 : 1;
    if (id) setFlipped(id, !back);
    Animated.timing(spin, { toValue: to, duration: 2 * FLIP_HALF, easing: Easing.inOut(Easing.cubic), useNativeDriver: native }).start();
    Animated.timing(v, { toValue: 1, duration: FLIP_HALF, easing: Easing.in(Easing.cubic), useNativeDriver: native }).start(() => {
      setBack((b) => !b);
      v.setValue(-1);
      Animated.timing(v, { toValue: 0, duration: FLIP_HALF, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start(() => { busy.current = false; });
    });
  };
  const style = {
    transform: [
      { perspective: 700 },
      { rotateY: v.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-90deg', '0deg', '90deg'] }) },
    ],
  };
  const iconStyle = { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] };
  return { can: !!backUri, back: back && !!backUri, loaded: backUri ? loaded : null, toggle, style, iconStyle };
}
const FLIP_HALF = 170;

const awayWeb = web ? ({ filter: `grayscale(${T.away.grayscale})` } as object) : null;
// TODO iOS: grayscale-Filter gibt es nativ nicht → dort nur Abblenden über opacity (oder Bild vorab entsättigen).

const s = StyleSheet.create({
  tile: { backgroundColor: T.bg, borderRadius: T.radius, overflow: 'hidden' },
  away: { opacity: T.away.opacity },
  hidden: { opacity: 0 },
  edge: { ...StyleSheet.absoluteFill, borderRadius: T.radius, boxShadow: `inset 0 0 0 ${T.edgeWidth}px ${T.edge}` },
  tl: { position: 'absolute', top: B.inset, left: B.inset },
  tr: { position: 'absolute', top: B.inset, right: B.inset, flexDirection: 'column', alignItems: 'center', gap: B.stackGap },
  bl: { position: 'absolute', bottom: B.inset, left: B.inset },
  br: { position: 'absolute', bottom: B.inset, right: B.inset, flexDirection: 'row', alignItems: 'center' },
  owner: { position: 'relative', flexDirection: 'row' },
  overlap: { marginLeft: -B.ownerOverlap },
  // vorläufig (Baukasten-Auswahl, wie bisher): Oxblood
  sel: { backgroundColor: tile.select.color },
  selRing: { ...StyleSheet.absoluteFill, borderRadius: T.radius, borderWidth: tile.select.ring, borderColor: tile.select.color },
});

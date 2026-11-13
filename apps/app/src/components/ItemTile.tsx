import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { glowFor, isAway, ownersFor, tileA11yLabel, topRightFor, TILE_STATUS, type ItemStatus } from '@valet/core';
import { itemTile, tile } from '@valet/ui';
import { ItemPicture } from './ItemPicture';
import { Glass, Mono, Num } from './tile/TileBadge';
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

/** Seitenverhältnis (Höhe : Breite) im Mosaik je Kategorie – wie im alten Valet. */
export const RATIO: Record<string, number> = { mantel: 1.6, hose: 1.45, jacke: 1.2, pullover: 1.15, oberteil: 1.1, sport: 1.1, shorts: 0.95, tasche: 0.95, schuhe: 0.72, accessoire: 0.72 };
export const tileHeight = (category: string, width: number) => Math.round(width * (RATIO[category] ?? 0.9));

/** Standard-Bedenkzeit der Wunschliste in Tagen */
export const WAIT = 14;

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
  name: string;
  category: string;
  /** Hauptfarbe (Farbanalyse) */
  hex: string | null;
  /** zweite, auffällige Farbe am Teil */
  highlight: string | null;
  status: ItemStatus | null;
  reversible: boolean;
  qty: number;
  thumb: string | null;
  /** Besitzer (Personen-IDs) */
  owners: string[];
  isWish: boolean;
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
  const h = height ?? tileHeight(item.category, width);
  const glow = glowFor(item.hex, item.highlight);
  const away = isAway(item.status);
  const tr = topRightFor(item.reversible, item.qty);
  const owners = ownersFor(item.owners.filter((id) => person(id)), me);
  const todayP = today ? (today.person ? person(today.person) : undefined) ?? { name: '', stroke: B.ink } : undefined;
  const label = tileA11yLabel({
    name: item.name,
    status: item.status,
    reversible: item.reversible,
    qty: item.qty,
    today: todayP,
    owners: owners.map((o) => ('more' in o ? o : { name: person(o.person)!.name })),
  });

  // TODO Wunschliste (mit Max klären): Inhalt der Wunsch-Plaketten nachtragen, z. B. Preis-Plakette und
  // Bedenkzeit-Plakette (früher Preis-Pille unten links, Bedenkzeit-Ring oben rechts). Aufbau, Schein und
  // Plaketten sind bereits die der neuen Kachel; die Wunsch-Inhalte bleiben bis dahin leer.

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
      <View style={[StyleSheet.absoluteFill, away && s.away, away && awayWeb, photoBlend && web ? ({ mixBlendMode: photoBlend } as ViewStyle) : null]}>
        <ItemPicture uri={item.thumb} category={item.category} color={item.hex ?? T.glow.fallback} inset={T.photoInset} />
      </View>

      {/* oben links: Status (bzw. vorläufig Auswahl im Baukasten) */}
      {selected ? (
        <View style={s.tl}><Glass style={s.sel}><Icons.check color={tile.select.on} size={B.icon.size} /></Glass></View>
      ) : item.status ? (
        <View style={s.tl}><Glass label={TILE_STATUS[item.status].label}><TileIcon name={item.status} color={B.ink} /></Glass></View>
      ) : null}

      {/* oben rechts: Wendbar, Anzahl */}
      {tr && (
        <View style={s.tr}>
          {tr.reversible && <Glass label="Wendbar"><TileIcon name="reversible" color={B.ink} /></Glass>}
          {tr.count && (
            <Glass shape={tr.count.shape} label={`${tr.count.n} Stück`}>
              <Num num={tr.count.num} sym={tr.count.sym} />
            </Glass>
          )}
        </View>
      )}

      {/* unten links: Bügel = heute getragen oder für heute reserviert */}
      {todayP && (
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

const awayWeb = web ? ({ filter: `grayscale(${T.away.grayscale})` } as object) : null;
// TODO iOS: grayscale-Filter gibt es nativ nicht → dort nur Abblenden über opacity (oder Bild vorab entsättigen).

const s = StyleSheet.create({
  tile: { backgroundColor: T.bg, borderRadius: T.radius, overflow: 'hidden' },
  away: { opacity: T.away.opacity },
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

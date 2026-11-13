import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { itemTile, person as personColors, type as typo, colors, fonts } from '@valet/ui';
import { ItemTile, type PersonLook, type TileItem } from '@/components/ItemTile';
import { personLook } from '@/lib/wardrobe';
import { DISPLAY } from '@/lib/theme';

// Prüfseite für die Schrank-Kachel: dieselben Fälle und Daten wie docs/design/kachel/valet-kachel-referenz.html,
// gleiche Kachelbreite (114 px). Ohne Anmeldung erreichbar (/valet/kachel-test), nur zum Vergleichen.
// Die Fotos der Referenz haben weißen Hintergrund → hier wie in der Referenz mit „multiply“ eingeblendet.

const W = 114;
const L = colors.light;

const base = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.pathname.replace(/\/kachel-test\/?$/, '') : '';
const img = (k: string) => `${base}/kachel-test/${k}.jpg`;

// Personen wie in der Referenz; Person 3 und 4 ohne Farbe → Monogramm/Bügel in ink (Entscheidung Max)
const PEOPLE: Record<string, PersonLook> = Object.fromEntries(
  [
    { id: 'M', name: 'Max', color: 'Rosa' },
    { id: 'P', name: 'Paul', color: 'Rot' },
    { id: 'L', name: 'Lea', color: null },
    { id: 'J', name: 'Jo', color: null },
  ].map((p) => [p.id, personLook({ ...p, user_id: null, item_order: null }, itemTile.badge.ink, personColors.light)]),
);
const person = (id: string) => PEOPLE[id] ?? (/^X\d+$/.test(id) ? { name: id, letter: 'X', stroke: itemTile.badge.ink, text: itemTile.badge.ink } : undefined);

// Farben aus der Referenz (Hauptfarbe, Highlight)
const C: Record<string, [string, string | null]> = {
  sneaker: ['#b8a269', null], tank: ['#2a5bb2', null], pants: ['#1a191e', null], bag: ['#a2a2a2', null], cap: ['#bbb4ab', '#3e3c53'],
  tee: ['#e0e2e4', null], silver: ['#61605b', null], jacket: ['#b6ab9c', null], loafer: ['#462b1f', null], penny: ['#3f3b3c', null],
};

type Demo = { img: string; h: number; item: TileItem; today: string | null };
const item = (k: string, h: number, x: Partial<TileItem> & { today?: string } = {}): Demo => {
  const { today, ...rest } = x;
  return {
    img: k, h, today: today ?? null,
    item: { name: k, category: 'oberteil', hex: C[k]![0], highlight: C[k]![1], status: null, reversible: false, qty: 1, thumb: img(k), owners: ['M'], isWish: false, ...rest },
  };
};

function Tile({ d }: { d: Demo }) {
  return <ItemTile item={d.item} width={W} height={d.h} me="M" person={person} today={d.today ? { person: d.today } : null} photoBlend="multiply" />;
}

function Grid({ list }: { list: [Demo, string][] }) {
  return (
    <View style={s.grid}>
      {list.map(([d, cap], i) => (
        <View key={i} style={s.cell} testID={`cell-${cap}`}>
          <Tile d={d} />
          <Text style={s.cap}>{cap}</Text>
        </View>
      ))}
    </View>
  );
}

const mosaic: Demo[][] = [
  [item('sneaker', 114, { today: 'M' }), item('bag', 114, { qty: 2 }), item('tee', 150, { status: 'lent' }), item('loafer', 114, { status: 'out' })],
  [item('tank', 150, { owners: ['M', 'P'] }), item('cap', 114, { owners: ['P'], status: 'wash' }), item('silver', 114, { today: 'P' })],
  [item('pants', 190), item('jacket', 160, { reversible: true, qty: 2 }), item('penny', 114, { status: 'repair' })],
];
const twelve = Array.from({ length: 12 }, (_, i) => `X${i}`);

export default function KachelTest() {
  return (
    <ScrollView style={{ backgroundColor: L.bg }} contentContainerStyle={s.page}>
      <Text style={s.h1}>valet</Text>
      <Text style={s.note}>Prüfseite Schrank-Kachel – gleiche Fälle wie valet-kachel-referenz.html (Kachelbreite 114 px).</Text>

      <Text style={s.h2}>Schrank-Mosaik</Text>
      <View style={s.mosaic} testID="mosaic">
        {mosaic.map((col, i) => <View key={i} style={s.col}>{col.map((d, j) => <Tile key={j} d={d} />)}</View>)}
      </View>

      <Text style={s.h2}>Besitzer-Regeln (angemeldet: Max)</Text>
      <Grid list={[
        [item('cap', 114, { owners: ['M'] }), 'nur ich'],
        [item('tank', 114, { owners: ['M', 'P'] }), 'ich + Paul'],
        [item('bag', 114, { owners: ['M', 'P', 'L'] }), 'ich + 2 → +2'],
        [item('sneaker', 114, { owners: ['M', 'P', 'L', 'J'] }), 'ich + 3 → +3'],
        [item('tee', 114, { owners: ['M', ...twelve] }), 'ich + 12 → +12'],
        [item('jacket', 114, { owners: ['P'] }), 'nur Paul'],
        [item('silver', 114, { owners: ['P', 'L'] }), 'ohne mich, 2 Personen'],
        [item('penny', 114, { owners: ['P', 'L', 'J'] }), 'ohne mich, 3 → +2'],
        [item('pants', 114, { owners: [] }), 'ohne Besitzer'],
      ]} />

      <Text style={s.h2}>Oben rechts: Wendbar und Anzahl</Text>
      <Grid list={[
        [item('jacket', 114, { reversible: true }), 'nur Wendbar'],
        [item('bag', 114, { qty: 2 }), 'nur Anzahl: Kreis'],
        [item('cap', 114, { qty: 12 }), 'nur Anzahl, zweistellig: Kreis'],
        [item('jacket', 114, { reversible: true, qty: 2 }), 'mit Wendbar: Kapsel'],
        [item('bag', 114, { reversible: true, qty: 12 }), 'mit Wendbar, zweistellig'],
        [item('tee', 114, { qty: 120 }), 'ab 100: 99+'],
      ]} />

      <Text style={s.h2}>Status (oben links) und Bügel (unten links)</Text>
      <Grid list={[
        [item('cap', 114, { status: 'wash' }), 'Wäsche (nicht abgeblendet)'],
        [item('penny', 114, { status: 'repair' }), 'Reparatur'],
        [item('tee', 114, { status: 'lent' }), 'verliehen'],
        [item('loafer', 114, { status: 'out' }), 'eingelagert / aussortiert'],
        [item('silver', 114, { status: 'sold' }), 'verkauft'],
        [item('sneaker', 114, { today: 'M' }), 'heute: Max'],
        [item('silver', 114, { today: 'P' }), 'heute: Paul'],
      ]} />

      <Text style={s.h2}>Innenschein-Regel</Text>
      <Grid list={[
        [item('tank', 114), 'farbig → Hauptfarbe 52 %'],
        [item('sneaker', 114), 'farbig → Hauptfarbe 52 %'],
        [item('loafer', 114), 'farbig (braun) → 52 %'],
        [item('cap', 114), 'neutral + Highlight Navy → 52 %'],
        [item('pants', 114), 'neutral schwarz → 28 %'],
        [item('bag', 114), 'neutral silber → 28 %'],
        [item('tee', 114), 'neutral sehr hell → #d8d2c8 28 %'],
        [item('jacket', 114), 'neutral beige → 28 %'],
      ]} />

      <Text style={s.h2}>Extremfälle</Text>
      <Grid list={[
        [item('cap', 114, { owners: ['M', 'P', 'L'], status: 'wash', reversible: true, qty: 3, today: 'P' }), 'alle fünf Plätze'],
        [item('pants', 114, { owners: ['M', 'P'], status: 'sold', reversible: true, qty: 12, today: 'M' }), 'alle fünf, zweistellig'],
        [item('silver', 114, { owners: ['P', 'L', 'J'], status: 'repair', reversible: true, qty: 2, today: 'M' }), 'ohne mich + alle'],
      ]} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { maxWidth: 1100, width: '100%', alignSelf: 'center', paddingTop: 24, paddingHorizontal: 16, paddingBottom: 64 },
  h1: { fontFamily: DISPLAY, fontSize: typo.wordmark.size, lineHeight: 34, color: '#722638', marginBottom: 4 },
  h2: { fontFamily: Platform.OS === 'web' ? fonts.text : undefined, fontSize: typo.headline.size, lineHeight: typo.headline.line, fontWeight: '600', color: L.ink, marginTop: 32, marginBottom: 8 },
  note: { fontSize: 13, lineHeight: 18, color: L.inkMuted },
  mosaic: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', width: 358 },
  col: { flex: 1, minWidth: 0, gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 16 },
  cell: { width: W, gap: 6 },
  cap: { fontSize: 11, lineHeight: 14, color: L.inkMuted },
});

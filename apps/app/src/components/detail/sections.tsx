// Inhalte der Detailseite (Spec 3–5): Tragen-Kacheln, Steckbrief, Kauf, Set, Outfits, Notizen
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  CARE, LAYERS, RAIN, SEASONS, WARMTH, careList, categoryLast, discountPct, fitScalesOf, formatPrice, hasCollarSize, setOrder, shareRows, shopView,
  shortDate, shortUrl, splitLabel, statFontSize, fieldsFor, type CareGroup, type EditForm, type StatTile,
} from '@valet/core';
import { detail } from '@valet/ui';
import { useTheme, DISPLAY } from '@/lib/theme';
import { personKey, type Person, type Tile } from '@/lib/wardrobe';
import type { Outfit } from '@/lib/outfits';
import { OutfitCard } from '@/components/OutfitCard';
import { ItemPicture } from '@/components/ItemPicture';
import { ColorDot, EditCard, ValueCapsule, ValueCircle, ValueScale } from '@/components/edit/fields';
import { SEASON_ICON } from '@valet/ui';
import { Capsule, Hint, Monogram, Wrap } from './parts';
import { Icon } from '@/components/Icon';
import type { SymbolName } from '@valet/ui';

const S = detail.stat;

// ---------- Drei Kacheln (Spec 3.2) ----------

/** Getragen · Pro Tragen · Zuletzt: Werte gleich groß (22), passt einer nicht, alle gemeinsam kleiner bis 20 */
export function StatTiles({ tiles, onEditPrice }: { tiles: StatTile[]; onEditPrice: () => void }) {
  const t = useTheme();
  const [widths, setWidths] = useState<Record<number, number>>({});
  const [inner, setInner] = useState(0);
  const size = inner ? statFontSize(tiles.map((_, i) => widths[i] ?? 0), inner) : S.value;
  return (
    <View style={s.tiles}>
      {tiles.map((x, i) => {
        const body = (
          <View style={[s.tile, { backgroundColor: t.surface, borderColor: t.hairline }]} onLayout={i === 0 ? (e) => setInner(e.nativeEvent.layout.width - 28) : undefined}>
            <Text style={{ fontSize: S.label, lineHeight: 18, color: t.inkMuted }}>{x.label}</Text>
            <Text numberOfLines={1} style={[s.value, { color: t.ink, fontSize: size, lineHeight: size + 4 }]}>{x.value}</Text>
            <Text numberOfLines={1} style={{ fontSize: S.hint, lineHeight: 16, marginTop: 2, color: x.editPrice ? t.accent : t.inkMuted }}>{x.hint}</Text>
            {/* Messung bei 22 px (unsichtbar) */}
            <Text style={[s.value, s.measure, { fontSize: S.value }]} onLayout={(e) => { const w = Math.ceil(e.nativeEvent.layout.width); setWidths((m) => (m[i] === w ? m : { ...m, [i]: w })); }}>{x.value}</Text>
          </View>
        );
        return x.editPrice
          ? <Pressable key={x.label} style={{ flex: 1, minWidth: 0 }} accessibilityRole="button" accessibilityLabel={`${x.label}: ${x.hint}, Preis eintragen`} onPress={onEditPrice}>{body}</Pressable>
          : <View key={x.label} style={{ flex: 1, minWidth: 0 }} accessibilityLabel={`${x.label}: ${x.value}, ${x.hint}`}>{body}</View>;
      })}
    </View>
  );
}

// ---------- Karte mit Zeilen (Steckbrief) ----------

/** Zeile der Ansicht: Bezeichnung links (15, muted), Werte rechts gleichmäßig umbrochen */
export function ReadRow({ label, values, last }: { label: string; values: React.ReactNode[]; last?: boolean }) {
  const t = useTheme();
  return (
    <View style={[s.row, !last && { borderBottomWidth: 1, borderBottomColor: t.hairline }]}>
      <Text style={{ fontSize: detail.font.rowLabel, color: t.inkMuted, flexShrink: 0 }}>{label}</Text>
      <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}><Wrap gap={6} align="end">{values}</Wrap></View>
    </View>
  );
}

function Rows({ rows }: { rows: [string, React.ReactNode[]][] }) {
  const shown = rows.filter(([, v]) => v.length > 0);
  return <>{shown.map(([l, v], i) => <ReadRow key={l} label={l} values={v} last={i === shown.length - 1} />)}</>;
}

/**
 * Steckbrief (Spec 4): Aussehen, Tragen, Details, Pflege. Kategorie nur die letzte Stufe; Skalen statt Kapseln;
 * Pflege als Symbol-Kreise, geschätzte grau mit Stern; Wendbar: Farben je Seite.
 */
export function SteckbriefView({ f, onCare, onEdit }: { f: EditForm; onCare: (g: CareGroup) => void; onEdit: () => void }) {
  const t = useTheme();
  const caps = (list: (string | null | undefined)[]) => list.filter((x): x is string => !!x).map((x) => <ValueCapsule key={x} label={x} />);
  const colors = (list: string[]) => list.map((c) => <ValueCircle key={c} a11y={c}><ColorDot name={c} onFill /></ValueCircle>);
  const fx = fieldsFor(f.category, f.subcategory);
  const rev = fx.reversible && f.reversible;
  const scales = fitScalesOf(f.category);
  const fit = scales.filter((sc) => f.fit[sc.key] != null).map((sc) => (
    <ValueScale key={sc.key} caption={sc.label} steps={sc.steps.length} on={(i) => i === f.fit[sc.key]} a11y={`${sc.label} ${sc.steps[f.fit[sc.key]!]}`} />
  ));
  const fitWord = scales.filter((sc) => f.fit[sc.key] != null).map((sc) => sc.steps[f.fit[sc.key]!]).join(', ');
  const care = careList(f.care);
  const estimated = care.some((c) => c.src === 'geschaetzt');
  const aussehen: [string, React.ReactNode[]][] = [
    ['Kategorie', caps([categoryLast({ category: f.category, subcategory: f.subcategory, type: f.type })])],
    ['Saison', SEASONS.filter((x) => f.seasons.includes(x)).map((x) => <ValueCircle key={x} a11y={x}><Icon name={SEASON_ICON[x]!} size="row" color={t.onFill} /></ValueCircle>)],
    [rev ? 'Farben Seite A' : 'Farben', colors(f.colors)],
    ...(rev ? [['Farben Seite B', colors(f.colorsB)] as [string, React.ReactNode[]]] : []),
    [rev ? 'Muster Seite A' : 'Muster', fx.pattern ? caps([f.pattern]) : []],
    ...(rev && fx.pattern ? [['Muster Seite B', caps([f.patternB])] as [string, React.ReactNode[]]] : []),
    ['Material', caps(f.materials.map((m) => m.name))],
    ['Größe', fx.size ? caps([f.size, fx.size === 'clothing' && hasCollarSize(f.subcategory) && f.collarSize ? `Kragen ${f.collarSize}` : null]) : []],
  ];
  const tragen: [string, React.ReactNode[]][] = [
    ['Passform', fit.length ? [...fit, <Text key="w" style={{ fontSize: 13, color: t.inkMuted }}>{fitWord}</Text>] : []],
    ['Lagen', !fx.layers ? [] : [
      ...(f.layers.length ? [<ValueScale key="l" steps={LAYERS.length} on={(i) => f.layers.includes(i)} a11y={`Lagen: ${f.layers.map((i) => LAYERS[i]).join(', ')}`} />] : []),
      ...(f.standalone ? [<Text key="a" style={{ fontSize: 13, color: t.inkMuted }}>auch allein tragbar</Text>] : []),
    ]],
    ['Wetter', !fx.weather ? [] : [
      ...(f.warmth != null ? [<ValueScale key="w" steps={3} on={(i) => i < f.warmth!} a11y={`Wärme ${WARMTH[f.warmth]}`} icon={(c) => <Icon name="thermo" size="inline" color={c} />} />] : []),
      ...(f.rain != null ? [<ValueScale key="r" steps={3} on={(i) => i <= f.rain!} a11y={`Regen ${RAIN[f.rain]}`} icon={(c) => <Icon name="drop" size="inline" color={c} />} />] : []),
    ]],
  ];
  const details: [string, React.ReactNode[]][] = [
    ['Stil', caps(f.styles)],
    [fx.neckline?.label ?? 'Kragen', fx.neckline ? caps([f.collar]) : []],
    ['Verschluss', fx.closure ? caps([f.closure]) : []],
    ['Trägerart', fx.strap ? caps([f.strap]) : []],
  ];
  const has = (rows: [string, React.ReactNode[]][]) => rows.some(([, v]) => v.length > 0);
  return (
    <>
      {has(aussehen) && <EditCard title="Aussehen" rows><Rows rows={aussehen} /></EditCard>}
      {has(tragen) && <EditCard title="Tragen" rows><Rows rows={tragen} /></EditCard>}
      {has(details) && <EditCard title="Details" rows><Rows rows={details} /></EditCard>}
      {fx.care && <EditCard title="Pflege" rows={care.length > 0}>
        {care.length ? (
          <View style={{ paddingBottom: 12 }}>
            <View style={[s.row, { justifyContent: 'flex-start' }]}>
              <Wrap gap={6}>
                {care.map((c) => {
                  const g = CARE.find((x) => x.key === c.group)!;
                  const o = g.options.find((x) => x.id === c.v);
                  const est = c.src === 'geschaetzt';
                  const circle = (
                    <ValueCircle a11y={`${g.label}: ${o?.short ?? c.v}`} estimated={est}>
                      <Icon name={c.v as SymbolName} size="button" color={est ? t.inkMuted : t.onFill} />
                    </ValueCircle>
                  );
                  return est
                    ? <Pressable key={c.group} accessibilityRole="button" accessibilityHint="Schätzung prüfen" onPress={() => onCare(c.group)}>{circle}</Pressable>
                    : <View key={c.group}>{circle}</View>;
                })}
              </Wrap>
            </View>
            {estimated && <Hint>geschätzt aus Material</Hint>}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 15, color: t.inkMuted }}>noch leer</Text>
            <Wrap>
              <Capsule label="Etikett" icon={(c) => <Icon name="label" size="chip" color={c} />} onPress={onEdit} />
              <Capsule label="Selbst wählen" onPress={onEdit} />
            </Wrap>
          </View>
        )}
      </EditCard>}
    </>
  );
}

// ---------- Kauf (Spec 5) ----------

/** Shop als Domain („zalando.de“), antippen öffnet den Shop (17.11.2026, Max) */
export function ShopValue({ shop, link }: { shop: string; link: string | null | undefined }) {
  const t = useTheme();
  const v = shopView(shop, link);
  if (!v) return null;
  if (!v.url) return <Text style={{ fontSize: 15, lineHeight: 20, color: t.ink }}>{v.label}</Text>;
  const url = v.url;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${v.label} öffnen`} onPress={() => Linking.openURL(url)} hitSlop={6}
      style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ fontSize: 15, lineHeight: 20, color: t.accent }}>{v.label}</Text>
    </Pressable>
  );
}

export function KaufView({ f, row, persons, meId, onEdit }: {
  f: EditForm; row: { price_paid: number | null; list_price: number | null; gift_value: number | null; payers: { person_id?: string | null; amount?: number | null }[] | null };
  persons: Person[]; meId: string | null; onEdit: () => void;
}) {
  const t = useTheme();
  const price = row.price_paid;
  const disc = discountPct(price, row.list_price);
  const shares = shareRows(price, f.qty, (row.payers ?? []).map((p) => ({ personId: p.person_id ?? null, amount: p.amount ?? null })));
  const person = (id: string) => persons.find((p) => p.id === id);
  // Eine Person hat allein bezahlt (ohne Zahler: der einzige Besitzer) → klein unter dem Preis statt eigener Aufteilung
  const solo = !f.gift && price != null && shares.length === 0 && f.payers.length === 1 ? person(f.payers[0]) : undefined;
  const facts: [string, string][] = [
    [f.gift ? 'Bekommen am' : 'Gekauft', f.purchaseDate ? shortDate(f.purchaseDate, '0000') : ''],
    ['Shop', f.shop], ['Artikelnummer', f.articleNo],
  ].filter(([, v]) => !!v) as [string, string][];
  return (
    <EditCard title="Kauf">
      {f.gift ? (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="gift" size="large" color={t.ink} />
            <Text style={{ fontFamily: DISPLAY, fontSize: detail.font.price, lineHeight: 36, color: t.ink }}>Geschenk</Text>
          </View>
          {!!f.giftFrom && <Text style={{ fontSize: 15, color: t.ink }}>von {f.giftFrom}</Text>}
          {row.gift_value != null && <Text style={{ fontSize: 13, color: t.inkMuted }}>Wert {formatPrice(row.gift_value)} (nur Info)</Text>}
        </View>
      ) : price != null ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: DISPLAY, fontSize: detail.font.price, lineHeight: 36, color: t.ink }}>{formatPrice(price)}</Text>
            {row.list_price != null && row.list_price > price && <Text style={{ fontSize: 15, color: t.inkMuted, textDecorationLine: 'line-through' }}>{formatPrice(row.list_price)}</Text>}
            {disc != null && <Text style={{ fontSize: 13, fontWeight: '600', color: t.actionText }}>−{disc} %</Text>}
          </View>
          {f.qty > 1 && <Text style={{ fontSize: 13, color: t.inkMuted }}>je Stück · {f.qty} Stück zusammen {formatPrice(price * f.qty)}</Text>}
        </View>
      ) : (
        <Pressable onPress={onEdit} accessibilityRole="button"><Text style={{ fontSize: 15, color: t.accent }}>Preis fehlt – eintragen</Text></Pressable>
      )}

      {shares.length > 0 && (
        <View style={{ gap: 10 }}>
          <View style={s.between}>
            <Text style={{ fontSize: 13, color: t.inkMuted }}>Bezahlt von</Text>
            <Text style={{ fontSize: 13, color: t.inkMuted }}>{splitLabel(shares)}</Text>
          </View>
          <View accessibilityRole="image" accessibilityLabel="Aufteilung" style={s.bar}>
            {shares.map((r) => <View key={r.personId} style={{ flex: Math.max(r.amount, 0.0001), backgroundColor: t.person[personKey(person(r.personId)?.color ?? null)] }} />)}
          </View>
          <View>
            {shares.map((r, i) => {
              const p = person(r.personId);
              return (
                <View key={r.personId} style={[s.shareRow, i < shares.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.hairline }]}>
                  <View style={{ flex: 1, alignItems: 'flex-start' }}>
                    {p ? <Capsule label={p.id === meId ? `${p.name} (du)` : p.name} selected leading={<Monogram person={p} />} />
                      : <Text style={{ fontSize: 15, color: t.ink }}>?</Text>}
                  </View>
                  <Text style={{ fontSize: 13, color: t.inkMuted }}>{r.pct} %</Text>
                  <Text style={{ minWidth: 72, textAlign: 'right', fontSize: 15, fontWeight: '600', color: t.ink, fontVariant: ['tabular-nums'] }}>{formatPrice(r.amount)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {solo && (
        <View style={{ gap: 8, alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 13, color: t.inkMuted }}>Bezahlt von</Text>
          <Capsule label={solo.id === meId ? `${solo.name} (du)` : solo.name} selected leading={<Monogram person={solo} />} />
        </View>
      )}

      {facts.length > 0 && (
        <View style={s.facts}>
          {facts.map(([k, v]) => (
            <View key={k} style={{ width: '48%', gap: 1 }}>
              <Text style={{ fontSize: 12, lineHeight: 16, color: t.inkMuted }}>{k}</Text>
              {k === 'Shop' ? <ShopValue shop={v} link={f.link} /> : <Text style={{ fontSize: 15, lineHeight: 20, color: t.ink }}>{v}</Text>}
            </View>
          ))}
        </View>
      )}

      {!!f.link && (
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(/^https?:\/\//.test(f.link) ? f.link : `https://${f.link}`)}
          style={({ pressed }) => [s.link, { backgroundColor: t.surfaceSunken, borderColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}>
          <Icon name="external" size="chip" color={t.accent} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 15, lineHeight: 19, fontWeight: '600', color: t.accent }}>Produktseite öffnen</Text>
            <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 15, color: t.inkMuted }}>{shortUrl(f.link)}</Text>
          </View>
          <Icon name="chevron" size="inline" color={t.accent} />
        </Pressable>
      )}
    </EditCard>
  );
}

// ---------- Set (Spec 3.3) ----------

/** Kleine Kacheln aller Teile, von oben nach unten am Körper; aktuelles Teil in accent umrandet */
/** Bearbeitet wird das Set in Bearbeiten (Zeile „Set“ unter „Wendbar“, entschieden 15.11.2026) – hier nur Ansicht */
export function SetCard({ name, members, currentId, onOpen }: { name: string | null; members: Tile[]; currentId: string; onOpen: (id: string) => void }) {
  const t = useTheme();
  const sorted = setOrder(members);
  const tiles = sorted.map((m) => {
    const cur = m.id === currentId;
    return (
      <Pressable key={m.id} onPress={() => !cur && onOpen(m.id)} accessibilityRole="button" accessibilityLabel={cur ? `${m.name} (dieses Teil)` : m.name}
        style={{ width: sorted.length > 3 ? 100 : undefined, flex: sorted.length > 3 ? undefined : 1, minWidth: 0, gap: 6 }}>
        <View style={[s.setTile, { boxShadow: cur ? `inset 0 0 0 2px ${t.accent}` : 'inset 0 0 0 1px rgba(42,26,29,0.09)' }]}>
          <ItemPicture uri={m.thumb} inset={8} category={m.kind} color={m.hex ?? '#d8d2c8'} />
        </View>
        <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 17, color: cur ? t.ink : t.inkMuted, fontWeight: cur ? '600' : '400' }}>{cur ? 'Dieses Teil' : m.name}</Text>
      </Pressable>
    );
  });
  return (
    <EditCard title={name ? `Set · ${name}` : 'Set'}>
      {sorted.length > 3
        ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{tiles}</ScrollView>
        : <View style={{ flexDirection: 'row', gap: 8 }}>{tiles}</View>}
    </EditCard>
  );
}

// ---------- Outfits (Spec 3.4) ----------

export function OutfitsCard({ outfits, byId, width, onOpen, onNew }: { outfits: Outfit[]; byId: Map<string, Tile>; width: number; onOpen: (id: string) => void; onNew: () => void }) {
  const t = useTheme();
  if (!outfits.length) {
    return (
      <View style={[s.plainRow, { backgroundColor: t.surface, borderColor: t.hairline }]}>
        <Text style={{ flex: 1, fontSize: 15, color: t.ink }}>Noch in keinem Outfit</Text>
        <Capsule label="Outfit damit" onPress={onNew} icon={(c) => <Icon name="outfitNew" size="chip" color={c} />} />
      </View>
    );
  }
  const cardW = Math.floor((width - 28 - 16) / 3);
  return (
    <EditCard title={`In ${outfits.length} ${outfits.length === 1 ? 'Outfit' : 'Outfits'}`}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {outfits.map((o) => <OutfitCard key={o.id} outfit={o} byId={byId} width={cardW} small onPress={() => onOpen(o.id)} />)}
      </ScrollView>
    </EditCard>
  );
}

export function NotesCard({ text }: { text: string }) {
  const t = useTheme();
  return <EditCard title="Notizen"><Text style={{ fontSize: 15, lineHeight: 21, color: t.ink }}>{text}</Text></EditCard>;
}

const s = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { borderRadius: 16, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, minWidth: 0, overflow: 'hidden' },
  value: { fontFamily: DISPLAY, marginTop: 4 },
  measure: { position: 'absolute', opacity: 0, left: 0, top: 0, pointerEvents: 'none' } as object,
  row: { minHeight: 52, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 8 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, columnGap: 8 },
  link: { height: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  setTile: { height: 104, borderRadius: 14, backgroundColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  plainRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14 },
});

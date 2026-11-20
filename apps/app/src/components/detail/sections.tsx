// Inhalte der Detailseite (Spec 3–5): Tragen-Kacheln, Steckbrief, Kauf, Set, Outfits, Notizen
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  CARE, SEASONS, analysisSections, colorLabel, materialLabel, careList, categoryLast, discountPct, fitWords, formatPrice, hasCollarSize, setOrder, shareRows, shopView,
  shortDate, shortUrl, sizeText, splitLabel, statFontSize, fieldsFor, type CareGroup, type EditForm, type StatTile,
} from '@valet/core';
import { detail } from '@valet/ui';
import { useTheme, DISPLAY } from '@/lib/theme';
import { personKey, type Person, type Tile } from '@/lib/wardrobe';
import type { Outfit } from '@/lib/outfits';
import { OutfitCard } from '@/components/OutfitCard';
import { ItemPicture } from '@/components/ItemPicture';
import { EditCard } from '@/components/edit/fields';
import { Capsule, Monogram, Wrap } from './parts';
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


/**
 * Steckbrief: vollständige, schlichte Bezeichner-Wert-Liste. Neben den Grundangaben werden auch Details,
 * Trageeigenschaften und vorhandene KI-Profilwerte angezeigt. Bearbeiten bleibt als einfache Inline-Liste bedienbar.
 */
export function SteckbriefView({ f, onCare, onEdit, onAnalysis }: { f: EditForm; onCare: (g: CareGroup) => void; onEdit: () => void; onAnalysis?: () => void }) {
  const t = useTheme();
  const fx = fieldsFor(f.category, f.subcategory);
  const rev = fx.reversible && f.reversible;
  const care = careList(f.care);
  const rows: [string, string][] = [
    ['Kategorie', categoryLast({ category: f.category, subcategory: f.subcategory, type: f.type })],
    ['Saison', SEASONS.filter((x) => f.seasons.includes(x.key)).map((x) => x.label).join(', ')],
    [rev ? 'Farben Seite A' : 'Farben', f.colors.map(colorLabel).join(', ')],
    ...(rev ? [['Farben Seite B', f.colorsB.map(colorLabel).join(', ')] as [string, string]] : []),
    ['Material', f.materials.map((m) => m.pct != null ? materialLabel(m.name) + ' ' + m.pct + ' %' : materialLabel(m.name)).join(', ')],
    ['Größe', [fx.size ? sizeText(f.sizeSystem, f.size) : '', fx.size === 'clothing' && hasCollarSize(f.subcategory) && f.collarSize ? 'Kragen ' + f.collarSize : ''].filter(Boolean).join(', ')],
    ['Passform', fitWords(f).join(', ')],
    ...(fx.reversible ? [['Wendbar', f.reversible ? 'Ja' : 'Nein'] as [string, string]] : []),
  ];
  const careText = care.map((c) => { const group = CARE.find((x) => x.key === c.group); const option = group?.options.find((x) => x.id === c.v); return (group?.label ?? c.group) + ': ' + (option?.short ?? c.v) + (c.src === 'geschaetzt' ? ' (geschätzt)' : ''); }).join(', ');
  const shown = [...rows, ...(fx.care ? [['Pflege', careText] as [string, string]] : [])].filter(([, value]) => !!value);
  const extraSections = analysisSections(f);
  return <View style={{ gap: 0 }}>
    {shown.map(([label, value], i) => <View key={label} style={{ minHeight: 42, paddingVertical: 9, borderBottomWidth: i < shown.length - 1 || !!onAnalysis ? 1 : 0, borderBottomColor: t.hairline, gap: 3 }}>
      <Text style={{ fontSize: 13, color: t.inkMuted }}>{label}</Text>
      <Text style={{ fontSize: 16, lineHeight: 22, color: t.ink }}>{value}</Text>
    </View>)}
    {extraSections.map((section) => <View key={section.key} style={{ paddingTop: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: t.inkMuted, paddingBottom: 5 }}>{section.title}</Text>
      {section.rows.map((r) => <View key={r.label} style={{ paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: t.hairline, gap: 2 }}>
        <Text style={{ fontSize: 13, color: t.inkMuted }}>{r.label}</Text>
        <Text style={{ fontSize: 16, lineHeight: 22, color: t.ink }}>{r.value}</Text>
      </View>)}
    </View>)}
    {care.filter((c) => c.src === 'geschaetzt').map((c) => <Text key={c.group} onPress={() => onCare(c.group)} style={{ paddingVertical: 5, fontSize: 14, color: t.accent }}>Pflege-Schätzung prüfen: {CARE.find((x) => x.key === c.group)?.label ?? c.group}</Text>)}
    {fx.care && !careText && <View style={{ paddingVertical: 9, gap: 6 }}><Text style={{ fontSize: 13, color: t.inkMuted }}>Pflege</Text><Text style={{ fontSize: 16, color: t.inkMuted }}>Noch leer</Text><Text onPress={onEdit} style={{ fontSize: 15, color: t.accent }}>Pflegehinweise bearbeiten</Text></View>}
    {onAnalysis && <Pressable accessibilityRole="button" accessibilityLabel="KI-Analyse öffnen" onPress={onAnalysis} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ fontSize: 16, color: t.ink }}>KI-Analyse</Text><Icon name="chevron" size="inline" color={t.inkMuted} /></Pressable>}
  </View>;
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

export function KaufView({ f, row, wasWish, createdAt, persons, meId, onEdit }: {
  f: EditForm; row: { price_paid: number | null; list_price: number | null; gift_value: number | null; payers: { person_id?: string | null; amount?: number | null }[] | null };
  wasWish: boolean | null; createdAt: string; persons: Person[]; meId: string | null; onEdit: () => void;
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
    ...(!f.gift && wasWish && createdAt ? [['Gemerkt seit', shortDate(createdAt.slice(0, 10), '0000')] as [string, string]] : []),
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
            <View key={k} style={{ width: k === 'Gekauft' || k === 'Bekommen am' || k === 'Gemerkt seit' ? '100%' : '48%', gap: 1 }}>
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

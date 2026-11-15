// Bausteine der Wunschteil-Detailseite (VALET_DETAILSEITE_SPEC.md, Abschnitte 2, 3, 5; Leinwand „E · Wunschteil“):
// Listen-Zeile, „Lohnt sich das?“ (vorerst Platzhalter), „Im Outfit ansehen“, Kauf-Reiter und die Blätter
// Kategorie, Kauftag planen und Gekauft.
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  buyDayHint, buyDayLabel, buyDayQuick, buyError, formatPrice, parseAmount, priceTrend, shortUrl, wishFacts, wishTagLabel,
  type WishRow, type WishTag,
} from '@valet/core';
import { detail } from '@valet/ui';
import { useTheme, DISPLAY } from '@/lib/theme';
import type { Person, Tile } from '@/lib/wardrobe';
import type { Outfit } from '@/lib/outfits';
import { Sheet } from '@/components/Sheet';
import { OutfitCard } from '@/components/OutfitCard';
import { TileIcon, type TileIconName } from '@/components/tile/TileIcons';
import { EditCard } from '@/components/edit/fields';
import { Capsule, DateField, FieldLabel, Glyph, GLYPHS, Hint, IconCircle, Monogram, SheetHead, TextField, Wrap } from './parts';

/** Reihenfolge der Kategorien wie in Bearbeiten (Spec 7a) */
export const WISH_ORDER: WishTag[] = ['nextcop', 'grail', 'watchlist', 'someday', 'gift'];

// ---------- Übersicht ----------

/** Zeile mit der Liste (nur Name, Spec 3) und „gemerkt vor …“; ohne Liste: „Keine Liste“ */
export function WishListRow({ name, saved, onPress }: { name: string | null; saved: string | null; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={name ? `Liste ${name} öffnen` : 'Keiner Liste zugeordnet, zuordnen'}
      style={({ pressed }) => [s.row, { backgroundColor: t.surface, borderColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 12, lineHeight: 16, color: t.inkMuted }}>Liste</Text>
        <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 20, fontWeight: '600', color: name ? t.ink : t.inkMuted }}>{name ?? 'Keine Liste'}</Text>
      </View>
      {saved && <Text style={{ fontSize: 13, color: t.inkMuted }}>gemerkt {saved}</Text>}
      <Glyph d={GLYPHS.chevron} size={16} color={t.inkMuted} />
    </Pressable>
  );
}

/** „Lohnt sich das?“ – Kauf-Check der KI; vorerst nur Platzhalter (Max, 15.11.2026) */
export function WorthCard() {
  const t = useTheme();
  const cells = ['Kombinierbar mit', 'Ähnlich im Schrank', 'Lücke im Schrank', 'Preis'];
  return (
    <EditCard title="Lohnt sich das?">
      <Text style={{ fontSize: 15, lineHeight: 21, color: t.inkMuted }}>Kommt bald: Valet prüft, ob das Teil eine Lücke im Schrank schließt oder etwas Ähnliches schon da ist.</Text>
      <View style={s.facts}>
        {cells.map((k) => (
          <View key={k} style={s.fact}>
            <Text style={{ fontSize: 12, lineHeight: 16, color: t.inkMuted }}>{k}</Text>
            <Text style={{ fontSize: 15, lineHeight: 20, color: t.inkMuted }}>–</Text>
          </View>
        ))}
      </View>
      <Hint>Noch nicht geprüft.</Hint>
    </EditCard>
  );
}

/** „Im Outfit ansehen“: Outfits, in denen das Teil schon steckt, und der Weg in den Baukasten (Würfel) */
export function TryOnCard({ outfits, byId, width, onOpen, onTry }: { outfits: Outfit[]; byId: Map<string, Tile>; width: number; onOpen: (id: string) => void; onTry: () => void }) {
  const t = useTheme();
  const cardW = Math.floor((width - 28 - 16) / 3);
  return (
    <EditCard title="Im Outfit ansehen">
      {outfits.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {outfits.map((o) => <OutfitCard key={o.id} outfit={o} byId={byId} width={cardW} onPress={() => onOpen(o.id)} />)}
        </ScrollView>
      ) : (
        <Text style={{ fontSize: 15, lineHeight: 21, color: t.inkMuted }}>Stell das Teil mit Sachen aus deinem Schrank zusammen, bevor du es kaufst.</Text>
      )}
      <Wrap><Capsule label="Im Baukasten ausprobieren" onPress={onTry} icon={(c) => <Glyph d={GLYPHS.dice} size={18} color={c} />} /></Wrap>
    </EditCard>
  );
}

// ---------- Kauf (Spec 5, Wunschteil) ----------

export function WishKaufView({ row, link, onEdit }: { row: WishRow; link: string; onEdit: () => void }) {
  const t = useTheme();
  const price = row.list_price;
  const trend = priceTrend(row.wish_price, price);
  const facts = wishFacts(row);
  return (
    <EditCard title="Preis">
      {price != null ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: DISPLAY, fontSize: detail.font.price, lineHeight: 36, color: t.ink }}>{formatPrice(price)}</Text>
          {trend && <Text style={{ fontSize: 13, fontWeight: '600', color: trend.down ? t.actionText : t.inkMuted }}>{trend.down ? '−' : '+'}{trend.pct} % seit dem Merken</Text>}
        </View>
      ) : (
        <Pressable onPress={onEdit} accessibilityRole="button"><Text style={{ fontSize: 15, color: t.accent }}>Preis fehlt – eintragen</Text></Pressable>
      )}
      {facts.length > 0 && (
        <View style={s.facts}>
          {facts.map(([k, v]) => (
            <View key={k} style={s.fact}>
              <Text style={{ fontSize: 12, lineHeight: 16, color: t.inkMuted }}>{k}</Text>
              <Text style={{ fontSize: 15, lineHeight: 20, color: t.ink }}>{v}</Text>
            </View>
          ))}
        </View>
      )}
      {!!link && (
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(/^https?:\/\//.test(link) ? link : `https://${link}`)}
          style={({ pressed }) => [s.link, { backgroundColor: t.surfaceSunken, borderColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}>
          <Glyph d={GLYPHS.external} size={18} color={t.accent} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 15, lineHeight: 19, fontWeight: '600', color: t.accent }}>Produktseite öffnen</Text>
            <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 15, color: t.inkMuted }}>{shortUrl(link)}</Text>
          </View>
          <Glyph d={GLYPHS.chevron} size={16} color={t.accent} />
        </Pressable>
      )}
    </EditCard>
  );
}

// ---------- Blätter ----------

/** Kategorie wählen (Werkzeugleiste links 1): runde Symbol-Kreise, eine; erneut tippen hebt auf */
export function WishTagSheet({ open, current, onPick, onClose }: { open: boolean; current: WishTag | null; onPick: (tag: WishTag | null) => void; onClose: () => void }) {
  const t = useTheme();
  return (
    <Sheet open={open} onClose={onClose} title="Kategorie" head={<SheetHead title="Kategorie" onCancel={onClose} />}>
      <View style={{ gap: 14, paddingTop: 14 }}>
        <View style={{ gap: 4 }}>
          {WISH_ORDER.map((w) => {
            const on = current === w;
            return (
              <Pressable key={w} onPress={() => onPick(on ? null : w)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={wishTagLabel(w) ?? w}
                style={({ pressed }) => [s.tagRow, { borderBottomColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}>
                <IconCircle a11y={wishTagLabel(w) ?? w} selected={on}><TileIcon name={w as TileIconName} color={on ? t.bg : t.ink} size={20} /></IconCircle>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: on ? '600' : '400', color: t.ink }}>{wishTagLabel(w)}</Text>
                {on && <Glyph d={GLYPHS.check} size={20} color={t.accent} stroke={2.4} />}
              </Pressable>
            );
          })}
        </View>
        <Hint>Eine Kategorie pro Teil. Erneut antippen hebt sie auf.</Hint>
      </View>
    </Sheet>
  );
}

/** Kauftag planen (Werkzeugleiste links 2): Schnellwahl, Datum, Entfernen */
export function BuyDaySheet({ open, current, today, onSave, onClose }: {
  open: boolean; current: string | null; today: string; onSave: (day: string | null) => Promise<void>; onClose: () => void;
}) {
  const [day, setDay] = useState<string | null>(current ?? today);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setDay(current ?? today); setError(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save(v: string | null) {
    if (v && v < today) return setError('Der Tag liegt in der Vergangenheit.');
    setBusy(true);
    try { await onSave(v); } catch (e) { setError('Speichern fehlgeschlagen: ' + (e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Kauftag planen" head={<SheetHead title="Kauftag planen" onCancel={onClose} onDone={() => save(day)} doneDisabled={busy || !day} />}>
      <View style={{ gap: 14, paddingTop: 14 }}>
        <FieldLabel>Schnell</FieldLabel>
        <Wrap>{buyDayQuick(today).map((q) => <Capsule key={q.label} label={q.label} selected={day === q.day} onPress={() => { setDay(q.day); setError(null); }} />)}</Wrap>
        <DateField label="Tag" value={day} onChange={(v) => { setDay(v); setError(null); }} />
        {day && !error && <Hint>{buyDayLabel(day)} · {buyDayHint(day, today)}</Hint>}
        {error && <Hint accent>{error}</Hint>}
        {current && <Wrap><Capsule label="Geplanten Tag entfernen" onPress={() => save(null)} /></Wrap>}
      </View>
    </Sheet>
  );
}

export type BuyInput = { price: number | null; date: string; owners: string[] };

/** Gekauft (Hauptaktion): Bezahlt, Kaufdatum, Gehört → Teil wandert in den Schrank */
export function BoughtSheet({ open, start, persons, meId, today, onSave, onClose }: {
  open: boolean; start: BuyInput; persons: Person[]; meId: string | null; today: string; onSave: (b: BuyInput) => Promise<void>; onClose: () => void;
}) {
  const [price, setPrice] = useState('');
  const [date, setDate] = useState<string | null>(today);
  const [owners, setOwners] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setPrice(start.price != null ? start.price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
    setDate(start.date); setOwners(start.owners); setError(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  async function done() {
    const priceValue = price.trim() ? parseAmount(price) : null;
    const err = buyError({ price, priceValue, date, owners }, today);
    if (err) return setError(err);
    setBusy(true);
    try { await onSave({ price: priceValue, date: date!, owners }); } catch (e) { setError('Speichern fehlgeschlagen: ' + (e as Error).message); } finally { setBusy(false); }
  }
  const toggle = (id: string) => { setError(null); setOwners((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id])); };
  return (
    <Sheet open={open} onClose={onClose} title="Gekauft" head={<SheetHead title="Gekauft" onCancel={onClose} onDone={done} doneDisabled={busy} />}>
      <View style={{ gap: 14, paddingTop: 14 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextField label="Bezahlt" value={price} onChange={(v) => { setPrice(v); setError(null); }} placeholder="0,00 €" keyboardType="decimal-pad" inputMode="decimal" />
          <DateField label="Kaufdatum" value={date} onChange={(v) => { setDate(v); setError(null); }} />
        </View>
        <FieldLabel>Gehört</FieldLabel>
        <Wrap>{persons.map((p) => (
          <Capsule key={p.id} label={p.id === meId ? `${p.name} (du)` : p.name} selected={owners.includes(p.id)} leading={<Monogram person={p} />} onPress={() => toggle(p.id)} />
        ))}</Wrap>
        <Hint>Danach steht das Teil im Schrank. Liste und Kategorie fallen weg, der Wunsch-Preis bleibt als Listenpreis.</Hint>
        {error && <Hint accent>{error}</Hint>}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, columnGap: 8 },
  fact: { width: '48%', gap: 1, minWidth: 0 },
  link: { height: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: 1 },
});

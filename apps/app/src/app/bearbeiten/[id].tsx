import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, KeyboardAvoidingView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, SEASONS, STYLES, parseAmount } from '@valet/core';
import { Chip, useToast } from '@/components/ui';
import { Icons } from '@/components/Icon';
import { Sheet, SheetButton } from '@/components/Sheet';
import { useSession } from '@/lib/session';
import { useTheme, DISPLAY, space, radius } from '@/lib/theme';
import { loadItem, updateItem, deleteItem, type ItemRow } from '@/lib/item';
import { NAMED, nameToHex, personKey } from '@/lib/wardrobe';

const PERSON = { pink: '#D9668E', red: '#C8102E' } as const;
const COLORS = Object.keys(NAMED).map((k) => k[0].toUpperCase() + k.slice(1));
const eur = (n: number | null) => (n == null ? '' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const toDe = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : '');
function toIso(de: string): string | null | undefined {
  const t = de.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return undefined; // ungültig
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

type Form = {
  name: string; brand: string; category: string; owner_id: string | null; price: string; qty: string;
  colors: string[]; size: string; list: string; date: string; shop: string; link: string;
  seasons: string[]; style: string | null; material: string; reversible: boolean; notes: string;
};

function toForm(i: ItemRow): Form {
  return {
    name: i.name ?? '', brand: i.brand ?? '', category: i.category, owner_id: i.owner_id, price: eur(i.price_paid),
    qty: String(i.qty ?? 1), colors: (i.color ?? '').split('/').map((c) => c.trim()).filter(Boolean), size: i.size ?? '',
    list: eur(i.list_price), date: toDe(i.purchase_date), shop: i.shop ?? '', link: i.link ?? '',
    seasons: i.seasons ?? [], style: i.style, material: i.material ?? '', reversible: !!i.reversible, notes: i.notes ?? '',
  };
}

export default function Bearbeiten() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { wardrobe, patch, reload } = useSession();
  const [orig, setOrig] = useState<ItemRow | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast(insets.bottom + 90);

  useEffect(() => { loadItem(id).then((d) => { setOrig(d.item); setF(toForm(d.item)); }).catch((e) => toast.show(e.message)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => (router.canGoBack() ? router.back() : router.replace(`/teil/${id}`));
  if (!f || !orig) return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={t.accent} /></View>;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const toggleIn = (k: 'seasons' | 'colors', v: string, max = 9) =>
    set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : f[k].length < max ? [...f[k], v] : [...f[k].slice(0, max - 1), v]);

  async function save() {
    if (!f) return;
    if (!f.name.trim()) return toast.show('Bitte einen Namen eingeben.');
    const date = toIso(f.date);
    if (date === undefined) return toast.show('Kaufdatum bitte als TT.MM.JJJJ eingeben.');
    const price = parseAmount(f.price); const list = parseAmount(f.list);
    if (f.price.trim() && price == null) return toast.show('Preis ist keine Zahl.');
    if (f.list.trim() && list == null) return toast.show('Listenpreis ist keine Zahl.');
    const qty = Math.max(1, parseInt(f.qty, 10) || 1);
    const color = f.colors.join('/') || null;
    const change = {
      name: f.name.trim(), brand: f.brand.trim() || null, category: f.category, owner_id: f.owner_id, price_paid: price, qty,
      color, size: f.size.trim() || null, list_price: list, purchase_date: date, shop: f.shop.trim() || null, link: f.link.trim() || null,
      seasons: f.seasons, style: f.style, material: f.material.trim() || null, reversible: f.reversible, notes: f.notes.trim() || null,
    };
    setSaving(true);
    try {
      await updateItem(id, change);
      const tile = wardrobe?.items.find((i) => i.id === id);
      const colorChanged = color !== orig!.color;
      patch(id, {
        name: change.name, brand: change.brand, category: change.category, ownerId: change.owner_id, price: price ?? list,
        qty, reversible: change.reversible, seasons: change.seasons, style: change.style, purchaseDate: date, color,
        hex: colorChanged ? nameToHex(color) ?? tile?.hex ?? null : tile?.hex ?? null,
      });
      close();
    } catch (e) { toast.show('Speichern fehlgeschlagen: ' + (e as Error).message); }
    finally { setSaving(false); }
  }

  async function remove() {
    setConfirmDelete(false);
    try { await deleteItem(id); await reload(); router.dismissTo('/'); }
    catch (e) { toast.show('Löschen fehlgeschlagen: ' + (e as Error).message); }
  }

  const input = [s.input, { backgroundColor: t.surface, borderColor: t.hairline, color: t.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null];
  const Field = ({ label, k, ...p }: { label: string; k: 'name' | 'brand' | 'price' | 'qty' | 'size' | 'list' | 'date' | 'shop' | 'link' | 'material' | 'notes' } & React.ComponentProps<typeof TextInput>) => (
    <View style={{ gap: 4, flex: p.style ? undefined : 1 }}>
      <Text style={[s.label, { color: t.inkMuted }]}>{label}</Text>
      <TextInput value={f[k]} onChangeText={(v) => set(k, v)} placeholderTextColor={t.inkMuted} {...p} style={[input, p.multiline && { height: 96, paddingTop: 12, textAlignVertical: 'top' }]} />
    </View>
  );
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.bar, { paddingTop: insets.top + space.xs, borderBottomColor: t.hairline }]}>
        <Pressable onPress={close} hitSlop={10}><Text style={{ fontSize: 17, color: t.ink }}>Abbrechen</Text></Pressable>
        <Text style={{ fontFamily: DISPLAY, fontSize: 20, color: t.ink }}>Bearbeiten</Text>
        <Pressable onPress={save} disabled={saving} hitSlop={10}><Text style={{ fontSize: 17, fontWeight: '700', color: t.dark ? t.accent : '#722638', opacity: saving ? 0.4 : 1 }}>{saving ? 'Speichert …' : 'Sichern'}</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={s.col}>
          {/* Das Wichtigste */}
          {Field({ label: 'Name', k: 'name', placeholder: 'z. B. Wollmantel' })}
          {Field({ label: 'Marke', k: 'brand', placeholder: 'z. B. COS' })}
          <Text style={[s.label, { color: t.inkMuted, marginTop: space.xs }]}>Kategorie</Text>
          <View style={s.wrap}>{CATEGORIES.map((c) => <Chip key={c.id} label={c.label} selected={f.category === c.id} onPress={() => set('category', c.id)} />)}</View>
          <Text style={[s.label, { color: t.inkMuted, marginTop: space.xs }]}>Gehört</Text>
          <View style={s.wrap}>
            {(wardrobe?.persons ?? []).map((p) => (
              <Chip key={p.id} label={p.name} dot={PERSON[personKey(p.color)]} selected={f.owner_id === p.id} onPress={() => set('owner_id', p.id)} />
            ))}
            <Chip label="Niemand" selected={!f.owner_id} onPress={() => set('owner_id', null)} />
          </View>
          <View style={s.row}>
            {Field({ label: 'Bezahlt (€ pro Stück)', k: 'price', placeholder: '0,00', keyboardType: 'decimal-pad' })}
            <View style={{ width: 96 }}>{Field({ label: 'Anzahl', k: 'qty', keyboardType: 'number-pad', style: {} })}</View>
          </View>

          {/* Gruppen */}
          <Group open={!!open.farbe} onToggle={() => setOpen({ ...open, farbe: !open.farbe })} title="Farbe & Größe" summary={[f.colors.join(' / '), f.size && `Größe ${f.size}`].filter(Boolean).join(' · ')}>
            <Text style={[s.label, { color: t.inkMuted }]}>Farben (in Reihenfolge antippen, bis zu 3)</Text>
            <View style={s.swatches}>
              {COLORS.map((c) => {
                const n = f.colors.indexOf(c);
                return (
                  <Pressable key={c} onPress={() => toggleIn('colors', c, 3)} accessibilityLabel={c} accessibilityState={{ selected: n >= 0 }} style={s.swatchWrap}>
                    <View style={[s.swatch, { backgroundColor: NAMED[c.toLowerCase()], borderColor: n >= 0 ? t.ink : t.hairline, borderWidth: n >= 0 ? 3 : 1 }]}>
                      {n >= 0 && <Text style={s.swatchN}>{n + 1}</Text>}
                    </View>
                    <Text style={{ fontSize: 11, color: t.inkMuted }} numberOfLines={1}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>
            {Field({ label: 'Größe', k: 'size', placeholder: 'z. B. M, 32/32, 44' })}
          </Group>

          <Group open={!!open.kauf} onToggle={() => setOpen({ ...open, kauf: !open.kauf })} title="Kauf" summary={[f.shop, f.date, f.list && `Liste ${f.list} €`].filter(Boolean).join(' · ')}>
            <View style={s.row}>
              {Field({ label: 'Listenpreis (€)', k: 'list', placeholder: '0,00', keyboardType: 'decimal-pad' })}
              {Field({ label: 'Kaufdatum', k: 'date', placeholder: 'TT.MM.JJJJ', keyboardType: 'numbers-and-punctuation' })}
            </View>
            {Field({ label: 'Shop', k: 'shop', placeholder: 'z. B. Zalando' })}
            {Field({ label: 'Link', k: 'link', placeholder: 'https://…', autoCapitalize: 'none', keyboardType: 'url' })}
          </Group>

          <Group open={!!open.eig} onToggle={() => setOpen({ ...open, eig: !open.eig })} title="Eigenschaften" summary={[f.seasons.join(', '), f.style, f.material, f.reversible && 'Wendeteil'].filter(Boolean).join(' · ')}>
            <Text style={[s.label, { color: t.inkMuted }]}>Saison</Text>
            <View style={s.wrap}>{SEASONS.map((x) => <Chip key={x} label={x} selected={f.seasons.includes(x)} onPress={() => toggleIn('seasons', x)} />)}</View>
            <Text style={[s.label, { color: t.inkMuted }]}>Stil</Text>
            <View style={s.wrap}>{STYLES.map((x) => <Chip key={x} label={x} selected={f.style === x} onPress={() => set('style', f.style === x ? null : x)} />)}</View>
            {Field({ label: 'Material', k: 'material', placeholder: 'z. B. 100 % Baumwolle' })}
            <View style={s.switchRow}>
              <Text style={{ fontSize: 16, color: t.ink }}>Wendeteil</Text>
              <Switch value={f.reversible} onValueChange={(v) => set('reversible', v)} trackColor={{ true: '#722638', false: t.surfaceSunken }} thumbColor="#fff" {...({ activeThumbColor: '#fff' } as object)} />
            </View>
          </Group>

          <Group open={!!open.notiz} onToggle={() => setOpen({ ...open, notiz: !open.notiz })} title="Notizen" summary={f.notes}>
            {Field({ label: 'Notizen', k: 'notes', multiline: true, placeholder: 'Pflegehinweise, Passform …' })}
          </Group>

          <Pressable onPress={() => setConfirmDelete(true)} style={{ alignItems: 'center', paddingVertical: space.lg }}>
            <Text style={{ fontSize: 16, color: t.dark ? '#F2B8B5' : '#B3261E' }}>Teil löschen</Text>
          </Pressable>
        </View>
      </ScrollView>
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Teil löschen?"
        footer={<><SheetButton label="Abbrechen" onPress={() => setConfirmDelete(false)} /><SheetButton primary label="Löschen" onPress={remove} /></>}>
        <Text style={{ fontSize: 16, color: t.ink }}>„{orig.name}“ wird mit allen Tragetagen und aus allen Outfits entfernt. Das lässt sich nicht rückgängig machen.</Text>
      </Sheet>
      {toast.node}
    </KeyboardAvoidingView>
  );
}

/** Aufklappbare Gruppe; zugeklappt zeigt sie eine Zusammenfassung */
function Group({ open, onToggle, title, summary, children }: { open: boolean; onToggle: () => void; title: string; summary: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[s.group, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <Pressable onPress={onToggle} style={s.groupHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: t.ink }}>{title}</Text>
          {!open && !!summary && <Text style={{ fontSize: 13, color: t.inkMuted }} numberOfLines={1}>{summary}</Text>}
        </View>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><Icons.chevron color={t.inkMuted} /></View>
      </Pressable>
      {open && <View style={{ gap: space.sm, padding: space.md, paddingTop: 0 }}>{children}</View>}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingBottom: space.sm, borderBottomWidth: 1 },
  col: { width: '100%', maxWidth: 520, padding: space.md, gap: space.sm },
  label: { fontSize: 13, fontWeight: '500' },
  input: { height: 48, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: space.md, fontSize: 17 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  row: { flexDirection: 'row', gap: space.sm },
  group: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', marginTop: space.xs },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56, paddingHorizontal: space.md, paddingVertical: space.sm },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchWrap: { width: 54, alignItems: 'center', gap: 4 },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  swatchN: { color: '#fff', fontSize: 13, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
});

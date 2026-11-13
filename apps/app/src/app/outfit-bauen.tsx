import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, SIDE_CATEGORIES, formatEur } from '@valet/core';
import { Chip, SearchField, RoundButton, Empty, useToast } from '@/components/ui';
import { Icons } from '@/components/Icon';
import { ItemPicture } from '@/components/ItemPicture';
import { Mosaic } from '@/components/Mosaic';
import { Sheet, SheetButton } from '@/components/Sheet';
import { useSession } from '@/lib/session';
import { useBottomInset } from '@/lib/bottomInset';
import { useTheme, DISPLAY, space, radius } from '@/lib/theme';
import { personKey, type Tile } from '@/lib/wardrobe';
import { allOccasions, deleteOutfit, planOutfit, saveOutfit } from '@/lib/outfits';

const catIndex = (c: string) => { const n = CATEGORIES.findIndex((x) => x.id === c); return n < 0 ? 99 : n; };

/** Outfit zusammenstellen oder bearbeiten. Parameter: id (bearbeiten), date + who (danach planen), item (mit diesem Teil anfangen) */
export default function OutfitBauen() {
  const p = useLocalSearchParams<{ id?: string; date?: string; who?: string; item?: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { wardrobe } = useSession();
  // Erst bauen, wenn der Schrank geladen ist – sonst stünde beim Bearbeiten eine leere Auswahl im Formular
  if (!wardrobe) return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={t.accent} /></View>;
  if (p.id && !wardrobe.outfits.some((o) => o.id === p.id)) return <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}><Empty title="Nicht gefunden" text="Dieses Outfit gibt es nicht mehr." /></View>;
  return <Editor {...p} />;
}

function Editor(p: { id?: string; date?: string; who?: string; item?: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset();
  const { height: winH, width: winW } = useWindowDimensions();
  const toast = useToast(bottom + space.lg);
  const { wardrobe, session, reloadOutfits } = useSession();
  const persons = wardrobe?.persons ?? [];
  const me = persons.find((x) => x.user_id === session?.user.id) ?? null;
  const old = p.id ? wardrobe?.outfits.find((o) => o.id === p.id) : undefined;
  const byId = useMemo(() => new Map((wardrobe?.items ?? []).map((i) => [i.id, i] as [string, Tile])), [wardrobe]);

  const [ids, setIds] = useState<string[]>(() => old ? old.pieces.map((x) => x.id) : p.item ? [p.item] : []);
  const [occ, setOcc] = useState<string[]>(() => old?.occasions ?? []);
  const [src, setSrc] = useState<string>(() => {
    if (persons.length < 2) return 'all';
    const owners = new Set(ids.map((id) => byId.get(id)?.ownerId).filter(Boolean));
    return owners.size > 1 ? 'all' : owners.size === 1 ? [...owners][0]! : p.who || me?.id || 'all';
  });
  const [cat, setCat] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [own, setOwn] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const width = Math.min(winW, 520) - 2 * space.md;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/outfits'));
  if (!wardrobe) return null;

  const chosen = ids.map((id) => byId.get(id)).filter((i): i is Tile => !!i);
  const value = chosen.filter((i) => !i.isWish).reduce((s, i) => s + (i.pricePaid ?? 0), 0);
  const inSrc = (i: Tile) => src === 'all' || i.ownerId === src;
  const pool = wardrobe.items.filter((i) => !i.isWish && i.status !== 'out' && i.status !== 'sold' && inSrc(i));
  const counts = new Map<string, number>();
  for (const i of pool) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
  const q = query.trim().toLowerCase();
  const shown = pool
    .filter((i) => (!cat || i.category === cat) && (!q || [i.name, i.brand, i.color].some((f) => f?.toLowerCase().includes(q))))
    .sort((a, b) => catIndex(a.category) - catIndex(b.category) || a.name.localeCompare(b.name, 'de'));
  const toggle = (i: Tile) => setIds((xs) => (xs.includes(i.id) ? xs.filter((x) => x !== i.id) : [...xs, i.id]));
  const ownerOf = (i: Tile) => {
    const o = persons.find((x) => x.id === i.ownerId);
    return o ? { letter: o.name.slice(0, 1).toUpperCase(), color: personKey(o.color) } : null;
  };
  const occList = [...new Set([...allOccasions(wardrobe.outfits), ...occ])];

  async function save() {
    if (!ids.length) return toast.show('Wähle mindestens ein Teil aus.');
    setSaving(true);
    try {
      const ownerId = old ? old.ownerId : p.who || me?.id || null;
      const id = await saveOutfit({ id: old?.id, wardrobeId: wardrobe!.id, ownerId, occasions: occ, itemIds: ids });
      if (!old && p.date) await planOutfit(id, p.date, p.who || me?.id || null);
      await reloadOutfits();
      close();
    } catch (e) { toast.show('Speichern fehlgeschlagen: ' + (e as Error).message); setSaving(false); }
  }

  async function remove() {
    setConfirmDelete(false);
    try { await deleteOutfit(old!.id); await reloadOutfits(); router.dismissTo('/outfits'); }
    catch (e) { toast.show('Löschen fehlgeschlagen: ' + (e as Error).message); }
  }

  function addOwn() {
    const v = own.trim().slice(0, 24);
    if (v && !occ.includes(v)) setOcc([...occ, v]);
    setOwn(''); setAdding(false);
  }

  const main = chosen.filter((i) => !SIDE_CATEGORIES.has(i.category)).sort((a, b) => catIndex(a.category) - catIndex(b.category));
  const side = chosen.filter((i) => SIDE_CATEGORIES.has(i.category)).sort((a, b) => catIndex(a.category) - catIndex(b.category));
  const piece = (i: Tile) => (
    <View key={i.id} style={[s.ctile, { opacity: i.isWish ? 0.5 : 1 }]}>
      {i.thumb || i.image
        ? <Image source={{ uri: i.thumb ?? i.image! }} resizeMode="contain" style={StyleSheet.absoluteFill} />
        : <ItemPicture uri={null} inset={0} category={i.category} color={i.hex ?? '#c4bfb4'} />}
      <Pressable onPress={() => toggle(i)} hitSlop={8} accessibilityLabel={`${i.name || 'Teil'} entfernen`} style={s.x}><Icons.close color="#fff" size={12} /></Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.bar, { paddingTop: insets.top + space.xs, backgroundColor: t.bg, borderBottomColor: t.hairline }]}>
        <Pressable onPress={close} hitSlop={8}><Text style={{ fontSize: 17, color: t.ink }}>Abbrechen</Text></Pressable>
        <Text style={[s.title, { color: t.ink }]}>{old ? 'Outfit bearbeiten' : 'Neues Outfit'}</Text>
        <Pressable onPress={save} disabled={saving} hitSlop={8}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: saving ? t.inkMuted : t.accent }}>{saving ? 'Speichert …' : 'Speichern'}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: bottom + space.xxl }} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[1]}>
        <View style={{ width, paddingTop: space.sm }}>
          {persons.length > 1 && (
            <>
              <Text style={[s.label, { color: t.inkMuted }]}>Aus welchem Schrank?</Text>
              <View style={s.wrap}>
                {persons.map((x) => <Chip key={x.id} label={x.id === me?.id ? 'Meinem Schrank' : x.name} dot={t.person[personKey(x.color)]} selected={src === x.id} onPress={() => setSrc(x.id)} />)}
                <Chip label="Beiden" selected={src === 'all'} onPress={() => setSrc('all')} />
              </View>
            </>
          )}

          {/* Vorschau wie im alten Valet: Hauptteile links, Accessoires und Taschen rechts */}
          <View style={[s.collage, { height: Math.min(winH * 0.46, 420), borderColor: t.hairline, marginTop: space.sm }]}>
            {chosen.length === 0 ? (
              <Text style={{ flex: 1, textAlign: 'center', alignSelf: 'center', color: '#7a7266', fontSize: 15 }}>Wähle unten Teile aus,{'\n'}um dein Outfit zu sehen.</Text>
            ) : (
              <>
                {(main.length ? main : side).length > 0 && <View style={[s.ccol, { flex: 2 }]}>{(main.length ? main : side).map(piece)}</View>}
                {main.length > 0 && side.length > 0 && <View style={[s.ccol, { flex: 1 }]}>{side.map(piece)}</View>}
              </>
            )}
          </View>

          <Text style={[s.label, { color: t.inkMuted, marginTop: space.sm }]}>Anlass <Text style={{ opacity: 0.7 }}>(optional)</Text></Text>
          <View style={s.wrap}>
            {occList.map((x) => <Chip key={x} label={x} selected={occ.includes(x)} onPress={() => setOcc(occ.includes(x) ? occ.filter((y) => y !== x) : [...occ, x])} />)}
            {adding ? (
              <View style={[s.ownWrap, { borderColor: t.hairline, backgroundColor: t.surface }]}>
                <TextInput autoFocus value={own} onChangeText={setOwn} onSubmitEditing={addOwn} onBlur={addOwn} placeholder="z. B. Date" placeholderTextColor={t.inkMuted} maxLength={24}
                  style={[{ fontSize: 15, color: t.ink, width: 110, paddingVertical: 0 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} />
              </View>
            ) : <Chip label="+ Eigener" onPress={() => setAdding(true)} />}
          </View>

          <View style={[s.sum, { borderColor: t.hairline, backgroundColor: t.surface }]}>
            <Text style={{ fontSize: 15, color: t.ink }}>{ids.length} {ids.length === 1 ? 'Teil' : 'Teile'} ausgewählt</Text>
            <Text style={{ fontSize: 15, color: t.inkMuted }}>Wert {formatEur(value)}</Text>
          </View>
        </View>

        <View style={[s.filters, { backgroundColor: t.bg, width: width + 2 * space.md }]}>
          {searching ? (
            <SearchField value={query} onChange={setQuery} onClose={() => { setSearching(false); setQuery(''); }} />
          ) : (
            <>
              <RoundButton label="Suchen" onPress={() => setSearching(true)}><Icons.search color={t.ink} /></RoundButton>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: space.xs }}>
                <Chip label="Alle" count={pool.length} selected={!cat} onPress={() => setCat(null)} />
                {CATEGORIES.filter((c) => counts.get(c.id)).map((c) => (
                  <Chip key={c.id} label={c.label} count={counts.get(c.id)} selected={cat === c.id} onPress={() => setCat(cat === c.id ? null : c.id)} />
                ))}
              </ScrollView>
            </>
          )}
        </View>

        <View style={{ width, marginTop: space.xs }}>
          {shown.length ? (
            <Mosaic items={shown} width={width} ownerOf={ownerOf} selected={(i) => ids.includes(i.id)} onPress={toggle} />
          ) : <Empty title="Keine Teile" text="Probier eine andere Kategorie oder Suche." />}
          {old && (
            <Pressable onPress={() => setConfirmDelete(true)} style={[s.delete, { borderColor: t.hairline, backgroundColor: t.surface }]} accessibilityRole="button">
              <Text style={{ fontSize: 17, fontWeight: '600', color: '#B3261E' }}>Outfit löschen</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Outfit löschen?"
        footer={<><SheetButton label="Abbrechen" onPress={() => setConfirmDelete(false)} /><SheetButton primary label="Löschen" onPress={remove} /></>}>
        <Text style={{ fontSize: 15, color: t.inkMuted }}>Das Outfit und seine geplanten Tage werden entfernt. Die Teile bleiben im Schrank.</Text>
      </Sheet>
      {toast.node}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontFamily: DISPLAY, fontSize: 20 },
  label: { fontSize: 13, marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  collage: { backgroundColor: '#fff', borderWidth: 1, borderRadius: 16, flexDirection: 'row', gap: 6, padding: 8 },
  ccol: { gap: 6, minWidth: 0 },
  ctile: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  x: { position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  ownWrap: { height: 36, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, justifyContent: 'center' },
  sum: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, marginTop: space.md },
  filters: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.xs },
  delete: { height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: space.xl },
});

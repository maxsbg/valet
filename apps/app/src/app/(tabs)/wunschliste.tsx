import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { WISH_TAGS, priceLabel, type WishTag } from '@valet/core';
import { Page } from '@/components/Page';
import { Header, Chip, Empty, Fab, glass, useToast } from '@/components/ui';
import { ClosetBar, type BarChip } from '@/components/ClosetBar';
import { Mosaic } from '@/components/Mosaic';
import { Sheet, OptionRow, SheetButton, SectionLabel } from '@/components/Sheet';
import { TileIcon } from '@/components/tile/TileIcons';
import { Icons } from '@/components/Icon';
import { useSession } from '@/lib/session';
import { useTheme, space, radius } from '@/lib/theme';
import { useScreen } from '@/lib/useScreen';
import { usePersisted } from '@/lib/usePersisted';
import { personKey, type Wishlist } from '@/lib/wardrobe';
import {
  WISH_SORTS, NO_WISH_FILTERS, applyWishFilters, createList, deleteList, matchesWish, ownOrder, renameList, setListOrder,
  sortWishes, wishFilterCount, type WishFilters, type WishSortId,
} from '@/lib/wishlists';

// Wunschliste (entschieden 14.11.2026, Entwurf docs/design/wunschliste/wunschliste-leiste.html):
// Leiste wie im Schrank, Chips = Listen (+ Liste am Ende), Liste gedrückt halten → Umbenennen / Reihenfolge / Löschen.
// Grail, Watchlist … sind keine Listen, nur Filter und Suche. Keine Kopfkarte mit Gesamtwert.

// Web: Seite wird beim Öffnen eines Teils abgebaut → gewählte Liste und Filter für die Rückkehr merken
const kept: { list: string | null; filters: WishFilters } = { list: null, filters: NO_WISH_FILTERS };

type SheetId = 'sort' | 'filter' | 'new' | 'menu' | 'rename' | 'order' | 'delete' | null;

export default function Wunschliste() {
  const t = useTheme();
  const scr = useScreen();
  const { wardrobe, loading, error, reload, session } = useSession();
  const toast = useToast(scr.barTop + space.sm);
  const me = wardrobe?.persons.find((p) => p.user_id === session?.user.id);

  const [list, setListState] = useState<string | null>(kept.list);
  const setList = (l: string | null) => { kept.list = l; setListState(l); };
  const [filters, setFiltersState] = useState<WishFilters>(kept.filters);
  const setFilters = (f: WishFilters) => { kept.filters = f; setFiltersState(f); };
  const [draft, setDraft] = useState<WishFilters>(NO_WISH_FILTERS);
  const [query, setQuery] = useState('');
  const [sort, setSort] = usePersisted<WishSortId>('valet.wishSort', 'added');
  const [seed, setSeed] = usePersisted<number>('valet.wishSeed', 1);
  const [sheet, setSheet] = useState<SheetId>(null);
  const [target, setTarget] = useState<Wishlist | null>(null); // Liste fürs Menü
  const [name, setName] = useState('');
  const [owner, setOwner] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const lists = wardrobe?.wishlists ?? [];
  // gewählte Liste existiert nicht mehr (gelöscht) → zurück zu „Alle“
  useEffect(() => { if (list && wardrobe && !lists.some((l) => l.id === list)) setList(null); }, [wardrobe]); // eslint-disable-line react-hooks/exhaustive-deps

  const wishes = useMemo(() => applyWishFilters((wardrobe?.items ?? []).filter((i) => i.isWish), filters), [wardrobe, filters]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of wishes) if (i.wishlistId) m.set(i.wishlistId, (m.get(i.wishlistId) ?? 0) + 1);
    return m;
  }, [wishes]);
  const shown = useMemo(
    () => sortWishes(wishes.filter((i) => (!list || i.wishlistId === list) && matchesWish(i, query)), sort, seed, ownOrder(lists, list)),
    [wishes, list, query, sort, seed, lists],
  );
  const nFilters = wishFilterCount(filters);

  // Mit Personen-Filter nur Listen dieser Person (Listen ohne Besitzer immer)
  const visibleLists = lists.filter((l) => !filters.person || !l.ownerId || l.ownerId === filters.person || l.id === list);
  const chips: BarChip[] = [
    { key: 'alle', label: 'Alle', count: wishes.length, selected: !list, onPress: () => setList(null) },
    ...visibleLists.map((l) => ({
      key: l.id, label: l.name, count: counts.get(l.id) ?? 0, selected: list === l.id,
      onPress: () => setList(list === l.id ? null : l.id),
      onLongPress: () => { setTarget(l); setSheet('menu'); },
    })),
    { key: '+', label: '+ Liste', selected: false, dashed: true, onPress: () => { setName(''); setOwner(me?.id ?? null); setSheet('new'); } },
  ];

  // Leiste klebt beim Scrollen oben (wie im Schrank)
  const [headH, setHeadH] = useState(60);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => setStuck(value >= headH));
    return () => scrollY.removeListener(id);
  }, [scrollY, headH]);
  const web = Platform.OS === 'web';
  const barW = scr.content + 2 * space.md;

  async function run(job: () => Promise<void>, fail: string) {
    setBusy(true);
    try { await job(); await reload(); setSheet(null); }
    catch (e) { toast.show(`${fail}: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }
  const addList = () => {
    if (!name.trim() || !wardrobe) return toast.show('Bitte einen Namen eingeben.');
    run(async () => { const id = await createList(wardrobe.id, name, owner); setList(id); }, 'Anlegen fehlgeschlagen');
  };
  const rename = () => {
    if (!name.trim() || !target) return toast.show('Bitte einen Namen eingeben.');
    run(() => renameList(target.id, name), 'Umbenennen fehlgeschlagen');
  };
  const remove = () => target && run(() => deleteList(target.id), 'Löschen fehlgeschlagen');
  const saveOrder = () => target && run(async () => {
    await setListOrder(target.id, order);
    setList(target.id);
    setSort('own');
  }, 'Speichern fehlgeschlagen');
  const openOrder = () => {
    if (!target) return;
    const inList = (wardrobe?.items ?? []).filter((i) => i.isWish && i.wishlistId === target.id);
    setOrder(sortWishes(inList, 'own', seed, target.itemOrder).map((i) => i.id));
    setSheet('order');
  };
  const move = (n: number, d: -1 | 1) => setOrder((o) => {
    const m = n + d;
    if (m < 0 || m >= o.length) return o;
    const a = [...o];
    [a[n], a[m]] = [a[m]!, a[n]!];
    return a;
  });
  const toggleTag = (v: WishTag) => setDraft((d) => ({ ...d, tags: d.tags.includes(v) ? d.tags.filter((x) => x !== v) : [...d.tags, v] }));
  const byId = new Map((wardrobe?.items ?? []).map((i) => [i.id, i]));
  const input = [s.input, { backgroundColor: t.surface, borderColor: t.hairline, color: t.ink }, web ? ({ outlineStyle: 'none' } as object) : null];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Page
        contentContainerStyle={{ paddingTop: scr.top, paddingBottom: scr.barTop + 90, alignItems: 'center' }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        keyboardShouldPersistTaps="handled"
        scrollY={scrollY}
        stickyHeaderIndices={web ? undefined : [1]}
      >
        <View style={{ width: barW }} onLayout={(e) => setHeadH(e.nativeEvent.layout.height)}>
          <Header />
        </View>
        <View pointerEvents="box-none" style={[{ alignSelf: 'stretch', alignItems: 'center', zIndex: 10, marginTop: -scr.top, paddingTop: scr.top },
          stuck ? [...glass(t), { borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth }] : { backgroundColor: 'transparent' },
          web ? ({ position: 'sticky', top: 0 } as object) : null]}>
          <ClosetBar width={barW} placeholder="Name, Marke, Shop …" query={query} onQuery={setQuery} chips={chips} filterActive={nFilters > 0}
            onFilter={() => { setDraft(filters); setSheet('filter'); }} onSort={() => setSheet('sort')} />
        </View>
        <View style={{ width: scr.content, marginTop: space.xs }}>
          {error ? (
            <Empty title="Laden fehlgeschlagen" text={error} />
          ) : !wardrobe ? (
            <View style={{ padding: space.xl }}>{loading ? <ActivityIndicator color={t.accent} /> : null}</View>
          ) : shown.length ? (
            <Mosaic items={shown} width={scr.content} onPress={(i) => router.push(`/teil/${i.id}`)} />
          ) : query || nFilters ? (
            <Empty title="Nichts gefunden" text="Probier einen anderen Suchbegriff oder Filter." />
          ) : list ? (
            <Empty title="Liste ist leer" text="Füge Teile über das Plus hinzu oder ordne sie beim Bearbeiten dieser Liste zu." />
          ) : (
            <Empty title="Noch keine Wünsche" text="Teile, die du dir überlegst, landen hier." />
          )}
        </View>
      </Page>
      <Fab bottom={scr.fabBottom} label="Wunsch hinzufügen" onPress={() => router.push(list ? `/neu?wunsch=1&liste=${list}` : '/neu?wunsch=1')} />
      {toast.node}

      {/* Sortieren */}
      <Sheet open={sheet === 'sort'} onClose={() => setSheet(null)} title="Sortieren"
        footer={sort === 'random' ? <SheetButton label="Neu mischen" onPress={() => { setSeed(seed + 1); setSheet(null); }} /> : undefined}>
        {WISH_SORTS.map((o, n) => (
          <OptionRow key={o.id} label={o.label} selected={sort === o.id} last={n === WISH_SORTS.length - 1} onPress={() => { setSort(o.id); setSheet(null); }} />
        ))}
      </Sheet>

      {/* Filter: Person und Kategorie */}
      <Sheet open={sheet === 'filter'} onClose={() => setSheet(null)} title="Filter"
        footer={<>
          <SheetButton label="Zurücksetzen" onPress={() => setDraft(NO_WISH_FILTERS)} />
          <SheetButton primary label="Fertig" onPress={() => { setFilters(draft); setSheet(null); }} />
        </>}>
        <SectionLabel>Person</SectionLabel>
        <View style={s.wrap}>
          <Chip label="Alle" selected={!draft.person} onPress={() => setDraft((d) => ({ ...d, person: null }))} />
          {(wardrobe?.persons ?? []).map((p) => (
            <Chip key={p.id} label={p.name} dot={t.person[personKey(p.color)]} selected={draft.person === p.id}
              onPress={() => setDraft((d) => ({ ...d, person: d.person === p.id ? null : p.id }))} />
          ))}
        </View>
        <SectionLabel>Kategorie</SectionLabel>
        <View style={s.wrap}>
          {WISH_TAGS.map((w) => {
            const on = draft.tags.includes(w.id);
            return <Chip key={w.id} label={w.label} selected={on} onPress={() => toggleTag(w.id)} icon={<TileIcon name={w.id} color={on ? t.bg : t.ink} size={15} />} />;
          })}
        </View>
      </Sheet>

      {/* Neue Liste */}
      <Sheet open={sheet === 'new'} onClose={() => setSheet(null)} title="Neue Liste"
        footer={<>
          <SheetButton label="Abbrechen" onPress={() => setSheet(null)} />
          <SheetButton primary label={busy ? 'Legt an …' : 'Anlegen'} onPress={addList} />
        </>}>
        <SectionLabel>Name</SectionLabel>
        <TextInput value={name} onChangeText={setName} placeholder="z. B. Sommer" placeholderTextColor={t.inkMuted} autoFocus
          returnKeyType="done" onSubmitEditing={addList} style={input} />
        <SectionLabel>Für</SectionLabel>
        <View style={s.wrap}>
          {(wardrobe?.persons ?? []).map((p) => (
            <Chip key={p.id} label={p.name} dot={t.person[personKey(p.color)]} selected={owner === p.id} onPress={() => setOwner(p.id)} />
          ))}
        </View>
      </Sheet>

      {/* Liste gedrückt halten */}
      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title={target?.name ?? 'Liste'}>
        <MenuRow label="Umbenennen" onPress={() => { setName(target?.name ?? ''); setSheet('rename'); }} />
        <MenuRow label="Reihenfolge ändern" onPress={openOrder} />
        <MenuRow label="Liste löschen" danger last onPress={() => setSheet('delete')} />
      </Sheet>

      <Sheet open={sheet === 'rename'} onClose={() => setSheet(null)} title="Umbenennen"
        footer={<>
          <SheetButton label="Abbrechen" onPress={() => setSheet(null)} />
          <SheetButton primary label={busy ? 'Speichert …' : 'Sichern'} onPress={rename} />
        </>}>
        <SectionLabel>Name</SectionLabel>
        <TextInput value={name} onChangeText={setName} autoFocus returnKeyType="done" onSubmitEditing={rename} style={input} />
      </Sheet>

      <Sheet open={sheet === 'delete'} onClose={() => setSheet(null)} title="Liste löschen?"
        footer={<>
          <SheetButton label="Abbrechen" onPress={() => setSheet(null)} />
          <SheetButton primary label={busy ? 'Löscht …' : 'Löschen'} onPress={remove} />
        </>}>
        <Text style={{ fontSize: 16, color: t.inkMuted, lineHeight: 22 }}>
          „{target?.name}“ wird gelöscht. Die Teile darin bleiben auf der Wunschliste und stehen weiter unter „Alle“.
        </Text>
      </Sheet>

      {/* Reihenfolge einer Liste: hoch/runter, danach Sortierung „Eigene Reihenfolge“ */}
      <Sheet open={sheet === 'order'} onClose={() => setSheet(null)} title="Reihenfolge"
        footer={<>
          <SheetButton label="Abbrechen" onPress={() => setSheet(null)} />
          <SheetButton primary label={busy ? 'Speichert …' : 'Fertig'} onPress={saveOrder} />
        </>}>
        {order.length === 0 && <Text style={{ fontSize: 16, color: t.inkMuted }}>In dieser Liste sind noch keine Teile.</Text>}
        {order.map((id, n) => {
          const it = byId.get(id);
          if (!it) return null;
          return (
            <View key={id} style={[s.orderRow, { borderBottomColor: t.hairline, borderBottomWidth: n === order.length - 1 ? 0 : StyleSheet.hairlineWidth * 2 }]}>
              <View style={s.thumb}>{it.thumb ? <Image source={{ uri: it.thumb }} style={s.thumbImg} resizeMode="contain" /> : null}</View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: t.ink }} numberOfLines={1}>{it.name}</Text>
                {!!priceLabel(it.price) && <Text style={{ fontSize: 13, color: t.inkMuted }}>{priceLabel(it.price)} €</Text>}
              </View>
              <Pressable onPress={() => move(n, -1)} disabled={n === 0} hitSlop={6} accessibilityLabel="Nach oben" style={[s.arrow, { opacity: n === 0 ? 0.25 : 1 }]}>
                <View style={{ transform: [{ rotate: '-90deg' }] }}><Icons.chevron color={t.ink} size={20} /></View>
              </Pressable>
              <Pressable onPress={() => move(n, 1)} disabled={n === order.length - 1} hitSlop={6} accessibilityLabel="Nach unten" style={[s.arrow, { opacity: n === order.length - 1 ? 0.25 : 1 }]}>
                <View style={{ transform: [{ rotate: '90deg' }] }}><Icons.chevron color={t.ink} size={20} /></View>
              </Pressable>
            </View>
          );
        })}
      </Sheet>
    </View>
  );
}

/** Zeile im Listen-Menü: nur Text, Löschen in Rot */
function MenuRow({ label, onPress, danger, last }: { label: string; onPress: () => void; danger?: boolean; last?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [s.menuRow, { borderBottomColor: t.hairline, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth * 2, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={{ fontSize: 17, color: danger ? (t.dark ? '#EF6B7E' : '#B00E28') : t.ink }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  input: { height: 48, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: space.md, fontSize: 17 },
  menuRow: { minHeight: 52, justifyContent: 'center' },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 64, paddingVertical: 6 },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: 40, height: 40 },
  arrow: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
});

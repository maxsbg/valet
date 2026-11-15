import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { WISH_TAGS, priceLabel, type WishTag } from '@valet/core';
import { Page } from '@/components/Page';
import { Header, Chip, Empty, Fab, RoundButton, TopTint, glass, useToast } from '@/components/ui';
import { WishlistCard, NewListCard, euros } from '@/components/WishlistCard';
import { ClosetBar, type BarChip } from '@/components/ClosetBar';
import { Mosaic } from '@/components/Mosaic';
import { Sheet, OptionRow, SheetButton, SectionLabel } from '@/components/Sheet';
import { TileIcon } from '@/components/tile/TileIcons';
import { Icons } from '@/components/Icon';
import { useSession } from '@/lib/session';
import { useTheme, space, radius, DISPLAY } from '@/lib/theme';
import { useScreen } from '@/lib/useScreen';
import { usePersisted } from '@/lib/usePersisted';
import { personKey, type Tile, type Wishlist } from '@/lib/wardrobe';
import {
  WISH_SORTS, NO_WISH_FILTERS, applyWishFilters, createList, deleteList, matchesWish, ownOrder, renameList, setListOrder,
  sortWishes, type WishFilters, type WishSortId,
  wishlistNav,
} from '@/lib/wishlists';

// Wunschliste (entschieden 14.11.2026, Entwurf docs/design/wunschliste/wunschlisten-karten.html):
// Übersicht = Karten (erste „Neue Liste“, dann „Alle Wünsche“, dann die Listen), Chips = Personen.
// Liste geöffnet = Kopf wie Teil-Detail (Zurück, Titel, „…“-Menü), Leiste wie im Schrank mit Kategorie-Chips
// (Symbol · Name · Anzahl), Kacheln im selben Mosaik wie im Schrank. Grail, Watchlist … sind keine Listen.

const ALL = 'alle';

// Web: Seite wird beim Öffnen eines Teils abgebaut → geöffnete Liste, Filter und Scroll-Stand der Übersicht merken
const kept: { open: string | null; filters: WishFilters; overviewY: number } = { open: null, filters: NO_WISH_FILTERS, overviewY: 0 };

type SheetId = 'sort' | 'filter' | 'new' | 'menu' | 'rename' | 'order' | 'delete' | null;

const sum = (items: Tile[]) => items.reduce((a, i) => a + (i.price ?? 0), 0);
const teile = (n: number) => (n === 1 ? '1 Teil' : `${n} Teile`);

export default function Wunschliste() {
  const t = useTheme();
  const scr = useScreen();
  const { wardrobe, loading, error, reload, session } = useSession();
  const toast = useToast(scr.barTop + space.sm);
  const me = wardrobe?.persons.find((p) => p.user_id === session?.user.id);
  const web = Platform.OS === 'web';

  // Aus der Wunschteil-Detailseite („Liste“ antippen): diese Liste geöffnet zeigen
  const [open, setOpenState] = useState<string | null>(() => {
    if (wishlistNav.open) { kept.open = wishlistNav.open; kept.filters = { ...kept.filters, tags: [] }; wishlistNav.open = null; }
    return kept.open;
  });
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

  /** Liste öffnen (Kategorie-Auswahl startet bei „Alle“) bzw. mit null zurück zur Übersicht */
  const openList = (id: string | null) => {
    if (web && id && !kept.open) kept.overviewY = window.scrollY;
    kept.open = id;
    setOpenState(id);
    setQuery('');
    if (id) setFilters({ ...kept.filters, tags: [] });
    if (web) requestAnimationFrame(() => window.scrollTo(0, id ? 0 : kept.overviewY));
  };

  const lists = wardrobe?.wishlists ?? [];
  const list = open && open !== ALL ? lists.find((l) => l.id === open) ?? null : null;
  // geöffnete Liste existiert nicht mehr (gelöscht) → zurück zur Übersicht
  useEffect(() => { if (open && open !== ALL && wardrobe && !list) openList(null); }, [wardrobe]); // eslint-disable-line react-hooks/exhaustive-deps

  // Person-Filter gilt überall, Kategorien nur in der geöffneten Liste (Chips)
  const wishes = useMemo(() => applyWishFilters((wardrobe?.items ?? []).filter((i) => i.isWish), { ...filters, tags: [] }), [wardrobe, filters]);
  const sorted = (items: Tile[], listId: string | null) => sortWishes(items, sort, seed, ownOrder(lists, listId));

  // ---------- geöffnete Liste ----------
  const inList = useMemo(
    () => wishes.filter((i) => (open === ALL || i.wishlistId === open) && matchesWish(i, query)),
    [wishes, open, query],
  );
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of inList) if (i.wishTag) m.set(i.wishTag, (m.get(i.wishTag) ?? 0) + 1);
    return m;
  }, [inList]);
  const shown = useMemo(
    () => sorted(inList.filter((i) => !filters.tags.length || (!!i.wishTag && filters.tags.includes(i.wishTag))), list?.id ?? null),
    [inList, filters.tags, sort, seed, lists, list], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const oneTag = filters.tags.length === 1 ? filters.tags[0] : null;
  const tagChips: BarChip[] = [
    { key: 'alle', label: 'Alle', count: inList.length, selected: !filters.tags.length, onPress: () => setFilters({ ...filters, tags: [] }) },
    ...WISH_TAGS.filter((w) => tagCounts.get(w.id) || filters.tags.includes(w.id)).map((w) => {
      const on = oneTag === w.id;
      return {
        key: w.id, label: w.label, count: tagCounts.get(w.id) ?? 0, selected: on,
        icon: <TileIcon name={w.id} color={on ? t.bg : t.ink} size={15} />,
        onPress: () => setFilters({ ...filters, tags: on ? [] : [w.id] }),
      };
    }),
  ];

  // ---------- Übersicht ----------
  const ownedBy = (l: Wishlist, p: string | null) => !p || !l.ownerId || l.ownerId === p;
  const personChips: BarChip[] = [
    { key: 'alle', label: 'Alle', count: lists.length, selected: !filters.person, onPress: () => setFilters({ ...filters, person: null }) },
    ...(wardrobe?.persons ?? []).map((p) => ({
      key: p.id, label: p.name, dot: t.person[personKey(p.color)], count: lists.filter((l) => l.ownerId === p.id).length,
      selected: filters.person === p.id, onPress: () => setFilters({ ...filters, person: filters.person === p.id ? null : p.id }),
    })),
  ];
  const q = query.trim().toLowerCase();
  const cards = useMemo(() => lists.filter((l) => ownedBy(l, filters.person)).map((l) => {
    const all = wishes.filter((i) => i.wishlistId === l.id);
    const hits = all.filter((i) => matchesWish(i, query));
    return { list: l, items: sorted(q && !l.name.toLowerCase().includes(q) ? hits : all, l.id), hit: !q || l.name.toLowerCase().includes(q) || hits.length > 0 };
  }).filter((c) => c.hit), [lists, wishes, filters.person, query, sort, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const allItems = useMemo(() => sorted(wishes.filter((i) => matchesWish(i, query)), null), [wishes, query, sort, seed, lists]); // eslint-disable-line react-hooks/exhaustive-deps

  const personOf = (id: string | null | undefined) => wardrobe?.persons.find((p) => p.id === id);
  const dotOf = (id: string | null | undefined) => { const p = personOf(id); return p ? t.person[personKey(p.color)] : null; };

  // Filter-Punkt an der Lupe: Übersicht = keiner (Person steckt in den Chips), Liste = Person und Mehrfach-Kategorien
  const nFilters = open ? (filters.person ? 1 : 0) + (filters.tags.length > 1 ? filters.tags.length : 0) : 0;

  // Leiste klebt beim Scrollen oben (wie im Schrank)
  const [headH, setHeadH] = useState(60);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => setStuck(value >= headH));
    return () => scrollY.removeListener(id);
  }, [scrollY, headH]);
  const barW = scr.content + 2 * space.md;
  const gap = 10;
  const cardW = Math.floor((scr.content - gap) / 2);

  async function run(job: () => Promise<void>, fail: string) {
    setBusy(true);
    try { await job(); await reload(); setSheet(null); }
    catch (e) { toast.show(`${fail}: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }
  const newList = () => { setName(''); setOwner(me?.id ?? null); setSheet('new'); };
  const addList = () => {
    if (!name.trim() || !wardrobe) return toast.show('Bitte einen Namen eingeben.');
    run(async () => { const id = await createList(wardrobe.id, name, owner); openList(id); }, 'Anlegen fehlgeschlagen');
  };
  const rename = () => {
    if (!name.trim() || !target) return toast.show('Bitte einen Namen eingeben.');
    run(() => renameList(target.id, name), 'Umbenennen fehlgeschlagen');
  };
  const remove = () => target && run(() => deleteList(target.id), 'Löschen fehlgeschlagen');
  const saveOrder = () => target && run(async () => {
    await setListOrder(target.id, order);
    setSort('own');
  }, 'Speichern fehlgeschlagen');
  const openOrder = () => {
    if (!target) return;
    const items = (wardrobe?.items ?? []).filter((i) => i.isWish && i.wishlistId === target.id);
    setOrder(sortWishes(items, 'own', seed, target.itemOrder).map((i) => i.id));
    setSheet('order');
  };
  const menu = (l: Wishlist) => { setTarget(l); setSheet('menu'); };
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

  // Karten paarweise in Zeilen (gleiche Höhe je Zeile, damit „Neue Liste“ so hoch ist wie ihre Nachbarin)
  const tiles: React.ReactNode[] = [
    <NewListCard key="new" width={cardW} onPress={newList} />,
    ...(!q || allItems.length ? [
      <WishlistCard key={ALL} width={cardW} title="Alle Wünsche" sub={`${teile(allItems.length)} · ${euros(sum(allItems))}`} items={allItems}
        onPress={() => openList(ALL)} />,
    ] : []),
    ...cards.map(({ list: l, items }) => (
      <WishlistCard key={l.id} width={cardW} title={l.name} dot={dotOf(l.ownerId)} sub={`${teile(items.length)} · ${euros(sum(items))}`} items={items}
        onPress={() => openList(l.id)} onLongPress={() => menu(l)} />
    )),
  ];
  const rows: React.ReactNode[][] = [];
  for (let n = 0; n < tiles.length; n += 2) rows.push(tiles.slice(n, n + 2));

  const owner0 = personOf(list?.ownerId);
  const detailSub = [owner0?.name, teile(inList.length), euros(sum(inList))].filter(Boolean).join(' · ');

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
          {open ? (
            <View style={{ paddingHorizontal: space.md }}>
              {!stuck && <TopTint />}
              <View style={s.top}>
                <RoundButton label="Zurück" onPress={() => openList(null)}><Icons.back color={t.ink} /></RoundButton>
                {list && <RoundButton label="Liste bearbeiten" onPress={() => menu(list)}><Icons.more color={t.ink} /></RoundButton>}
              </View>
              <Text style={[s.title, { color: t.ink }]} numberOfLines={2}>{list?.name ?? 'Alle Wünsche'}</Text>
              <View style={s.subLine}>
                {owner0 && <View style={[s.dot, { backgroundColor: t.person[personKey(owner0.color)] }]} />}
                <Text style={{ fontSize: 14, color: t.inkMuted }}>{detailSub}</Text>
              </View>
            </View>
          ) : (
            <Header tint={!stuck} />
          )}
        </View>
        <View pointerEvents="box-none" style={[{ alignSelf: 'stretch', alignItems: 'center', zIndex: 10, marginTop: -scr.top, paddingTop: scr.top },
          stuck ? [...glass(t), { borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth }] : { backgroundColor: 'transparent' },
          web ? ({ position: 'sticky', top: 0 } as object) : null]}>
          <ClosetBar key={open ? 'liste' : 'uebersicht'} width={barW} placeholder={open ? 'Name, Marke, Shop …' : 'Liste oder Teil suchen …'} query={query} onQuery={setQuery}
            chips={open ? tagChips : personChips} filterActive={nFilters > 0}
            onFilter={() => { setDraft(filters); setSheet('filter'); }} onSort={() => setSheet('sort')} />
        </View>
        <View style={{ width: scr.content, marginTop: space.xs }}>
          {error ? (
            <Empty title="Laden fehlgeschlagen" text={error} />
          ) : !wardrobe ? (
            <View style={{ padding: space.xl }}>{loading ? <ActivityIndicator color={t.accent} /> : null}</View>
          ) : !open ? (
            <View style={{ gap }}>
              {rows.map((r, n) => <View key={n} style={{ flexDirection: 'row', gap, alignItems: 'stretch' }}>{r}</View>)}
              {q && rows.length === 1 && <Empty title="Nichts gefunden" text="Probier einen anderen Suchbegriff." />}
            </View>
          ) : shown.length ? (
            <Mosaic items={shown} width={scr.content} onPress={(i) => router.push(`/teil/${i.id}`)} />
          ) : query || filters.tags.length || filters.person ? (
            <Empty title="Nichts gefunden" text="Probier einen anderen Suchbegriff oder Filter." />
          ) : list ? (
            <Empty title="Liste ist leer" text="Füge Teile über das Plus hinzu oder ordne sie beim Bearbeiten dieser Liste zu." />
          ) : (
            <Empty title="Noch keine Wünsche" text="Teile, die du dir überlegst, landen hier." />
          )}
        </View>
      </Page>
      <Fab bottom={scr.fabBottom} label="Wunsch hinzufügen" onPress={() => router.push(list ? `/neu?wunsch=1&liste=${list.id}` : '/neu?wunsch=1')} />
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
        {/* Kategorien nur in einer geöffneten Liste (dort auch als Chips) */}
        {!!open && <>
          <SectionLabel>Kategorie</SectionLabel>
          <View style={s.wrap}>
            {WISH_TAGS.map((w) => {
              const on = draft.tags.includes(w.id);
              return <Chip key={w.id} label={w.label} selected={on} onPress={() => toggleTag(w.id)} icon={<TileIcon name={w.id} color={on ? t.bg : t.ink} size={15} />} />;
            })}
          </View>
        </>}
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

      {/* Listen-Menü: „…“ in der Liste oder Karte gedrückt halten */}
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
          „{target?.name}“ wird gelöscht. Die Teile darin bleiben auf der Wunschliste und stehen weiter unter „Alle Wünsche“.
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
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.xs },
  title: { fontFamily: DISPLAY, fontSize: 30, lineHeight: 36, marginTop: space.xxs },
  subLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: space.xxs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  input: { height: 48, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: space.md, fontSize: 17 },
  menuRow: { minHeight: 52, justifyContent: 'center' },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 64, paddingVertical: 6 },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: 40, height: 40 },
  arrow: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
});

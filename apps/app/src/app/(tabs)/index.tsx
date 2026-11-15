import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES, lentDue } from '@valet/core';
import { Header, Chip, Fab, Empty, PageEnd, glass } from '@/components/ui';
import { ClosetBar } from '@/components/ClosetBar';
import { Page } from '@/components/Page';
import { Mosaic } from '@/components/Mosaic';
import { useSession } from '@/lib/session';
import { useTheme, space } from '@/lib/theme';
import { useScreen } from '@/lib/useScreen';
import { Sheet, OptionRow, SheetButton, SectionLabel } from '@/components/Sheet';
import { SORTS, sortTiles, applyFilters, filterCount, NO_FILTERS, SEASON_FILTERS, type SortId, type Filters } from '@/lib/sort';
import { personKey, todayLocal } from '@/lib/wardrobe';
import { CATEGORY_ICON } from '@valet/ui';
import { usePersisted } from '@/lib/usePersisted';
import { Icon } from '@/components/Icon';

const kept: { cat: string | null; filters: Filters } = { cat: null, filters: NO_FILTERS };

export default function Schrank() {
  const t = useTheme();
  const scr = useScreen();
  const { wardrobe, loading, error, reload, session } = useSession();
  // Web: Seite wird beim Öffnen eines Teils abgebaut → Kategorie und Filter für die Rückkehr merken
  const [cat, setCatState] = useState<string | null>(kept.cat);
  const setCat = (c: string | null) => { kept.cat = c; setCatState(c); };
  const [query, setQuery] = useState('');
  const [headH, setHeadH] = useState(60);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [sort, setSort] = usePersisted<SortId>('valet.sort', 'random');
  const [seed, setSeed] = usePersisted<number>('valet.seed', 1);
  const [filters, setFiltersState] = useState<Filters>(kept.filters);
  const setFilters = (f: Filters) => { kept.filters = f; setFiltersState(f); };
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [sheet, setSheet] = useState<'sort' | 'filter' | null>(null);

  const me = wardrobe?.persons.find((p) => p.user_id === session?.user.id);
  const inCloset = useMemo(
    () => sortTiles(applyFilters((wardrobe?.items ?? []).filter((i) => !i.isWish), filters), sort, seed, me?.item_order ?? []),
    [wardrobe, me, filters, sort, seed],
  );
  const nFilters = filterCount(filters);
  const today = todayLocal();
  const due = useMemo(() => (wardrobe?.items ?? []).filter((i) => !i.isWish && lentDue({ status: i.status, status_until: i.statusUntil }, today)), [wardrobe, today]);
  const [hideDue, setHideDue] = useState(false);
  const toggleSeason = (v: string) =>
    setDraft((d) => ({ ...d, seasons: d.seasons.includes(v) ? d.seasons.filter((x) => x !== v) : [...d.seasons, v] }));

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of inCloset) m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return m;
  }, [inCloset]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inCloset.filter((i) => (!cat || i.category === cat) &&
      (!q || [i.name, i.brand, i.color, i.category, i.subcategory, i.type, ...i.colors].some((f) => f?.toLowerCase().includes(q))));
  }, [inCloset, cat, query]);

  const barW = scr.content + 2 * space.md;
  const chips = [
    { key: 'alle', label: 'Alle', count: inCloset.length, selected: !cat, onPress: () => setCat(null) },
    ...CATEGORIES.filter((c) => counts.get(c)).map((c) => ({
      key: c, label: c, count: counts.get(c), selected: cat === c, onPress: () => setCat(cat === c ? null : c),
      // Symbol wie bei den Anlass-Chips im Outfits-Tab: ClosetBar faltet Chips mit Symbol (zu: Symbol + Anzahl)
      icon: CATEGORY_ICON[c] ? <Icon name={CATEGORY_ICON[c]!} size="chip" color={cat === c ? t.bg : t.ink} /> : undefined,
    })),
  ];
  // Milchglas erst, wenn die Leiste oben klebt (Kopfzeile weggescrollt)
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => setStuck(value >= headH));
    return () => scrollY.removeListener(id);
  }, [scrollY, headH]);
  const web = Platform.OS === 'web';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Page
        contentContainerStyle={{ paddingTop: scr.top, paddingBottom: scr.barTop + space.lg, alignItems: 'center' }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        keyboardShouldPersistTaps="handled"
        scrollY={scrollY}
        stickyHeaderIndices={web ? undefined : [1]}
      >
        <View style={{ width: barW }} onLayout={(e) => setHeadH(e.nativeEvent.layout.height)}>
          <Header title="Schrank" tint={!stuck} />
        </View>
        {/* klebt beim Scrollen oben; reicht bis unter die Statusleiste, Kacheln laufen darunter durch.
            Hintergrund sitzt direkt auf der klebenden Fläche: Safari tönt danach den Bereich hinter der Uhr
            (oben durchsichtig → Seitenfarbe, geklebt → Milchglas). Weichzeichner nur beim Kleben, sonst würde er den Kopf verwischen. */}
        <View pointerEvents="box-none" style={[{ alignSelf: 'stretch', alignItems: 'center', zIndex: 10, marginTop: -scr.top, paddingTop: scr.top },
          stuck ? [...glass(t), { borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth }] : { backgroundColor: 'transparent' },
          web ? ({ position: 'sticky', top: 0 } as object) : null]}>
          <ClosetBar width={barW} query={query} onQuery={setQuery} chips={chips} filterActive={nFilters > 0}
            onFilter={() => { setDraft(filters); setSheet('filter'); }} onSort={() => setSheet('sort')} />
        </View>
        <View style={{ width: scr.content, marginTop: space.xs }}>
          {error ? (
            <Empty title="Laden fehlgeschlagen" text={error} />
          ) : !wardrobe ? (
            <View style={{ padding: space.xl }}>{loading ? <ActivityIndicator color={t.accent} /> : <Empty title="Kein Schrank" text="Für dein Konto gibt es noch keinen Kleiderschrank." />}</View>
          ) : due.length > 0 && !query && !cat && nFilters === 0 && !hideDue ? (
            <>
              {/* Rückgabe fällig (Hinweis in der App; Push-Nachricht kommt später) */}
              <Pressable accessibilityRole="button" onPress={() => router.push(`/teil/${due[0]!.id}`)} onLongPress={() => setHideDue(true)}
                style={({ pressed }) => [s.due, { backgroundColor: t.surface, borderColor: t.accent, opacity: pressed ? 0.8 : 1 }]}>
                <Icon name="lent" size="row" color={t.accent} />
                <Text style={{ flex: 1, fontSize: 15, color: t.ink }}>
                  {due.length === 1 ? <>Rückgabe fällig: <Text style={{ fontWeight: '600' }}>{due[0]!.name}</Text></> : `${due.length} verliehene Teile sind fällig`}
                </Text>
              </Pressable>
              <Mosaic items={shown} width={scr.content} onPress={(i) => router.push(`/teil/${i.id}`)} />
            </>
          ) : shown.length === 0 ? (
            <Empty title="Nichts gefunden" text="Probier einen anderen Suchbegriff oder Filter." />
          ) : (
            <Mosaic items={shown} width={scr.content} onPress={(i) => router.push(`/teil/${i.id}`)} />
          )}
        </View>
        <PageEnd />
      </Page>
      <Fab bottom={scr.fabBottom} onPress={() => router.push('/neu')} />
      <Sheet open={sheet === 'sort'} onClose={() => setSheet(null)} title="Sortieren"
        footer={sort === 'random' ? <SheetButton label="Neu mischen" onPress={() => { setSeed(seed + 1); setSheet(null); }} /> : undefined}>
        {SORTS.map((o, n) => (
          <OptionRow key={o.id} label={o.label} selected={sort === o.id} last={n === SORTS.length - 1} onPress={() => { setSort(o.id); setSheet(null); }} />
        ))}
      </Sheet>
      <Sheet open={sheet === 'filter'} onClose={() => setSheet(null)} title="Filter"
        footer={<>
          <SheetButton label="Zurücksetzen" onPress={() => setDraft(NO_FILTERS)} />
          <SheetButton primary label="Fertig" onPress={() => { setFilters(draft); setSheet(null); }} />
        </>}>
        <SectionLabel>Person</SectionLabel>
        <View style={s.wrap}>
          <Chip label="Alle" selected={!draft.person} onPress={() => setDraft((d) => ({ ...d, person: null }))} />
          {(wardrobe?.persons ?? []).map((p) => (
            <Chip key={p.id} label={p.name} person={p} selected={draft.person === p.id}
              onPress={() => setDraft((d) => ({ ...d, person: d.person === p.id ? null : p.id }))} />
          ))}
        </View>
        <SectionLabel>Saison</SectionLabel>
        <View style={s.wrap}>{SEASON_FILTERS.map((f) => <Chip key={f} label={f} selected={draft.seasons.includes(f)} onPress={() => toggleSeason(f)} />)}</View>
        <SectionLabel>Status</SectionLabel>
        <View style={s.wrap}>
          <Chip label="Aussortiert (zum Verkauf)" selected={!!draft.out} onPress={() => setDraft((d) => ({ ...d, out: !d.out }))} />
          <Chip label="Verkauft" selected={!!draft.sold} onPress={() => setDraft((d) => ({ ...d, sold: !d.sold }))} />
        </View>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  due: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});

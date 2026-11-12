import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '@valet/core';
import { Header, Chip, SearchField, TodayBar, Fab, RoundButton, Empty, useToast } from '@/components/ui';
import { Icons } from '@/components/Icon';
import { Mosaic } from '@/components/Mosaic';
import { useSession } from '@/lib/session';
import { useTheme, space } from '@/lib/theme';
import { useScreen } from '@/lib/useScreen';
import { personKey, type Tile } from '@/lib/wardrobe';
import { Sheet, OptionRow, SheetButton, SectionLabel } from '@/components/Sheet';
import { SORTS, sortTiles, applyFilters, filterCount, NO_FILTERS, STATUS_FILTERS, SEASON_FILTERS, STYLE_FILTERS, type SortId, type Filters } from '@/lib/sort';
import { usePersisted } from '@/lib/usePersisted';

export default function Schrank() {
  const t = useTheme();
  const scr = useScreen();
  const { wardrobe, loading, error, reload, session } = useSession();
  const [cat, setCat] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const toast = useToast(scr.barTop + space.sm);
  const [sort, setSort] = usePersisted<SortId>('valet.sort', 'random');
  const [seed, setSeed] = usePersisted<number>('valet.seed', 1);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [sheet, setSheet] = useState<'sort' | 'filter' | null>(null);

  const me = wardrobe?.persons.find((p) => p.user_id === session?.user.id);
  const inCloset = useMemo(
    () => sortTiles(applyFilters((wardrobe?.items ?? []).filter((i) => !i.isWish), filters), sort, seed, me?.item_order ?? []),
    [wardrobe, me, filters, sort, seed],
  );
  const today = useMemo(() => {
    const ids = new Set(wardrobe?.today ?? []);
    return (wardrobe?.items ?? []).filter((i) => ids.has(i.id));
  }, [wardrobe]);
  const nFilters = filterCount(filters);
  const toggle = (k: keyof Filters, v: string) =>
    setDraft((d) => ({ ...d, [k]: d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v] }));

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of inCloset) m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return m;
  }, [inCloset]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inCloset.filter((i) => (!cat || i.category === cat) &&
      (!q || [i.name, i.brand, i.color].some((f) => f?.toLowerCase().includes(q))));
  }, [inCloset, cat, query]);

  const persons = new Map((wardrobe?.persons ?? []).map((p) => [p.id, p]));
  const ownerOf = (i: Tile) => {
    const p = i.ownerId ? persons.get(i.ownerId) : null;
    return p ? { letter: p.name.slice(0, 1).toUpperCase(), color: personKey(p.color) } : null;
  };
  const soon = () => toast.show('Kommt in einem der nächsten Schritte.');

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: scr.top, paddingBottom: scr.barTop + 90, alignItems: 'center' }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        stickyHeaderIndices={[1]}
      >
        <View style={{ width: scr.content + 2 * space.md }}>
          <Header onHelp={soon} onSettings={soon} />
          <View style={{ paddingHorizontal: space.md, paddingBottom: space.sm }}>
            <TodayBar items={today} onPress={soon} />
          </View>
        </View>
        <View style={[s.filters, { backgroundColor: t.bg, width: scr.content + 2 * space.md }]}>
          {searching ? (
            <SearchField value={query} onChange={setQuery} onClose={() => { setSearching(false); setQuery(''); }} />
          ) : (
            <>
              <RoundButton label="Suchen" onPress={() => setSearching(true)}><Icons.search color={t.ink} /></RoundButton>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: space.xs, paddingRight: space.xs }}>
                <Chip label="Filter" icon={<Icons.filter color={nFilters ? t.bg : t.ink} />} count={nFilters || undefined} selected={nFilters > 0}
                  onPress={() => { setDraft(filters); setSheet('filter'); }} />
                <Chip label="Alle" count={inCloset.length} selected={!cat} onPress={() => setCat(null)} />
                {CATEGORIES.filter((c) => counts.get(c.id)).map((c) => (
                  <Chip key={c.id} label={c.label} count={counts.get(c.id)} selected={cat === c.id} onPress={() => setCat(cat === c.id ? null : c.id)} />
                ))}
              </ScrollView>
              <RoundButton label="Sortieren" onPress={() => setSheet('sort')}><Icons.sort color={t.ink} /></RoundButton>
            </>
          )}
        </View>
        <View style={{ width: scr.content, marginTop: space.xs }}>
          {error ? (
            <Empty title="Laden fehlgeschlagen" text={error} />
          ) : !wardrobe ? (
            <View style={{ padding: space.xl }}>{loading ? <ActivityIndicator color={t.accent} /> : <Empty title="Kein Schrank" text="Für dein Konto gibt es noch keinen Kleiderschrank." />}</View>
          ) : shown.length === 0 ? (
            <Empty title="Nichts gefunden" text="Probier einen anderen Suchbegriff oder Filter." />
          ) : (
            <Mosaic items={shown} width={scr.content} ownerOf={ownerOf} onPress={(i) => router.push(`/teil/${i.id}`)} />
          )}
        </View>
        {wardrobe && (
          <Pressable onPress={() => import('@/lib/supabase').then((m) => m.supabase.auth.signOut())} style={{ marginTop: space.xl }}>
            <Text style={{ color: t.inkMuted, fontSize: 13 }}>Abmelden</Text>
          </Pressable>
        )}
      </ScrollView>
      <Fab bottom={scr.fabBottom} onPress={soon} />
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
        <SectionLabel>Status</SectionLabel>
        <View style={s.wrap}>{STATUS_FILTERS.map((f) => <Chip key={f.id} label={f.label} selected={draft.status.includes(f.id)} onPress={() => toggle('status', f.id)} />)}</View>
        <SectionLabel>Saison</SectionLabel>
        <View style={s.wrap}>{SEASON_FILTERS.map((f) => <Chip key={f} label={f} selected={draft.seasons.includes(f)} onPress={() => toggle('seasons', f)} />)}</View>
        <SectionLabel>Stil</SectionLabel>
        <View style={s.wrap}>{STYLE_FILTERS.map((f) => <Chip key={f} label={f} selected={draft.styles.includes(f)} onPress={() => toggle('styles', f)} />)}</View>
      </Sheet>
      {toast.node}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  filters: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.xs },
});

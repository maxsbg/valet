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

const GONE = new Set(['out', 'sold']);

export default function Schrank() {
  const t = useTheme();
  const scr = useScreen();
  const { wardrobe, loading, error, reload, session } = useSession();
  const [cat, setCat] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const toast = useToast(scr.barTop + space.sm);

  const me = wardrobe?.persons.find((p) => p.user_id === session?.user.id);
  const inCloset = useMemo(() => {
    const all = (wardrobe?.items ?? []).filter((i) => !i.isWish && !(i.status && GONE.has(i.status)));
    // Reihenfolge: eigene Reihenfolge der Person, sonst neueste zuerst
    const order = new Map((me?.item_order ?? []).map((id, n) => [id, n]));
    return all.sort((a, b) => (order.get(a.id) ?? 1e6) - (order.get(b.id) ?? 1e6) || b.createdAt.localeCompare(a.createdAt));
  }, [wardrobe, me]);

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
            <TodayBar text="noch nichts geplant" action="Outfit planen" onPress={soon} />
          </View>
        </View>
        <View style={[s.filters, { backgroundColor: t.bg, width: scr.content + 2 * space.md }]}>
          {searching ? (
            <SearchField value={query} onChange={setQuery} onClose={() => { setSearching(false); setQuery(''); }} />
          ) : (
            <>
              <RoundButton label="Suchen" onPress={() => setSearching(true)}><Icons.search color={t.ink} /></RoundButton>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs, paddingRight: space.md }}>
                <Chip label="Alle" count={inCloset.length} selected={!cat} onPress={() => setCat(null)} />
                {CATEGORIES.filter((c) => counts.get(c.id)).map((c) => (
                  <Chip key={c.id} label={c.label} count={counts.get(c.id)} selected={cat === c.id} onPress={() => setCat(cat === c.id ? null : c.id)} />
                ))}
              </ScrollView>
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
            <Mosaic items={shown} width={scr.content} ownerOf={ownerOf} onPress={(i) => toast.show(`${i.name}${i.brand ? ' · ' + i.brand : ''}`)} />
          )}
        </View>
        {wardrobe && (
          <Pressable onPress={() => import('@/lib/supabase').then((m) => m.supabase.auth.signOut())} style={{ marginTop: space.xl }}>
            <Text style={{ color: t.inkMuted, fontSize: 13 }}>Abmelden</Text>
          </Pressable>
        )}
      </ScrollView>
      <Fab bottom={scr.fabBottom} onPress={soon} />
      {toast.node}
    </View>
  );
}

const s = StyleSheet.create({
  filters: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.xs },
});

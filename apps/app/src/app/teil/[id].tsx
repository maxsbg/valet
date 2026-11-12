import { Page } from '@/components/Page';
import { useBottomInset } from '@/lib/bottomInset';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { categoryLabel, formatEur } from '@valet/core';
import { Icons, Silhouette } from '@/components/Icon';
import { RoundButton, Empty, useToast } from '@/components/ui';
import { Sheet, OptionRow, SheetButton } from '@/components/Sheet';
import { useSession } from '@/lib/session';
import { useTheme, DISPLAY, space, radius, tile } from '@/lib/theme';
import { loadItem, wornDays, setWornToday, setStatus, type ItemDetail, type ItemRow } from '@/lib/item';
import { personKey, todayLocal } from '@/lib/wardrobe';

const STATUS_OPTIONS: { id: ItemRow['status']; label: string; text: string }[] = [
  { id: null, label: 'Im Schrank', text: 'Im Schrank' },
  { id: 'wash', label: 'Wäsche', text: 'In der Wäsche' },
  { id: 'repair', label: 'Reparatur', text: 'In Reparatur' },
  { id: 'lent', label: 'Verliehen', text: 'Verliehen' },
  { id: 'out', label: 'Aussortiert', text: 'Aussortiert' },
  { id: 'sold', label: 'Verkauft', text: 'Verkauft' },
];
const PERSON = { pink: '#D9668E', red: '#C8102E' } as const;
const de = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
const ago = (iso: string) => {
  const n = Math.round((new Date(todayLocal()).getTime() - new Date(iso).getTime()) / 864e5);
  return n <= 0 ? 'heute' : n === 1 ? 'gestern' : `vor ${n} Tagen`;
};

export default function Teil() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { wardrobe, session, patch, setToday } = useSession();
  const [d, setD] = useState<ItemDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [lentTo, setLentTo] = useState('');
  const [pickLent, setPickLent] = useState(false);
  const [more, setMore] = useState(false);
  const bottom = useBottomInset();
  const toast = useToast(bottom + space.lg);

  const load = useCallback(() => { loadItem(id).then(setD).catch((e) => setErr(e.message ?? String(e))); }, [id]);
  useFocusEffect(load);

  const tileInfo = wardrobe?.items.find((i) => i.id === id);
  const me = wardrobe?.persons.find((p) => p.user_id === session?.user.id);
  const owner = wardrobe?.persons.find((p) => p.id === d?.item.owner_id);
  const today = todayLocal();
  const days = useMemo(() => (d ? wornDays(d) : []), [d]);
  const wornToday = days.includes(today);
  const setMates = useMemo(() => (d?.item.set_id ? (wardrobe?.items ?? []).filter((i) => i.setId === d.item.set_id && i.id !== id) : []), [d, wardrobe, id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (err) return <View style={[s.page, { backgroundColor: t.bg, paddingTop: insets.top }]}><TopBar onBack={back} /><Empty title="Nicht gefunden" text={err} /></View>;
  if (!d) return <View style={[s.page, { backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={t.accent} /></View>;

  const it = d.item;
  const paid = it.price_paid != null ? it.price_paid * (it.qty || 1) : null;
  const cpw = paid && days.length ? paid / days.length : null;
  const hex = tileInfo?.hex ?? '#d8d2c8';
  const st = STATUS_OPTIONS.find((o) => o.id === it.status) ?? STATUS_OPTIONS[0];

  async function toggleWorn() {
    setBusy(true);
    try {
      await setWornToday(id, me?.id ?? null, !wornToday);
      setD((x) => x && { ...x, wears: wornToday ? x.wears.filter((w) => w !== today) : [...x.wears, today] });
      const ids = new Set(wardrobe?.today ?? []);
      if (wornToday) ids.delete(id); else ids.add(id);
      setToday([...ids]);
      toast.show(wornToday ? 'Heute getragen entfernt.' : 'Als heute getragen eingetragen.');
    } catch (e) { toast.show('Speichern fehlgeschlagen: ' + (e as Error).message); }
    finally { setBusy(false); }
  }

  async function changeStatus(next: ItemRow['status'], to?: string) {
    setSheet(false); setPickLent(false);
    try {
      await setStatus(id, next, to);
      setD((x) => x && { ...x, item: { ...x.item, status: next, status_at: next ? today : null, lent_to: next === 'lent' ? to ?? null : null } });
      patch(id, { status: next });
      toast.show(next ? `Status: ${STATUS_OPTIONS.find((o) => o.id === next)!.label}` : 'Wieder im Schrank.');
    } catch (e) { toast.show('Speichern fehlgeschlagen: ' + (e as Error).message); }
  }

  const info: [string, string | null | undefined][] = [
    ['Kategorie', categoryLabel(it.category)],
    ['Farbe', [it.color, it.alt_color].filter(Boolean).join(' · ')],
    ['Größe', it.size],
    ['Material', it.material],
    ['Saison', it.seasons?.join(', ')],
    ['Stil', it.style],
    ['Gekauft', it.purchase_date && de(it.purchase_date)],
    ['Shop', it.shop],
    ['Listenpreis', it.list_price != null ? formatEur(it.list_price) : null],
    ['Anzahl', it.qty && it.qty > 1 ? String(it.qty) : null],
    ['Notizen', it.notes],
  ];

  return (
    <View style={[s.page, { backgroundColor: t.bg }]}>
      <Page contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottom + space.xxl, alignItems: 'center' }}>
        <View style={s.col}>
          <TopBar onBack={back} onEdit={() => router.push(`/bearbeiten/${id}`)} />

          {/* Bild */}
          <View style={[s.hero, { boxShadow: `inset 0 0 28px 4px ${hex}73, 0 2px 8px rgba(42,26,29,0.10)` }]}>
            <View style={{ width: '70%', height: '80%', alignItems: 'center', justifyContent: 'center' }}><Silhouette category={it.category} color={hex} /></View>
            {owner && (
              <View style={s.ownerBadge}><Text style={{ fontFamily: DISPLAY, fontSize: 20, color: PERSON[personKey(owner.color)] }}>{owner.name.slice(0, 1)}</Text></View>
            )}
          </View>

          {/* Titel */}
          <View style={{ gap: 4, marginTop: space.md }}>
            <Text style={[s.title, { color: t.ink }]}>{it.name}</Text>
            <Text style={{ fontSize: 15, color: t.inkMuted }}>
              {[it.brand, paid != null ? formatEur(paid) : null, owner ? `gehört ${owner.name}` : null].filter(Boolean).join(' · ')}
            </Text>
          </View>

          {it.status && (
            <View style={[s.statusBar, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              <View style={[s.dot, { backgroundColor: t.status[it.status] }]} />
              <Text style={{ flex: 1, fontSize: 15, color: t.ink }}>
                {st.text}{it.status === 'lent' && it.lent_to ? ` an ${it.lent_to}` : ''}{it.status_at ? ` seit ${de(it.status_at)}` : ''}
              </Text>
              {it.status !== 'out' && it.status !== 'sold' && (
                <Pressable onPress={() => changeStatus(null)} hitSlop={8}><Text style={{ fontSize: 15, fontWeight: '600', color: t.actionText }}>Zurück</Text></Pressable>
              )}
            </View>
          )}

          {!it.is_wish && <>
          {/* Zahlen */}
          <View style={[s.stats, { backgroundColor: t.surface, borderColor: t.hairline }]}>
            <Stat label="getragen" value={`${days.length}×`} />
            <View style={[s.vline, { backgroundColor: t.hairline }]} />
            <Stat label="pro Tragen" value={cpw != null ? formatEur(cpw) : '–'} />
            <View style={[s.vline, { backgroundColor: t.hairline }]} />
            <Stat label="zuletzt" value={days.length ? ago(days[days.length - 1]) : 'nie'} />
          </View>

          {/* Aktionen */}
          <View style={s.actions}>
            <Action label={wornToday ? 'Heute getragen' : 'Heute tragen'} active={wornToday} disabled={busy} onPress={toggleWorn}
              icon={(c) => <Icons.check color={c} />} />
            <Action label="Outfit damit" onPress={() => toast.show('Kommt mit der Outfit-Seite.')} icon={(c) => <Icons.layers color={c} size={22} />} />
            <Action label="Reservieren" onPress={() => toast.show('Kommt mit der Outfit-Seite.')} icon={(c) => <Icons.calendar color={c} />} />
            <Action label="Status" active={!!it.status} onPress={() => { setLentTo(it.lent_to ?? ''); setSheet(true); }} icon={(c) => <Icons.closet color={c} />} />
          </View>

          </>}

          {/* Set */}
          {setMates.length > 0 && (
            <Section title={it.set_name ? `Set · ${it.set_name}` : 'Set'}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
                {setMates.map((m) => (
                  <Pressable key={m.id} onPress={() => router.push(`/teil/${m.id}`)} accessibilityLabel={m.name}
                    style={[s.mini, { boxShadow: `inset 0 0 14px 2px ${(m.hex ?? '#d8d2c8')}73, 0 1px 4px rgba(42,26,29,0.10)` }]}>
                    <Silhouette category={m.category} color={m.hex ?? '#8e8e93'} />
                  </Pressable>
                ))}
              </ScrollView>
            </Section>
          )}

          {/* Outfits */}
          <Section title={d.outfits.length ? `In ${d.outfits.length} ${d.outfits.length === 1 ? 'Outfit' : 'Outfits'}` : 'In noch keinem Outfit'}>
            {d.outfits.length > 0 && (
              <View style={[s.list, { backgroundColor: t.surface, borderColor: t.hairline }]}>
                {d.outfits.map((o, n) => (
                  <View key={o.id} style={[s.listRow, n > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
                    <Text style={{ flex: 1, fontSize: 16, color: t.ink }} numberOfLines={1}>{o.name || 'Outfit'}</Text>
                    {!!o.occasions?.length && <Text style={{ fontSize: 13, color: t.inkMuted }}>{o.occasions.join(', ')}</Text>}
                  </View>
                ))}
              </View>
            )}
          </Section>

          {/* Mehr Infos */}
          <Pressable onPress={() => setMore(!more)} style={s.moreHead} accessibilityRole="button" accessibilityState={{ expanded: more }}>
            <Text style={[s.sectionTitle, { color: t.ink, marginBottom: 0 }]}>Mehr Infos</Text>
            <View style={{ transform: [{ rotate: more ? '90deg' : '0deg' }] }}><Icons.chevron color={t.inkMuted} /></View>
          </Pressable>
          {more && (
            <View style={[s.list, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              {info.filter(([, v]) => v).map(([k, v], n) => (
                <View key={k} style={[s.listRow, n > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
                  <Text style={{ width: 110, fontSize: 15, color: t.inkMuted }}>{k}</Text>
                  <Text style={{ flex: 1, fontSize: 15, color: t.ink }}>{v}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Page>

      <Sheet open={sheet} onClose={() => { setSheet(false); setPickLent(false); }} title={pickLent ? 'An wen verliehen?' : 'Status'}
        footer={pickLent ? <>
          <SheetButton label="Zurück" onPress={() => setPickLent(false)} />
          <SheetButton primary label="Speichern" onPress={() => changeStatus('lent', lentTo.trim() || undefined)} />
        </> : undefined}>
        {pickLent ? (
          <TextInput autoFocus value={lentTo} onChangeText={setLentTo} placeholder="Name (optional)" placeholderTextColor={t.inkMuted}
            style={[s.input, { backgroundColor: t.surface, borderColor: t.hairline, color: t.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} />
        ) : (
          STATUS_OPTIONS.map((o, n) => (
            <OptionRow key={o.label} label={o.label} selected={it.status === o.id} last={n === STATUS_OPTIONS.length - 1}
              onPress={() => (o.id === 'lent' ? setPickLent(true) : changeStatus(o.id))} />
          ))
        )}
      </Sheet>
      {toast.node}
    </View>
  );
}

function TopBar({ onBack, onEdit }: { onBack: () => void; onEdit?: () => void }) {
  const t = useTheme();
  return (
    <View style={s.top}>
      <RoundButton label="Zurück" onPress={onBack}><Icons.back color={t.ink} /></RoundButton>
      {onEdit && <RoundButton label="Bearbeiten" onPress={onEdit}><Icons.pencil color={t.ink} /></RoundButton>}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: DISPLAY, fontSize: 22, color: t.ink }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={{ fontSize: 12, color: t.inkMuted }}>{label}</Text>
    </View>
  );
}

function Action({ label, icon, onPress, active, disabled }: { label: string; icon: (c: string) => React.ReactNode; onPress: () => void; active?: boolean; disabled?: boolean }) {
  const t = useTheme();
  const bg = active ? (t.dark ? t.accent : '#722638') : t.surface;
  const fg = active ? (t.dark ? t.onAccent : '#fff') : t.ink;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: active, disabled }}
      style={({ pressed }) => [{ flex: 1, alignItems: 'center', gap: 6, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
      <View style={[s.actBtn, { backgroundColor: bg, borderColor: active ? bg : t.hairline }]}>{icon(fg)}</View>
      <Text style={{ fontSize: 12, color: t.ink, textAlign: 'center' }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: space.lg }}>
      <Text style={[s.sectionTitle, { color: t.ink }]}>{title}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  col: { width: '100%', maxWidth: 520, paddingHorizontal: space.md },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.xs },
  hero: { height: 340, backgroundColor: '#fff', borderRadius: tile.radius, alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
  ownerBadge: { position: 'absolute', right: 12, bottom: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(42,26,29,0.16)' },
  title: { fontFamily: DISPLAY, fontSize: 30, lineHeight: 36 },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, marginTop: space.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stats: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingVertical: space.md, marginTop: space.md },
  vline: { width: 1, alignSelf: 'stretch' },
  actions: { flexDirection: 'row', marginTop: space.lg },
  actBtn: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: DISPLAY, fontSize: 20, marginBottom: space.xs },
  mini: { width: 76, height: 76, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  list: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md, paddingVertical: space.sm },
  moreHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.xs, minHeight: 44 },
  input: { height: 50, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: space.md, fontSize: 17 },
});

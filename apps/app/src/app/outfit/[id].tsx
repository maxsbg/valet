import { occasionOf } from '@valet/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Page } from '@/components/Page';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatEur } from '@valet/core';
import { ItemPicture } from '@/components/ItemPicture';
import { OutfitBoard } from '@/components/OutfitBoard';
import { ExportSheet } from '@/components/ExportSheet';
import { canExport, fileName, outfitPng } from '@/lib/share';
import { Chip, RoundButton, Empty, useToast } from '@/components/ui';
import { Sheet, SheetButton, SectionLabel } from '@/components/Sheet';
import { useSession } from '@/lib/session';
import { useBottomInset } from '@/lib/bottomInset';
import { useTheme, DISPLAY, space, radius } from '@/lib/theme';
import { personKey, todayLocal, type Tile } from '@/lib/wardrobe';
import { addDays, allOccasions, clashes, fmtLong, fmtShort, outfitValue, planOutfit, setOccasions, unplanOutfit } from '@/lib/outfits';
import { Icon } from '@/components/Icon';

export default function OutfitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset();
  const { width: winW } = useWindowDimensions();
  const toast = useToast(bottom + space.lg);
  const { wardrobe, session, reloadOutfits } = useSession();
  const [planning, setPlanning] = useState(false);
  const [date, setDate] = useState(() => addDays(todayLocal(), 1));
  const [who, setWho] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const dayScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const o = wardrobe?.outfits.find((x) => x.id === id);
  const persons = wardrobe?.persons ?? [];
  const me = persons.find((p) => p.user_id === session?.user.id) ?? null;
  const byId = useMemo(() => new Map((wardrobe?.items ?? []).map((i) => [i.id, i] as [string, Tile])), [wardrobe]);
  const today = todayLocal();
  const width = Math.min(winW, 520) - 2 * space.md;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/outfits'));

  // Warnung, wenn ein Teil an dem Tag schon von jemand anderem reserviert ist
  useEffect(() => {
    if (!planning || !o) return;
    let off = false;
    clashes(o.id, date, who).then((cl) => {
      if (off) return;
      if (!cl.length) return setWarn(null);
      const names = cl.map((c) => `${byId.get(c.item_id)?.name || 'Teil'}${persons.find((p) => p.id === c.person_id) ? ` (${persons.find((p) => p.id === c.person_id)!.name})` : ''}`);
      setWarn(`Schon reserviert: ${[...new Set(names)].join(', ')}.`);
    }).catch(() => setWarn(null));
    return () => { off = true; };
  }, [planning, date, who, o?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!wardrobe) return <View style={[s.page, { backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={t.accent} /></View>;
  if (!o) return <View style={[s.page, { backgroundColor: t.bg, paddingTop: insets.top }]}><View style={s.col}><TopBar onBack={back} /></View><Empty title="Nicht gefunden" text="Dieses Outfit gibt es nicht mehr." /></View>;

  const owner = persons.find((p) => p.id === o.ownerId);
  const pieces = o.pieces.map((p) => byId.get(p.id)).filter((i): i is Tile => !!i);
  const plans = [...o.plans].sort((a, b) => b.date.localeCompare(a.date));
  const future = plans.filter((p) => p.date >= today).reverse();
  const past = plans.filter((p) => p.date < today);
  const plannedToday = o.plans.some((p) => p.date === today && (!me || !p.personId || p.personId === me.id));
  const occList = allOccasions();
  const dayChoices = Array.from({ length: 45 }, (_, n) => addDays(today, n - 14));

  async function plan(d: string, personId: string | null) {
    setBusy(true);
    try {
      await planOutfit(o!.id, d, personId);
      await reloadOutfits();
      setPlanning(false);
      toast.show(d < today ? 'Als getragen eingetragen.' : d === today ? 'Heute getragen – eingetragen.' : `Geplant für ${fmtLong(d)}.`);
    } catch (e) { toast.show('Speichern fehlgeschlagen: ' + (e as Error).message); }
    finally { setBusy(false); }
  }
  function wearToday() {
    // Bei zwei Personen ohne „Das bin ich“ erst fragen, wer es trägt
    if (!me && persons.length > 1) { setDate(today); setWho(persons[0]!.id); setPlanning(true); return; }
    plan(today, me?.id ?? null);
  }
  async function unplan(planId: string) {
    setBusy(true);
    try { await unplanOutfit(planId); await reloadOutfits(); }
    catch (e) { toast.show('Entfernen fehlgeschlagen: ' + (e as Error).message); }
    finally { setBusy(false); }
  }
  async function toggleOcc(x: string) {
    const next = o!.occasions.includes(x) ? o!.occasions.filter((y) => y !== x) : [...o!.occasions, x];
    try { await setOccasions(o!.id, next); await reloadOutfits(); }
    catch (e) { toast.show('Speichern fehlgeschlagen: ' + (e as Error).message); }
  }

  const planRow = (p: (typeof plans)[number], n: number) => {
    const w = persons.find((x) => x.id === p.personId);
    return (
      <View key={p.id} style={[s.row, n > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
        <Text style={{ flex: 1, fontSize: 15, color: t.ink }}>
          {fmtShort(p.date)}{p.date < today ? ' · getragen' : p.date === today ? ' · heute' : ' · geplant'}{w ? ` · ${w.name}` : ''}
        </Text>
        <Pressable onPress={() => unplan(p.id)} disabled={busy} hitSlop={8} style={[s.smallBtn, { borderColor: t.hairline }]}>
          <Text style={{ fontSize: 14, color: t.ink }}>Entfernen</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[s.page, { backgroundColor: t.bg }]}>
      <Page contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottom + space.xxl, alignItems: 'center' }}>
        <View style={s.col}>
          <TopBar onBack={back} onEdit={() => router.push(`/outfit-bauen?id=${o.id}`)} onShare={canExport && o.pieces.length ? () => setExporting(true) : undefined} />
          <View style={[s.boardWrap, { borderColor: t.hairline }]}>
            <OutfitBoard pieces={o.pieces} byId={byId} width={width - 2} full />
          </View>

          <Text style={{ fontSize: 15, color: t.inkMuted, marginTop: space.sm }}>
            {[`${pieces.length} Teile`, formatEur(outfitValue(o, byId)), owner?.name].filter(Boolean).join(' · ')}
          </Text>

          <View style={s.actions}>
            <Pressable onPress={wearToday} disabled={busy || plannedToday} accessibilityRole="button"
              style={({ pressed }) => [s.btn, { backgroundColor: plannedToday ? t.surface : t.action, borderColor: plannedToday ? t.hairline : t.action, opacity: pressed ? 0.85 : 1 }]}>
              {plannedToday && <Icon name="check" size="chip" color={t.ink} />}
              <Text style={{ fontSize: 17, fontWeight: '600', color: plannedToday ? t.ink : t.onAction }}>{plannedToday ? 'Heute getragen' : 'Heute tragen'}</Text>
            </Pressable>
            <Pressable onPress={() => { setDate(addDays(today, 1)); setWho(me?.id ?? persons[0]?.id ?? null); setPlanning(true); }} accessibilityRole="button"
              style={({ pressed }) => [s.btn, { backgroundColor: t.surface, borderColor: t.hairline, opacity: pressed ? 0.85 : 1 }]}>
              <Icon name="calendar" size="chip" color={t.ink} />
              <Text style={{ fontSize: 17, fontWeight: '600', color: t.ink }}>Für Tag planen</Text>
            </Pressable>
          </View>

          <Text style={[s.section, { color: t.ink }]}>Anlass</Text>
          <View style={s.wrap}>
            {occList.map((x) => {
              const on = o.occasions.includes(x);
              return <Chip key={x} label={x} selected={on} icon={<Icon name={occasionOf(x)!.icon} size="chip" color={on ? t.bg : t.ink} />} onPress={() => toggleOcc(x)} />;
            })}
          </View>

          {(future.length > 0 || past.length > 0) && (
            <>
              <Text style={[s.section, { color: t.ink }]}>Tage</Text>
              <View style={[s.list, { backgroundColor: t.surface, borderColor: t.hairline }]}>
                {[...future, ...past.slice(0, 10)].map(planRow)}
                {past.length > 0 && (
                  <View style={[s.row, { borderTopWidth: 1, borderTopColor: t.hairline }]}>
                    <Text style={{ fontSize: 14, color: t.inkMuted }}>{past.length}× getragen</Text>
                  </View>
                )}
              </View>
            </>
          )}

          <Text style={[s.section, { color: t.ink }]}>Teile</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
            {pieces.map((m) => (
              <Pressable key={m.id} onPress={() => router.push(`/teil/${m.id}`)} accessibilityLabel={m.name}
                style={[s.mini, { boxShadow: `inset 0 0 14px 2px ${(m.hex ?? '#d8d2c8')}73, 0 1px 4px rgba(42,26,29,0.10)` }]}>
                <ItemPicture uri={m.thumb} inset={6} category={m.category} color={m.hex ?? '#8e8e93'} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Page>

      <Sheet open={planning} onClose={() => setPlanning(false)} title="Für Tag planen"
        footer={<>
          <SheetButton label="Abbrechen" onPress={() => setPlanning(false)} />
          <SheetButton primary label={busy ? 'Speichert …' : warn ? 'Trotzdem planen' : 'Planen'} onPress={() => !busy && plan(date, who)} />
        </>}>
        <SectionLabel>Tag</SectionLabel>
        <ScrollView ref={dayScroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
          {dayChoices.map((d) => (
            <Pressable key={d} onPress={() => setDate(d)}
              onLayout={d === today ? (e) => dayScroll.current?.scrollTo({ x: e.nativeEvent.layout.x, animated: false }) : undefined} accessibilityRole="radio" accessibilityState={{ selected: d === date }}
              style={[s.dayChip, { backgroundColor: d === date ? t.ink : t.surface, borderColor: d === date ? t.ink : t.hairline }]}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: d === date ? t.bg : t.ink }}>{fmtShort(d)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {persons.length > 1 && (
          <>
            <SectionLabel>Wer trägt es?</SectionLabel>
            <View style={s.wrap}>
              {persons.map((p) => <Chip key={p.id} label={p.id === me?.id ? `${p.name} (ich)` : p.name} person={p} selected={who === p.id} onPress={() => setWho(p.id)} />)}
            </View>
          </>
        )}
        {warn && <Text style={[s.warn, { color: t.ink, borderColor: '#F9E58A' }]}>{warn}</Text>}
        <Text style={{ fontSize: 13, color: t.inkMuted, marginTop: space.md }}>
          {date < today ? 'Vergangene Tage zählen als getragen.' : 'Die Teile werden für diesen Tag automatisch reserviert.'}
        </Text>
      </Sheet>
      {canExport && (
        <ExportSheet open={exporting} onClose={() => setExporting(false)} title="Outfit als Bild" name={`${fileName(o.name || 'Outfit')}.png`}
          make={() => outfitPng(o.pieces, byId, o.name || (o.occasions.length ? `Outfit · ${o.occasions.join(', ')}` : 'Outfit'))} />
      )}
      {toast.node}
    </View>
  );
}

function TopBar({ onBack, onEdit, onShare }: { onBack: () => void; onEdit?: () => void; onShare?: () => void }) {
  const t = useTheme();
  return (
    <View style={s.top}>
      <RoundButton label="Zurück" onPress={onBack}><Icon name="back" size="button" color={t.ink} /></RoundButton>
      <View style={{ flexDirection: 'row', gap: space.xs }}>
        {onShare && <RoundButton label="Als Bild teilen" onPress={onShare}><Icon name="share" size="button" color={t.ink} /></RoundButton>}
        {onEdit && <RoundButton label="Bearbeiten" onPress={onEdit}><Icon name="edit" size="button" color={t.ink} /></RoundButton>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  col: { width: '100%', maxWidth: 520, paddingHorizontal: space.md },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.xs },
  boardWrap: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginTop: space.xs },
  actions: { flexDirection: 'row', gap: space.xs, marginTop: space.md },
  btn: { flex: 1, height: 52, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  section: { fontFamily: DISPLAY, fontSize: 20, marginTop: space.lg, marginBottom: space.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  list: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md, paddingVertical: space.xs },
  smallBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  mini: { width: 76, height: 76, borderRadius: 18, overflow: 'hidden', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  dayChip: { height: 40, minWidth: 76, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  warn: { marginTop: space.md, fontSize: 14, backgroundColor: '#FBF1C2', borderWidth: 1, borderRadius: radius.sm, padding: space.sm },
});

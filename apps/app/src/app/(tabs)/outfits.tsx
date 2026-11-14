import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Page } from '@/components/Page';
import { Header, Chip, Empty, Fab, useToast } from '@/components/ui';
import { Icons } from '@/components/Icon';
import { OutfitCard } from '@/components/OutfitCard';
import { OutfitBoard } from '@/components/OutfitBoard';
import { Sheet, SheetButton, SectionLabel } from '@/components/Sheet';
import { useSession } from '@/lib/session';
import { useTheme, space, radius, DISPLAY } from '@/lib/theme';
import { useScreen } from '@/lib/useScreen';
import { personKey, todayLocal, type Tile } from '@/lib/wardrobe';
import { usePersisted } from '@/lib/usePersisted';
import { monthGrid, monthTitle, shiftMonth } from '@valet/core';
import { addDays, allOccasions, fmtLong, mondayOf, plansOn, planOutfit, unplanOutfit, weekday, clashes, reservationsOn, deleteReservation, type Outfit } from '@/lib/outfits';

export default function Outfits() {
  const t = useTheme();
  const scr = useScreen();
  const win = useWindowDimensions();
  const { wardrobe, session, loading, reload, reloadOutfits } = useSession();
  const toast = useToast(scr.barTop + space.sm);
  const [occ, setOcc] = useState<string | null>(null);
  const [week, setWeek] = useState(0);
  const [month, setMonth] = useState(0);
  // Woche oder Monat (bleibt auf dem Gerät gespeichert)
  const [view, setView] = usePersisted<'week' | 'month'>('valet-outfits-view', 'week');
  const [day, setDay] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const today = todayLocal();
  const outfits = wardrobe?.outfits ?? [];
  const persons = wardrobe?.persons ?? [];
  const me = persons.find((p) => p.user_id === session?.user.id) ?? null;
  const byId = useMemo(() => new Map((wardrobe?.items ?? []).map((i) => [i.id, i] as [string, Tile])), [wardrobe]);
  const colorOf = (personId: string | null) => {
    const p = persons.find((x) => x.id === personId);
    return p ? t.person[personKey(p.color)] : null;
  };

  const used = allOccasions(outfits).filter((x) => outfits.some((o) => o.occasions.includes(x)));
  const list = useMemo(
    () => outfits.filter((o) => !occ || o.occasions.includes(occ)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [outfits, occ],
  );

  // Raster wie im alten Valet: Spalten mit mindestens 160 px, 10 px Abstand
  const gap = 10;
  const cols = Math.max(1, Math.floor((scr.content + gap) / (160 + gap)));
  const cardW = Math.floor((scr.content - (cols - 1) * gap) / cols);

  const monday = addDays(mondayOf(today), week * 7);
  const days = Array.from({ length: 7 }, (_, n) => addDays(monday, n));
  const dayW = (scr.content - 2 * space.sm - 6 * 6) / 7;
  const mon = shiftMonth(today, month);
  const grid = view === 'month' ? monthGrid(mon.year, mon.month) : [];
  const step = (n: number) => (view === 'month' ? setMonth(month + n) : setWeek(week + n));
  const title = view === 'month'
    ? monthTitle(mon.year, mon.month)
    : week === 0 ? 'Diese Woche' : week === 1 ? 'Nächste Woche' : week === -1 ? 'Letzte Woche' : `${fmtDay(days[0]!)} – ${fmtDay(days[6]!)}`;
  /** Beim Umschalten dort bleiben, wo man gerade ist: Woche ↔ Monat dieser Woche */
  function toggleView() {
    if (view === 'week') { const m = shiftMonth(monday, 0); const n = shiftMonth(today, 0); setMonth((m.year - n.year) * 12 + m.month - n.month); setView('month'); }
    else { setWeek(month === 0 ? 0 : Math.round((Date.parse(`${mondayOf(`${mon.year}-${String(mon.month + 1).padStart(2, '0')}-01`)}T00:00:00Z`) - Date.parse(`${mondayOf(today)}T00:00:00Z`)) / 6048e5)); setView('week'); }
  }

  function openDay(d: string) { setDay(d); setPicking(false); setWho(me?.id ?? persons[0]?.id ?? null); }

  async function pick(o: Outfit) {
    if (!day) return;
    setBusy(true);
    try {
      const cl = await clashes(o.id, day, who);
      if (cl.length) {
        const it = byId.get(cl[0]!.item_id);
        const p = persons.find((x) => x.id === cl[0]!.person_id);
        toast.show(`Hinweis: ${it?.name || 'Ein Teil'} ist an dem Tag schon${p ? ` von ${p.name}` : ''} reserviert.`);
      }
      await planOutfit(o.id, day, who);
      await reloadOutfits();
      setPicking(false);
      if (!cl.length) toast.show(day < today ? 'Als getragen eingetragen.' : day === today ? 'Heute getragen – eingetragen.' : `Geplant für ${fmtLong(day)}.`);
    } catch (e) { toast.show('Speichern fehlgeschlagen: ' + (e as Error).message); }
    finally { setBusy(false); }
  }

  async function unplan(planId: string) {
    setBusy(true);
    try { await unplanOutfit(planId); await reloadOutfits(); }
    catch (e) { toast.show('Entfernen fehlgeschlagen: ' + (e as Error).message); }
    finally { setBusy(false); }
  }

  const dayPlans = day ? plansOn(outfits, day) : [];
  const reservations = wardrobe?.reservations ?? [];
  const dayRes = day ? reservationsOn(reservations, day) : [];

  async function unreserve(rid: string) {
    setBusy(true);
    try { await deleteReservation(rid); await reloadOutfits(); }
    catch (e) { toast.show('Entfernen fehlgeschlagen: ' + (e as Error).message); }
    finally { setBusy(false); }
  }
  const pickList = [...outfits]
    .filter((o) => !who || persons.length < 2 || !o.ownerId || o.ownerId === who)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pickW = Math.floor((Math.min(win.width, 560) - 2 * space.md - 2 * space.xs) / 3);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Page contentContainerStyle={{ paddingTop: scr.top, paddingBottom: scr.barTop + 90, alignItems: 'center' }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
        <View style={{ width: scr.content + 2 * space.md }}><Header /></View>

        {/* Wochenleiste */}
        <View style={[s.week, { width: scr.content, backgroundColor: t.surface, borderColor: t.hairline }]}>
          <View style={s.weekHead}>
            <Pressable onPress={() => step(-1)} hitSlop={10} accessibilityLabel={view === 'month' ? 'Voriger Monat' : 'Vorige Woche'}><Icons.back color={t.inkMuted} size={18} /></Pressable>
            <Text style={[s.weekTitle, { color: t.ink }]}>{title}</Text>
            <Pressable onPress={() => step(1)} hitSlop={10} accessibilityLabel={view === 'month' ? 'Nächster Monat' : 'Nächste Woche'} style={{ transform: [{ rotate: '180deg' }] }}><Icons.back color={t.inkMuted} size={18} /></Pressable>
          </View>
          {view === 'month' ? (
            <View style={{ gap: 6 }}>
              <View style={s.days}>
                {grid[0]!.map((c) => <Text key={c.date} style={[s.wd, { width: dayW, textAlign: 'center', color: t.inkMuted }]}>{weekday(c.date)}</Text>)}
              </View>
              {grid.map((row) => {
                const any = row.some((c) => plansOn(outfits, c.date).length > 0);
                return (
                  <View key={row[0]!.date} style={s.days}>
                    {row.map((c) => {
                      const ps = plansOn(outfits, c.date);
                      const isToday = c.date === today;
                      return (
                        <Pressable key={c.date} onPress={() => openDay(c.date)} accessibilityRole="button"
                          accessibilityLabel={`${fmtLong(c.date)}, ${ps.length ? `${ps.length} Outfit geplant` : 'nichts geplant'}`}
                          style={({ pressed }) => [s.day, { width: dayW, opacity: (pressed ? 0.7 : 1) * (c.inMonth ? 1 : 0.35) }]}>
                          <View style={[s.num, isToday && { backgroundColor: t.highlight }]}>
                            <Text style={{ fontSize: 13, fontWeight: isToday ? '700' : '500', color: isToday ? '#2a1a1d' : t.ink }}>{Number(c.date.slice(8))}</Text>
                          </View>
                          <View style={[s.resDot, { backgroundColor: reservationsOn(reservations, c.date).length ? t.inkMuted : 'transparent' }]} />
                          {ps.length ? (
                            <View style={[s.mini, { borderColor: t.hairline, opacity: c.date < today ? 0.75 : 1 }]}>
                              <OutfitBoard pieces={ps[0]!.outfit.pieces} byId={byId} width={dayW - 2} />
                              {ps.length > 1 && <Text style={s.more}>+{ps.length - 1}</Text>}
                            </View>
                          ) : any ? <View style={{ height: Math.round(dayW * 1.25) }} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          ) : (
          <View style={s.days}>
            {days.map((d) => {
              const ps = plansOn(outfits, d);
              const isToday = d === today;
              return (
                <Pressable key={d} onPress={() => openDay(d)} accessibilityRole="button" accessibilityLabel={`${fmtLong(d)}, ${ps.length ? `${ps.length} Outfit geplant` : 'nichts geplant'}`}
                  style={({ pressed }) => [s.day, { width: dayW, opacity: pressed ? 0.7 : 1 }]}>
                  <Text style={[s.wd, { color: isToday ? t.ink : t.inkMuted, fontWeight: isToday ? '700' : '500' }]}>{weekday(d)}</Text>
                  <View style={[s.num, isToday && { backgroundColor: t.highlight }]}>
                    <Text style={{ fontSize: 13, fontWeight: isToday ? '700' : '500', color: isToday ? '#2a1a1d' : t.ink }}>{Number(d.slice(8))}</Text>
                  </View>
                  <View style={[s.resDot, { backgroundColor: reservationsOn(reservations, d).length ? t.inkMuted : 'transparent' }]} />
                  {ps.length ? (
                    <View style={[s.mini, { borderColor: t.hairline, opacity: d < today ? 0.75 : 1 }]}>
                      <OutfitBoard pieces={ps[0]!.outfit.pieces} byId={byId} width={dayW - 2} />
                      {ps.length > 1 && <Text style={s.more}>+{ps.length - 1}</Text>}
                    </View>
                  ) : (
                    <View style={[s.slot, { height: Math.round(dayW * 1.25), borderColor: t.hairline }]}>
                      {d >= today && <Icons.plus color={t.inkMuted} size={14} />}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          )}
          <Pressable onPress={toggleView} hitSlop={8} accessibilityRole="button" style={s.toggle}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: t.actionText }}>{view === 'month' ? 'Woche anzeigen' : 'Monat anzeigen'}</Text>
            <View style={{ transform: [{ rotate: view === 'month' ? '-90deg' : '90deg' }] }}><Icons.chevron color={t.actionText} size={14} /></View>
          </Pressable>
        </View>

        {used.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: scr.content + 2 * space.md, flexGrow: 0 }}
            contentContainerStyle={{ gap: space.xs, paddingHorizontal: space.md, paddingTop: space.md }}>
            <Chip label="Alle" count={outfits.length} selected={!occ} onPress={() => setOcc(null)} />
            {used.map((x) => <Chip key={x} label={x} selected={occ === x} onPress={() => setOcc(occ === x ? null : x)} />)}
          </ScrollView>
        )}

        <View style={{ width: scr.content, marginTop: space.md }}>
          {!wardrobe ? (
            <View style={{ padding: space.xl }}>{loading ? <ActivityIndicator color={t.accent} /> : <Empty title="Kein Schrank" text="Für dein Konto gibt es noch keinen Kleiderschrank." />}</View>
          ) : list.length ? (
            <View style={[s.grid, { gap }]}>
              {list.map((o) => (
                <OutfitCard key={o.id} outfit={o} byId={byId} width={cardW} personColor={colorOf(o.ownerId)} onPress={() => router.push(`/outfit/${o.id}`)} />
              ))}
            </View>
          ) : (
            <Empty title="Noch keine Outfits" text="Stell dir aus deinen Teilen ein Outfit zusammen und speichere es." />
          )}
        </View>
      </Page>
      <Fab bottom={scr.fabBottom} label="Neues Outfit" onPress={() => router.push('/outfit-bauen')} />

      {/* Tag: geplante Outfits, Outfit wählen */}
      <Sheet open={!!day} onClose={() => setDay(null)} title={day ? (picking ? `Outfit für ${fmtLong(day)}` : fmtLong(day)) : ''}
        footer={picking ? <>
          <SheetButton label="Zurück" onPress={() => setPicking(false)} />
          <SheetButton label="+ Neues Outfit" onPress={() => { const d = day; setDay(null); router.push(`/outfit-bauen?date=${d}&who=${who ?? ''}`); }} />
        </> : <SheetButton primary label={dayPlans.length ? 'Weiteres Outfit wählen' : 'Outfit wählen'} onPress={() => setPicking(true)} />}>
        {persons.length > 1 && (
          <>
            <SectionLabel>Wer trägt es?</SectionLabel>
            <View style={s.wrap}>
              {persons.map((p) => <Chip key={p.id} label={p.id === me?.id ? `${p.name} (ich)` : p.name} dot={t.person[personKey(p.color)]} selected={who === p.id} onPress={() => setWho(p.id)} />)}
            </View>
          </>
        )}
        {busy && <ActivityIndicator color={t.accent} style={{ marginTop: space.md }} />}
        {picking ? (
          pickList.length ? (
            <View style={[s.wrap, { marginTop: space.md }]}>
              {pickList.map((o) => (
                <Pressable key={o.id} disabled={busy} onPress={() => pick(o)} accessibilityRole="button" accessibilityLabel="Dieses Outfit planen"
                  style={({ pressed }) => [s.pick, { borderColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}>
                  <OutfitBoard pieces={o.pieces} byId={byId} width={pickW - 2} />
                </Pressable>
              ))}
            </View>
          ) : <Text style={{ color: t.inkMuted, fontSize: 15, marginTop: space.md }}>Noch keine Outfits gespeichert.</Text>
        ) : dayPlans.length ? (
          <View style={{ marginTop: space.md, gap: space.sm }}>
            {dayPlans.map(({ outfit, plan }) => {
              const p = persons.find((x) => x.id === plan.personId);
              return (
                <View key={plan.id} style={[s.planRow, { backgroundColor: t.surface, borderColor: t.hairline }]}>
                  <Pressable onPress={() => { setDay(null); router.push(`/outfit/${outfit.id}`); }} style={[s.pick, { borderColor: t.hairline, width: 82 }]}>
                    <OutfitBoard pieces={outfit.pieces} byId={byId} width={80} />
                  </Pressable>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 16, color: t.ink }}>{outfit.pieces.length} Teile</Text>
                    <Text style={{ fontSize: 14, color: t.inkMuted }}>{[day! < today ? 'getragen' : day === today ? 'heute' : 'geplant', p?.name].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Pressable onPress={() => unplan(plan.id)} disabled={busy} hitSlop={8} style={[s.smallBtn, { borderColor: t.hairline }]}>
                    <Text style={{ fontSize: 14, color: t.ink }}>Entfernen</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={{ color: t.inkMuted, fontSize: 15, marginTop: space.md }}>{day && day < today ? 'An dem Tag ist nichts eingetragen.' : 'Für den Tag ist noch nichts geplant.'}</Text>
        )}
        {!picking && dayRes.length > 0 && (
          <View style={{ marginTop: space.md }}>
            <SectionLabel>Reservierte Teile</SectionLabel>
            <View style={{ gap: space.xs }}>
              {dayRes.map((r) => {
                const it = byId.get(r.itemId);
                const p = persons.find((x) => x.id === r.personId);
                return (
                  <View key={r.id} style={[s.planRow, { backgroundColor: t.surface, borderColor: t.hairline }]}>
                    <Pressable onPress={() => { setDay(null); router.push(`/teil/${r.itemId}`); }} style={{ flex: 1, gap: 2, paddingHorizontal: space.xs }}>
                      <Text style={{ fontSize: 16, color: t.ink }} numberOfLines={1}>{it?.name ?? 'Teil'}</Text>
                      <Text style={{ fontSize: 14, color: t.inkMuted }}>{[p?.name, r.from !== r.to ? `${fmtDay(r.from)} – ${fmtDay(r.to)}` : null].filter(Boolean).join(' · ') || 'reserviert'}</Text>
                    </Pressable>
                    <Pressable onPress={() => unreserve(r.id)} disabled={busy} hitSlop={8} style={[s.smallBtn, { borderColor: t.hairline }]}>
                      <Text style={{ fontSize: 14, color: t.ink }}>Aufheben</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </Sheet>
      {toast.node}
    </View>
  );
}

const fmtDay = (iso: string) => `${Number(iso.slice(8))}.${Number(iso.slice(5, 7))}.`;

const s = StyleSheet.create({
  week: { borderWidth: 1, borderRadius: radius.md, padding: space.sm, gap: space.xs },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  weekTitle: { fontFamily: DISPLAY, fontSize: 18 },
  days: { flexDirection: 'row', gap: 6 },
  day: { alignItems: 'center', gap: 4 },
  wd: { fontSize: 12 },
  num: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  mini: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  more: { position: 'absolute', right: 2, bottom: 2, fontSize: 10, fontWeight: '700', color: '#2a1a1d', backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 3, overflow: 'hidden' },
  resDot: { width: 4, height: 4, borderRadius: 2, marginTop: -2 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 2, minHeight: 28 },
  slot: { alignSelf: 'stretch', borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  pick: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.md, padding: space.xs },
  smallBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
});

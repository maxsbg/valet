import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Page } from '@/components/Page';
import { Header, Chip, Empty, Fab, PageEnd, useToast, useChipReveal } from '@/components/ui';
import { WeekCalendar } from '@/components/WeekCalendar';
import { useTilePeople } from '@/components/Mosaic';
import { OutfitCard } from '@/components/OutfitCard';
import { OutfitBoard } from '@/components/OutfitBoard';
import { Sheet, SheetButton, SectionLabel } from '@/components/Sheet';
import { useSession } from '@/lib/session';
import { useTheme, space, radius } from '@/lib/theme';
import { useScreen } from '@/lib/useScreen';
import { todayLocal, type Tile } from '@/lib/wardrobe';
import { fmtLong, plansOn, planOutfit, unplanOutfit, clashes, type Outfit } from '@/lib/outfits';
import { OCCASIONS } from '@valet/core';
import { itemTile } from '@valet/ui';
import { Icon } from '@/components/Icon';

export default function Outfits() {
  const t = useTheme();
  const scr = useScreen();
  const win = useWindowDimensions();
  const { wardrobe, session, loading, reload, reloadOutfits } = useSession();
  const toast = useToast(scr.barTop + space.sm);
  const [occ, setOcc] = useState<string | null>(null);
  const chipRow = useChipReveal();
  // Chip wählen; ragt er aus dem sichtbaren Bereich, rollt die Reihe gerade so weit, dass er ganz zu sehen ist
  const pickOcc = (x: string | null) => {
    chipRow.reveal(x ?? 'alle', occ ?? 'alle', space.md, space.md);
    setOcc(x);
  };
  const [day, setDay] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const today = todayLocal();
  const outfits = wardrobe?.outfits ?? [];
  const persons = wardrobe?.persons ?? [];
  const me = persons.find((p) => p.user_id === session?.user.id) ?? null;
  const byId = useMemo(() => new Map((wardrobe?.items ?? []).map((i) => [i.id, i] as [string, Tile])), [wardrobe]);

  // Anlass-Chips: nur Anlässe mit Outfits (bzw. der gewählte), in der festen Reihenfolge
  const used = OCCASIONS.map((x) => ({ ...x, n: outfits.filter((o) => o.occasions.includes(x.key)).length }))
    .filter((x) => x.n > 0 || occ === x.key);
  // Bügel auf der Karte: Outfit heute getragen bzw. für heute geplant, in der Farbe der Person
  const { person: lookOf } = useTilePeople();
  const todayLook = (o: Outfit) => {
    const p = o.plans.find((x) => x.date === today);
    if (!p) return null;
    const look = p.personId ? lookOf(p.personId) : undefined;
    return look ? { name: look.name, stroke: look.stroke } : { stroke: itemTile.badge.ink };
  };
  const list = useMemo(
    () => outfits.filter((o) => !occ || o.occasions.includes(occ)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [outfits, occ],
  );

  // Raster wie im alten Valet: Spalten mit mindestens 160 px, 10 px Abstand
  const gap = 10;
  const cols = Math.max(1, Math.floor((scr.content + gap) / (160 + gap)));
  const cardW = Math.floor((scr.content - (cols - 1) * gap) / cols);


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
  const pickList = [...outfits]
    .filter((o) => !who || persons.length < 2 || !o.ownerId || o.ownerId === who)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pickW = Math.floor((Math.min(win.width, 560) - 2 * space.md - 2 * space.xs) / 3);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Page contentContainerStyle={{ paddingTop: scr.top, paddingBottom: scr.barTop + space.lg, alignItems: 'center' }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
        <View style={{ width: scr.content + 2 * space.md }}><Header title="Outfits" /></View>

        {/* Wochenleiste; Titel antippen → Monat */}
        <WeekCalendar outfits={outfits} byId={byId} today={today} width={scr.content} onDay={openDay} />

        {used.length > 0 && (
          <ScrollView ref={chipRow.ref} {...chipRow.scrollProps} horizontal showsHorizontalScrollIndicator={false} style={{ width: scr.content + 2 * space.md, flexGrow: 0 }}
            contentContainerStyle={{ gap: space.xs, paddingHorizontal: space.md, paddingTop: space.md }}>
            <View onLayout={chipRow.layout('alle')}>
              <Chip tall label="Alle" count={outfits.length} selected={!occ} onPress={() => pickOcc(null)} />
            </View>
            {used.map((x) => {
              const on = occ === x.key;
              return (
                <View key={x.key} onLayout={chipRow.layout(x.key)}>
                  <Chip tall collapse label={x.label} count={x.n} selected={on} onLabelWidth={chipRow.labelWidth(x.key)}
                    icon={<Icon name={x.icon} size="chip" color={on ? t.onFill : t.ink} />} onPress={() => pickOcc(on ? null : x.key)} />
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={{ width: scr.content, marginTop: space.md }}>
          {!wardrobe ? (
            <View style={{ padding: space.xl }}>{loading ? <ActivityIndicator color={t.accent} /> : <Empty title="Kein Schrank" text="Für dein Konto gibt es noch keinen Kleiderschrank." />}</View>
          ) : list.length ? (
            <View style={[s.grid, { gap }]}>
              {list.map((o) => (
                <OutfitCard key={o.id} outfit={o} byId={byId} width={cardW} today={todayLook(o)} onPress={() => router.push(`/outfit/${o.id}`)} />
              ))}
            </View>
          ) : (
            <Empty title="Noch keine Outfits" text="Stell dir aus deinen Teilen ein Outfit zusammen und speichere es." />
          )}
        </View>
        <PageEnd />
      </Page>

      <Fab bottom={scr.fabBottom} label="Neues Outfit erstellen" icon="outfitNew" onPress={() => router.push('/outfit-bauen')} />

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
              {persons.map((p) => <Chip key={p.id} label={p.id === me?.id ? `${p.name} (ich)` : p.name} person={p} selected={who === p.id} onPress={() => setWho(p.id)} />)}
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
                  <Pressable accessibilityRole="button" onPress={() => { setDay(null); router.push(`/outfit/${outfit.id}`); }} style={[s.pick, { borderColor: t.hairline, width: 82 }]}>
                    <OutfitBoard pieces={outfit.pieces} byId={byId} width={80} />
                  </Pressable>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 16, color: t.ink }}>{outfit.pieces.length} Teile</Text>
                    <Text style={{ fontSize: 14, color: t.inkMuted }}>{[day! < today ? 'getragen' : day === today ? 'heute' : 'geplant', p?.name].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => unplan(plan.id)} disabled={busy} hitSlop={8} style={[s.smallBtn, { borderColor: t.hairline }]}>
                    <Text style={{ fontSize: 14, color: t.ink }}>Entfernen</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={{ color: t.inkMuted, fontSize: 15, marginTop: space.md }}>{day && day < today ? 'An dem Tag ist nichts eingetragen.' : 'Für den Tag ist noch nichts geplant.'}</Text>
        )}
      </Sheet>
      {toast.node}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  pick: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.md, padding: space.xs },
  smallBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
});

// Teil-Detail (VALET_DETAILSEITE_SPEC.md, Abschnitte 2–5): Kopf, Bild-Kachel, Reiter Übersicht · Steckbrief · Kauf,
// Werkzeugleiste unten statt Tab-Leiste. Wunschteile: components/detail/WishDetail.tsx (Stufe 5).
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  confirmCare, ownShare, statusCard, statusChange, statusDef, statusKey, toEditForm, wearTiles,
  type CareGroup, type EditRow, type StatusInfo, type StatusKey,
} from '@valet/core';
import { detail } from '@valet/ui';
import { useSession } from '@/lib/session';
import { useTheme, DISPLAY } from '@/lib/theme';
import { useBottomInset } from '@/lib/bottomInset';
import { todayLocal } from '@/lib/wardrobe';
import { loadItem, wornDays, setWornToday, saveStatus, updateItem, type ItemDetail } from '@/lib/item';
import { holdItem, holdsOf, releaseHold, fmtShort } from '@/lib/outfits';
import { canExport, fileName, itemPng } from '@/lib/share';
import { Page } from '@/components/Page';
import { Empty, useToast } from '@/components/ui';
import { ExportSheet } from '@/components/ExportSheet';
import { StatusMenu, type Anchor } from '@/components/StatusMenu';
import { StatusSheet } from '@/components/StatusSheet';
import { useTilePeople } from '@/components/Mosaic';
import { Segmented, EditCard } from '@/components/edit/fields';
import { DetailImage } from '@/components/detail/DetailImage';
import { Toolbar, TOOLBAR_SPACE } from '@/components/detail/Toolbar';
import { HeadButton } from '@/components/detail/parts';
import { KaufView, NotesCard, OutfitsCard, SetCard, StatTiles, SteckbriefView } from '@/components/detail/sections';
import { CareConfirmSheet, ReserveSheet, type HoldRow } from '@/components/detail/sheets';
import { WishDetail } from '@/components/detail/WishDetail';
import { Icon } from '@/components/Icon';

export default function Teil() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wardrobe } = useSession();
  const isWish = wardrobe?.items.find((i) => i.id === id)?.isWish;
  return isWish ? <WishDetail id={id} /> : <ClosetDetail id={id} />;
}

type Tab = 'overview' | 'profile' | 'purchase';

function ClosetDetail({ id }: { id: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset();
  const { width: W } = useWindowDimensions();
  const col = Math.min(W - 32, 520);
  const { wardrobe, patch, setToday, reloadOutfits } = useSession();
  const { me, person, todayBy } = useTilePeople();
  const toast = useToast(bottom + TOOLBAR_SPACE);
  const [d, setD] = useState<ItemDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<Anchor | null>(null);
  const [statusSheet, setStatusSheet] = useState<StatusKey | null>(null);
  const [holds, setHolds] = useState<HoldRow[]>([]);
  const [reserve, setReserve] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [care, setCare] = useState<CareGroup | null>(null);

  const today = todayLocal();
  const loadHolds = useCallback(() => { holdsOf(id, today).then(setHolds).catch(() => {}); }, [id, today]);
  const load = useCallback(() => { loadItem(id).then(setD).catch((e) => setErr(e.message ?? String(e))); loadHolds(); }, [id, loadHolds]);
  useFocusEffect(load);

  const tile = wardrobe?.items.find((i) => i.id === id);
  const days = useMemo(() => (d ? wornDays(d) : []), [d]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const edit = (tabName?: 'kauf') => router.push(`/bearbeiten/${id}${tabName ? `?reiter=${tabName}` : ''}`);

  if (err) return <View style={[s.page, { backgroundColor: t.bg, paddingTop: insets.top + 6, paddingHorizontal: 16 }]}><HeadButton glyph="back" label="Zurück" onPress={back} /><Empty title="Nicht gefunden" text={err} /></View>;
  if (!d || !tile) return <View style={[s.page, { backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={t.accent} /></View>;

  const it = d.item;
  const row = it as unknown as EditRow & typeof it;
  const f = toEditForm(row);
  const wornToday = days.includes(today);
  const mainPic = tile.image ?? tile.thumb;
  const share = ownShare(it.price_paid, it.qty, (row.payers ?? []).map((p) => ({ personId: p.person_id ?? null, amount: p.amount ?? null })), me);
  const tiles = wearTiles({ days, today, share, gift: f.gift });
  const setMembers = it.set_id ? (wardrobe?.items ?? []).filter((i) => i.setId === it.set_id) : [];
  const byId = new Map((wardrobe?.items ?? []).map((i) => [i.id, i] as const));
  const outfits = (wardrobe?.outfits ?? []).filter((o) => o.pieces.some((p) => p.id === id));
  const reservedToday = holds.some((h) => h.from <= today && h.to >= today);

  const sInfo: StatusInfo = {
    status: it.status, status_at: it.status_at, status_where: it.status_where || null, status_until: it.status_until,
    lent_person_id: it.lent_person_id, lent_to: it.lent_to || null, sold_price: it.sold_price, sold_date: it.sold_date,
  };
  const card = statusCard(sInfo, today, (pid) => wardrobe?.persons.find((p) => p.id === pid)?.name ?? null);
  const lendTo = (wardrobe?.persons ?? []).filter((p) => p.id !== me);
  const fail = (e: unknown) => toast.show('Speichern fehlgeschlagen: ' + (e as Error).message);

  async function applyStatus(next: StatusInfo) {
    await saveStatus(id, next);
    setD((x) => x && { ...x, item: { ...x.item, ...next } });
    patch(id, { status: next.status, statusUntil: next.status_until });
    setStatusSheet(null);
    toast.show(next.status ? `Status: ${statusDef(statusKey(next.status)).label}` : 'Wieder im Schrank.');
  }
  function pickStatus(k: StatusKey) {
    setMenu(null);
    if (statusDef(k).details) { setStatusSheet(k); return; }
    applyStatus(statusChange(k, {}, today)).catch(fail);
  }
  async function toggleWorn() {
    setBusy(true);
    try {
      await setWornToday(id, me, !wornToday);
      setD((x) => x && { ...x, wears: wornToday ? x.wears.filter((w) => w !== today) : [...x.wears, today] });
      setToday(id, me, !wornToday);
      reloadOutfits().catch(() => {});
      toast.show(wornToday ? 'Heute getragen entfernt.' : 'Als heute getragen eingetragen.');
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function saveHold(who: string | null, from: string, to: string) {
    await holdItem(id, who, from, to);
    setReserve(false);
    loadHolds();
    reloadOutfits().catch(() => {});
    const p = wardrobe?.persons.find((x) => x.id === who);
    toast.show(`Reserviert${p ? ` für ${p.name}` : ''}: ${from === to ? fmtShort(from) : `${fmtShort(from)} – ${fmtShort(to)}`}.`);
  }
  async function removeHold(hid: string) {
    try { await releaseHold(hid); loadHolds(); reloadOutfits().catch(() => {}); toast.show('Reservierung entfernt.'); } catch (e) { fail(e); }
  }
  async function confirmCareValue() {
    if (!care) return;
    const next = confirmCare(f.care, care);
    try { await updateItem(id, { care: next }); setD((x) => x && { ...x, item: { ...x.item, care: next } as typeof x.item }); setCare(null); } catch (e) { fail(e); }
  }

  const holdText = (h: HoldRow) => {
    const p = wardrobe?.persons.find((x) => x.id === h.personId);
    return `${h.from === h.to ? fmtShort(h.from) : `${fmtShort(h.from)} – ${fmtShort(h.to)}`}${p ? ` · ${p.name}` : ''}`;
  };

  const overview = (
    <>
      {card && (
        <View style={[s.statusCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <View style={[s.statusIcon, { borderColor: t.hairline }]}><Icon name={card.icon} size="row" color={t.ink} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>{card.title}</Text>
            {card.details.length > 0 && <Text style={{ fontSize: 13, color: t.inkMuted }}>{card.details.join(' · ')}</Text>}
            {card.warn && <Text style={{ fontSize: 13, fontWeight: '600', color: t.accent }}>{card.warn}</Text>}
          </View>
          <Pressable hitSlop={6} accessibilityRole="button" onPress={() => {
            const to = card.action.to;
            if (to === 'sheet:sold') setStatusSheet('sold');
            else applyStatus(statusChange(to, sInfo, today)).catch(fail);
          }} style={({ pressed }) => [s.statusAction, { backgroundColor: t.actionText + '24', opacity: pressed ? 0.6 : 1 }]}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: t.actionText }} numberOfLines={1}>{card.action.label}</Text>
          </Pressable>
        </View>
      )}
      <StatTiles tiles={tiles} onEditPrice={() => edit('kauf')} />
      {setMembers.length > 1 && (
        <SetCard name={it.set_name} members={setMembers} currentId={id} onOpen={(x) => router.push(`/teil/${x}`)} />
      )}
      <OutfitsCard outfits={outfits} byId={byId} width={col} onOpen={(o) => router.push(`/outfit/${o}`)} onNew={() => router.push(`/outfit-bauen?item=${id}`)} />
      {holds.length > 0 && (
        <EditCard title="Reserviert">
          {holds.map((h) => (
            <View key={h.id} style={s.holdRow}>
              <Text style={{ flex: 1, fontSize: 15, color: t.ink }}>{holdText(h)}</Text>
              {h.planned ? <Text style={{ fontSize: 13, color: t.inkMuted }}>über Outfit</Text>
                : <Pressable onPress={() => removeHold(h.id)} hitSlop={8} accessibilityRole="button"><Text style={{ fontSize: 15, color: t.accent }}>Entfernen</Text></Pressable>}
            </View>
          ))}
        </EditCard>
      )}
      {!!it.notes && <NotesCard text={it.notes} />}
    </>
  );

  return (
    <View style={[s.page, { backgroundColor: t.bg }]}>
      <Page contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: bottom + TOOLBAR_SPACE, alignItems: 'center' }}>
        <View style={{ width: col, gap: 14 }}>
          {/* Kopf: Zurück · Teilen, Bearbeiten */}
          <View style={s.head}>
            <HeadButton glyph="back" label="Zurück" onPress={back} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {canExport && mainPic && <HeadButton glyph="share" label="Bild teilen" onPress={() => setExporting(true)} />}
              <HeadButton glyph="edit" label="Bearbeiten" onPress={() => edit()} />
            </View>
          </View>

          <DetailImage width={Math.min(col, 420)} me={me} person={person} today={id in todayBy ? { person: todayBy[id] ?? null } : null}
            item={{ id, name: it.name, kind: tile.kind, size: tile.size, hex: tile.hex, colors: tile.colors, status: it.status, reversible: !!it.reversible, setId: it.set_id, qty: it.qty ?? 1,
              owners: tile.owners, image: mainPic, imageBack: tile.imageBack }} />

          <View style={{ gap: 2, marginTop: 4 }}>
            {!!it.brand && <Text style={[s.brand, { color: t.inkMuted }]}>{it.brand}</Text>}
            <Text style={[s.name, { color: t.ink }]}>{it.name}</Text>
            {it.was_wish && it.created_at && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Icon name="heart" size="small" color={t.inkMuted} />
                <Text style={{ fontSize: 13, color: t.inkMuted }}>
                  Gemerkt seit {it.created_at.slice(0, 10).split('-').reverse().join('.')}
                </Text>
              </View>
            )}
          </View>
          <Segmented items={[{ key: 'overview', label: 'Übersicht' }, { key: 'profile', label: 'Steckbrief' }, { key: 'purchase', label: 'Kauf' }]} value={tab} onChange={setTab} />

          {tab === 'overview' ? overview
            : tab === 'profile' ? <SteckbriefView f={f} onCare={setCare} onEdit={() => edit()} />
            : <KaufView f={f} row={row as never} persons={wardrobe?.persons ?? []} meId={me} onEdit={() => edit('kauf')} />}
        </View>
      </Page>

      <Toolbar
        left={[
          { label: `Status: ${statusDef(statusKey(it.status)).label}, ändern`, icon: (c) => <Icon name={statusKey(it.status)} size="button" color={c} />, onPress: (_e, g) => setMenu(g) },
          { label: reservedToday ? 'Reserviert – neue Reservierung' : 'Reservieren', active: reservedToday, icon: (c) => <Icon name="calendar" size="button" color={c} />, onPress: () => setReserve(true) },
        ]}
        right={[{ label: 'Outfit damit', icon: (c) => <Icon name="outfitNew" size="button" color={c} />, onPress: () => router.push(`/outfit-bauen?item=${id}`) }]}
        main={{ label: wornToday ? 'Heute getragen – entfernen' : 'Heute tragen', active: wornToday, disabled: busy, onPress: toggleWorn,
          icon: (c) => <Icon name={wornToday ? 'check' : 'wornToday'} size="bar" color={c} /> }}
      />

      <StatusMenu open={!!menu} anchor={menu} current={statusKey(it.status)} onPick={pickStatus} onClose={() => setMenu(null)} />
      <StatusSheet open={!!statusSheet} start={statusSheet ?? 'closet'} info={sInfo} persons={lendTo} today={today} onSave={applyStatus} onClose={() => setStatusSheet(null)} />
      <ReserveSheet open={reserve} persons={wardrobe?.persons ?? []} meId={me} holds={holds} onSave={saveHold} onClose={() => setReserve(false)} />
      <CareConfirmSheet group={care} value={care ? f.care[care] ?? null : null} onConfirm={confirmCareValue} onChange={() => { setCare(null); edit(); }} onClose={() => setCare(null)} />
      {canExport && mainPic && (
        <ExportSheet open={exporting} onClose={() => setExporting(false)} title="Bild teilen" name={`${fileName(it.name)}.png`} make={() => itemPng(mainPic)} />
      )}
      {toast.node}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: detail.font.brand, fontWeight: '600', letterSpacing: 0.4 },
  name: { fontFamily: DISPLAY, fontSize: detail.font.name, lineHeight: 36 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  /** Schnellaktion als Kapsel (38 hoch wie Spec-Kapseln), leicht getönt, damit sie als Knopf erkennbar ist */
  statusAction: { height: 38, borderRadius: 19, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  statusIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  holdRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
});

import { useBottomInset } from '@/lib/bottomInset';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, type GestureResponderEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { Page } from '@/components/Page';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { categoryLast, formatEur, parseAmount, statusCard, statusChange, statusDef, statusKey, type StatusInfo, type StatusKey } from '@valet/core';
import { Icons } from '@/components/Icon';
import { ItemPicture } from '@/components/ItemPicture';
import { RoundButton, Empty, Chip, useToast } from '@/components/ui';
import { eur, toDe, toIso } from '@/components/ItemForm';
import { Sheet, SheetButton } from '@/components/Sheet';
import { useSession } from '@/lib/session';
import { useTheme, DISPLAY, space, radius, tile } from '@/lib/theme';
import { useFlipped } from '@/lib/flipped';
import { loadItem, wornDays, setWornToday, saveStatus, markBought, saveSet, type ItemDetail, type ItemRow } from '@/lib/item';
import { holdItem, holdsOf, releaseHold, fmtShort } from '@/lib/outfits';
import { ExportSheet } from '@/components/ExportSheet';
import { StatusMenu, anchorFromPress, type Anchor } from '@/components/StatusMenu';
import { StatusSheet } from '@/components/StatusSheet';
import { TileIcon } from '@/components/tile/TileIcons';
import { canExport, fileName, itemPng } from '@/lib/share';
import { personKey, todayLocal } from '@/lib/wardrobe';

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
  const { wardrobe, session, patch, setToday, reloadOutfits } = useSession();
  const [d, setD] = useState<ItemDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Status: Menü (Pull-down) und Blatt für die Zusatzangaben
  const [menu, setMenu] = useState<Anchor | null>(null);
  const [statusSheet, setStatusSheet] = useState<StatusKey | null>(null);
  const [more, setMore] = useState(false);
  // Wunschteil gekauft → Schrank
  const [buy, setBuy] = useState<{ price: string; date: string; owners: string[]; error?: string } | null>(null);
  const bottom = useBottomInset();
  const toast = useToast(bottom + space.lg);
  // Reservieren (einzelnes Teil, ohne Outfit)
  type HoldRow = { id: string; personId: string | null; from: string; to: string; planned: boolean };
  const [holds, setHolds] = useState<HoldRow[]>([]);
  const [hold, setHold] = useState<{ who: string | null; from: string; to: string; error?: string } | null>(null);
  // Set bearbeiten
  const [setEdit, setSetEdit] = useState<{ members: string[]; name: string; q: string; error?: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadHolds = useCallback(() => { holdsOf(id, todayLocal()).then(setHolds).catch(() => {}); }, [id]);
  const load = useCallback(() => { loadItem(id).then(setD).catch((e) => setErr(e.message ?? String(e))); loadHolds(); }, [id, loadHolds]);
  useFocusEffect(load);

  const tileInfo = wardrobe?.items.find((i) => i.id === id);
  // Kachel im Schrank umgedreht → hier vorübergehend Seite B als Hauptbild
  const flipped = useFlipped(id) && !!tileInfo?.imageBack;
  const mainPic = (flipped ? tileInfo?.imageBack : null) ?? tileInfo?.image ?? tileInfo?.thumb;
  const me = wardrobe?.persons.find((p) => p.user_id === session?.user.id);
  const ownerList = (wardrobe?.persons ?? []).filter((p) => (d?.item.owner_ids ?? (d?.item.owner_id ? [d.item.owner_id] : [])).includes(p.id));
  const owner = ownerList.length === 1 ? ownerList[0] : undefined;
  const today = todayLocal();
  const days = useMemo(() => (d ? wornDays(d) : []), [d]);
  const wornToday = days.includes(today);
  const setMates = useMemo(() => (d?.item.set_id ? (wardrobe?.items ?? []).filter((i) => i.setId === d.item.set_id && i.id !== id) : []), [d, wardrobe, id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  /** Outfits haben meist keinen Namen: „Outfit mit Jeans, Cap“ aus den anderen Teilen */
  const outfitLabel = (oid: string) => {
    const others = (wardrobe?.outfits.find((x) => x.id === oid)?.pieces ?? []).filter((p) => p.id !== id)
      .map((p) => wardrobe?.items.find((i) => i.id === p.id)?.name).filter(Boolean);
    return others.length ? `mit ${others.slice(0, 2).join(', ')}${others.length > 2 ? ` +${others.length - 2}` : ''}` : 'Outfit';
  };

  if (err) return <View style={[s.page, { backgroundColor: t.bg, paddingTop: insets.top }]}><TopBar onBack={back} /><Empty title="Nicht gefunden" text={err} /></View>;
  if (!d) return <View style={[s.page, { backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={t.accent} /></View>;

  const it = d.item;
  const paid = it.price_paid != null ? it.price_paid * (it.qty || 1) : null;
  const cpw = paid && days.length ? paid / days.length : null;
  const hex = tileInfo?.hex ?? '#d8d2c8';
  const sInfo: StatusInfo = {
    status: it.status, status_at: it.status_at, status_where: it.status_where || null, status_until: it.status_until,
    lent_person_id: it.lent_person_id, lent_to: it.lent_to || null, sold_price: it.sold_price, sold_date: it.sold_date,
  };
  const personName = (pid: string) => wardrobe?.persons.find((p) => p.id === pid)?.name ?? null;
  const card = statusCard(sInfo, today, personName);
  const lendTo = (wardrobe?.persons ?? []).filter((p) => p.user_id !== session?.user.id);

  async function toggleWorn() {
    setBusy(true);
    try {
      await setWornToday(id, me?.id ?? null, !wornToday);
      setD((x) => x && { ...x, wears: wornToday ? x.wears.filter((w) => w !== today) : [...x.wears, today] });
      setToday(id, me?.id ?? null, !wornToday);
      reloadOutfits().catch(() => {}); // Statistik und Wochenleiste aktuell halten
      toast.show(wornToday ? 'Heute getragen entfernt.' : 'Als heute getragen eingetragen.');
    } catch (e) { toast.show('Speichern fehlgeschlagen: ' + (e as Error).message); }
    finally { setBusy(false); }
  }

  /** Status mit Zusatzangaben speichern (aus Menü, Blatt oder Schnellaktion der Karte) */
  async function applyStatus(next: StatusInfo) {
    await saveStatus(id, next);
    setD((x) => x && { ...x, item: { ...x.item, ...next } });
    patch(id, { status: next.status });
    setStatusSheet(null);
    toast.show(next.status ? `Status: ${statusDef(statusKey(next.status)).label}` : 'Wieder im Schrank.');
  }
  /** Menü: einfache Status sofort setzen, die anderen öffnen das Blatt */
  function pickStatus(k: StatusKey) {
    setMenu(null);
    if (statusDef(k).details) { setStatusSheet(k); return; }
    applyStatus(statusChange(k, {}, today)).catch((e) => toast.show('Speichern fehlgeschlagen: ' + (e as Error).message));
  }

  function openBuy() {
    // Besitzer: die des Wunschteils, sonst Besitzer der Liste, sonst ich
    const listOwner = wardrobe?.wishlists.find((w) => w.id === it.wishlist_id)?.ownerId;
    const owners = it.owner_ids?.length ? it.owner_ids : listOwner ? [listOwner] : me ? [me.id] : [];
    setBuy({ price: eur(it.list_price), date: toDe(today), owners });
  }

  async function confirmBuy() {
    if (!buy) return;
    const price = parseAmount(buy.price);
    const date = toIso(buy.date);
    if (buy.price.trim() && price == null) return setBuy({ ...buy, error: 'Preis ist keine Zahl.' });
    if (date === undefined) return setBuy({ ...buy, error: 'Kaufdatum bitte als TT.MM.JJJJ eingeben.' });
    if (!buy.owners.length) return setBuy({ ...buy, error: 'Bitte wählen, wem das Teil gehört.' });
    setBusy(true);
    try {
      await markBought(it, { price, date, owners: buy.owners });
      const ownerId = buy.owners.length === 1 ? buy.owners[0]! : null;
      setD((x) => x && { ...x, item: { ...x.item, is_wish: false, wishlist_id: null, wish_tag: null, price_paid: price, purchase_date: date, owner_ids: buy.owners, owner_id: ownerId } });
      patch(id, { isWish: false, wishlistId: null, wishTag: null, pricePaid: price, price: price ?? it.list_price, purchaseDate: date, owners: buy.owners, ownerId });
      setBuy(null);
      toast.show('Gekauft – jetzt im Schrank.');
    } catch (e) { setBuy({ ...buy, error: 'Speichern fehlgeschlagen: ' + (e as Error).message }); }
    finally { setBusy(false); }
  }

  async function saveHold() {
    if (!hold) return;
    const from = toIso(hold.from), to = toIso(hold.to || hold.from);
    if (!from || !to) return setHold({ ...hold, error: 'Datum bitte als TT.MM.JJJJ eingeben.' });
    if (to < from) return setHold({ ...hold, error: '„Bis“ liegt vor „Von“.' });
    if (to < today) return setHold({ ...hold, error: 'Der Zeitraum liegt in der Vergangenheit.' });
    setBusy(true);
    try {
      await holdItem(id, hold.who, from, to);
      setHold(null);
      loadHolds();
      reloadOutfits().catch(() => {}); // Bügel auf der Kachel
      const p = wardrobe?.persons.find((x) => x.id === hold.who);
      toast.show(`Reserviert${p ? ` für ${p.name}` : ''}: ${from === to ? fmtShort(from) : `${fmtShort(from)} – ${fmtShort(to)}`}.`);
    } catch (e) { setHold({ ...hold, error: 'Speichern fehlgeschlagen: ' + (e as Error).message }); }
    finally { setBusy(false); }
  }

  async function removeHold(hid: string) {
    try { await releaseHold(hid); loadHolds(); reloadOutfits().catch(() => {}); toast.show('Reservierung entfernt.'); }
    catch (e) { toast.show('Entfernen fehlgeschlagen: ' + (e as Error).message); }
  }

  function openSet() {
    setSetEdit({ members: [id, ...setMates.map((m) => m.id)], name: it.set_name ?? '', q: '' });
  }

  async function confirmSet() {
    if (!setEdit) return;
    setBusy(true);
    try {
      const before = [id, ...setMates.map((m) => m.id)];
      const sid = await saveSet(it.set_id, setEdit.members, setEdit.name.trim() || null);
      for (const x of new Set([...before, ...setEdit.members])) patch(x, { setId: setEdit.members.includes(x) ? sid : null });
      setD((x) => x && { ...x, item: { ...x.item, set_id: sid, set_name: sid ? setEdit.name.trim() || null : null } });
      setSetEdit(null);
      toast.show(sid ? 'Set gespeichert.' : 'Set aufgelöst.');
    } catch (e) { setSetEdit({ ...setEdit, error: 'Speichern fehlgeschlagen: ' + (e as Error).message }); }
    finally { setBusy(false); }
  }

  const holdText = (h: HoldRow) => {
    const p = wardrobe?.persons.find((x) => x.id === h.personId);
    return `${h.from === h.to ? fmtShort(h.from) : `${fmtShort(h.from)} – ${fmtShort(h.to)}`}${p ? ` · ${p.name}` : ''}`;
  };
  const otherHolds = hold ? holds.filter((h) => h.personId !== hold.who) : [];
  const setCandidates = setEdit ? (wardrobe?.items ?? []).filter((m) => m.id !== id && !m.isWish && m.status !== 'sold' &&
    (!setEdit.q.trim() || [m.name, m.brand, m.color].some((f) => f?.toLowerCase().includes(setEdit.q.trim().toLowerCase()))))
    .sort((a, b) => Number(setEdit.members.includes(b.id)) - Number(setEdit.members.includes(a.id)) || a.name.localeCompare(b.name, 'de')) : [];

  const info: [string, string | null | undefined][] = [
    ['Kategorie', categoryLast({ category: it.category, subcategory: it.subcategory, type: it.item_type })],
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
            <View style={{ width: '82%', height: '88%', alignItems: 'center', justifyContent: 'center' }}><ItemPicture uri={mainPic} inset={0} category={it.category} color={hex} /></View>
            {canExport && mainPic && (
              <View style={{ position: 'absolute', top: 10, right: 10 }}>
                <RoundButton label="Bild teilen" onPress={() => setExporting(true)}><Icons.share color={t.ink} /></RoundButton>
              </View>
            )}
            {owner && (
              <View style={s.ownerBadge}><Text style={{ fontFamily: DISPLAY, fontSize: 20, color: PERSON[personKey(owner.color)] }}>{owner.name.slice(0, 1)}</Text></View>
            )}
          </View>

          {/* Titel */}
          <View style={{ gap: 4, marginTop: space.md }}>
            <Text style={[s.title, { color: t.ink }]}>{it.name}</Text>
            <Text style={{ fontSize: 15, color: t.inkMuted }}>
              {[it.brand, paid != null ? formatEur(paid) : null, ownerList.length ? `gehört ${ownerList.map((p) => p.name).join(' und ')}` : null].filter(Boolean).join(' · ')}
            </Text>
          </View>

          {/* Status-Karte (Spec 3.1): nur wenn nicht „Im Schrank“; genau eine Schnellaktion, Ändern nur über den Status-Knopf */}
          {card && (
            <View style={[s.statusBar, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              <TileIcon name={card.icon} color={t.ink} size={22} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>{card.title}</Text>
                {card.details.length > 0 && <Text style={{ fontSize: 13, color: t.inkMuted }}>{card.details.join(' · ')}</Text>}
                {card.warn && <Text style={{ fontSize: 13, fontWeight: '600', color: t.accent }}>{card.warn}</Text>}
              </View>
              <Pressable hitSlop={8} accessibilityRole="button" onPress={() => {
                const to = card.action.to;
                if (to === 'sheet:sold') setStatusSheet('sold');
                else applyStatus(statusChange(to, sInfo, today)).catch((e) => toast.show('Speichern fehlgeschlagen: ' + (e as Error).message));
              }}><Text style={{ fontSize: 15, fontWeight: '600', color: t.actionText }}>{card.action.label}</Text></Pressable>
            </View>
          )}

          {it.is_wish && (
            <Pressable onPress={openBuy} accessibilityRole="button"
              style={({ pressed }) => [s.buyBtn, { opacity: pressed ? 0.8 : 1 }]}>
              <Icons.check color="#fff" />
              <Text style={{ fontSize: 17, fontWeight: '600', color: '#fff' }}>Gekauft – in den Schrank</Text>
            </Pressable>
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
            <Action label="Outfit damit" onPress={() => router.push(`/outfit-bauen?item=${id}`)} icon={(c) => <Icons.layers color={c} size={22} />} />
            <Action label="Reservieren" active={holds.some((h) => h.from <= today && h.to >= today)} onPress={() => setHold({ who: me?.id ?? null, from: toDe(today), to: toDe(today) })} icon={(c) => <Icons.calendar color={c} />} />
            <Action label="Status" active={!!it.status} onPress={(e) => setMenu(anchorFromPress(e))} icon={(c) => <TileIcon name={statusKey(it.status)} color={c} size={22} />} />
          </View>

          {/* Reservierungen ab heute */}
          {holds.length > 0 && (
            <Section title="Reserviert">
              <View style={[s.list, { backgroundColor: t.surface, borderColor: t.hairline }]}>
                {holds.map((h, n) => (
                  <View key={h.id} style={[s.listRow, n > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
                    <Text style={{ flex: 1, fontSize: 15, color: t.ink }}>{holdText(h)}</Text>
                    {h.planned ? <Text style={{ fontSize: 13, color: t.inkMuted }}>über Outfit</Text>
                      : <Pressable onPress={() => removeHold(h.id)} hitSlop={8} style={[s.smallBtn, { borderColor: t.hairline }]}><Text style={{ fontSize: 14, color: t.ink }}>Entfernen</Text></Pressable>}
                  </View>
                ))}
              </View>
            </Section>
          )}
          </>}

          {/* Set */}
          {!it.is_wish && setMates.length === 0 && (
            <Pressable onPress={openSet} accessibilityRole="button" style={({ pressed }) => [s.setBtn, { borderColor: t.hairline, backgroundColor: t.surface, opacity: pressed ? 0.7 : 1 }]}>
              <Icons.link color={t.ink} size={20} />
              <Text style={{ flex: 1, fontSize: 16, color: t.ink }}>Mit anderen Teilen zu einem Set verbinden</Text>
              <Icons.chevron color={t.inkMuted} />
            </Pressable>
          )}
          {setMates.length > 0 && (
            <Section title={it.set_name ? `Set · ${it.set_name}` : 'Set'} action={!it.is_wish ? { label: 'Bearbeiten', onPress: openSet } : undefined}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
                {setMates.map((m) => (
                  <Pressable key={m.id} onPress={() => router.push(`/teil/${m.id}`)} accessibilityLabel={m.name}
                    style={[s.mini, { boxShadow: `inset 0 0 14px 2px ${(m.hex ?? '#d8d2c8')}73, 0 1px 4px rgba(42,26,29,0.10)` }]}>
                    <ItemPicture uri={m.thumb} inset={6} category={m.category} color={m.hex ?? '#8e8e93'} />
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
                  <Pressable key={o.id} onPress={() => router.push(`/outfit/${o.id}`)} accessibilityRole="button"
                    style={({ pressed }) => [s.listRow, n > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }, { opacity: pressed ? 0.6 : 1 }]}>
                    <Text style={{ flex: 1, fontSize: 16, color: t.ink }} numberOfLines={1}>{o.name || outfitLabel(o.id)}</Text>
                    {!!o.occasions?.length && <Text style={{ fontSize: 13, color: t.inkMuted }}>{o.occasions.join(', ')}</Text>}
                    <Icons.chevron color={t.inkMuted} />
                  </Pressable>
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

      <StatusMenu open={!!menu} anchor={menu} current={statusKey(it.status)} onPick={pickStatus} onClose={() => setMenu(null)} />
      <StatusSheet open={!!statusSheet} start={statusSheet ?? 'closet'} info={sInfo} persons={lendTo} today={today}
        onSave={applyStatus} onClose={() => setStatusSheet(null)} />
      <Sheet open={!!buy} onClose={() => setBuy(null)} title="Gekauft!"
        footer={<>
          <SheetButton label="Abbrechen" onPress={() => setBuy(null)} />
          <SheetButton primary label={busy ? 'Speichert …' : 'In den Schrank'} onPress={() => { if (!busy) confirmBuy(); }} />
        </>}>
        {buy && (
          <View style={{ gap: space.md }}>
            <BuyField label="Bezahlt (€)" value={buy.price} onText={(v) => setBuy({ ...buy, price: v, error: undefined })} placeholder="0,00" keyboardType="decimal-pad" />
            <BuyField label="Kaufdatum" value={buy.date} onText={(v) => setBuy({ ...buy, date: v, error: undefined })} placeholder="TT.MM.JJJJ" keyboardType="numbers-and-punctuation" />
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, color: t.inkMuted }}>Gehört</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                {(wardrobe?.persons ?? []).map((p) => {
                  const on = buy.owners.includes(p.id);
                  return <Chip key={p.id} label={p.name} selected={on} dot={PERSON[personKey(p.color)]}
                    onPress={() => setBuy({ ...buy, error: undefined, owners: on ? buy.owners.filter((x) => x !== p.id) : [...buy.owners, p.id] })} />;
                })}
              </View>
            </View>
            {buy.error && <Text style={{ fontSize: 15, color: '#C8102E' }}>{buy.error}</Text>}
          </View>
        )}
      </Sheet>
      <Sheet open={!!hold} onClose={() => setHold(null)} title="Reservieren"
        footer={<>
          <SheetButton label="Abbrechen" onPress={() => setHold(null)} />
          <SheetButton primary label={busy ? 'Speichert …' : 'Reservieren'} onPress={() => { if (!busy) saveHold(); }} />
        </>}>
        {hold && (
          <View style={{ gap: space.md }}>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, color: t.inkMuted }}>Für</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                {(wardrobe?.persons ?? []).map((p) => (
                  <Chip key={p.id} label={p.id === me?.id ? `${p.name} (ich)` : p.name} dot={PERSON[personKey(p.color)]} selected={hold.who === p.id}
                    onPress={() => setHold({ ...hold, who: p.id, error: undefined })} />
                ))}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, color: t.inkMuted }}>Schnell</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                {[['Heute', 0, 0], ['Morgen', 1, 1], ['Wochenende', ...weekend(today)], ['7 Tage', 0, 6]].map(([l, a, b]) => {
                  const from = toDe(addDaysIso(today, a as number)), to = toDe(addDaysIso(today, b as number));
                  return <Chip key={l as string} label={l as string} selected={hold.from === from && hold.to === to} onPress={() => setHold({ ...hold, from, to, error: undefined })} />;
                })}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}><BuyField label="Von" value={hold.from} onText={(v) => setHold({ ...hold, from: v, error: undefined })} placeholder="TT.MM.JJJJ" keyboardType="numbers-and-punctuation" /></View>
              <View style={{ flex: 1 }}><BuyField label="Bis" value={hold.to} onText={(v) => setHold({ ...hold, to: v, error: undefined })} placeholder="TT.MM.JJJJ" keyboardType="numbers-and-punctuation" /></View>
            </View>
            {otherHolds.length > 0 && (
              <Text style={[s.warn, { color: t.ink, borderColor: '#E8D27A' }]}>Schon reserviert: {otherHolds.map(holdText).join(', ')}</Text>
            )}
            {hold.error && <Text style={{ fontSize: 15, color: '#C8102E' }}>{hold.error}</Text>}
          </View>
        )}
      </Sheet>
      <Sheet open={!!setEdit} onClose={() => setSetEdit(null)} title="Set"
        footer={<>
          <SheetButton label="Abbrechen" onPress={() => setSetEdit(null)} />
          <SheetButton primary label={busy ? 'Speichert …' : 'Speichern'} onPress={() => { if (!busy) confirmSet(); }} />
        </>}>
        {setEdit && (
          <View style={{ gap: space.md }}>
            <Text style={{ fontSize: 15, color: t.inkMuted }}>Teile, die zusammengehören (z. B. Anzug oder Trainingsanzug). Im Outfit-Baukasten wird dann nachgefragt, ob du das ganze Set trägst.</Text>
            <BuyField label="Name (optional)" value={setEdit.name} onText={(v) => setSetEdit({ ...setEdit, name: v })} placeholder="z. B. Trainingsanzug" maxLength={40} />
            <BuyField label="Teile suchen" value={setEdit.q} onText={(v) => setSetEdit({ ...setEdit, q: v })} placeholder="Name, Marke oder Farbe" />
            <View style={[s.list, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              {setCandidates.slice(0, 40).map((m, n) => {
                const on = setEdit.members.includes(m.id);
                return (
                  <Pressable key={m.id} onPress={() => setSetEdit({ ...setEdit, error: undefined, members: on ? setEdit.members.filter((x) => x !== m.id) : [...setEdit.members, m.id] })}
                    accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                    style={({ pressed }) => [s.listRow, n > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }, { opacity: pressed ? 0.6 : 1 }]}>
                    <View style={s.thumb}><ItemPicture uri={m.thumb} inset={2} category={m.category} color={m.hex ?? '#8e8e93'} /></View>
                    <Text style={{ flex: 1, fontSize: 15, color: t.ink }} numberOfLines={1}>{m.name || 'Teil'}{m.setId && m.setId !== it.set_id ? ' · in anderem Set' : ''}</Text>
                    <View style={[s.check, { borderColor: on ? '#722638' : t.hairline, backgroundColor: on ? '#722638' : 'transparent' }]}>{on && <Icons.check color="#fff" size={16} />}</View>
                  </Pressable>
                );
              })}
            </View>
            {setEdit.error && <Text style={{ fontSize: 15, color: '#C8102E' }}>{setEdit.error}</Text>}
          </View>
        )}
      </Sheet>
      {canExport && (
        <ExportSheet open={exporting} onClose={() => setExporting(false)} title="Bild teilen" name={`${fileName(it.name)}.png`}
          make={() => itemPng(mainPic!)} />
      )}
      {toast.node}
    </View>
  );
}

const addDaysIso = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); return todayLocal(new Date(y!, m! - 1, d! + n)); };
/** Nächstes Wochenende (Sa–So); am Sonntag nur heute */
function weekend(iso: string): [number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(y!, m! - 1, d!).getDay();
  return wd === 0 ? [0, 0] : [6 - wd, 7 - wd];
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

function BuyField({ label, value, onText, ...p }: { label: string; value: string; onText: (v: string) => void } & React.ComponentProps<typeof TextInput>) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, color: t.inkMuted }}>{label}</Text>
      <TextInput value={value} onChangeText={onText} placeholderTextColor={t.inkMuted} {...p}
        style={[s.input, { backgroundColor: t.surface, borderColor: t.hairline, color: t.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} />
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

function Action({ label, icon, onPress, active, disabled }: { label: string; icon: (c: string) => React.ReactNode; onPress: (e: GestureResponderEvent) => void; active?: boolean; disabled?: boolean }) {
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

function Section({ title, children, action }: { title: string; children?: React.ReactNode; action?: { label: string; onPress: () => void } }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={[s.sectionTitle, { color: t.ink }]}>{title}</Text>
        {action && <Pressable onPress={action.onPress} hitSlop={8}><Text style={{ fontSize: 15, fontWeight: '600', color: t.actionText }}>{action.label}</Text></Pressable>}
      </View>
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
  mini: { width: 76, height: 76, borderRadius: 18, overflow: 'hidden', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  list: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md, paddingVertical: space.sm },
  moreHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.xs, minHeight: 44 },
  buyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, height: 52, borderRadius: 26, backgroundColor: '#722638', marginTop: space.lg },
  smallBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  setBtn: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, marginTop: space.lg },
  thumb: { width: 40, height: 40, borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  warn: { fontSize: 14, backgroundColor: '#FBF1C2', borderWidth: 1, borderRadius: radius.sm, padding: space.sm },
  input: { height: 50, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: space.md, fontSize: 17 },
});

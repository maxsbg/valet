import { useBottomInset } from '@/lib/bottomInset';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { Page } from '@/components/Page';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { categoryLabel, formatEur, parseAmount } from '@valet/core';
import { Icons } from '@/components/Icon';
import { ItemPicture } from '@/components/ItemPicture';
import { RoundButton, Empty, Chip, useToast } from '@/components/ui';
import { eur, toDe, toIso } from '@/components/ItemForm';
import { Sheet, OptionRow, SheetButton } from '@/components/Sheet';
import { useSession } from '@/lib/session';
import { useTheme, DISPLAY, space, radius, tile } from '@/lib/theme';
import { loadItem, wornDays, setWornToday, setStatus, markBought, type ItemDetail, type ItemRow } from '@/lib/item';
import { personKey, todayLocal } from '@/lib/wardrobe';
import { addDays, itemReservations, itemClashes, reserveItem, deleteReservation } from '@/lib/outfits';

const STATUS_OPTIONS: { id: ItemRow['status']; label: string; text: string }[] = [
  { id: null, label: 'Im Schrank', text: 'Im Schrank' },
  { id: 'wash', label: 'Wäsche', text: 'In der Wäsche' },
  { id: 'repair', label: 'Reparatur', text: 'In Reparatur' },
  { id: 'lent', label: 'Verliehen', text: 'Verliehen' },
  { id: 'out', label: 'Aussortiert', text: 'Aussortiert' },
  { id: 'sold', label: 'Verkauft', text: 'Verkauft' },
];
const PERSON = { pink: '#D9668E', red: '#C8102E' } as const;
/** „20.11.“ bzw. „20.–22.11.“ bzw. „30.11.–2.12.“ */
const range = (from: string, to: string) => {
  const d = (x: string) => Number(x.slice(8)); const m = (x: string) => Number(x.slice(5, 7));
  if (from === to) return `${d(from)}.${m(from)}.`;
  return m(from) === m(to) ? `${d(from)}.–${d(to)}.${m(to)}.` : `${d(from)}.${m(from)}.–${d(to)}.${m(to)}.`;
};
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
  const [sheet, setSheet] = useState(false);
  const [lentTo, setLentTo] = useState('');
  const [pickLent, setPickLent] = useState(false);
  const [more, setMore] = useState(false);
  // Wunschteil gekauft → Schrank
  // Einzeln reservieren
  type Res = Awaited<ReturnType<typeof itemReservations>>;
  const [res, setRes] = useState<Res>([]);
  const [rsv, setRsv] = useState<{ who: string | null; from: string; to: string; error?: string; clash?: string } | null>(null);
  const [buy, setBuy] = useState<{ price: string; date: string; owners: string[]; error?: string } | null>(null);
  const bottom = useBottomInset();
  const toast = useToast(bottom + space.lg);

  const load = useCallback(() => {
    loadItem(id).then(setD).catch((e) => setErr(e.message ?? String(e)));
    itemReservations(id).then(setRes).catch(() => {});
  }, [id]);
  useFocusEffect(load);

  const tileInfo = wardrobe?.items.find((i) => i.id === id);
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
  const st = STATUS_OPTIONS.find((o) => o.id === it.status) ?? STATUS_OPTIONS[0];

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

  async function changeStatus(next: ItemRow['status'], to?: string) {
    setSheet(false); setPickLent(false);
    try {
      await setStatus(id, next, to);
      setD((x) => x && { ...x, item: { ...x.item, status: next, status_at: next ? today : null, lent_to: next === 'lent' ? to ?? null : null } });
      patch(id, { status: next });
      toast.show(next ? `Status: ${STATUS_OPTIONS.find((o) => o.id === next)!.label}` : 'Wieder im Schrank.');
    } catch (e) { toast.show('Speichern fehlgeschlagen: ' + (e as Error).message); }
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

  const nameOf = (pid: string | null) => wardrobe?.persons.find((p) => p.id === pid)?.name;

  function openReserve() {
    setRsv({ who: me?.id ?? wardrobe?.persons[0]?.id ?? null, from: toDe(today), to: toDe(today) });
  }

  async function confirmReserve() {
    if (!rsv) return;
    const from = toIso(rsv.from); const to = toIso(rsv.to);
    if (!from || !to) return setRsv({ ...rsv, error: 'Datum bitte als TT.MM.JJJJ eingeben.', clash: undefined });
    if (to < from) return setRsv({ ...rsv, error: '„Bis“ liegt vor „Von“.', clash: undefined });
    if (to < today) return setRsv({ ...rsv, error: 'Der Zeitraum liegt in der Vergangenheit.', clash: undefined });
    setBusy(true);
    try {
      // Überschneidung mit anderen: einmal warnen, beim zweiten Tippen trotzdem speichern
      if (!rsv.clash) {
        const cl = await itemClashes(id, rsv.who, from, to);
        if (cl.length) {
          const c = cl[0]!;
          return setRsv({ ...rsv, error: undefined, clash: `Schon reserviert${nameOf(c.person_id) ? ` von ${nameOf(c.person_id)}` : ''} (${range(c.date_from, c.date_to)}). Trotzdem reservieren?` });
        }
      }
      await reserveItem(id, rsv.who, from, to);
      setRsv(null);
      setRes(await itemReservations(id));
      reloadOutfits().catch(() => {});
      toast.show(`Reserviert für ${range(from, to)}`);
    } catch (e) { setRsv({ ...rsv, error: 'Speichern fehlgeschlagen: ' + (e as Error).message }); }
    finally { setBusy(false); }
  }

  async function removeReservation(rid: string) {
    try {
      await deleteReservation(rid);
      setRes((x) => x.filter((r) => r.id !== rid));
      reloadOutfits().catch(() => {});
      toast.show('Reservierung aufgehoben.');
    } catch (e) { toast.show('Entfernen fehlgeschlagen: ' + (e as Error).message); }
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
            <View style={{ width: '82%', height: '88%', alignItems: 'center', justifyContent: 'center' }}><ItemPicture uri={tileInfo?.image ?? tileInfo?.thumb} inset={0} category={it.category} color={hex} /></View>
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
            <Action label="Reservieren" active={res.some((r) => r.from <= today)} onPress={openReserve} icon={(c) => <Icons.calendar color={c} />} />
            <Action label="Status" active={!!it.status} onPress={() => { setLentTo(it.lent_to ?? ''); setSheet(true); }} icon={(c) => <Icons.closet color={c} />} />
          </View>

          {/* Reservierungen ab heute */}
          {res.length > 0 && (
            <Section title="Reserviert">
              <View style={[s.list, { backgroundColor: t.surface, borderColor: t.hairline }]}>
                {res.map((r, n) => (
                  <View key={r.id} style={[s.listRow, n > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
                    <Text style={{ flex: 1, fontSize: 16, color: t.ink }}>
                      {range(r.from, r.to)}{nameOf(r.personId) ? ` · ${nameOf(r.personId)}` : ''}
                    </Text>
                    {r.viaOutfit
                      ? <Text style={{ fontSize: 13, color: t.inkMuted }}>über Outfit</Text>
                      : <Pressable onPress={() => removeReservation(r.id)} hitSlop={8}><Text style={{ fontSize: 15, fontWeight: '600', color: t.actionText }}>Aufheben</Text></Pressable>}
                  </View>
                ))}
              </View>
            </Section>
          )}
          </>}

          {/* Set */}
          {setMates.length > 0 && (
            <Section title={it.set_name ? `Set · ${it.set_name}` : 'Set'}>
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
      <Sheet open={!!rsv} onClose={() => setRsv(null)} title="Reservieren"
        footer={<>
          <SheetButton label="Abbrechen" onPress={() => setRsv(null)} />
          <SheetButton primary label={busy ? 'Speichert …' : rsv?.clash ? 'Trotzdem' : 'Reservieren'} onPress={() => { if (!busy) confirmReserve(); }} />
        </>}>
        {rsv && (
          <View style={{ gap: space.md }}>
            {(wardrobe?.persons.length ?? 0) > 1 && (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, color: t.inkMuted }}>Für wen?</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                  {(wardrobe?.persons ?? []).map((p) => (
                    <Chip key={p.id} label={p.id === me?.id ? `${p.name} (ich)` : p.name} dot={PERSON[personKey(p.color)]} selected={rsv.who === p.id}
                      onPress={() => setRsv({ ...rsv, who: p.id, clash: undefined, error: undefined })} />
                  ))}
                </View>
              </View>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {([['Heute', 0, 0], ['Morgen', 1, 1], ['7 Tage', 0, 6]] as const).map(([label, a, b]) => {
                const f = toDe(addDays(today, a)); const e = toDe(addDays(today, b));
                return <Chip key={label} label={label} selected={rsv.from === f && rsv.to === e} onPress={() => setRsv({ ...rsv, from: f, to: e, clash: undefined, error: undefined })} />;
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}><BuyField label="Von" value={rsv.from} onText={(v) => setRsv({ ...rsv, from: v, clash: undefined, error: undefined })} placeholder="TT.MM.JJJJ" keyboardType="numbers-and-punctuation" /></View>
              <View style={{ flex: 1 }}><BuyField label="Bis" value={rsv.to} onText={(v) => setRsv({ ...rsv, to: v, clash: undefined, error: undefined })} placeholder="TT.MM.JJJJ" keyboardType="numbers-and-punctuation" /></View>
            </View>
            {rsv.clash && <Text style={{ fontSize: 15, color: t.ink }}>{rsv.clash}</Text>}
            {rsv.error && <Text style={{ fontSize: 15, color: '#C8102E' }}>{rsv.error}</Text>}
          </View>
        )}
      </Sheet>

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
  mini: { width: 76, height: 76, borderRadius: 18, overflow: 'hidden', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  list: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md, paddingVertical: space.sm },
  moreHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.xs, minHeight: 44 },
  buyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, height: 52, borderRadius: 26, backgroundColor: '#722638', marginTop: space.lg },
  input: { height: 50, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: space.md, fontSize: 17 },
});

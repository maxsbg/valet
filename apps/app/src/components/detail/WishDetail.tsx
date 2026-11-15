// Wunschteil-Detail (VALET_DETAILSEITE_SPEC.md, Abschnitte 2–5, Stufe 5; Leinwand „E · Wunschteil“):
// gleicher Aufbau wie das Schrank-Teil – Kopf, Bild-Kachel (Kategorie oben links, Preis unten links), Reiter
// Übersicht · Steckbrief · Kauf. Werkzeugleiste: Kategorie, Kauftag planen | Würfel „im Outfit ansehen“, Gekauft.
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { agoLabel, buyDayHint, buyDayLabel, buyDefaults, confirmCare, toEditForm, wishOwners, wishTagLabel, type CareGroup, type EditRow, type WishRow, type WishTag } from '@valet/core';
import { detail } from '@valet/ui';
import { useSession } from '@/lib/session';
import { useTheme, DISPLAY } from '@/lib/theme';
import { useBottomInset } from '@/lib/bottomInset';
import { todayLocal } from '@/lib/wardrobe';
import { loadItem, markBought, updateItem, type ItemDetail } from '@/lib/item';
import { wishlistNav } from '@/lib/wishlists';
import { canExport, fileName, itemPng } from '@/lib/share';
import { Page } from '@/components/Page';
import { Empty, useToast } from '@/components/ui';
import { ExportSheet } from '@/components/ExportSheet';
import { TileIcon, type TileIconName } from '@/components/tile/TileIcons';
import { useTilePeople } from '@/components/Mosaic';
import { Segmented } from '@/components/edit/fields';
import { DetailImage } from './DetailImage';
import { Toolbar, TOOLBAR_SPACE } from './Toolbar';
import { PullMenu, type Anchor } from '@/components/StatusMenu';
import { Glyph, GLYPHS, HeadButton } from './parts';
import { NotesCard, SteckbriefView } from './sections';
import { CareConfirmSheet } from './sheets';
import { BoughtSheet, BuyDaySheet, TryOnCard, WishKaufView, WishListRow, WorthCard, WISH_ORDER, type BuyInput } from './wish';

type Tab = 'overview' | 'profile' | 'purchase';

export function WishDetail({ id }: { id: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset();
  const { width: W } = useWindowDimensions();
  const col = Math.min(W - 32, 520);
  const { wardrobe, patch } = useSession();
  const { me, person } = useTilePeople();
  const toast = useToast(bottom + TOOLBAR_SPACE);
  const [d, setD] = useState<ItemDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [sheet, setSheet] = useState<'day' | 'buy' | null>(null);
  const [menu, setMenu] = useState<Anchor | null>(null);
  const [exporting, setExporting] = useState(false);
  const [care, setCare] = useState<CareGroup | null>(null);

  const today = todayLocal();
  const load = useCallback(() => { loadItem(id).then(setD).catch((e) => setErr(e.message ?? String(e))); }, [id]);
  useFocusEffect(load);

  const tile = wardrobe?.items.find((i) => i.id === id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/wunschliste'));
  const edit = (tabName?: 'kauf') => router.push(`/bearbeiten/${id}${tabName ? `?reiter=${tabName}` : ''}`);

  if (err) return <View style={[s.page, { backgroundColor: t.bg, paddingTop: insets.top + 6, paddingHorizontal: 16 }]}><HeadButton glyph="back" label="Zurück" onPress={back} /><Empty title="Nicht gefunden" text={err} /></View>;
  if (!d || !tile) return <View style={[s.page, { backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={t.accent} /></View>;

  const it = d.item;
  const row = it as unknown as EditRow & WishRow & typeof it;
  const f = toEditForm(row);
  const mainPic = tile.image ?? tile.thumb;
  const list = wardrobe?.wishlists.find((l) => l.id === it.wishlist_id) ?? null;
  const owners = wishOwners(it.owner_ids, list?.ownerId);
  const byId = new Map((wardrobe?.items ?? []).map((i) => [i.id, i] as const));
  const outfits = (wardrobe?.outfits ?? []).filter((o) => o.pieces.some((p) => p.id === id));
  const tag = f.wishTag;
  const fail = (e: unknown) => toast.show('Speichern fehlgeschlagen: ' + (e as Error).message);
  const tryOn = () => router.push(`/outfit-bauen?item=${id}`);

  async function pickTag(next: WishTag | null) {
    try {
      await updateItem(id, { wish_tag: next });
      setD((x) => x && { ...x, item: { ...x.item, wish_tag: next } });
      patch(id, { wishTag: next });
      setMenu(null);
      toast.show(next ? `Kategorie: ${wishTagLabel(next)}` : 'Kategorie entfernt.');
    } catch (e) { fail(e); }
  }
  async function saveDay(day: string | null) {
    await updateItem(id, { buy_on: day });
    setD((x) => x && { ...x, item: { ...x.item, buy_on: day } as typeof x.item });
    setSheet(null);
    toast.show(day ? `Kauftag: ${buyDayLabel(day)}` : 'Kauftag entfernt.');
  }
  async function bought(b: BuyInput) {
    await markBought(it, { price: b.price, date: b.date, owners: b.owners });
    const ownerId = b.owners.length === 1 ? b.owners[0]! : null;
    patch(id, { isWish: false, wishlistId: null, wishTag: null, pricePaid: b.price, price: b.price ?? it.list_price, purchaseDate: b.date, owners: b.owners, ownerId });
    setSheet(null);
    toast.show('Gekauft – jetzt im Schrank.');
    // Seite zeigt ab jetzt das Schrank-Teil (Teil in /teil/[id] entscheidet nach isWish)
  }
  function openList() {
    if (!list) { edit('kauf'); return; }
    wishlistNav.open = list.id;
    router.push('/wunschliste');
  }
  async function confirmCareValue() {
    if (!care) return;
    const next = confirmCare(f.care, care);
    try { await updateItem(id, { care: next }); setD((x) => x && { ...x, item: { ...x.item, care: next } as typeof x.item }); setCare(null); } catch (e) { fail(e); }
  }

  const overview = (
    <>
      <WishListRow name={list?.name ?? null} saved={row.created_at ? agoLabel(row.created_at.slice(0, 10), today) : null} onPress={openList} />
      {row.buy_on && (
        <Text style={{ fontSize: 13, color: t.inkMuted, marginTop: -6, paddingHorizontal: 4 }}>
          Kauftag geplant: {buyDayLabel(row.buy_on)} · {buyDayHint(row.buy_on, today)}
        </Text>
      )}
      <WorthCard />
      <TryOnCard outfits={outfits} byId={byId} width={col} onOpen={(o) => router.push(`/outfit/${o}`)} onTry={tryOn} />
      {!!it.notes && <NotesCard text={it.notes} />}
    </>
  );

  return (
    <View style={[s.page, { backgroundColor: t.bg }]}>
      <Page contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: bottom + TOOLBAR_SPACE, alignItems: 'center' }}>
        <View style={{ width: col, gap: 14 }}>
          <View style={s.head}>
            <HeadButton glyph="back" label="Zurück" onPress={back} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {canExport && mainPic && <HeadButton glyph="share" label="Bild teilen" onPress={() => setExporting(true)} />}
              <HeadButton glyph="edit" label="Bearbeiten" onPress={() => edit()} />
            </View>
          </View>

          <DetailImage width={Math.min(col, 420)} me={me} person={person}
            item={{ id, name: it.name, kind: tile.kind, hex: tile.hex, highlight: tile.highlight, status: null, reversible: !!it.reversible, qty: 1,
              owners, image: mainPic, imageBack: tile.imageBack, wish: { tag, price: it.list_price } }} />

          <View style={{ gap: 2, marginTop: 4 }}>
            {!!it.brand && <Text style={[s.brand, { color: t.inkMuted }]}>{it.brand}</Text>}
            <Text style={[s.name, { color: t.ink }]}>{it.name}</Text>
          </View>
          <Segmented items={[{ key: 'overview', label: 'Übersicht' }, { key: 'profile', label: 'Steckbrief' }, { key: 'purchase', label: 'Kauf' }]} value={tab} onChange={setTab} />

          {tab === 'overview' ? overview
            : tab === 'profile' ? <SteckbriefView f={f} onCare={setCare} onEdit={() => edit()} />
            : <WishKaufView row={row} link={f.link} onEdit={() => edit('kauf')} />}
        </View>
      </Page>

      <Toolbar
        left={[
          { label: tag ? `Kategorie: ${wishTagLabel(tag)}, ändern` : 'Kategorie wählen',
            icon: (c) => (tag ? <TileIcon name={tag as TileIconName} color={c} size={detail.toolbar.icon} /> : <Glyph d={GLYPHS.tagNone} color={c} />), onPress: (_e, g) => setMenu(g) },
          { label: row.buy_on ? `Kauftag ${buyDayLabel(row.buy_on)}, ändern` : 'Kauftag planen', active: !!row.buy_on,
            icon: (c) => <Glyph d={GLYPHS.calendar} color={c} />, onPress: () => setSheet('day') },
        ]}
        right={[{ label: 'Im Outfit ansehen', icon: (c) => <Glyph d={GLYPHS.dice} color={c} />, onPress: tryOn }]}
        main={{ label: 'Gekauft – in den Schrank', onPress: () => setSheet('buy'), icon: (c) => <Glyph d={GLYPHS.bagCheck} size={24} color={c} stroke={2.1} /> }}
      />

      <PullMenu open={!!menu} anchor={menu} label="Kategorie" onClose={() => setMenu(null)}
        sections={[
          WISH_ORDER.map((w) => ({ key: w, label: wishTagLabel(w) ?? w, icon: w as TileIconName, current: tag === w })),
          tag ? [{ key: '', label: 'Ohne Kategorie' }] : [],
        ]}
        onPick={(k) => { if (k === (tag ?? '')) setMenu(null); else pickTag((k || null) as WishTag | null); }} />
      <BuyDaySheet open={sheet === 'day'} current={row.buy_on} today={today} onSave={saveDay} onClose={() => setSheet(null)} />
      <BoughtSheet open={sheet === 'buy'} persons={wardrobe?.persons ?? []} meId={me} today={today} onSave={bought} onClose={() => setSheet(null)}
        start={buyDefaults({ ownerIds: it.owner_ids, listOwner: list?.ownerId, me, price: it.list_price, today })} />
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
});

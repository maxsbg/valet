import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Page } from '@/components/Page';
import { categoryLabel, closetStats, formatEur, seasonLabel, spendStats, wearStats, IDLE_DAYS, type StatItem, type WearLog, type WearPeriod, type Outfit as CoreOutfit } from '@valet/core';
import { OutfitBoard } from '@/components/OutfitBoard';
import { Header, Chip, Empty, PageEnd } from '@/components/ui';
import { ItemPicture } from '@/components/ItemPicture';
import { Invite } from '@/components/Invite';
import { ProfileBatch } from '@/components/ProfileBatch';
import { useSession } from '@/lib/session';
import { usePersisted } from '@/lib/usePersisted';
import { useTheme, space, radius, DISPLAY, type Theme } from '@/lib/theme';
import { useScreen } from '@/lib/useScreen';
import { personKey, type Person, type Tile } from '@/lib/wardrobe';
import { Monogram } from '@/components/Monogram';
import { Icon } from '@/components/Icon';

type Tab = 'spend' | 'wear' | 'closet';
const TABS: [Tab, string][] = [['spend', 'Ausgaben'], ['wear', 'Getragen'], ['closet', 'Bestand']];
const STATUS_TEXT: Record<string, string> = { wash: 'in der Wäsche', repair: 'in Reparatur', lent: 'verliehen', stored: 'eingelagert', out: 'aussortiert', sold: 'verkauft' };

export default function Statistik() {
  const t = useTheme();
  const scr = useScreen();
  const { wardrobe, session } = useSession();
  const [tab, setTab] = usePersisted<Tab>('valet.statsTab', 'spend');
  const [scopeSel, setScope] = useState<string | null>(null);
  const [allBrands, setAllBrands] = useState(false);
  const [period, setPeriod] = usePersisted<WearPeriod>('valet.wearPeriod', '30');

  const persons = wardrobe?.persons ?? [];
  const me = persons.find((p) => p.user_id === session?.user.id) ?? null;
  const scope = scopeSel && (scopeSel === 'all' || persons.some((p) => p.id === scopeSel)) ? scopeSel : me ? me.id : 'all';
  const P = scope === 'all' ? null : persons.find((p) => p.id === scope) ?? null;
  const items = wardrobe?.items ?? [];
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i] as [string, Tile])), [items]);
  const withoutPicture = items.filter((i) => !i.thumb).length;

  const stat: StatItem[] = useMemo(() => items.map((i) => ({
    id: i.id, ownerId: i.ownerId, category: i.category, brand: i.brand, qty: i.qty, pricePaid: i.pricePaid, listPrice: i.listPrice,
    payers: i.payers, purchaseDate: i.purchaseDate, status: i.status, soldPrice: i.soldPrice, isWish: i.isWish, isGift: i.isGift, createdAt: i.createdAt, seasons: i.seasons,
  })), [items]);
  const wears: WearLog = useMemo(() => {
    const m: WearLog = {};
    for (const w of wardrobe?.wears ?? []) (m[w.itemId] ??= []).push(w.date);
    return m;
  }, [wardrobe]);
  const outfits: CoreOutfit[] = useMemo(() => (wardrobe?.outfits ?? []).map((o) => ({
    id: o.id, ownerId: o.ownerId, occasions: o.occasions, itemIds: o.pieces.map((p) => p.id),
    plans: o.plans.map((p) => ({ id: p.id, date: p.date, personId: p.personId })),
  })), [wardrobe]);
  const personIds = persons.map((p) => p.id);

  const body = () => {
    if (!items.length) return <Empty title="Noch keine Daten" text="Sobald du Teile mit Preisen einträgst, siehst du hier deine Ausgaben." />;
    if (tab === 'spend') {
      const r = spendStats(stat, P?.id ?? null, personIds);
      const brands = r.brands.slice(0, allBrands ? 999 : 8), maxB = Math.max(1, ...r.brands.map((b) => b.value));
      const people = P ? [] : [
        ...r.byPerson.map((x) => { const p = persons.find((y) => y.id === x.key)!; return { label: p.name + (p.id === me?.id ? ' (ich)' : ''), value: x.value, color: t.person[personKey(p.color)], person: p as Person | undefined }; }),
        ...(r.unassigned ? [{ label: 'ohne Zuordnung', value: r.unassigned, color: '#c4bfb4', person: undefined }] : []),
      ].sort((a, b) => b.value - a.value);
      return (
        <>
          <View style={s.tiles}>
            <StatTile t={t} label={P ? (P.id === me?.id ? 'Von dir ausgegeben' : `Von ${P.name} ausgegeben`) : 'Ausgegeben'} value={formatEur(r.total)}
              hint={`${r.revenue ? `netto ${formatEur(r.total - r.revenue)} · ` : ''}${P ? `alle zusammen ${formatEur(r.allTotal)}` : `${r.paidPieces} Teile mit Preis`}`} />
            <StatTile t={t} label="Gespart ggü. Listenpreis" value={formatEur(r.saved)} good={r.saved > 0}
              hint={r.listSum ? `${Math.round((r.saved / r.listSum) * 100)} % von ${formatEur(r.listSum)}` : 'Listenpreise fehlen'} />
            <StatTile t={t} label="Ø pro Teil" value={formatEur(r.avg)} hint={r.missing ? `${r.missing} ohne Preis` : 'alle mit Preis'} />
            <StatTile t={t} label="Marken" value={String(r.brands.length)} hint={r.brands[0] ? `meiste: ${r.brands[0].key}` : 'noch keine'} />
          </View>
          {r.brands.length > 0 && (
            <Panel t={t} title="Ausgaben nach Marke">
              {brands.map((b) => <Bar key={b.key} t={t} label={b.key} sub={`${b.count} ${b.count === 1 ? 'Teil' : 'Teile'}`} value={b.value} max={maxB} text={formatEur(b.value)} />)}
              {r.noBrand > 0 && <Bar t={t} label="ohne Marke" value={r.noBrand} max={maxB} text={formatEur(r.noBrand)} color="#c4bfb4" dim />}
              {r.brands.length > 8 && (
                <Pressable accessibilityRole="button" onPress={() => setAllBrands(!allBrands)} hitSlop={6}><Text style={[s.more, { color: t.accent }]}>{allBrands ? 'Weniger zeigen' : `Alle ${r.brands.length} Marken`}</Text></Pressable>
              )}
            </Panel>
          )}
          {people.length > 0 && (
            <Panel t={t} title="Ausgaben nach Person">
              {people.map((x) => <Bar key={x.label} t={t} label={x.label} value={x.value} max={Math.max(1, ...people.map((y) => y.value))} text={formatEur(x.value)} color={x.color} person={x.person} />)}
            </Panel>
          )}
          {r.categories.length > 0 && (
            <Panel t={t} title="Ausgaben nach Kategorie">
              {r.categories.map((c) => <Bar key={c.key} t={t} label={categoryLabel(c.key)} value={c.value} max={r.categories[0]!.value} text={formatEur(c.value)} />)}
              {/* Geschenke: 0 € in eigener Zeile (Spec 5) */}
              {r.gifts > 0 && <Bar t={t} label="Geschenke" sub={`${r.gifts} ${r.gifts === 1 ? 'Teil' : 'Teile'}`} value={0} max={r.categories[0]!.value} text={formatEur(0)} color="#c4bfb4" dim />}
            </Panel>
          )}
          {r.years.length > 0 && (
            <Panel t={t} title="Ausgaben nach Kaufjahr">
              {r.years.map((y) => <Bar key={y.key} t={t} label={y.key} value={y.value} max={Math.max(...r.years.map((z) => z.value))} text={formatEur(y.value)} />)}
            </Panel>
          )}
          {r.top.length > 0 && (
            <Panel t={t} title="Teuerste Teile">
              <PGrid t={t} width={scr.content - 30} list={r.top.map((x) => ({ item: byId.get(x.item.id)!, value: formatEur(x.value), sub: x.item.qty > 1 ? `×${x.item.qty}` : undefined }))} />
            </Panel>
          )}
        </>
      );
    }
    if (tab === 'wear') {
      const r = wearStats(stat, P?.id ?? null, wears, outfits, undefined, period);
      const g = (list: { item: StatItem }[], value: (x: never) => string, sub?: (x: never) => string) =>
        list.map((x) => ({ item: byId.get(x.item.id)!, value: value(x as never), sub: sub?.(x as never) }));
      const W = scr.content - 30;
      const periods: [WearPeriod, string][] = [['30', '30 Tage'], ['year', '12 Monate'], ['all', 'Gesamt']];
      const pct = r.usage.total ? Math.round((r.usage.worn / r.usage.total) * 100) : 0;
      const dayCount = Object.keys(r.days).length;
      const late = r.start && r.from && r.start > r.from; // Aufzeichnung beginnt erst im Zeitraum
      const wardOutfits = new Map((wardrobe?.outfits ?? []).map((o) => [o.id, o]));
      return (
        <>
          <View style={[s.wrap, { marginBottom: space.sm }]}>
            {periods.map(([k, l]) => <Chip key={k} label={l} selected={period === k} onPress={() => setPeriod(k)} />)}
          </View>
          {!r.start ? (
            <Panel t={t} title="Getragen">
              <Text style={{ fontSize: 14, color: t.inkMuted }}>Noch nichts eingetragen. Tippe bei einem Outfit auf „Heute tragen“, plane Tage in der Wochenleiste oder markiere ein Teil mit „Heute tragen“. Dann siehst du hier Kosten pro Tragen, Lieblingsteile und was lange im Schrank liegt.</Text>
            </Panel>
          ) : <>
          {late && <Text style={[s.note, { color: t.inkMuted }]}>Aufgezeichnet seit {deDate(r.start!)} – davor gibt es keine Einträge.</Text>}
          <View style={s.tiles}>
            <StatTile t={t} label="Getragen" value={`${r.total}×`} hint={`an ${dayCount} ${dayCount === 1 ? 'Tag' : 'Tagen'}`} />
            <StatTile t={t} label="Schrank genutzt" value={`${pct} %`} hint={`${r.usage.worn} von ${r.usage.total} Teilen`} />
            <StatTile t={t} label="Ø Kosten pro Tragen" value={r.avgCpw != null ? formatEur(r.avgCpw) : '–'} hint="seit Beginn, Teile mit Preis" />
            <StatTile t={t} label="Lieblingsteil" value={r.favorites[0] ? `${r.favorites[0].w.length}×` : '–'} hint={r.favorites[0] ? byId.get(r.favorites[0].item.id)?.name || 'Teil' : 'im Zeitraum nichts'} />
          </View>

          {r.favorites.length > 0 && (
            <Panel t={t} title="Lieblingsteile">
              <PGrid t={t} width={W} list={g(r.favorites, (x: { w: string[] }) => `${x.w.length}×`)} />
            </Panel>
          )}

          {r.outfits.length > 0 && (
            <Panel t={t} title="Lieblings-Outfits">
              <View style={s.pgrid}>
                {r.outfits.map(({ outfit, n }) => {
                  const o = wardOutfits.get(outfit.id);
                  const w = (W - 3 * 8) / 4;
                  return o ? (
                    <Pressable accessibilityRole="button" key={o.id} onPress={() => router.push(`/outfit/${o.id}`)} accessibilityLabel={o.name || 'Outfit'} style={{ width: w, alignItems: 'center' }}>
                      <View style={[s.pim, { width: w, height: Math.round(w * 1.25), borderColor: t.hairline }]}><OutfitBoard pieces={o.pieces} byId={byId} width={w - 2} /></View>
                      <Text style={{ fontSize: 13, fontWeight: '600', marginTop: 5, color: t.ink }}>{n}×</Text>
                    </Pressable>
                  ) : null;
                })}
              </View>
              {r.pairs.length > 0 && <>
                <Text style={[s.psub, { color: t.inkMuted, marginTop: space.md }]}>Oft zusammen getragen</Text>
                {r.pairs.map((x, n) => {
                  const a = byId.get(x.a.id), b = byId.get(x.b.id);
                  if (!a || !b) return null;
                  return (
                    <View key={n} style={[s.pair, n > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
                      {[a, b].map((it) => (
                        <Pressable accessibilityRole="button" key={it.id} onPress={() => router.push(`/teil/${it.id}`)} accessibilityLabel={it.name || 'Teil'} style={[s.pim, { width: 48, height: 48, borderColor: t.hairline }]}>
                          <ItemPicture uri={it.thumb} inset="11%" category={it.category} color={it.hex ?? '#c4bfb4'} />
                        </Pressable>
                      ))}
                      <Text style={{ flex: 1, fontSize: 14, color: t.ink }} numberOfLines={2}>{a.name || 'Teil'} + {b.name || 'Teil'}</Text>
                      <Text style={{ fontSize: 14, color: t.inkMuted }}>{x.n}×</Text>
                    </View>
                  );
                })}
              </>}
            </Panel>
          )}

          {r.best.length > 0 && (
            <Panel t={t} title="Kosten pro Tragen">
              <Text style={[s.psub, { color: t.inkMuted }]}>Seit Beginn · am meisten rausgeholt</Text>
              <PGrid t={t} width={W} list={g(r.best, (x: { cpw: number }) => formatEur(x.cpw), (x: { w: string[] }) => `${x.w.length}× getragen`)} />
              {r.worst.length > 0 && <>
                <Text style={[s.psub, { color: t.inkMuted, marginTop: space.sm }]}>Noch teuer pro Tragen</Text>
                <PGrid t={t} width={W} list={g(r.worst, (x: { cpw: number }) => formatEur(x.cpw), (x: { w: string[] }) => `${x.w.length}× getragen`)} />
              </>}
            </Panel>
          )}

          {r.usage.categories.length > 0 && (
            <Panel t={t} title="Schrank-Nutzung">
              <Text style={[s.psub, { color: t.inkMuted }]}>Wie viele Teile je Kategorie du im Zeitraum getragen hast (ohne eingelagerte)</Text>
              {r.usage.categories.map((c) => <Bar key={c.key} t={t} label={categoryLabel(c.key)} value={c.worn} max={c.total} text={`${c.worn} von ${c.total}`} />)}
            </Panel>
          )}

          <Panel t={t} title="Lange nicht getragen">
            <Text style={[s.psub, { color: t.inkMuted }]}>Nur Teile für den {seasonLabel(r.season)} (und ganzjährige), ab {IDLE_DAYS} Tagen</Text>
            {r.idle.length ? (
              <PGrid t={t} width={W} list={g(r.idle, (x: { w: string[]; days: number }) => (x.w.length ? `${x.days} Tage` : 'noch nie'), (x: { w: string[]; days: number }) => (x.w.length ? 'her' : `seit ${x.days} Tagen`))} />
            ) : <Text style={{ fontSize: 14, color: t.inkMuted }}>Nichts – alles für die Saison war in den letzten {IDLE_DAYS} Tagen dran.</Text>}
          </Panel>
          </>}
        </>
      );
    }
    const r = closetStats(stat, P?.id ?? null);
    const nOutfits = (wardrobe?.outfits ?? []).filter((o) => !P || o.ownerId === P.id).length;
    const revenue = spendStats(stat, P?.id ?? null, personIds);
    return (
      <>
        <View style={s.tiles}>
          <StatTile t={t} label="Teile" value={String(r.pieces)} hint={`${r.pieces !== r.distinct ? `${r.distinct} verschiedene · ` : ''}${nOutfits} ${nOutfits === 1 ? 'Outfit' : 'Outfits'}`} />
          <StatTile t={t} label="Wunschliste" value={String(r.wishes)} hint={r.wishes ? `${formatEur(r.wishValue)} zusammen` : 'leer'} />
        </View>
        {r.categories.length > 0 && (
          <Panel t={t} title="Teile nach Kategorie">
            {r.categories.map((c) => <Bar key={c.key} t={t} label={categoryLabel(c.key)} value={c.value} max={r.categories[0]!.value} text={String(c.value)} />)}
          </Panel>
        )}
        {(r.status.length > 0 || revenue.revenue > 0) && (
          <Panel t={t} title="Status">
            {r.status.map((x, n) => {
              return (
                <View key={x.key} style={[s.trow, n > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Icon name={x.key} size="inline" color={t.ink} /><Text style={{ fontSize: 14, color: t.ink }}>{x.value} {STATUS_TEXT[x.key]}</Text></View>
                  <Text style={{ fontSize: 14, color: t.inkMuted }}>{x.key === 'sold' && revenue.revenue ? `${formatEur(revenue.revenue)} Erlös` : ''}</Text>
                </View>
              );
            })}
            {revenue.revenue > 0 && (
              <View style={[s.trow, { borderTopWidth: 1, borderTopColor: t.hairline }]}>
                <Text style={{ fontSize: 14, color: t.ink }}>Netto ausgegeben</Text>
                <Text style={{ fontSize: 14, color: t.ink }}>{formatEur(revenue.total - revenue.revenue)}</Text>
              </View>
            )}
          </Panel>
        )}
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Page contentContainerStyle={{ paddingTop: scr.top, paddingBottom: scr.barTop + space.lg, alignItems: 'center' }}>
        <View style={{ width: scr.content + 2 * space.md }}><Header title="Statistik" /></View>
        <View style={{ width: scr.content }}>
          {persons.length > 0 && (
            <View style={[s.wrap, { marginBottom: space.sm }]}>
              {persons.map((p) => <Chip key={p.id} label={p.id === me?.id ? 'Ich' : p.name} person={p} selected={scope === p.id} onPress={() => setScope(p.id)} />)}
              <Chip label="Allgemein" selected={scope === 'all'} onPress={() => setScope('all')} />
            </View>
          )}
          <View style={[s.seg, { backgroundColor: t.surfaceSunken }]}>
            {TABS.map(([k, l]) => (
              <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}
                style={[s.segBtn, tab === k && { backgroundColor: t.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }]}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: tab === k ? t.ink : t.inkMuted }}>{l}</Text>
              </Pressable>
            ))}
          </View>
          {body()}

          <Text style={[s.h2, { color: t.ink }]}>Schrank teilen</Text>
          {wardrobe && <Invite />}

          <Text style={[s.h2, { color: t.ink }]}>Werkzeuge</Text>
          {/* Übergang vom alten Valet: Bilder zuordnen */}
          <Pressable onPress={() => router.push('/bilder-zuordnen')} accessibilityRole="button"
            style={({ pressed }) => [s.panel, { borderColor: t.hairline, backgroundColor: t.surface, gap: 4, marginTop: space.sm, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: t.ink }}>Bilder zuordnen</Text>
            <Text style={{ fontSize: 14, color: t.inkMuted }}>
              {withoutPicture ? `${withoutPicture} Teile haben noch kein Bild. ` : ''}Mehrere Fotos wählen, freistellen und den Teilen zuordnen.
            </Text>
          </Pressable>
          <ProfileBatch />
        </View>
        <PageEnd />
      </Page>
    </View>
  );
}

function StatTile({ t, label, value, hint, good }: { t: Theme; label: string; value: string; hint: string; good?: boolean }) {
  return (
    <View style={[s.tile, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <Text style={{ fontSize: 13, color: t.inkMuted }} numberOfLines={1}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 4, color: good ? (t.dark ? '#7FC29B' : '#2E7D4F') : t.ink }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={{ fontSize: 12, color: t.inkMuted, marginTop: 2 }} numberOfLines={2}>{hint}</Text>
    </View>
  );
}

function Panel({ t, title, children }: { t: Theme; title: string; children: React.ReactNode }) {
  return (
    <View style={[s.panel, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: t.ink, marginBottom: 12 }}>{title}</Text>
      {children}
    </View>
  );
}

function Bar({ t, label, sub, value, max, text, color, dim, person }: { t: Theme; label: string; sub?: string; value: number; max: number; text: string; color?: string; dim?: boolean; person?: Pick<Person, 'name' | 'color'> }) {
  return (
    <View style={[s.bar, dim && { opacity: 0.6 }]}>
      <View style={[s.barHead, person && { alignItems: 'center', gap: 8 }]}>
        {person && <Monogram person={person} size="text" />}
        <Text style={{ flex: 1, fontSize: 14, color: t.ink }} numberOfLines={1}>{label}{sub ? <Text style={{ fontSize: 12, color: t.inkMuted }}>  {sub}</Text> : null}</Text>
        <Text style={{ fontSize: 14, color: t.inkMuted }}>{text}</Text>
      </View>
      <View style={[s.track, { backgroundColor: t.dark ? '#3a302d' : '#efece5' }]}>
        <View style={[s.fill, { width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, backgroundColor: color ?? t.accent }]} />
      </View>
    </View>
  );
}

const deDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${Number(d)}.${Number(m)}.${y}`; };
/** Teile als Bilder statt Namen (Antippen öffnet das Teil) */
function PGrid({ t, list, width }: { t: Theme; list: { item: Tile; value: string; sub?: string }[]; width: number }) {
  const w = (width - 3 * 8) / 4;
  return (
    <View style={s.pgrid}>
      {list.filter((x) => x.item).map(({ item, value, sub }) => (
        <Pressable accessibilityRole="button" key={item.id} onPress={() => router.push(`/teil/${item.id}`)} accessibilityLabel={item.name || 'Teil'} style={{ width: w, alignItems: 'center' }}>
          <View style={[s.pim, { width: w, height: w, borderColor: t.hairline }]}>
            <ItemPicture uri={item.thumb} inset="11%" category={item.category} color={item.hex ?? '#c4bfb4'} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: '600', marginTop: 5, color: t.ink }} numberOfLines={1}>{value}</Text>
          {!!sub && <Text style={{ fontSize: 12, color: t.inkMuted }} numberOfLines={1}>{sub}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  seg: { flexDirection: 'row', gap: 3, padding: 3, borderRadius: radius.pill, marginBottom: 14 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.pill },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  tile: { width: '48.5%', flexGrow: 1, flexBasis: '45%', borderWidth: 1, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14 },
  panel: { borderWidth: 1, borderRadius: radius.md, padding: 14, marginBottom: 14 },
  bar: { marginBottom: 13, gap: 6 },
  barHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  more: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  psub: { fontSize: 12, marginTop: -4, marginBottom: 8 },
  pgrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pim: { backgroundColor: '#fff', borderWidth: 1, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  note: { fontSize: 13, marginTop: -4, marginBottom: 10 },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  trow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 8 },
  h2: { fontFamily: DISPLAY, fontSize: 22, marginTop: space.lg, marginBottom: space.xs },
});

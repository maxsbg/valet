// Bearbeiten-Seite (VALET_DETAILSEITE_SPEC.md, Abschnitte 7 und 7a) – gemeinsam für „Bearbeiten“ und „Neues Teil prüfen“.
// Kopf X · Titel · Haken, Bild-Kachel, KI-Hinweis, Name, Marke, Reiter Steckbrief · Kauf (Wunschteil: Steckbrief · Wunsch).
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CATEGORY_NAMES, CLOSURES, COLLARS, COLLAR_SIZES, MATERIALS, ONE_SIZE, PATTERNS, SEASONS, SIZES, SIZE_SYSTEMS, STYLES, LAYERS, WARMTH, RAIN, CARE,
  careList, categoryLast, fitScalesOf, hasCollarSize, layoutKind, pickCategory, subcategoriesOf, typesOf,
  setField, toggleIn, pickOne, toggleMaterial, materialRank, pickSizeSystem, isCustomSize, pickFit, togglePayer, splitView, qtyHint, formatPrice,
  type ColorPick, type EditForm, type SizeSystem, type WishTag,
} from '@valet/core';
import { detail } from '@valet/ui';
import { useTheme } from '@/lib/theme';
import { useBottomInset } from '@/lib/bottomInset';
import { personKey, type Person, type Wishlist } from '@/lib/wardrobe';
import type { Picture } from '@/lib/cutout';
import { Page, STICKY } from '@/components/Page';
import { TileIcon, type TileIconName } from '@/components/tile/TileIcons';
import { Capsule, DateField, FieldLabel, HeadButton, Hint, IconCircle, Monogram, TextField, Wrap } from '@/components/detail/parts';
import { DetailIcon, SEASON_ICON, type DetailIconName } from '@/components/detail/DetailIcons';
import {
  ColorDot, EditCard, EditRow, KiBadge, NotesField, Pair, PlainRow, RankBadge, Segmented, Stepper, SymbolSwitch, ValueCapsule, ValueCircle, ValueScale,
} from './fields';
import { CarePicker, ColorPicker, FitPicker, LayersPicker, WeatherPicker } from './pickers';
import { EditImage } from './EditImage';
import { InfoSheet } from './InfoSheet';
import { SetPicker, type SetDraft } from './SetPicker';
import type { Tile } from '@/lib/wardrobe';

type Side = 'a' | 'b';
const WISH_ORDER: WishTag[] = ['nextcop', 'grail', 'watchlist', 'someday', 'gift'];
const WISH_LABEL: Record<WishTag, string> = { nextcop: 'Next Cop', grail: 'Grail', watchlist: 'Watchlist', someday: 'Someday', gift: 'Gift' };

type Props = {
  title: string;
  form: EditForm;
  onForm: (f: EditForm) => void;
  persons: Person[];
  meId: string | null;
  wishlists: Wishlist[];
  current: Record<Side, string | null>;
  pics: Record<Side, Picture | null>;
  onPic: (side: Side, p: Picture | null) => void;
  hex: string | null;
  highlight?: string | null;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
  /** Neues Teil: „Foto ändern“ führt zurück zum Fotoschritt */
  onChangePhoto?: () => void;
  /** Start-Reiter (z. B. „Preis fehlt“ antippen → Kauf) */
  initialTab?: 'steck' | 'kauf';
  /** Set (nur Schrank-Teile): Zustand, Teile des Schranks, bisheriges Set */
  set?: { draft: SetDraft; onChange: (d: SetDraft) => void; items: Tile[]; currentId: string | null; setId: string | null };
};

export function ItemEditor(p: Props) {
  const { form: f, onForm } = p;
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset();
  const { width: W } = useWindowDimensions();
  const col = Math.min(W - 32, 520);
  const [tab, setTab] = useState<'steck' | 'kauf'>(p.initialTab ?? 'steck');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [colorUi, setColorUi] = useState<Record<Side, { open: string | null; full: boolean }>>({ a: { open: null, full: false }, b: { open: null, full: false } });
  const [info, setInfo] = useState(false);
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const set = <K extends keyof EditForm>(k: K, v: EditForm[K]) => onForm(setField(f, k, v));
  const ai = (k: string) => f.aiPending.includes(k) || f.aiPending.some((x) => x.startsWith(`${k}.`));
  const capsules = (list: readonly string[]) => list.map((x) => <ValueCapsule key={x} label={x} />);

  // ---------- Steckbrief ----------
  const scales = fitScalesOf(f.category);
  const subs = subcategoriesOf(f.category);
  const types = typesOf(f.category, f.subcategory);
  const pickCat = (level: 'category' | 'subcategory' | 'type', name: string) => {
    const next = pickCategory({ category: f.category, subcategory: f.subcategory, type: f.type }, level, name);
    onForm(setField(setField(setField(f, 'category', next.category), 'subcategory', next.subcategory), 'type', next.type));
  };
  const colorRow = (side: Side) => {
    const list = side === 'a' ? f.colors : f.colorsB;
    const key = side === 'a' ? 'colors' : 'colorsB';
    const pick: ColorPick = { colors: list, ...colorUi[side] };
    return (
      <EditRow key={key} label={f.reversible ? (side === 'a' ? 'Farben Seite A' : 'Farben Seite B') : 'Farben'} open={!!open[key]} onToggle={() => toggle(key)} ai={ai(key)}
        values={list.map((c) => <ValueCircle key={c} a11y={c} outline><ColorDot name={c} /></ValueCircle>)}>
        <ColorPicker pick={pick} onChange={(n) => { setColorUi((u) => ({ ...u, [side]: { open: n.open, full: n.full } })); set(key, n.colors); }} />
      </EditRow>
    );
  };
  const textRow = (key: 'pattern' | 'patternB' | 'collar' | 'closure', label: string, opts: readonly string[]) => {
    const v = f[key];
    return (
      <EditRow key={key} label={label} open={!!open[key]} onToggle={() => toggle(key)} ai={ai(key)} values={v ? [<ValueCapsule key={v} label={v} />] : []}>
        <Wrap>{opts.map((o) => <Capsule key={o} label={o} selected={v === o} onPress={() => set(key, pickOne(v, o))} />)}</Wrap>
      </EditRow>
    );
  };
  const sizeValues = [f.size, hasCollarSize(f.subcategory) && f.collarSize ? `Kragen ${f.collarSize}` : null].filter((x): x is string => !!x);
  const sizeOpts = f.sizeSystem ? SIZES[f.sizeSystem] : [ONE_SIZE];

  const steckbrief = (
    <>
      <EditCard title="Aussehen" rows>
        <EditRow label="Kategorie" open={!!open.cat} onToggle={() => toggle('cat')} ai={ai('category')}
          values={f.category ? [<ValueCapsule key="c" label={categoryLast({ category: f.category, subcategory: f.subcategory, type: f.type })} />] : []}>
          <FieldLabel>Kategorie</FieldLabel>
          <Wrap>{CATEGORY_NAMES.map((c) => <Capsule key={c} label={c} selected={f.category === c} onPress={() => pickCat('category', c)} />)}</Wrap>
          {f.category && <>
            <FieldLabel>Unterkategorie</FieldLabel>
            <Wrap>{subs.map((c) => <Capsule key={c} label={c} selected={f.subcategory === c} onPress={() => pickCat('subcategory', c)} />)}</Wrap>
          </>}
          {types.length > 0 && <>
            <FieldLabel>Typ</FieldLabel>
            <Wrap>{types.map((c) => <Capsule key={c} label={c} selected={f.type === c} onPress={() => pickCat('type', c)} />)}</Wrap>
          </>}
        </EditRow>
        <EditRow label="Saison" open={!!open.season} onToggle={() => toggle('season')} ai={ai('seasons')}
          values={SEASONS.filter((x) => f.seasons.includes(x)).map((x) => <ValueCircle key={x} a11y={x}><DetailIcon name={SEASON_ICON[x]!} color={t.bg} /></ValueCircle>)}>
          <Wrap>{SEASONS.map((x) => <Capsule key={x} label={x} selected={f.seasons.includes(x)} onPress={() => set('seasons', toggleIn(f.seasons, x))}
            icon={(c) => <DetailIcon name={SEASON_ICON[x]!} size={18} color={c} />} />)}</Wrap>
        </EditRow>
        {colorRow('a')}
        <PlainRow label="Wendbar" inset>
          <SymbolSwitch on={f.reversible} label="Wendbar" onToggle={() => set('reversible', !f.reversible)}>
            {(c) => <TileIcon name="reversible" color={c} size={20} />}
          </SymbolSwitch>
        </PlainRow>
        {f.reversible && colorRow('b')}
        {p.set && !f.isWish && (
          <PlainRow label="Set" inset
            below={p.set.draft.on ? <SetPicker draft={p.set.draft} onChange={p.set.onChange} items={p.set.items} width={col}
              current={{ id: p.set.currentId, name: f.name.trim(), setId: p.set.setId }} /> : null}>
            <SymbolSwitch on={p.set.draft.on} label="Set" onToggle={() => p.set!.onChange({ ...p.set!.draft, on: !p.set!.draft.on })}>
              {(c) => <DetailIcon name="link" size={20} color={c} />}
            </SymbolSwitch>
          </PlainRow>
        )}
        {textRow('pattern', f.reversible ? 'Muster Seite A' : 'Muster', PATTERNS)}
        {f.reversible && textRow('patternB', 'Muster Seite B', PATTERNS)}
        <EditRow label="Material" open={!!open.material} onToggle={() => toggle('material')} ai={ai('materials')}
          values={capsules(f.materials.map((m) => (m.pct ? `${m.name} ${m.pct} %` : m.name)))}>
          <Wrap>{MATERIALS.map((m) => {
            const r = materialRank(f.materials, m);
            return <Capsule key={m} label={m} selected={r > 0} a11y={r ? `${m}, Rang ${r}` : m} leading={r ? <RankBadge n={r} /> : undefined}
              onPress={() => set('materials', toggleMaterial(f.materials, m))} />;
          })}</Wrap>
          <Hint>Die Zahl ist die Reihenfolge nach Anteil, 1 = Hauptmaterial.</Hint>
        </EditRow>
        <EditRow label="Größe" open={!!open.size} onToggle={() => toggle('size')} ai={ai('size')} last values={capsules(sizeValues)}>
          <FieldLabel>System</FieldLabel>
          <Wrap>{(Object.keys(SIZE_SYSTEMS) as SizeSystem[]).map((k) => <Capsule key={k} label={SIZE_SYSTEMS[k]} selected={f.sizeSystem === k} onPress={() => onForm(pickSizeSystem(f, k))} />)}</Wrap>
          <FieldLabel>Größe</FieldLabel>
          <Wrap>{sizeOpts.map((x) => <Capsule key={x} label={x} selected={f.size === x} onPress={() => set('size', pickOne(f.size, x))} />)}</Wrap>
          <TextField label="Eigene Angabe (z. B. W30/L32)" value={isCustomSize(f) ? f.size ?? '' : ''} onChange={(v) => set('size', v.trim() ? v : null)} />
          {hasCollarSize(f.subcategory) && <>
            <FieldLabel>Kragenweite</FieldLabel>
            <Wrap>{COLLAR_SIZES.map((x) => <Capsule key={x} label={x} selected={f.collarSize === x} onPress={() => set('collarSize', pickOne(f.collarSize, x))} />)}</Wrap>
          </>}
        </EditRow>
      </EditCard>

      <EditCard title="Tragen" rows>
        {scales.length > 0 && (
          <EditRow label="Passform" open={!!open.fit} onToggle={() => toggle('fit')} ai={ai('fit')}
            values={scales.filter((sc) => f.fit[sc.key] != null).map((sc) => (
              <ValueScale key={sc.key} caption={sc.label} steps={sc.steps.length} on={(i) => i === f.fit[sc.key]} a11y={`${sc.label} ${sc.steps[f.fit[sc.key]!]}`} />
            ))}>
            <FitPicker scales={scales} fit={f.fit} onPick={(k, i) => onForm(pickFit(f, k, i))} />
          </EditRow>
        )}
        <EditRow label="Lagen" open={!!open.layers} onToggle={() => toggle('layers')} ai={ai('layers')}
          values={[
            ...(f.layers.length ? [<ValueScale key="l" steps={LAYERS.length} on={(i) => f.layers.includes(i)} a11y={`Lagen: ${f.layers.map((i) => LAYERS[i]).join(', ')}`} />] : []),
            ...(f.standalone ? [<ValueCapsule key="s" label="allein" />] : []),
          ]}>
          <LayersPicker layers={f.layers} standalone={f.standalone} onToggle={(i) => set('layers', toggleIn(f.layers, i))} onStandalone={() => set('standalone', !f.standalone)} />
        </EditRow>
        <EditRow label="Wetter" open={!!open.weather} onToggle={() => toggle('weather')} ai={ai('warmth') || ai('rain')} last
          values={[
            ...(f.warmth != null ? [<ValueScale key="w" steps={3} on={(i) => i < f.warmth!} a11y={`Wärme ${WARMTH[f.warmth]}`} icon={(c) => <DetailIcon name="thermo" size={16} color={c} />} />] : []),
            ...(f.rain != null ? [<ValueScale key="r" steps={3} on={(i) => i <= f.rain!} a11y={`Regen ${RAIN[f.rain]}`} icon={(c) => <DetailIcon name="drop" size={16} color={c} />} />] : []),
          ]}>
          <WeatherPicker warmth={f.warmth} rain={f.rain} onWarmth={(v) => set('warmth', v)} onRain={(v) => set('rain', v)} />
        </EditRow>
      </EditCard>

      <EditCard title="Details" rows>
        <EditRow label="Stil" open={!!open.style} onToggle={() => toggle('style')} ai={ai('styles')} values={capsules(f.styles)}>
          <Wrap>{STYLES.map((x) => <Capsule key={x} label={x} selected={f.styles.includes(x)} onPress={() => set('styles', toggleIn(f.styles, x))} />)}</Wrap>
        </EditRow>
        {textRow('collar', 'Kragen', COLLARS)}
        <View>{/* letzte Zeile ohne Trennlinie */}
          {(() => {
            const v = f.closure;
            return (
              <EditRow label="Verschluss" open={!!open.closure} onToggle={() => toggle('closure')} ai={ai('closure')} last values={v ? [<ValueCapsule key={v} label={v} />] : []}>
                <Wrap>{CLOSURES.map((o) => <Capsule key={o} label={o} selected={v === o} onPress={() => set('closure', pickOne(v, o))} />)}</Wrap>
              </EditRow>
            );
          })()}
        </View>
      </EditCard>

      <EditCard title="Pflege" rows>
        <EditRow label="Pflegehinweise" open={!!open.care} onToggle={() => toggle('care')} ai={ai('care')} last
          values={careList(f.care).map((c) => {
            const g = CARE.find((x) => x.key === c.group)!;
            const o = g.options.find((x) => x.id === c.v);
            return <ValueCircle key={c.group} a11y={`${g.label}: ${o?.short ?? c.v}`} estimated={c.src === 'geschaetzt'}>
              <DetailIcon name={c.v as DetailIconName} size={22} color={c.src === 'geschaetzt' ? t.inkMuted : t.bg} />
            </ValueCircle>;
          })}>
          <CarePicker care={f.care} onChange={(c) => set('care', c)} />
        </EditRow>
      </EditCard>

      <EditCard title="Notizen">
        <NotesField value={f.notes} onChange={(v) => set('notes', v)} />
      </EditCard>
    </>
  );

  // ---------- Kauf ----------
  const name = (pp: Person) => (pp.id === p.meId ? `${pp.name} (du)` : pp.name);
  const split = splitView(f);
  const personColor = (id: string) => t.person[personKey(p.persons.find((x) => x.id === id)?.color ?? null)];
  const kauf = (
    <>
      <EditCard title="Kauf">
        {!f.gift && (
          <Pair>
            <TextField label="Bezahlt" value={f.price} onChange={(v) => set('price', v)} placeholder="0,00 €" keyboardType="decimal-pad" inputMode="decimal" extra={ai('price') ? <KiBadge /> : null} />
            <TextField label="Listenpreis" value={f.listPrice} onChange={(v) => set('listPrice', v)} placeholder="0,00 €" keyboardType="decimal-pad" inputMode="decimal" extra={ai('listPrice') ? <KiBadge /> : null} />
          </Pair>
        )}
        <PlainRow label="Geschenk" last>
          <SymbolSwitch on={f.gift} label="Geschenk" onToggle={() => set('gift', !f.gift)}>{(c) => <TileIcon name="gift" color={c} size={20} />}</SymbolSwitch>
        </PlainRow>
        {f.gift ? (
          <View style={{ gap: 12 }}>
            <Pair>
              <TextField label="Von" value={f.giftFrom} onChange={(v) => set('giftFrom', v)} placeholder="z. B. Oma" />
              <DateField label="Bekommen am" value={f.purchaseDate} onChange={(v) => set('purchaseDate', v)} optional />
            </Pair>
            <TextField label="Wert (optional)" value={f.giftValue} onChange={(v) => set('giftValue', v)} placeholder="0,00 €" keyboardType="decimal-pad" inputMode="decimal" />
            <Hint>Kein Kaufpreis. In der Statistik zählt es mit 0 € in einer eigenen Zeile „Geschenke“, ohne Kosten pro Tragen. Der Wert dient nur zur Info.</Hint>
          </View>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              <FieldLabel>Bezahlt von</FieldLabel>
              <Wrap>{p.persons.map((pp) => <Capsule key={pp.id} label={name(pp)} selected={f.payers.includes(pp.id)} leading={<Monogram person={pp} />} onPress={() => onForm(togglePayer(f, pp.id))} />)}</Wrap>
            </View>
            {split && (
              <View style={{ gap: 10 }}>
                <FieldLabel>Aufteilung</FieldLabel>
                <Wrap>
                  <Capsule label="Gleich" selected={f.splitMode === 'equal'} onPress={() => set('splitMode', 'equal')} />
                  <Capsule label="Eigene Beträge" selected={f.splitMode === 'custom'} onPress={() => {
                    // Startwerte = gleiche Anteile
                    const amounts = Object.fromEntries(split.rows.map((r) => [r.personId, r.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })]));
                    onForm(setField(setField(f, 'splitMode', 'custom'), 'amounts', { ...amounts, ...f.amounts }));
                  }} />
                </Wrap>
                <View accessibilityRole="image" accessibilityLabel="Aufteilung als Balken" style={s.bar}>
                  {split.rows.map((r) => <View key={r.personId} style={{ flex: Math.max(r.amount, 0.0001), backgroundColor: personColor(r.personId) }} />)}
                </View>
                <View>
                  {split.rows.map((r) => {
                    const pp = p.persons.find((x) => x.id === r.personId);
                    return (
                      <View key={r.personId} style={[s.shareRow, { borderBottomColor: t.hairline }]}>
                        {pp && <Monogram person={pp} size={28} />}
                        <Text style={{ flex: 1, fontSize: 15, color: t.ink }}>{pp ? name(pp) : '?'}</Text>
                        <Text style={{ fontSize: 13, color: t.inkMuted }}>{r.pct} %</Text>
                        {f.splitMode === 'custom' ? (
                          <View style={{ width: 104 }}>
                            <TextField label="" value={f.amounts[r.personId] ?? ''} onChange={(v) => set('amounts', { ...f.amounts, [r.personId]: v })} keyboardType="decimal-pad" inputMode="decimal" />
                          </View>
                        ) : <Text style={{ minWidth: 80, textAlign: 'right', fontSize: 15, fontWeight: '600', color: t.ink }}>{formatPrice(r.amount)}</Text>}
                      </View>
                    );
                  })}
                </View>
                <Hint accent={split.warn}>{split.hint}</Hint>
              </View>
            )}
            <Pair>
              <DateField label="Kaufdatum" value={f.purchaseDate} onChange={(v) => set('purchaseDate', v)} optional />
              <TextField label="Shop" value={f.shop} onChange={(v) => set('shop', v)} placeholder="z. B. COS" extra={ai('shop') ? <KiBadge /> : null} />
            </Pair>
          </>
        )}
        {f.gift && <TextField label="Shop" value={f.shop} onChange={(v) => set('shop', v)} />}
        <TextField label="Produktlink" value={f.link} onChange={(v) => set('link', v)} placeholder="https://…" keyboardType="url" inputMode="url" />
        <TextField label="Artikelnummer" value={f.articleNo} onChange={(v) => set('articleNo', v)} extra={ai('articleNo') ? <KiBadge /> : null} />
      </EditCard>

      <EditCard title="Besitz">
        <View style={{ gap: 8 }}>
          <FieldLabel>Gehört</FieldLabel>
          <Wrap>{p.persons.map((pp) => <Capsule key={pp.id} label={name(pp)} selected={f.owners.includes(pp.id)} leading={<Monogram person={pp} />} onPress={() => set('owners', toggleIn(f.owners, pp.id))} />)}</Wrap>
        </View>
        <View style={s.between}>
          <Text style={{ fontSize: 15, color: t.ink }}>Anzahl</Text>
          <Stepper value={f.qty} onChange={(n) => set('qty', n)} />
        </View>
        {qtyHint(f) && <Hint>{qtyHint(f)}</Hint>}
      </EditCard>
    </>
  );

  // ---------- Wunsch (Spec 7a) ----------
  const wunsch = (
    <EditCard title="Wunsch">
      <Pair>
        <TextField label="Preis" value={f.listPrice} onChange={(v) => set('listPrice', v)} placeholder="0,00 €" keyboardType="decimal-pad" inputMode="decimal" extra={ai('listPrice') ? <KiBadge /> : null} />
        <TextField label="Shop" value={f.shop} onChange={(v) => set('shop', v)} />
      </Pair>
      <TextField label="Produktlink" value={f.link} onChange={(v) => set('link', v)} placeholder="https://…" keyboardType="url" inputMode="url" />
      <TextField label="Artikelnummer" value={f.articleNo} onChange={(v) => set('articleNo', v)} />
      {p.wishlists.length > 0 && (
        <View style={{ gap: 8 }}>
          <FieldLabel>Liste</FieldLabel>
          <Wrap>{p.wishlists.map((l) => <Capsule key={l.id} label={l.name} selected={f.wishlistId === l.id} onPress={() => set('wishlistId', pickOne(f.wishlistId, l.id))} />)}</Wrap>
        </View>
      )}
      <View style={{ gap: 8 }}>
        <FieldLabel>Kategorie{f.wishTag ? ` · ${WISH_LABEL[f.wishTag]}` : ''}</FieldLabel>
        <Wrap>{WISH_ORDER.map((w) => (
          <IconCircle key={w} a11y={WISH_LABEL[w]} selected={f.wishTag === w} onPress={() => set('wishTag', pickOne(f.wishTag, w))}>
            <TileIcon name={w as TileIconName} color={f.wishTag === w ? t.bg : t.ink} size={20} />
          </IconCircle>
        ))}</Wrap>
      </View>
      <DateField label="Kauftag geplant (optional)" value={f.buyOn} onChange={(v) => set('buyOn', v)} optional />
    </EditCard>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.head, STICKY, { paddingTop: insets.top + 6, backgroundColor: t.bg }]}>
        <View style={s.side}><HeadButton glyph="close" label="Abbrechen" onPress={p.onCancel} /></View>
        <Text style={[s.title, { color: t.ink }]} accessibilityRole="header">{p.title}</Text>
        <View style={[s.side, { alignItems: 'flex-end' }]}><HeadButton glyph="check" label="Fertig" primary onPress={p.onSave} disabled={p.saving} /></View>
      </View>
      <Page contentContainerStyle={{ alignItems: 'center', paddingBottom: bottom + 60 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: col, paddingTop: 12, gap: 14 }}>
          <EditImage width={col} current={p.current} pics={p.pics} onPick={p.onPic} reversible={f.reversible} kind={layoutKind(f.category, f.subcategory)}
            hex={p.hex} highlight={p.highlight} onInfo={() => setInfo(true)} onChangePhoto={p.onChangePhoto} />
          {f.aiPending.length > 0 && (
            <View style={[s.kiCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              <KiBadge />
              <Text style={{ flex: 1, fontSize: 14, lineHeight: 19, color: t.ink }}>Felder mit „KI“ hat die KI aus dem Foto vorausgefüllt. Die Markierung verschwindet, sobald du den Wert änderst oder bestätigst.</Text>
            </View>
          )}
          <TextField label="Name" value={f.name} onChange={(v) => set('name', v)} placeholder="z. B. Relaxed Flannel Shirt" extra={ai('name') ? <KiBadge /> : null} />
          <TextField label="Marke" value={f.brand} onChange={(v) => set('brand', v)} placeholder="z. B. COS" extra={ai('brand') ? <KiBadge /> : null} />
          <Segmented items={[{ key: 'steck', label: 'Steckbrief' }, { key: 'kauf', label: f.isWish ? 'Wunsch' : 'Kauf' }]} value={tab} onChange={setTab} />
          {tab === 'steck' ? steckbrief : f.isWish ? wunsch : kauf}
          {p.onDelete && (
            <Pressable accessibilityRole="button" onPress={p.onDelete} style={({ pressed }) => [s.delete, { borderColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: t.accent }}>{f.isWish ? 'Wunsch löschen' : 'Teil löschen'}</Text>
            </Pressable>
          )}
        </View>
      </Page>
      <InfoSheet open={info} onClose={() => setInfo(false)} />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  side: { flex: 1, flexBasis: 0 },
  title: { fontFamily: 'Gloock_400Regular', fontSize: detail.font.sheetTitle, lineHeight: 24, textAlign: 'center' },
  kiCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, marginTop: 4 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderBottomWidth: 1 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  delete: { height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

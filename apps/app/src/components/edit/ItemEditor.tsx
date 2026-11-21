// Bearbeiten-Seite (VALET_DETAILSEITE_SPEC.md, Abschnitte 7 und 7a) – gemeinsam für „Bearbeiten“ und „Neues Teil prüfen“.
// Kopf X · Titel · Haken, Bild-Kachel, KI-Hinweis, Name, Marke, Reiter Steckbrief · Kauf (Wunschteil: Steckbrief · Wunsch).
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ruleNote, weatherNote } from '@valet/core';
import {
  CATEGORY_LIST, CLOSURES, colorLabel, materialLabel, subListOf, typeListOf, label as keyLabel, type KeyList, MATERIALS, PATTERNS, SEASONS, LAYERS, WARMTH, RAIN, CARE, careList, categoryLast, fitScalesOf, hasCollarSize,
  layoutKind, pickCategory, setField, setName, setCategory, fieldsFor, STRAPS, toggleIn, pickOne, toggleMaterial, materialRank, parsePct, setMaterialPct, materialPctSum, materialOrderOff, sortMaterialsByPct,
  pickSizeSystem, pickSize, sizeText, pickFit, togglePayer, splitView, qtyHint, formatPrice, type ColorPick, type EditForm, type WishTag,
  applyInfo, confirmAllAi, infoHint, setCare, shopFromLink, tileKind,
  PROFILE_FIELDS, profileFieldsFor, profileLabel, scaleWord,
} from '@valet/core';
import { detail } from '@valet/ui';
import { useTheme } from '@/lib/theme';
import { useSession } from '@/lib/session';
import { createList } from '@/lib/wishlists';
import { useBottomInset } from '@/lib/bottomInset';
import { personKey, type Person, type Wishlist } from '@/lib/wardrobe';
import type { Picture } from '@/lib/cutout';
import { Page, STICKY } from '@/components/Page';
import { Capsule, DateField, FieldLabel, HeadButton, Hint, IconCircle, Monogram, TextField, Wrap } from '@/components/detail/parts';
import { SEASON_ICON } from '@valet/ui';
import {
  ColorDot, EditCard, KiBadge, NotesField, Pair, PlainRow, RankBadge, Segmented, Stepper, SymbolSwitch, ValueCapsule, ValueCircle, ValueScale,
} from './fields';
import { CarePicker, ColorPicker, FitPicker, LayersPicker, SizePicker, WeatherPicker } from './pickers';
import { EditImage } from './EditImage';
import { InfoSheet } from './InfoSheet';
import { SetPicker, type SetDraft } from './SetPicker';
import type { Tile } from '@/lib/wardrobe';
import { Icon } from '@/components/Icon';
import type { SymbolName } from '@valet/ui';

type Side = 'a' | 'b';
const WISH_ORDER: WishTag[] = ['nextcop', 'grail', 'watchlist', 'someday', 'gift'];
const WISH_LABEL: Record<WishTag, string> = { nextcop: 'Next Cop', grail: 'Grail', watchlist: 'Watchlist', someday: 'Someday', gift: 'Gift' };

type Props = {
  title: string;
  form: EditForm;
  /** neuer Stand oder Rechnung auf dem aktuellsten Stand (für Ergebnisse, die erst später ankommen) */
  onForm: (f: EditForm | ((cur: EditForm) => EditForm)) => void;
  persons: Person[];
  meId: string | null;
  wishlists: Wishlist[];
  current: Record<Side, string | null>;
  pics: Record<Side, Picture | null>;
  onPic: (side: Side, p: Picture | null) => void;
  hex: string | null;
  saving: boolean;
  /** KI liest bzw. analysiert noch (Neues Teil): Hinweis zeigen, Vorschläge kommen gleich */
  aiBusy?: string | null;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
  /** Neues Teil: „Foto ändern“ führt zurück zum Fotoschritt */
  onChangePhoto?: () => void;
  /** Bearbeiten: gespeichertes Bild einer Seite laden (Spiegeln ohne neues Foto) */
  loadStored?: (side: Side) => Promise<Picture | null>;
  /** Fehlermeldung anzeigen (z. B. Spiegeln fehlgeschlagen) */
  onError?: (message: string) => void;
  /** Start-Reiter (z. B. „Preis fehlt“ antippen → Kauf) */
  initialTab?: 'steck' | 'kauf';
  /** Set (nur Schrank-Teile): Zustand, Teile des Schranks, bisheriges Set */
  set?: { draft: SetDraft; onChange: (d: SetDraft) => void; items: Tile[]; currentId: string | null; setId: string | null };
};

function SimpleEditRow({ label, values, ai, last, children }: { label: string; values: React.ReactNode[]; ai?: boolean; last?: boolean; open?: boolean; onToggle?: () => void; children?: React.ReactNode }) {
  const t = useTheme();
  return <View style={{ paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.hairline, gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={{ flex: 1, fontSize: 15, color: t.inkMuted }}>{label}</Text>{ai && <KiBadge />}</View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>{values.length ? values : <Text style={{ fontSize: 15, color: t.inkMuted }}>Noch nicht angegeben</Text>}</View>
    {children}
  </View>;
}
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
  // Neue Wunschliste direkt im Formular anlegen
  const { wardrobe, reload } = useSession();
  const [listName, setListName] = useState<string | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [listErr, setListErr] = useState<string | null>(null);
  const addList = async () => {
    const name = (listName ?? '').trim();
    if (!name) return setListErr('Bitte einen Namen eingeben.');
    if (!wardrobe) return;
    setListBusy(true); setListErr(null);
    try {
      const id = await createList(wardrobe.id, name, p.meId);
      await reload();
      onForm(setField(f, 'wishlistId', id));
      setListName(null);
    } catch (e) { setListErr(`Anlegen fehlgeschlagen: ${(e as Error).message}`); }
    finally { setListBusy(false); }
  };
  // Produktlink → Shop als Domain („zalando.de“, 17.11.2026, Max)
  const setLink = (v: string) => {
    const next = setField(f, 'link', v), shop = shopFromLink(f.shop, f.link, v);
    onForm(shop === f.shop ? next : setField(next, 'shop', shop));
  };
  const capsules = (list: readonly string[]) => list.map((x) => <ValueCapsule key={x} label={x} />);

  // KI-Profil: vorhandene Analysewerte werden in denselben groben Bereichen wie auf der Detailseite bearbeitbar.
  const profileContext = { category: f.category, sub: f.subcategory, pattern: f.pattern, materials: f.materials.map((m) => m.name) };
  const setProfile = (key: string, value: unknown) => set('profile', { ...f.profile, [key]: value } as EditForm['profile']);
  const profileRow = (field: (typeof PROFILE_FIELDS)[number], last: boolean): React.ReactNode => {
    const value = f.profile[field.key as keyof EditForm['profile']] as unknown;
    let values: React.ReactNode[] = [];
    if (field.kind === 'scale') {
      const n = typeof value === 'number' ? value : null;
      values = n == null ? [] : [<ValueCapsule key="v" label={profileLabel(field.key, n) || String(n)} />];
    } else if (field.kind === 'range') {
      const range = Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number' ? [value[0], value[1]] as const : null;
      values = range ? [<ValueCapsule key="v" label={range[0] === range[1] ? (profileLabel(field.key, range[0]) || String(range[0])) : `${profileLabel(field.key, range[0]) || range[0]} bis ${profileLabel(field.key, range[1]) || range[1]}`} />] : [];
    } else if (field.kind === 'enum') {
      const selected = typeof value === 'string' ? field.values.find((x) => x.key === value) : null;
      values = selected ? [<ValueCapsule key="v" label={selected.label} />] : [];
    } else {
      values = (Array.isArray(value) ? value : []).map((key) => <ValueCapsule key={String(key)} label={field.values.find((x) => x.key === key)?.label ?? String(key)} />);
    }
    return <SimpleEditRow key={field.key} label={field.label} last={last} values={values}>
      {field.kind === 'scale' && <Wrap>{[1, 2, 3, 4, 5].map((n) => scaleWord(field.key, n)).map((label, i) => <Capsule key={i} label={label} selected={value === i + 1} onPress={() => setProfile(field.key, value === i + 1 ? null : i + 1)} />)}</Wrap>}
      {field.kind === 'range' && (() => {
        const range = Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number'
          ? ([value[0], value[1]] as const)
          : null;
        return <View style={{ gap: 8 }}>
          <FieldLabel>Von</FieldLabel>
          <Wrap>{[1, 2, 3, 4, 5].map((n) => scaleWord(field.key, n)).map((label, i) => <Capsule key={i} label={label} selected={range?.[0] === i + 1} onPress={() => { const lo = i + 1; setProfile(field.key, [lo, Math.max(lo, range?.[1] ?? lo)]); }} />)}</Wrap>
          <FieldLabel>Bis</FieldLabel>
          <Wrap>{[1, 2, 3, 4, 5].map((n) => scaleWord(field.key, n)).map((label, i) => <Capsule key={i} label={label} selected={range?.[1] === i + 1} onPress={() => { const hi = i + 1; setProfile(field.key, [Math.min(range?.[0] ?? hi, hi), hi]); }} />)}</Wrap>
        </View>;
      })()}
      {field.kind === 'enum' && <Wrap>{field.values.map((option) => <Capsule key={option.key} label={option.label} selected={value === option.key} onPress={() => setProfile(field.key, value === option.key ? null : option.key)} />)}</Wrap>}
      {field.kind === 'list' && <Wrap>{field.values.map((option) => <Capsule key={option.key} label={option.label} selected={Array.isArray(value) && value.includes(option.key)} onPress={() => {
        const current = Array.isArray(value) ? value as string[] : [];
        if (!current.includes(option.key) && current.length >= field.max) return;
        setProfile(field.key, toggleIn(current, option.key));
      }} />)}</Wrap>}
    </SimpleEditRow>;
  };
  const profileCard = (group: 'shape' | 'surface' | 'style', title: string) => {
    const fields = profileFieldsFor(profileContext, group);
    return card(title, fields.map((field) => (last) => profileRow(field, last)));
  };

  // ---------- Steckbrief ----------
  const scales = fitScalesOf(f.category);
  const subs = subListOf(f.category);
  const types = typeListOf(f.category, f.subcategory);
  const pickCat = (level: 'category' | 'subcategory' | 'type', key: string) => {
    const next = pickCategory({ category: f.category, subcategory: f.subcategory, type: f.type }, level, key);
    onForm(setCategory(f, next));
  };
  const colorRow = (side: Side, last = false) => {
    const list = side === 'a' ? f.colors : f.colorsB;
    const key = side === 'a' ? 'colors' : 'colorsB';
    const pick: ColorPick = { colors: list, ...colorUi[side] };
    return (
      <SimpleEditRow key={key} label={fieldsFor(f.category, f.subcategory).reversible && f.reversible ? (side === 'a' ? 'Farben Seite A' : 'Farben Seite B') : 'Farben'} open={!!open[key]} onToggle={() => toggle(key)} ai={ai(key)} last={last}
        values={list.map((c) => <ValueCircle key={c} a11y={colorLabel(c)}><ColorDot name={c} onFill /></ValueCircle>)}>
        <ColorPicker pick={pick} onChange={(n) => { setColorUi((u) => ({ ...u, [side]: { open: n.open, full: n.full } })); set(key, n.colors); }} />
      </SimpleEditRow>
    );
  };
  type Row = ((last: boolean) => React.ReactNode) | null | false;
  /** Sichtbare Zeilen einer Karte; die letzte ohne Trennlinie. Keine Zeile → Karte entfällt (Spec 8a) */
  const card = (title: string, rows: Row[], extra?: React.ReactNode) => {
    const shown = rows.filter((r): r is (last: boolean) => React.ReactNode => !!r);
    return shown.length ? <View style={{ gap: 0 }}><Text style={{ fontSize: 18, fontWeight: '600', color: t.ink, paddingTop: 10, paddingBottom: 4 }}>{title}</Text>{shown.map((r, i) => <View key={i}>{r(i === shown.length - 1)}</View>)}{extra}</View> : null;
  };
  const textRow = (key: 'pattern' | 'patternB' | 'collar' | 'closure' | 'strap', label: string, opts: KeyList): Row => (last) => {
    const v = f[key];
    return (
      <SimpleEditRow label={label} open={!!open[key]} onToggle={() => toggle(key)} ai={ai(key)} last={last} values={v ? [<ValueCapsule key={v} label={keyLabel(opts, v)} />] : []}>
        {!!ruleNote(f, key) && <Text style={{ fontSize: 12, lineHeight: 16, color: t.inkMuted, marginBottom: 8 }}>{ruleNote(f, key)}</Text>}
        <Wrap>{opts.map((o) => <Capsule key={o.key} label={o.label} selected={v === o.key} onPress={() => set(key, pickOne(v, o.key))} />)}</Wrap>
      </SimpleEditRow>
    );
  };
  const fx = fieldsFor(f.category, f.subcategory);
  const reversible = fx.reversible && f.reversible;
  const sizeValues = [sizeText(f.sizeSystem, f.size), fx.size === 'clothing' && hasCollarSize(f.subcategory) && f.collarSize ? `Kragen ${f.collarSize}` : null].filter((x): x is string => !!x);

  const steckbrief = (
    <>
      {card('Aussehen', [
        (last) => (
          <SimpleEditRow label="Kategorie" open={!!open.cat} onToggle={() => toggle('cat')} ai={ai('category')} last={last}
            values={f.category ? [<ValueCapsule key="c" label={categoryLast({ category: f.category, subcategory: f.subcategory, type: f.type })} />] : []}>
            <FieldLabel>Kategorie</FieldLabel>
            <Wrap>{CATEGORY_LIST.map((c) => <Capsule key={c.key} label={c.label} selected={f.category === c.key} onPress={() => pickCat('category', c.key)} />)}</Wrap>
            {f.category && <>
              <FieldLabel>Unterkategorie</FieldLabel>
              <Wrap>{subs.map((c) => <Capsule key={c.key} label={c.label} selected={f.subcategory === c.key} onPress={() => pickCat('subcategory', c.key)} />)}</Wrap>
            </>}
            {types.length > 0 && <>
              <FieldLabel>Typ</FieldLabel>
              <Wrap>{types.map((c) => <Capsule key={c.key} label={c.label} selected={f.type === c.key} onPress={() => pickCat('type', c.key)} />)}</Wrap>
            </>}
          </SimpleEditRow>
        ),
        (last) => (
          <SimpleEditRow label="Saison" open={!!open.season} onToggle={() => toggle('season')} ai={ai('seasons')} last={last}
            values={SEASONS.filter((x) => f.seasons.includes(x.key)).map((x) => <ValueCircle key={x.key} a11y={x.label}><Icon name={SEASON_ICON[x.key]!} size="row" color={t.onFill} /></ValueCircle>)}>
            {!!ruleNote(f, 'seasons') && <Text style={{ fontSize: 12, lineHeight: 16, color: t.inkMuted, marginBottom: 8 }}>{ruleNote(f, 'seasons')}</Text>}
            <Wrap>{SEASONS.map((x) => <Capsule key={x.key} label={x.label} selected={f.seasons.includes(x.key)} onPress={() => set('seasons', toggleIn(f.seasons, x.key))}
              icon={(c) => <Icon name={SEASON_ICON[x.key]!} size="chip" color={c} />} />)}</Wrap>
          </SimpleEditRow>
        ),
        (last) => colorRow('a', last),
        fx.reversible && ((last) => (
          <PlainRow label="Wendbar" inset last={last}>
            <SymbolSwitch on={f.reversible} label="Wendbar" onToggle={() => set('reversible', !f.reversible)}>
              {(c) => <Icon name="reversible" size="row" color={c} />}
            </SymbolSwitch>
          </PlainRow>
        )),
        reversible && ((last) => colorRow('b', last)),
        !!p.set && !f.isWish && ((last) => (
          <PlainRow label="Set" inset last={last}
            below={p.set!.draft.on ? <SetPicker draft={p.set!.draft} onChange={p.set!.onChange} items={p.set!.items} width={col}
              current={{ id: p.set!.currentId, name: f.name.trim(), setId: p.set!.setId, thumb: p.pics.a?.preview ?? p.current.a, kind: layoutKind(f.category, f.subcategory), hex: p.hex }} /> : null}>
            <SymbolSwitch on={p.set!.draft.on} label="Set" onToggle={() => p.set!.onChange({ ...p.set!.draft, on: !p.set!.draft.on })}>
              {(c) => <Icon name="link" size="row" color={c} />}
            </SymbolSwitch>
          </PlainRow>
        )),
        fx.pattern && textRow('pattern', reversible ? 'Muster Seite A' : 'Muster', PATTERNS),
        fx.pattern && reversible && textRow('patternB', 'Muster Seite B', PATTERNS),
        (last) => (
          <SimpleEditRow label="Material" open={!!open.material} onToggle={() => toggle('material')} ai={ai('materials')} last={last}
            values={capsules(f.materials.map((m) => m.pct != null ? `${materialLabel(m.name)} ${m.pct} %` : materialLabel(m.name)))}>
            <Wrap>{MATERIALS.map((m) => {
              const r = materialRank(f.materials, m.key);
              return <Capsule key={m.key} label={m.label} selected={r > 0} a11y={r ? `${m.label}, Rang ${r}` : m.label} leading={r ? <RankBadge n={r} /> : undefined}
                onPress={() => set('materials', toggleMaterial(f.materials, m.key))} />;
            })}</Wrap>
            <Hint>Die Zahl ist die Reihenfolge nach Anteil, 1 = Hauptmaterial.</Hint>
            {f.materials.map((part) => <TextField key={part.name} label={`${materialLabel(part.name)} · Anteil in %`} value={part.pct == null ? '' : String(part.pct)}
              onChange={(v) => set('materials', setMaterialPct(f.materials, part.name, parsePct(v)))}
              placeholder="optional" keyboardType="decimal-pad" inputMode="decimal" />)}
            {materialPctSum(f.materials) > 100 && <Hint accent>Zusammen {materialPctSum(f.materials)} %, höchstens 100 % möglich.</Hint>}
            {materialOrderOff(f.materials) && (
              <Text accessibilityRole="button" onPress={() => set('materials', sortMaterialsByPct(f.materials))} style={{ fontSize: 12, lineHeight: 16, color: t.accent }}>
                Reihenfolge passt nicht zu den Anteilen · Nach Anteil sortieren
              </Text>
            )}
          </SimpleEditRow>
        ),
        !!fx.size && ((last) => (
          <SimpleEditRow label="Größe" open={!!open.size} onToggle={() => toggle('size')} ai={ai('size')} last={last} values={capsules(sizeValues)}>
            <SizePicker kind={fx.size!} category={f.category} sub={f.subcategory} system={f.sizeSystem} size={f.size} collarSize={f.collarSize}
              onSystem={(sys) => onForm(pickSizeSystem(f, sys))} onSize={(sys, v) => onForm(pickSize(f, sys, v))} onCollar={(v) => set('collarSize', v)} />
          </SimpleEditRow>
        )),
      ])}

      {card('Tragen', [
        scales.length > 0 && ((last) => (
          <SimpleEditRow label="Passform" open={!!open.fit} onToggle={() => toggle('fit')} ai={ai('fit')} last={last}
            values={scales.filter((sc) => f.fit[sc.key] != null).map((sc) => (
              <ValueCapsule key={sc.key} label={sc.steps[f.fit[sc.key]!] ?? ''} />
            ))}>
            <FitPicker scales={scales} fit={f.fit} onPick={(k, i) => onForm(pickFit(f, k, i))} />
          </SimpleEditRow>
        )),
        fx.layers && ((last) => (
          <SimpleEditRow label="Lagen" open={!!open.layers} onToggle={() => toggle('layers')} ai={ai('layers')} last={last}
            values={capsules([...f.layers].sort().map((i) => LAYERS[i]!).filter(Boolean))}>
            <LayersPicker layers={f.layers} onToggle={(i) => set('layers', toggleIn(f.layers, i))} />
          </SimpleEditRow>
        )),
        fx.weather && ((last) => (
          <SimpleEditRow label="Wetter" open={!!open.weather} onToggle={() => toggle('weather')} ai={ai('warmth') || ai('rain')} last={last}
            values={[
              ...(f.warmth != null ? [<ValueScale key="w" steps={4} on={(i) => i <= f.warmth!} a11y={`Wärme ${WARMTH[f.warmth]}`} icon={(c) => <Icon name="thermo" size="inline" color={c} />} />] : []),
              ...(f.rain != null ? [<ValueScale key="r" steps={3} on={(i) => i <= f.rain!} a11y={`Regen ${RAIN[f.rain]}`} icon={(c) => <Icon name="drop" size="inline" color={c} />} />] : []),
            ]}>
            {!!weatherNote(f) && <Text style={{ fontSize: 12, lineHeight: 16, color: t.inkMuted, marginBottom: 8 }}>{weatherNote(f)}</Text>}
            <WeatherPicker warmth={f.warmth} rain={f.rain} onWarmth={(v) => set('warmth', v)} onRain={(v) => set('rain', v)} />
          </SimpleEditRow>
        )),
      ])}

      {card('Details', [
        // Stil entfällt (Max, 21.11.2026): für die Outfit-Logik zählt die Formalität aus dem KI-Profil
        !!fx.neckline && textRow('collar', fx.neckline!.label, fx.neckline!.options),
        fx.closure && textRow('closure', 'Verschluss', CLOSURES),
        fx.strap && textRow('strap', 'Trägerart', STRAPS),
      ])}

      {profileCard('shape', 'Form')}
      {profileCard('surface', 'Oberfläche')}
      {profileCard('style', 'Wirkung')}

      {card('Pflege', [
        fx.care && ((last) => (
          <SimpleEditRow label="Pflegehinweise" open={!!open.care} onToggle={() => toggle('care')} ai={ai('care')} last={last}
            values={careList(f.care).map((c) => {
              const g = CARE.find((x) => x.key === c.group)!;
              const o = g.options.find((x) => x.id === c.v);
              return <ValueCircle key={c.group} a11y={`${g.label}: ${o?.short ?? c.v}`} estimated={c.src === 'geschaetzt'}>
                <Icon name={c.v as SymbolName} size="button" color={c.src === 'geschaetzt' ? t.inkMuted : t.onFill} />
              </ValueCircle>;
            })}>
            <CarePicker care={f.care} onChange={(c) => onForm(setCare(f, c))} />
          </SimpleEditRow>
        )),
      ])}

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: t.ink, paddingTop: 10 }}>Notizen</Text>
        <NotesField value={f.notes} onChange={(v) => set('notes', v)} />
      </View>
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
          <SymbolSwitch on={f.gift} label="Geschenk" onToggle={() => set('gift', !f.gift)}>{(c) => <Icon name="gift" size="row" color={c} />}</SymbolSwitch>
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
                        <View style={{ flex: 1, alignItems: 'flex-start' }}>
                          {pp ? <Capsule label={name(pp)} selected leading={<Monogram person={pp} />} />
                            : <Text style={{ fontSize: 15, color: t.ink }}>?</Text>}
                        </View>
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
              <DateField label="Kaufdatum" value={f.purchaseDate} onChange={(v) => set('purchaseDate', v)} optional extra={ai('purchaseDate') ? <KiBadge /> : null} />
              <TextField label="Shop" value={f.shop} onChange={(v) => set('shop', v)} placeholder="z. B. zalando.de" extra={ai('shop') ? <KiBadge /> : null} />
            </Pair>
          </>
        )}
        {f.gift && <TextField label="Shop" value={f.shop} onChange={(v) => set('shop', v)} />}
        <TextField label="Produktlink" value={f.link} onChange={setLink} placeholder="https://…" keyboardType="url" inputMode="url" />
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
      <TextField label="Produktlink" value={f.link} onChange={setLink} placeholder="https://…" keyboardType="url" inputMode="url" />
      <TextField label="Artikelnummer" value={f.articleNo} onChange={(v) => set('articleNo', v)} />
      {/* Pflicht: Wunschteile gibt es nur in einer Liste (17.11.2026) */}
      <View style={{ gap: 8 }}>
        <FieldLabel>Liste</FieldLabel>
        <Wrap>
          {p.wishlists.map((l) => <Capsule key={l.id} label={l.name} selected={f.wishlistId === l.id} onPress={() => set('wishlistId', l.id)} />)}
          {listName == null && <Capsule label="Neue Liste" dashed onPress={() => { setListName(''); setListErr(null); }} icon={(c) => <Icon name="plus" size="chip" color={c} />} />}
        </Wrap>
        {/* Neue Liste direkt hier anlegen (17.11.2026, Max): gehört mir, wird gleich gewählt */}
        {listName != null && (
          <View style={{ gap: 8 }}>
            <TextField label="Name der neuen Liste" value={listName} onChange={setListName} placeholder="z. B. Winter" autoFocus />
            <Wrap>
              <Capsule label={listBusy ? 'Lege an …' : 'Anlegen'} selected onPress={listBusy ? undefined : addList} />
              <Capsule label="Abbrechen" onPress={listBusy ? undefined : () => setListName(null)} />
            </Wrap>
          </View>
        )}
        {!!listErr && <Hint>{listErr}</Hint>}
        {p.wishlists.length === 0 && listName == null && <Hint>Noch keine Liste – lege hier eine an.</Hint>}
      </View>
      <View style={{ gap: 8 }}>
        <FieldLabel>Kategorie{f.wishTag ? ` · ${WISH_LABEL[f.wishTag]}` : ''}</FieldLabel>
        <Wrap>{WISH_ORDER.map((w) => (
          <IconCircle key={w} a11y={WISH_LABEL[w]} selected={f.wishTag === w} onPress={() => set('wishTag', pickOne(f.wishTag, w))}>
            <Icon name={w as SymbolName} size="row" color={f.wishTag === w ? t.onFill : t.ink} />
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
          <EditImage width={col} current={p.current} pics={p.pics} onPick={p.onPic} reversible={f.reversible} kind={tileKind(f.category, f.subcategory, f.type, f.fit.length)}
            hex={p.hex} colors={f.colors} colorsB={f.colorsB} onInfo={() => setInfo(true)} onChangePhoto={p.onChangePhoto}
            loadStored={p.loadStored} onError={p.onError} />
          {!!p.aiBusy && (
            <View style={[s.kiCard, { backgroundColor: t.surface, borderColor: t.hairline, alignItems: 'center' }]}>
              <ActivityIndicator color={t.accent} />
              <Text style={{ flex: 1, fontSize: 14, lineHeight: 19, color: t.ink }}>{p.aiBusy}</Text>
            </View>
          )}
          {f.aiPending.length > 0 && (
            <View style={[s.kiCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              <KiBadge />
              <View style={{ flex: 1, gap: 10 }}>
                <Text style={{ fontSize: 14, lineHeight: 19, color: t.ink }}>Felder mit „KI“ hat die KI vorausgefüllt (aus Foto, Shop, Etikett oder Name). Prüfe sie und übernimm sie – erst dann gelten sie als bestätigt und eine neue Analyse ändert sie nicht mehr. Ändern bestätigt einen Wert ebenfalls.</Text>
                <View style={{ flexDirection: 'row' }}>
                  <Capsule label="Alle übernehmen" selected onPress={() => onForm(confirmAllAi(f))} icon={(c) => <Icon name="check" size="chip" color={c} />} />
                </View>
              </View>
            </View>
          )}
          <TextField label="Name" value={f.name} onChange={(v) => onForm(setName(f, v))} placeholder="z. B. Relaxed Flannel Shirt" extra={ai('name') ? <KiBadge /> : null} />
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
      <InfoSheet open={info} hint={infoHint(f)} link={f.link} onClose={() => setInfo(false)}
        onResult={(r, from, url) => onForm((cur) => {
          const next = applyInfo(cur, r, from);
          // Link wie bei „Neues Teil“ per Link: ins Feld Link (falls leer), Shop aus der Domain
          return url && !next.link.trim() ? { ...setField(next, 'link', url), shop: shopFromLink(next.shop, '', url) } : next;
        })} />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  side: { flex: 1, flexBasis: 0 },
  title: { fontFamily: 'Gloock_400Regular', fontSize: detail.font.sheetTitle, lineHeight: 24, textAlign: 'center' },
  kiCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, marginTop: 4 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 8, borderBottomWidth: 1 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  delete: { height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

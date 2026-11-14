import { Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { CATEGORIES, SEASONS, STYLES, WISH_TAGS, isWishTag, parseAmount, type WishTag } from '@valet/core';
import { Chip } from './ui';
import { Icons } from './Icon';
import { useTheme, space, radius } from '@/lib/theme';
import type { ItemChange, ItemRow } from '@/lib/item';
import { NAMED, personKey, type Person, type Wishlist } from '@/lib/wardrobe';
import { TileIcon } from './tile/TileIcons';

// Formular eines Teils – gemeinsam für „Bearbeiten“ und „Teil hinzufügen“

const PERSON = { pink: '#D9668E', red: '#C8102E' } as const;
const COLORS = Object.keys(NAMED).map((k) => k[0].toUpperCase() + k.slice(1));
const eur = (n: number | null) => (n == null ? '' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const toDe = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : '');
function toIso(de: string): string | null | undefined {
  const t = de.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return undefined; // ungültig
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export type ItemForm = {
  name: string; brand: string; category: string; owners: string[]; price: string; qty: string;
  colors: string[]; size: string; list: string; date: string; shop: string; link: string;
  seasons: string[]; style: string | null; material: string; reversible: boolean; notes: string;
  /** Wunschliste: Wunschteil, Liste und Kategorie (Grail, Watchlist …) */
  isWish: boolean; wishlistId: string | null; wishTag: WishTag | null;
};

export function toForm(i: ItemRow): ItemForm {
  return {
    name: i.name ?? '', brand: i.brand ?? '', category: i.category, owners: i.owner_ids ?? (i.owner_id ? [i.owner_id] : []), price: eur(i.price_paid),
    qty: String(i.qty ?? 1), colors: (i.color ?? '').split('/').map((c) => c.trim()).filter(Boolean), size: i.size ?? '',
    list: eur(i.list_price), date: toDe(i.purchase_date), shop: i.shop ?? '', link: i.link ?? '',
    seasons: i.seasons ?? [], style: i.style, material: i.material ?? '', reversible: !!i.reversible, notes: i.notes ?? '',
    isWish: !!i.is_wish, wishlistId: i.wishlist_id ?? null, wishTag: isWishTag(i.wish_tag) ? i.wish_tag : null,
  };
}

export function emptyForm(ownerId: string | null, wish?: { wishlistId: string | null }): ItemForm {
  return {
    name: '', brand: '', category: '', owners: ownerId ? [ownerId] : [], price: '', qty: '1', colors: [], size: '', list: '', date: '',
    shop: '', link: '', seasons: [], style: null, material: '', reversible: false, notes: '',
    isWish: !!wish, wishlistId: wish?.wishlistId ?? null, wishTag: null,
  };
}

/** Prüft die Eingaben (Pflicht ist nur der Name; ohne Kategorie → „Sonstiges“); liefert die Änderung für die Datenbank oder eine Fehlermeldung */
export function readForm(f: ItemForm) {
  const fail = (error: string) => ({ error }) as const;
  if (!f.name.trim()) return fail('Bitte einen Namen eingeben.');
  const date = toIso(f.date);
  if (date === undefined) return fail('Kaufdatum bitte als TT.MM.JJJJ eingeben.');
  const price = parseAmount(f.price); const list = parseAmount(f.list);
  if (f.price.trim() && price == null) return fail('Preis ist keine Zahl.');
  if (f.list.trim() && list == null) return fail('Listenpreis ist keine Zahl.');
  return {
    change: {
      // Textfelder sind in der Datenbank „not null default ''“ → leer statt null speichern
      name: f.name.trim(), brand: f.brand.trim(), category: f.category || 'sonstiges',
      // mehrere Besitzer; owner_id bleibt Spiegel für die Statistik (genau einer → dessen ID, sonst null)
      owner_ids: f.owners, owner_id: f.owners.length === 1 ? f.owners[0]! : null, price_paid: price,
      qty: Math.max(1, parseInt(f.qty, 10) || 1), color: f.colors.join('/'), size: f.size.trim(), list_price: list,
      purchase_date: date, shop: f.shop.trim(), link: f.link.trim(), seasons: f.seasons, style: f.style ?? '',
      material: f.material.trim(), reversible: f.reversible, notes: f.notes.trim(),
      // Liste und Kategorie nur bei Wunschteilen
      ...(f.isWish ? { is_wish: true, wishlist_id: f.wishlistId, wish_tag: f.wishTag } : {}),
    } satisfies ItemChange,
  };
}

type Props = {
  f: ItemForm;
  onChange: (f: ItemForm) => void;
  persons: Person[];
  /** Listen der Wunschliste (nur bei Wunschteilen gezeigt) */
  wishlists?: Wishlist[];
  open: Record<string, boolean>;
  onOpen: (open: Record<string, boolean>) => void;
};

/** Felder des Formulars: das Wichtigste offen, der Rest in aufklappbaren Gruppen */
export function ItemFormFields({ f, onChange, persons, wishlists = [], open, onOpen }: Props) {
  const t = useTheme();
  const set = <K extends keyof ItemForm>(k: K, v: ItemForm[K]) => onChange({ ...f, [k]: v });
  const toggleIn = (k: 'seasons' | 'colors', v: string, max = 9) =>
    set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : f[k].length < max ? [...f[k], v] : [...f[k].slice(0, max - 1), v]);
  const flip = (k: string) => onOpen({ ...open, [k]: !open[k] });

  const input = [s.input, { backgroundColor: t.surface, borderColor: t.hairline, color: t.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null];
  // Als Funktion aufgerufen (nicht als Komponente), sonst verliert das Textfeld bei jeder Eingabe den Fokus
  const Field = ({ label, k, ...p }: { label: string; k: 'name' | 'brand' | 'price' | 'qty' | 'size' | 'list' | 'date' | 'shop' | 'link' | 'material' | 'notes' } & React.ComponentProps<typeof TextInput>) => (
    <View style={{ gap: 4, flex: p.style ? undefined : 1 }}>
      <Text style={[s.label, { color: t.inkMuted }]}>{label}</Text>
      <TextInput value={f[k]} onChangeText={(v) => set(k, v)} placeholderTextColor={t.inkMuted} {...p} style={[input, p.multiline && { height: 96, paddingTop: 12, textAlignVertical: 'top' }]} />
    </View>
  );
  return (
    <>
      {/* Das Wichtigste */}
      {Field({ label: 'Name (Pflicht)', k: 'name', placeholder: 'z. B. Wollmantel' })}
      {Field({ label: 'Marke', k: 'brand', placeholder: 'z. B. COS' })}
      <Text style={[s.label, { color: t.inkMuted, marginTop: space.xs }]}>Kategorie <Text style={{ fontWeight: '400' }}>· optional, sonst „Sonstiges“</Text></Text>
      <View style={s.wrap}>{CATEGORIES.map((c) => <Chip key={c.id} label={c.label} selected={f.category === c.id} onPress={() => set('category', f.category === c.id ? '' : c.id)} />)}</View>
      <Text style={[s.label, { color: t.inkMuted, marginTop: space.xs }]}>Gehört <Text style={{ fontWeight: '400' }}>· mehrere möglich</Text></Text>
      <View style={s.wrap}>
        {persons.map((p) => {
          const on = f.owners.includes(p.id);
          return <Chip key={p.id} label={p.name} dot={PERSON[personKey(p.color)]} selected={on}
            onPress={() => set('owners', on ? f.owners.filter((x) => x !== p.id) : [...f.owners, p.id])} />;
        })}
      </View>
      <View style={s.row}>
        {f.isWish
          ? Field({ label: 'Preis (€)', k: 'list', placeholder: '0,00', keyboardType: 'decimal-pad' })
          : Field({ label: 'Bezahlt (€ pro Stück)', k: 'price', placeholder: '0,00', keyboardType: 'decimal-pad' })}
        <View style={{ width: 96 }}>{Field({ label: 'Anzahl', k: 'qty', keyboardType: 'number-pad', style: {} })}</View>
      </View>

      {/* Wunschliste: Liste (eine) und Kategorie (eine) */}
      {f.isWish && (
        <>
          <Text style={[s.label, { color: t.inkMuted, marginTop: space.xs }]}>Liste <Text style={{ fontWeight: '400' }}>· optional</Text></Text>
          <View style={s.wrap}>
            <Chip label="Keine" selected={!f.wishlistId} onPress={() => set('wishlistId', null)} />
            {wishlists.map((l) => <Chip key={l.id} label={l.name} selected={f.wishlistId === l.id} onPress={() => set('wishlistId', f.wishlistId === l.id ? null : l.id)} />)}
          </View>
          <Text style={[s.label, { color: t.inkMuted, marginTop: space.xs }]}>Kategorie <Text style={{ fontWeight: '400' }}>· optional, eine</Text></Text>
          <View style={s.wrap}>
            {WISH_TAGS.map((w) => {
              const on = f.wishTag === w.id;
              return <Chip key={w.id} label={w.label} selected={on} onPress={() => set('wishTag', on ? null : w.id)} icon={<TileIcon name={w.id} color={on ? t.bg : t.ink} size={15} />} />;
            })}
          </View>
        </>
      )}

      {/* Gruppen */}
      <Group open={!!open.farbe} onToggle={() => flip('farbe')} title="Farbe & Größe" summary={[f.colors.join(' / '), f.size && `Größe ${f.size}`].filter(Boolean).join(' · ')}>
        <Text style={[s.label, { color: t.inkMuted }]}>Farben (in Reihenfolge antippen, bis zu 3)</Text>
        <View style={s.swatches}>
          {COLORS.map((c) => {
            const n = f.colors.indexOf(c);
            return (
              <Pressable key={c} onPress={() => toggleIn('colors', c, 3)} accessibilityLabel={c} accessibilityState={{ selected: n >= 0 }} style={s.swatchWrap}>
                <View style={[s.swatch, { backgroundColor: NAMED[c.toLowerCase()], borderColor: n >= 0 ? t.ink : t.hairline, borderWidth: n >= 0 ? 3 : 1 }]}>
                  {n >= 0 && <Text style={s.swatchN}>{n + 1}</Text>}
                </View>
                <Text style={{ fontSize: 11, color: t.inkMuted }} numberOfLines={1}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
        {Field({ label: 'Größe', k: 'size', placeholder: 'z. B. M, 32/32, 44' })}
      </Group>

      <Group open={!!open.kauf} onToggle={() => flip('kauf')} title={f.isWish ? 'Shop' : 'Kauf'} summary={[f.shop, !f.isWish && f.date, !f.isWish && f.list && `Liste ${f.list} €`].filter(Boolean).join(' · ')}>
        {/* Wunschteile: Preis steht oben, gekauft ist noch nichts */}
        {!f.isWish && (
          <View style={s.row}>
            {Field({ label: 'Listenpreis (€)', k: 'list', placeholder: '0,00', keyboardType: 'decimal-pad' })}
            {Field({ label: 'Kaufdatum', k: 'date', placeholder: 'TT.MM.JJJJ', keyboardType: 'numbers-and-punctuation' })}
          </View>
        )}
        {Field({ label: 'Shop', k: 'shop', placeholder: 'z. B. Zalando' })}
        {Field({ label: 'Link', k: 'link', placeholder: 'https://…', autoCapitalize: 'none', keyboardType: 'url' })}
      </Group>

      <Group open={!!open.eig} onToggle={() => flip('eig')} title="Eigenschaften" summary={[f.seasons.join(', '), f.style, f.material, f.reversible && 'Wendeteil'].filter(Boolean).join(' · ')}>
        <Text style={[s.label, { color: t.inkMuted }]}>Saison</Text>
        <View style={s.wrap}>{SEASONS.map((x) => <Chip key={x} label={x} selected={f.seasons.includes(x)} onPress={() => toggleIn('seasons', x)} />)}</View>
        <Text style={[s.label, { color: t.inkMuted }]}>Stil</Text>
        <View style={s.wrap}>{STYLES.map((x) => <Chip key={x} label={x} selected={f.style === x} onPress={() => set('style', f.style === x ? null : x)} />)}</View>
        {Field({ label: 'Material', k: 'material', placeholder: 'z. B. 100 % Baumwolle' })}
        <View style={s.switchRow}>
          <Text style={{ fontSize: 16, color: t.ink }}>Wendeteil</Text>
          <Switch value={f.reversible} onValueChange={(v) => set('reversible', v)} trackColor={{ true: '#722638', false: t.surfaceSunken }} thumbColor="#fff" {...({ activeThumbColor: '#fff' } as object)} />
        </View>
      </Group>

      <Group open={!!open.notiz} onToggle={() => flip('notiz')} title="Notizen" summary={f.notes}>
        {Field({ label: 'Notizen', k: 'notes', multiline: true, placeholder: 'Pflegehinweise, Passform …' })}
      </Group>
    </>
  );
}

/** Aufklappbare Gruppe; zugeklappt zeigt sie eine Zusammenfassung */
function Group({ open, onToggle, title, summary, children }: { open: boolean; onToggle: () => void; title: string; summary: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[s.group, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <Pressable onPress={onToggle} style={s.groupHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: t.ink }}>{title}</Text>
          {!open && !!summary && <Text style={{ fontSize: 13, color: t.inkMuted }} numberOfLines={1}>{summary}</Text>}
        </View>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><Icons.chevron color={t.inkMuted} /></View>
      </Pressable>
      {open && <View style={{ gap: space.sm, padding: space.md, paddingTop: 0 }}>{children}</View>}
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '500' },
  input: { height: 48, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: space.md, fontSize: 17 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  row: { flexDirection: 'row', gap: space.sm },
  group: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', marginTop: space.xs },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56, paddingHorizontal: space.md, paddingVertical: space.sm },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchWrap: { width: 54, alignItems: 'center', gap: 4 },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  swatchN: { color: '#fff', fontSize: 13, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
});

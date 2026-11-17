import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Chip, useChipReveal } from './ui';
import { useTheme, space } from '@/lib/theme';
import type { Person } from '@/lib/wardrobe';
import { Icon } from '@/components/Icon';

export type BarChip = { key: string; label: string; count?: number; icon?: React.ReactNode; person?: Pick<Person, 'name' | 'color'>; selected: boolean; onPress: () => void; onLongPress?: () => void; dashed?: boolean };

type Props = {
  /** Platzhalter im Suchfeld */
  placeholder?: string;
  /** volle Breite der Leiste (Bildschirmbreite, auf großen Geräten begrenzt) */
  width: number;
  query: string;
  onQuery: (q: string) => void;
  chips: BarChip[];
  filterActive: boolean;
  onFilter: () => void;
  onSort: () => void;
};

// Maße und Ablauf wie docs/design/schrank/suche-animation.html
const D = 420;
const EASE = Easing.bezier(0.22, 0.8, 0.24, 1);
const BTN = 44;
const PAD = space.md; // 16
const GAP = 8;
const DROP = BTN + 12; // Kategorien rutschen 12 px unter das Suchfeld
const ROW_PAD = 8;
const FADE = 28; // Länge des Verlaufs an den Enden der Kategorien

/**
 * Leiste über dem Schrank: Lupe · Kategorien · Sortieren.
 * Lupe antippen → Suchfeld wächst in gleicher Höhe aus dem Knopf, Sortieren dreht sich zu Filter,
 * Kategorien rutschen darunter und reichen dort bis an beide Bildschirmränder.
 * Ablauf ohne Überlappung: Öffnen = Kategorien erst runter, dann seitlich; Schließen = Feld zu und seitlich, dann hoch.
 */
export function ClosetBar({ width: W, placeholder = 'Suchen …', query, onQuery, chips, filterActive, onFilter, onSort }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const row = useChipReveal();
  const v = useRef({
    box: new Animated.Value(0), // Breite des Suchfelds
    cy: new Animated.Value(0), // Kategorien senkrecht
    cx: new Animated.Value(0), // Kategorien seitlich / volle Breite
    sw: new Animated.Value(0), // Sortieren ↔ Filter
    tx: new Animated.Value(0), // Eingabe und ✕
    vis: new Animated.Value(0), // 1 = Suche offen (Eingabe minimal sichtbar, siehe show)
  }).current;
  const inputOpacity = useRef(Animated.add(Animated.multiply(v.tx, 0.95), Animated.multiply(v.vis, 0.05))).current;
  const inputWrap = useRef<React.ComponentRef<typeof View>>(null);

  const run = (o: boolean) => {
    const a = (val: Animated.Value, duration: number, delay: number) =>
      Animated.timing(val, { toValue: o ? 1 : 0, duration, delay, easing: EASE, useNativeDriver: false });
    Animated.parallel(o
      ? [a(v.cy, D, 0), a(v.cx, D, 0.3 * D), a(v.box, D, 0.32 * D), a(v.sw, 0.8 * D, 0), a(v.tx, 0.5 * D, 0.6 * D)]
      : [a(v.box, 0.6 * D, 0), a(v.cx, 0.7 * D, 0), a(v.cy, D, 0.4 * D), a(v.sw, 0.6 * D, 0), a(v.tx, 0.2 * D, 0)],
    ).start(({ finished }) => { if (!o && finished) v.vis.setValue(0); });
  };
  const show = () => {
    if (open) return;
    setOpen(true);
    // Safari (iPhone) merkt sich beim Fokussieren, ob das Feld unsichtbar ist (Deckkraft 0), und richtet die Eingabe dann
    // als „verstecktes Feld“ ein – dabei blockiert es das Wischen der Kategorien, bis die Tastatur einmal zu war.
    // Darum vor dem Fokussieren auf kaum sichtbare 5 % stellen; die Einblend-Animation übernimmt danach.
    v.vis.setValue(1);
    // Web: sofort am Element setzen (die Animation schreibt ihren Wert evtl. erst mit dem nächsten Bild)
    const node = inputWrap.current as unknown as HTMLElement | null;
    if (Platform.OS === 'web' && node?.style) node.style.opacity = '0.05';
    input.current?.focus(); // direkt im Tippen, sonst öffnet Safari die Tastatur nicht
    run(true);
  };
  const hide = () => {
    setOpen(false);
    onQuery('');
    input.current?.blur();
    run(false);
  };
  const pick = (c: BarChip) => {
    c.onPress();
    // Chip ragt aus dem sichtbaren Bereich → gerade so weit rollen, dass er (aufgeklappt) ganz zu sehen ist
    const prev = chips.find((x) => x.selected)?.key ?? null;
    row.reveal(c.key, prev, open ? PAD : FADE, open ? PAD : FADE);
  };

  const boxW = v.box.interpolate({ inputRange: [0, 1], outputRange: [BTN, W - 2 * PAD - BTN - GAP] });
  const inputW = W - 2 * PAD - BTN - GAP - 42 - 40;
  const sortStyle = {
    opacity: v.sw.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] }),
    transform: [
      { rotate: v.sw.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) },
      { scale: v.sw.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) },
    ],
  };
  const filterStyle = {
    opacity: v.sw.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] }),
    transform: [
      { rotate: v.sw.interpolate({ inputRange: [0, 1], outputRange: ['-45deg', '0deg'] }) },
      { scale: v.sw.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
    ],
  };
  // Verlauf an beiden Enden (zur Lupe und zu Sortieren), nur bei geschlossener Suche. Jede Seite wächst mit dem Weg,
  // den die Reihe dorthin noch rollen kann (bis FADE): am Anfang links scharf, am Ende rechts scharf.
  // Web: als Maske direkt am Element (passt auf Seitenfarbe und Milchglas, kein Neuzeichnen beim Rollen);
  // sonst als Flächen in Seitenfarbe.
  const web = Platform.OS === 'web';
  const rowWrap = useRef<React.ComponentRef<typeof View>>(null);
  const [m] = useState(() => ({ x: 0, view: 0, content: 0, open: false, sx: new Animated.Value(0), rest: new Animated.Value(FADE) }));
  const applyMask = () => {
    const left = Math.min(FADE, Math.max(0, m.x));
    const right = m.content && m.view ? Math.min(FADE, Math.max(0, m.content - m.view - m.x)) : FADE;
    m.sx.setValue(left);
    m.rest.setValue(right);
    const node = rowWrap.current as unknown as HTMLElement | null;
    if (!web || !node?.style) return;
    const mask = m.open ? 'none' : `linear-gradient(90deg, transparent, #000 ${left}px, #000 calc(100% - ${right}px), transparent)`;
    node.style.setProperty('mask-image', mask);
    node.style.setProperty('-webkit-mask-image', mask);
  };
  useEffect(() => { m.open = open; applyMask(); });
  const fadeL = { backgroundImage: `linear-gradient(270deg, ${t.bg}00, ${t.bg})` } as object;
  const fadeR = { backgroundImage: `linear-gradient(90deg, ${t.bg}00, ${t.bg})` } as object;
  const closed = v.cx.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const scrollProps = {
    ...row.scrollProps,
    onScroll: (e: { nativeEvent: { contentOffset: { x: number } } }) => { row.scrollProps.onScroll(e); m.x = e.nativeEvent.contentOffset.x; applyMask(); },
    onLayout: (e: { nativeEvent: { layout: { width: number } } }) => { row.scrollProps.onLayout(e); m.view = e.nativeEvent.layout.width; applyMask(); },
    onContentSizeChange: (w: number) => { m.content = w; applyMask(); },
  };

  return (
    <Animated.View style={{ width: W, height: v.cy.interpolate({ inputRange: [0, 1], outputRange: [BTN + 2 * ROW_PAD, BTN + 2 * ROW_PAD + DROP] }) }}>
      {/* Kategorien */}
      <Animated.View style={[s.abs, {
        height: BTN,
        top: v.cy.interpolate({ inputRange: [0, 1], outputRange: [ROW_PAD, ROW_PAD + DROP] }),
        left: v.cx.interpolate({ inputRange: [0, 1], outputRange: [PAD + BTN + GAP, 0] }),
        width: v.cx.interpolate({ inputRange: [0, 1], outputRange: [W - 2 * (PAD + BTN + GAP), W] }),
      }]} ref={rowWrap}>
        <ScrollView ref={row.ref} {...scrollProps} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: GAP }}>
          <Animated.View style={{ width: v.cx.interpolate({ inputRange: [0, 1], outputRange: [0, PAD - GAP] }) }} />
          {chips.map((c) => (
            <View key={c.key} onLayout={row.layout(c.key)}>
              <Chip tall collapse={!!c.icon} onLabelWidth={row.labelWidth(c.key)} label={c.label} count={c.count} icon={c.icon} person={c.person} selected={c.selected} dashed={c.dashed} onPress={() => pick(c)} onLongPress={c.onLongPress} />
            </View>
          ))}
          <View style={{ width: PAD - GAP + 12 }} />
        </ScrollView>
        {!web && <Animated.View pointerEvents="none" style={[s.fade, { left: 0 }, fadeL, { opacity: Animated.multiply(closed, m.sx.interpolate({ inputRange: [0, FADE], outputRange: [0, 1] })) }]} />}
        {!web && <Animated.View pointerEvents="none" style={[s.fade, { right: 0 }, fadeR, { opacity: Animated.multiply(closed, m.rest.interpolate({ inputRange: [0, FADE], outputRange: [0, 1] })) }]} />}
      </Animated.View>

      {/* Lupe → Suchfeld */}
      <Animated.View style={[s.abs, s.box, {
        top: ROW_PAD, left: PAD, width: boxW,
        backgroundColor: v.box.interpolate({ inputRange: [0, 1], outputRange: [t.surface, t.surfaceSunken] }),
        borderColor: v.box.interpolate({ inputRange: [0, 1], outputRange: [t.hairline, t.surfaceSunken] }),
      }]}>
        <Pressable onPress={show} disabled={open} accessibilityRole="button" accessibilityLabel="Suchen" style={s.lupe}>
          <Icon name="search" size="button" color={open ? t.inkMuted : t.ink} />
        </Pressable>
      </Animated.View>
      <Animated.View ref={inputWrap} pointerEvents={open ? 'auto' : 'none'} style={[s.abs, { left: PAD + 42, top: ROW_PAD + 1, height: BTN - 2, width: inputW, opacity: inputOpacity }]}>
        <TextInput ref={input} value={query} onChangeText={onQuery} placeholder={placeholder} placeholderTextColor={t.inkMuted}
          returnKeyType="search" enterKeyHint="search" autoCorrect={false}
          style={[s.input, { color: t.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} />
      </Animated.View>
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[s.abs, s.x, { left: W - PAD - BTN - GAP - 8 - 28, top: ROW_PAD + 8, backgroundColor: t.hairline, opacity: v.tx, transform: [{ scale: v.tx.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
        <Pressable onPress={hide} hitSlop={8} accessibilityRole="button" accessibilityLabel="Suche schließen" style={s.center}>
          <Icon name="close" size="mini" color={t.ink} />
        </Pressable>
      </Animated.View>
      {filterActive && (
        <Animated.View pointerEvents="none" style={[s.abs, s.dot, { top: ROW_PAD + 1, left: PAD + BTN - 11, borderColor: t.bg, backgroundColor: t.blush, opacity: v.box.interpolate({ inputRange: [0, 0.2], outputRange: [1, 0], extrapolate: 'clamp' }) }]} />
      )}

      {/* Sortieren ↔ Filter */}
      <Animated.View pointerEvents={open ? 'none' : 'auto'} style={[s.abs, { top: ROW_PAD, right: PAD }, sortStyle]}>
        <Pressable onPress={onSort} accessibilityRole="button" accessibilityLabel="Sortieren" style={[s.round, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Icon name="sort" size="button" color={t.ink} />
        </Pressable>
      </Animated.View>
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[s.abs, { top: ROW_PAD, right: PAD }, filterStyle]}>
        <Pressable onPress={() => { input.current?.blur(); onFilter(); }} accessibilityRole="button" accessibilityLabel="Filter"
          style={[s.round, filterActive ? { backgroundColor: t.fill, borderColor: t.fill } : { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Icon name="filter" size="button" color={filterActive ? t.onFill : t.ink} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  abs: { position: 'absolute' },
  box: { height: BTN, borderRadius: BTN / 2, borderWidth: 1, overflow: 'hidden' },
  lupe: { position: 'absolute', left: 0, top: 0, width: BTN - 2, height: BTN - 2, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontSize: 16, paddingVertical: 0, height: BTN - 2 },
  x: { width: 28, height: 28, borderRadius: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  round: { width: BTN, height: BTN, borderRadius: BTN / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fade: { position: 'absolute', top: 0, bottom: 0, width: FADE },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
});

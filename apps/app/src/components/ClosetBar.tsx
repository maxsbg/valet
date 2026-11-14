import { useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Icons } from './Icon';
import { Chip } from './ui';
import { useTheme, space } from '@/lib/theme';

export type BarChip = { key: string; label: string; count?: number; selected: boolean; onPress: () => void; onLongPress?: () => void; dashed?: boolean };

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
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const chipX = useRef(new Map<string, { x: number; w: number }>()).current;
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
    const m = chipX.get(c.key);
    if (m) scroll.current?.scrollTo({ x: Math.max(0, m.x - (W - m.w) / 2), animated: true });
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
  // Rechter Verlauf zu Sortieren: im Web als Maske (passt auf Seitenfarbe und Milchglas), sonst als Fläche in Seitenfarbe
  const web = Platform.OS === 'web';
  const mask = open ? 'linear-gradient(90deg, #000, #000)' : 'linear-gradient(90deg, #000 calc(100% - 28px), transparent)';
  const fade = { backgroundImage: `linear-gradient(90deg, ${t.bg}00, ${t.bg})` } as object;

  return (
    <Animated.View style={{ width: W, height: v.cy.interpolate({ inputRange: [0, 1], outputRange: [BTN + 2 * ROW_PAD, BTN + 2 * ROW_PAD + DROP] }) }}>
      {/* Kategorien */}
      <Animated.View style={[s.abs, {
        height: BTN,
        top: v.cy.interpolate({ inputRange: [0, 1], outputRange: [ROW_PAD, ROW_PAD + DROP] }),
        left: v.cx.interpolate({ inputRange: [0, 1], outputRange: [PAD + BTN + GAP, 0] }),
        width: v.cx.interpolate({ inputRange: [0, 1], outputRange: [W - 2 * (PAD + BTN + GAP), W] }),
      }, web ? ({ maskImage: mask, WebkitMaskImage: mask } as object) : null]}>
        <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: GAP }}>
          <Animated.View style={{ width: v.cx.interpolate({ inputRange: [0, 1], outputRange: [0, PAD - GAP] }) }} />
          {chips.map((c) => (
            <View key={c.key} onLayout={(e) => chipX.set(c.key, { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width })}>
              <Chip tall label={c.label} count={c.count} selected={c.selected} dashed={c.dashed} onPress={() => pick(c)} onLongPress={c.onLongPress} />
            </View>
          ))}
          <View style={{ width: PAD - GAP + 12 }} />
        </ScrollView>
        {!web && <Animated.View pointerEvents="none" style={[s.fade, fade, { opacity: v.cx.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]} />}
      </Animated.View>

      {/* Lupe → Suchfeld */}
      <Animated.View style={[s.abs, s.box, {
        top: ROW_PAD, left: PAD, width: boxW,
        backgroundColor: v.box.interpolate({ inputRange: [0, 1], outputRange: [t.surface, t.surfaceSunken] }),
        borderColor: v.box.interpolate({ inputRange: [0, 1], outputRange: [t.hairline, t.surfaceSunken] }),
      }]}>
        <Pressable onPress={show} disabled={open} accessibilityRole="button" accessibilityLabel="Suchen" style={s.lupe}>
          <Icons.search color={open ? t.inkMuted : t.ink} size={21} />
        </Pressable>
      </Animated.View>
      <Animated.View ref={inputWrap} pointerEvents={open ? 'auto' : 'none'} style={[s.abs, { left: PAD + 42, top: ROW_PAD + 1, height: BTN - 2, width: inputW, opacity: inputOpacity }]}>
        <TextInput ref={input} value={query} onChangeText={onQuery} placeholder={placeholder} placeholderTextColor={t.inkMuted}
          returnKeyType="search" enterKeyHint="search" autoCorrect={false}
          style={[s.input, { color: t.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} />
      </Animated.View>
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[s.abs, s.x, { left: W - PAD - BTN - GAP - 8 - 28, top: ROW_PAD + 8, backgroundColor: t.hairline, opacity: v.tx, transform: [{ scale: v.tx.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
        <Pressable onPress={hide} hitSlop={8} accessibilityRole="button" accessibilityLabel="Suche schließen" style={s.center}>
          <Icons.close color={t.ink} size={13} />
        </Pressable>
      </Animated.View>
      {filterActive && (
        <Animated.View pointerEvents="none" style={[s.abs, s.dot, { top: ROW_PAD + 1, left: PAD + BTN - 11, borderColor: t.bg, backgroundColor: t.blush, opacity: v.box.interpolate({ inputRange: [0, 0.2], outputRange: [1, 0], extrapolate: 'clamp' }) }]} />
      )}

      {/* Sortieren ↔ Filter */}
      <Animated.View pointerEvents={open ? 'none' : 'auto'} style={[s.abs, { top: ROW_PAD, right: PAD }, sortStyle]}>
        <Pressable onPress={onSort} accessibilityRole="button" accessibilityLabel="Sortieren" style={[s.round, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Icons.sort color={t.ink} size={21} />
        </Pressable>
      </Animated.View>
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[s.abs, { top: ROW_PAD, right: PAD }, filterStyle]}>
        <Pressable onPress={() => { input.current?.blur(); onFilter(); }} accessibilityRole="button" accessibilityLabel="Filter"
          style={[s.round, filterActive ? { backgroundColor: t.ink, borderColor: t.ink } : { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Icons.filter color={filterActive ? t.bg : t.ink} size={21} />
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
  fade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 28 },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
});

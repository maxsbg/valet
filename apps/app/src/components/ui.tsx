import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { router } from 'expo-router';
import { Icons } from './Icon';
import { Sheet, SheetButton, OptionRow } from './Sheet';
import { useTheme, DISPLAY, space, radius } from '@/lib/theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { personKey } from '@/lib/wardrobe';

type Theme = ReturnType<typeof useTheme>;

/** Web: fest am Bildschirm statt an der Seite (die Seite selbst scrollt) */
export const FIXED = (Platform.OS === 'web' ? { position: 'fixed' } : {}) as object;

/** Milchglas für die Bedien-Ebene (Tab-Leiste, Plus-Knopf, klebende Leisten) */
export function glass(t: Theme): object[] {
  return [
    { backgroundColor: t.glass, borderColor: t.glassBorder },
    Platform.OS === 'web' ? ({ backdropFilter: 'blur(24px) saturate(1.6)', WebkitBackdropFilter: 'blur(24px) saturate(1.6)' } as object) : {},
  ];
}

/**
 * Web (Safari ab iOS 26): Ohne festes Element am oberen Rand legt Safari einen eigenen Weichzeichner-Verlauf
 * unter die Statusleiste, der bis in die Kopfzeile reicht und sie unscharf macht. Ein fester, mind. 6 px hoher
 * Streifen in Seitenfarbe am oberen Rand lässt Safari stattdessen die Statusleiste einfarbig tönen.
 * Ausblenden, sobald eine klebende Milchglas-Leiste oben liegt (die übernimmt dann den Bereich).
 */
export function TopTint() {
  const t = useTheme();
  if (Platform.OS !== 'web') return null;
  return <View style={[FIXED, { top: 0, left: 0, right: 0, height: 8, zIndex: 5, backgroundColor: t.bg }]} />;
}

/**
 * Kopfzeile der Tabs (entschieden 15.11.2026): links der Tab-Name in Gloock 34 (ink, also weiß bzw. schwarz),
 * rechts nur das Profil-Monogramm – darüber auch die Einstellungen. Der Schriftzug „valet“ sitzt am Seitenende (`PageEnd`).
 */
export function Header({ title, tint = true }: { title: string; tint?: boolean }) {
  const t = useTheme();
  const { wardrobe, session } = useSession();
  const [open, setOpen] = useState(false);
  const me = wardrobe?.persons.find((p) => p.user_id === session?.user.id);
  const tone = t.person[personKey(me?.color ?? null)];
  const letter = (me?.name ?? session?.user.email ?? '?').trim().slice(0, 1).toUpperCase();
  return (
    <View style={s.header}>
      {tint && <TopTint />}
      <Text style={[s.title, { color: t.ink }]} numberOfLines={1} accessibilityRole="header">{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Profil und Einstellungen" onPress={() => setOpen(true)} hitSlop={4}
        style={({ pressed }) => [s.mono, { borderColor: tone + '73', backgroundColor: tone + '1F', opacity: pressed ? 0.7 : 1 }]}>
        <Text style={[s.monoText, { color: tone }]}>{letter}</Text>
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={me?.name ?? 'Profil'}
        footer={<SheetButton label="Abmelden" onPress={() => { setOpen(false); supabase.auth.signOut(); }} />}>
        <Text style={{ fontSize: 15, color: t.inkMuted }}>{session?.user.email}</Text>
        {wardrobe && <Text style={{ fontSize: 15, color: t.inkMuted, marginTop: 4, marginBottom: space.sm }}>Schrank „{wardrobe.name}“</Text>}
        <OptionRow label="Alte Bilder zuordnen" selected={false} last onPress={() => { setOpen(false); router.push('/bilder-zuordnen'); }} />
      </Sheet>
    </View>
  );
}

/** Schriftzug „valet“ am Ende jeder Tab-Seite: mittig, sichtbar gleicher Abstand zur letzten Karte und zur Tab-Leiste */
export function PageEnd() {
  const t = useTheme();
  return (
    <View style={s.end} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={[s.wordmark, { color: t.dark ? t.accent : '#722638' }]}>valet</Text>
    </View>
  );
}

export function RoundButton({ children, label, onPress, size = 40 }: { children: React.ReactNode; label: string; onPress?: () => void; size?: number }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.surface, borderWidth: 1, borderColor: t.hairline, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 }]}>
      {children}
    </Pressable>
  );
}

/** Filter-Chip; ausgewählt = gefüllt in ink (ein einheitlicher Stil für „ausgewählt“) */
/**
 * Filter-Chip. collapse (Kategorie-/Anlass-Chips mit Symbol, alle Tabs, entschieden 14.11.2026):
 * nicht ausgewählt nur Symbol + Anzahl, ausgewählt Symbol + Name + Anzahl – der Chip wird dabei weich breiter
 * und der Name blendet zwischen Symbol und Anzahl ein. Bei „Bewegung reduzieren“ ohne Breiten-Animation.
 */
export function Chip({ label, count, selected, onPress, onLongPress, dot, icon, tall, dashed, collapse, onLabelWidth }: { label: string; count?: number; selected?: boolean; onPress?: () => void; onLongPress?: () => void; dot?: string; icon?: React.ReactNode; tall?: boolean; dashed?: boolean; collapse?: boolean; onLabelWidth?: (w: number) => void }) {
  const t = useTheme();
  const fold = !!collapse && !!icon;
  const color = selected ? t.bg : dashed ? t.inkMuted : t.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} onLongPress={onLongPress} delayLongPress={400}
      accessibilityLabel={fold ? (count != null ? `${label}, ${count}` : label) : undefined}
      style={[s.chip, tall && s.chipTall, fold && s.chipFold, { backgroundColor: selected ? t.ink : t.surface, borderColor: selected ? t.ink : t.hairline }, dashed && { borderStyle: 'dashed', backgroundColor: 'transparent', borderColor: t.inkMuted }]}>
      {icon}
      {dot && <View style={[s.dot, { backgroundColor: dot }]} />}
      {fold ? <FoldLabel label={label} open={!!selected} color={color} onWidth={onLabelWidth} /> : <Text style={[s.chipText, { color }]}>{label}</Text>}
      {count != null && <Text style={[s.chipCount, { color: selected ? t.bg : t.inkMuted }, fold && s.chipCountFold]}>{count}</Text>}
    </Pressable>
  );
}

const FOLD_MS = 300;
const FOLD_EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
/** Abstand Symbol → Name im aufgeklappten Chip */
export const FOLD_GAP = 7;
/** Ab dieser Breite wird ein Name aus mehreren Wörtern gekürzt (ein Wort nie) */
const FOLD_MAX = 112;

/**
 * Name, wie er im aufgeklappten Chip steht (Regel 14.11.2026): ein Wort immer ganz; mehrere Wörter ganz, wenn sie
 * passen, sonst erstes Wort ganz und das zweite angedeutet („Besonderer Anl…“).
 */
export const foldShort = (label: string) => {
  const w = label.trim().split(/\s+/);
  return w.length < 2 ? label : `${w[0]} ${w.slice(1).join(' ').slice(0, 3)}…`;
};

/** Name im Chip, der beim Auswählen aufgeht (Breite gemessen, dann animiert) */
function FoldLabel({ label, open, color, onWidth }: { label: string; open: boolean; color: string; onWidth?: (w: number) => void }) {
  const [full, setFull] = useState(0);
  const [short, setShort] = useState(0);
  const [v] = useState(() => new Animated.Value(open ? 1 : 0));
  const reduce = useReduceMotion();
  useEffect(() => {
    const to = open ? 1 : 0;
    if (reduce) { v.setValue(to); return; }
    Animated.timing(v, { toValue: to, duration: FOLD_MS, easing: FOLD_EASE, useNativeDriver: false }).start();
  }, [open, reduce, v]);
  const shortLabel = foldShort(label);
  const useShort = shortLabel !== label && full > FOLD_MAX;
  const text = useShort ? shortLabel : label;
  // +2 px Puffer gegen Rundung beim Messen: der Name wird nie abgeschnitten
  const w = (useShort ? short : full) + 2;
  useEffect(() => { if (full) onWidth?.(w + FOLD_GAP); }, [w, full, onWidth]);
  return (
    <>
      <Animated.View style={{ width: v.interpolate({ inputRange: [0, 1], outputRange: [0, w + FOLD_GAP] }), opacity: v, overflow: 'hidden' }}>
        <View style={{ width: w + FOLD_GAP, flexDirection: 'row' }}>
          <Text style={[s.chipText, s.noWrap, { color, marginLeft: FOLD_GAP, fontWeight: '600', flexShrink: 0 }]}>{text}</Text>
        </View>
      </Animated.View>
      {/* unsichtbar in einem breiten Rahmen, damit die volle Breite gemessen wird (misst nach dem Laden der Schrift neu).
          Der breite Rahmen steckt in einer Hülle ohne Größe mit overflow: hidden – sonst zählt er im Browser zur
          Breite der Chip-Reihe und man kann weit über den letzten Chip hinaus wischen. */}
      <View pointerEvents="none" aria-hidden style={s.measureClip}><View style={s.measure}>
        <Text onLayout={(e) => setFull(Math.ceil(e.nativeEvent.layout.width))} style={[s.chipText, s.noWrap, { fontWeight: '600', flexShrink: 0 }]}>{label}</Text>
        <Text onLayout={(e) => setShort(Math.ceil(e.nativeEvent.layout.width))} style={[s.chipText, s.noWrap, { fontWeight: '600', flexShrink: 0 }]}>{shortLabel}</Text>
      </View></View>
    </>
  );
}

/**
 * Chip-Reihe zum Wischen (Regel 14.11.2026): Ein angetippter Chip, der nicht ganz im Bereich innerhalb des
 * Innenabstands sichtbar ist, schafft sich Platz – die Reihe rollt gerade so weit, dass er (in seiner aufgeklappten
 * Breite) bis zum Innenabstand ganz zu sehen ist; die anderen ragen auf der anderen Seite hinaus.
 */
export function useChipReveal() {
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [st] = useState(() => ({ x: 0, view: 0, pos: new Map<string, { x: number; w: number }>(), label: new Map<string, number>() }));
  return {
    ref,
    scrollProps: {
      scrollEventThrottle: 16,
      onScroll: (e: { nativeEvent: { contentOffset: { x: number } } }) => { st.x = e.nativeEvent.contentOffset.x; },
      onLayout: (e: { nativeEvent: { layout: { width: number } } }) => { st.view = e.nativeEvent.layout.width; },
    },
    /** onLayout für die Hülle jedes Chips */
    layout: (key: string) => (e: { nativeEvent: { layout: { x: number; width: number } } }) => { st.pos.set(key, { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width }); },
    /** Breite des Namens (aufgeklappt) je Chip */
    labelWidth: (key: string) => (w: number) => { st.label.set(key, w); },
    /**
     * key wird ausgewählt (prev war ausgewählt, klappt zu). padL/padR = Innenabstand links/rechts im sichtbaren Bereich.
     */
    reveal: (key: string, prev: string | null, padL: number, padR: number) => {
      const go = (grow: number, shift: number) => {
        const m = st.pos.get(key);
        if (!m || !st.view) return;
        const x = m.x + shift;
        const w = m.w + grow;
        let to: number | null = null;
        if (x < st.x + padL) to = x - padL;
        else if (x + w > st.x + st.view - padR) to = x + w - st.view + padR;
        if (to != null) ref.current?.scrollTo({ x: Math.max(0, to), animated: true });
      };
      // sofort mit der vorhergesagten Breite (Chip geht auf, der vorige klappt zu) …
      const pm = prev && prev !== key ? st.pos.get(prev) : undefined;
      const m0 = st.pos.get(key);
      go(prev === key ? 0 : st.label.get(key) ?? 0, pm && m0 && pm.x < m0.x ? -(st.label.get(prev!) ?? 0) : 0);
      // … und nach dem Aufklappen noch einmal mit der echten Lage: am Ende der Reihe kann die Ansicht erst rollen,
      // wenn der Inhalt breiter geworden ist
      setTimeout(() => go(0, 0), FOLD_MS + 40);
    },
  };
}

function useReduceMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled().then((x) => on && setR(x)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setR);
    return () => { on = false; sub.remove(); };
  }, []);
  return r;
}

/** Einfaches Suchfeld (Outfit-Baukasten) */
export function SearchField({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  const t = useTheme();
  return (
    <View style={[s.search, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <Icons.search color={t.inkMuted} size={18} />
      <TextInput autoFocus value={value} onChangeText={onChange} placeholder="Suchen" placeholderTextColor={t.inkMuted}
        style={[s.searchInput, { color: t.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} />
      <Pressable accessibilityLabel="Suche schließen" onPress={onClose} hitSlop={10}><Icons.close color={t.inkMuted} /></Pressable>
    </View>
  );
}

/** Plus-Knopf unten rechts: klein, Milchglas, Plus in der Akzentfarbe */
export function Fab({ onPress, bottom, label = 'Teil hinzufügen' }: { onPress?: () => void; bottom: number; label?: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [s.fab, ...glass(t), FIXED, { bottom, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
      <Icons.plus color={t.dark ? t.accent : '#722638'} size={22} />
    </Pressable>
  );
}

/** Kurzer Hinweis über der Tab-Leiste */
export function useToast(bottom: number) {
  const [msg, setMsg] = useState<string | null>(null);
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!msg) return;
    Animated.timing(op, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    const id = setTimeout(() => Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMsg(null)), 2200);
    return () => clearTimeout(id);
  }, [msg, op]);
  const node = msg ? (
    <Animated.View pointerEvents="none" style={[s.toastWrap, FIXED, { bottom, opacity: op }]}>
      <View style={s.toast}><Text style={s.toastText}>{msg}</Text></View>
    </Animated.View>
  ) : null;
  return { show: setMsg, node };
}

export function Empty({ title, text }: { title: string; text: string }) {
  const t = useTheme();
  return (
    <View style={{ padding: space.xl, alignItems: 'center', gap: space.xs }}>
      <Text style={{ fontFamily: DISPLAY, fontSize: 24, color: t.ink }}>{title}</Text>
      <Text style={{ fontSize: 15, color: t.inkMuted, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  // Maße wie der große Titel in Apple Music (15.11.2026): Titel 34, Monogramm 44 mittig daneben, seitlich bündig mit dem Inhalt,
  // oben knapp unter der Statusleiste (8 = Höhe von TopTint), darunter 24 Luft bis zur ersten Leiste/Karte
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingTop: space.xs, paddingBottom: space.lg },
  mono: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  monoText: { fontFamily: DISPLAY, fontSize: 20, lineHeight: 24 },
  wordmark: { fontFamily: DISPLAY, fontSize: 32, lineHeight: 38 },
  title: { flex: 1, fontFamily: DISPLAY, fontSize: 34, lineHeight: 41, marginRight: space.sm },
  // sichtbar gleicher Abstand oben und unten (≈ 31 pt): Gloock lässt über „l“ ca. 8, unter der Grundlinie ca. 7 pt Luft
  end: { alignSelf: 'stretch', alignItems: 'center', marginTop: space.lg - 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 14, flex: 1 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  chipTall: { height: 44, paddingHorizontal: 16 },
  chipText: { fontSize: 15, fontWeight: '500' },
  chipCount: { fontSize: 13 },
  // gefaltet: Abstände kommen vom Namen selbst, damit zu nichts kein doppelter Abstand bleibt
  chipFold: { gap: 0, paddingHorizontal: 13 },
  chipCountFold: { marginLeft: 6 },
  noWrap: (Platform.OS === 'web' ? { whiteSpace: 'nowrap' } : {}) as object,
  measureClip: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'hidden' },
  measure: { position: 'absolute', left: 0, top: 0, width: 600, opacity: 0, flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  fab: { position: 'absolute', zIndex: 10, right: space.md + 4, width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.28)' },
  toastWrap: { position: 'absolute', zIndex: 40, left: 0, right: 0, alignItems: 'center' },
  toast: { backgroundColor: '#2a1a1d', borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10, boxShadow: '0 6px 20px rgba(42,26,29,0.2)' },
  toastText: { color: '#F5F0E8', fontSize: 15, fontWeight: '500' },
});

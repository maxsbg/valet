// Bausteine der Bearbeiten-Seite (VALET_DETAILSEITE_SPEC.md, Abschnitt 7; Leinwand „H · Bearbeiten“)
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colorHex, rankInk, MULTICOLOR, MULTICOLOR_STOPS } from '@valet/core';
import { detail } from '@valet/ui';
import { useTheme, DISPLAY } from '@/lib/theme';
import { DetailIcon } from '@/components/detail/DetailIcons';
import { FieldLabel, Wrap } from '@/components/detail/parts';

const D = detail;
const web = Platform.OS === 'web';
/** Pfeil-Spalte der aufklappbaren Zeilen (Pfeil + Abstand zu den Werten) */
const CHEVRON = 16;
const CHEVRON_GAP = 10;

/** „KI“-Markierung: Feld von der KI vorausgefüllt, bis bestätigt oder geändert */
export function KiBadge() {
  const t = useTheme();
  return (
    <View accessibilityLabel="von der KI vorausgefüllt" style={[s.ki, { borderColor: t.hairline }]}>
      <Text style={[s.kiText, { color: t.inkMuted }]}>KI</Text>
    </View>
  );
}

/** Karte mit Gloock-Überschrift (Aussehen, Tragen, Details, Pflege, Kauf, Besitz …) */
export function EditCard({ title, children, rows, action }: {
  title: string; children: React.ReactNode; /** aufklappbare Zeilen: kein Innenabstand oben/unten */ rows?: boolean;
  /** Text-Aktion rechts neben der Überschrift (z. B. „Bearbeiten“ bei der Set-Karte) */ action?: { label: string; onPress: () => void };
}) {
  const t = useTheme();
  const head = <Text style={[s.cardTitle, { color: t.ink }, rows && { marginTop: 10, marginBottom: 2 }]} accessibilityRole="header">{title}</Text>;
  return (
    <View style={[s.card, rows ? s.cardRows : s.cardPlain, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      {action ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          {head}
          <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={8}><Text style={{ fontSize: 15, color: t.accent }}>{action.label}</Text></Pressable>
        </View>
      ) : head}
      {children}
    </View>
  );
}

/**
 * Aufklappbare Zeile: zu = Bezeichnung links, gewählte Werte rechts (wie in der Ansicht), Pfeil;
 * auf = Auswahl darunter, Pfeil dreht sich. Keine Werte → „Auswählen“.
 */
export function EditRow({ label, open, onToggle, values, ai, last, children }: {
  label: string; open: boolean; onToggle: () => void; values: React.ReactNode[]; ai?: boolean; last?: boolean; children?: React.ReactNode;
}) {
  const t = useTheme();
  const rot = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    let reduce = false;
    AccessibilityInfo.isReduceMotionEnabled?.().then((r) => { reduce = r; }).catch(() => {});
    Animated.timing(rot, { toValue: open ? 1 : 0, duration: reduce ? 0 : 200, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
  }, [open, rot]);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  return (
    <View style={[!last && { borderBottomWidth: 1, borderBottomColor: t.hairline }, open && { paddingBottom: 14 }]}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={label}
        style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={s.rowLabel}>
          <Text style={[s.rowLabelText, { color: t.inkMuted }]}>{label}</Text>
          {ai && <KiBadge />}
        </View>
        <View style={s.rowValues}>
          {values.length ? <Wrap gap={6} align="end">{values}</Wrap> : <Text style={{ fontSize: 15, color: t.inkMuted, textAlign: 'right' }}>Auswählen</Text>}
        </View>
        <Animated.View style={{ transform: [{ rotate }] }}><DetailIcon name="chevronDown" size={CHEVRON} color={t.inkMuted} /></Animated.View>
      </Pressable>
      {open && <View style={{ gap: 14 }}>{children}</View>}
    </View>
  );
}

/**
 * Feste Zeile ohne Aufklappen (z. B. Wendbar, Geschenk mit Symbol-Schalter).
 * Der Wert steht in der Wertespalte, rechtsbündig mit den Kapseln der aufklappbaren Zeilen:
 * rechts bleibt die Pfeil-Spalte frei (16 px Pfeil + 10 px Abstand, Spec 1).
 */
export function PlainRow({ label, children, last, ink }: { label: string; children: React.ReactNode; last?: boolean; ink?: boolean }) {
  const t = useTheme();
  return (
    <View style={[s.plain, !last && { borderBottomWidth: 1, borderBottomColor: t.hairline }]}>
      <Text style={{ fontSize: 15, color: ink ? t.ink : t.inkMuted }}>{label}</Text>
      <View style={{ marginRight: CHEVRON + CHEVRON_GAP }}>{children}</View>
    </View>
  );
}

/** Wert rechts in einer Zeile: gefüllte Kapsel */
export function ValueCapsule({ label, icon }: { label: string; icon?: (color: string) => React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[s.vcap, { backgroundColor: t.ink }]} accessibilityLabel={label}>
      {icon?.(t.bg)}
      <Text style={[s.vcapText, { color: t.bg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** Wert rechts in einer Zeile: runder Kreis mit Symbol (Saison, Pflege, Farbe) */
export function ValueCircle({ a11y, children, estimated, outline }: { a11y: string; children: React.ReactNode; /** geschätzte Pflege: ohne Füllung + Stern */ estimated?: boolean; /** Farbkreis: nur Rand */ outline?: boolean }) {
  const t = useTheme();
  return (
    <View accessibilityRole="image" accessibilityLabel={estimated ? `${a11y} (geschätzt)` : a11y}
      style={[s.vcircle, estimated || outline ? { borderWidth: 1, borderColor: t.hairline, backgroundColor: 'transparent' } : { backgroundColor: t.ink }]}>
      {children}
      {estimated && <Text style={[s.star, { color: t.inkMuted }]}>✱</Text>}
    </View>
  );
}

/** Skala als Wert in einer Zeile: gefüllte Kapsel mit Bezeichnung und Strichen */
export function ValueScale({ caption, steps, on, icon, a11y }: { caption?: string; steps: number; on: (i: number) => boolean; icon?: (c: string) => React.ReactNode; a11y: string }) {
  const t = useTheme();
  return (
    <View style={[s.vcap, { backgroundColor: t.ink, gap: 6 }]} accessibilityRole="image" accessibilityLabel={a11y}>
      {icon?.(t.bg)}
      {caption ? <Text style={[s.vcapText, { color: t.bg, fontSize: 14 }]}>{caption}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {Array.from({ length: steps }, (_, i) => <View key={i} style={{ width: 7, height: 6, borderRadius: 3, backgroundColor: on(i) ? t.bg : 'rgba(127,127,127,0.45)' }} />)}
      </View>
    </View>
  );
}

/** Farbkreis 24 px (überall gleich), optional mit Rang-Ziffer; „Bunt“ als Farbrad */
export function ColorDot({ name, rank, size = D.colorDot }: { name: string; rank?: number; size?: number }) {
  const hex = colorHex(name);
  const r = size / 2;
  return (
    <View style={{ width: size, height: size, borderRadius: r, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: hex ?? '#ccc', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.18)' }}>
      {name === MULTICOLOR && (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={StyleSheet.absoluteFill}>
          {MULTICOLOR_STOPS.map((c, i) => {
            const a0 = (i / MULTICOLOR_STOPS.length) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / MULTICOLOR_STOPS.length) * 2 * Math.PI - Math.PI / 2;
            return <Path key={i} d={`M12 12L${12 + 12 * Math.cos(a0)} ${12 + 12 * Math.sin(a0)}A12 12 0 0 1 ${12 + 12 * Math.cos(a1)} ${12 + 12 * Math.sin(a1)}Z`} fill={c} />;
          })}
          <Circle cx={12} cy={12} r={11.5} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={1} />
        </Svg>
      )}
      {rank ? <Text style={{ fontSize: 12, fontWeight: '700', color: name === MULTICOLOR ? '#fff' : rankInk(hex) }}>{rank}</Text> : null}
    </View>
  );
}

/** Rang-Ziffer in einer Kapsel (Material: 1 = Hauptmaterial) */
export function RankBadge({ n }: { n: number }) {
  const t = useTheme();
  return <View style={[s.rank, { backgroundColor: t.bg }]}><Text style={{ fontSize: 12, fontWeight: '700', color: t.ink }}>{n}</Text></View>;
}

/** Symbol-Schalter (Spec 1): runder 38-px-Knopf mit dem Plaketten-Symbol; leer = aus, gefüllt = an */
export function SymbolSwitch({ on, onToggle, label, children }: { on: boolean; onToggle: () => void; label: string; children: (color: string) => React.ReactNode }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onToggle}
      style={({ pressed }) => [s.symSwitch, on ? { backgroundColor: t.ink, borderColor: t.ink } : { borderColor: t.hairline }, { opacity: pressed ? 0.7 : 1 }]}>
      {children(on ? t.bg : t.ink)}
    </Pressable>
  );
}

/** iOS-Schalter (nur für „Auch allein tragbar“; Eigenschaften mit Kachel-Plakette nutzen SymbolSwitch) */
export function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onToggle}
      style={[s.toggle, { backgroundColor: on ? t.accent : t.hairline, justifyContent: on ? 'flex-end' : 'flex-start' }]}>
      <View style={s.knob} />
    </Pressable>
  );
}

/** Reiter (SegmentedControl) */
export function Segmented<K extends string>({ items, value, onChange }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  const t = useTheme();
  return (
    <View accessibilityRole="tablist" style={[s.seg, { backgroundColor: t.surfaceSunken }]}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(it.key)}
            style={[s.segItem, on && { backgroundColor: t.surface, boxShadow: '0 1px 4px rgba(42,26,29,0.16)' }]}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: on ? t.ink : t.inkMuted }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Anzahl − / + */
export function Stepper({ value, onChange, min = 1 }: { value: number; onChange: (n: number) => void; min?: number }) {
  const t = useTheme();
  return (
    <View style={[s.stepper, { backgroundColor: t.surfaceSunken, borderColor: t.hairline }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="eins weniger" disabled={value <= min} onPress={() => onChange(value - 1)} style={s.stepBtn}>
        <Text style={{ fontSize: 22, color: value <= min ? t.hairline : t.ink }}>−</Text>
      </Pressable>
      <Text aria-live="polite" style={{ minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '600', color: t.ink, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="eins mehr" onPress={() => onChange(value + 1)} style={s.stepBtn}>
        <Text style={{ fontSize: 22, color: t.ink }}>+</Text>
      </Pressable>
    </View>
  );
}

/** Zwei Felder nebeneinander */
export function Pair({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 10 }}>{children}</View>;
}

/** Mehrzeiliges Textfeld (Notizen) */
export function NotesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  return (
    <TextInput value={value} onChangeText={onChange} multiline placeholder="z. B. Fällt eher groß aus." placeholderTextColor={t.inkMuted}
      style={[s.notes, { backgroundColor: t.surfaceSunken, borderColor: t.hairline, color: t.ink }, web ? ({ outlineStyle: 'none' } as object) : null]} />
  );
}

/** Kleine Überschrift über einer Gruppe in einer aufgeklappten Zeile */
export const GroupLabel = FieldLabel;

const s = StyleSheet.create({
  ki: { height: 18, paddingHorizontal: 6, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  kiText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  card: { borderRadius: D.card.radius, borderWidth: 1 },
  cardRows: { paddingHorizontal: 14, paddingVertical: 4 },
  cardPlain: { padding: 14, gap: 16 },
  cardTitle: { fontFamily: DISPLAY, fontSize: D.font.cardTitle, lineHeight: 24 },
  row: { minHeight: 52, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: CHEVRON_GAP },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  rowLabelText: { fontSize: D.font.rowLabel },
  rowValues: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  plain: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vcap: { height: D.capsule.height, minWidth: D.capsule.minWidth, paddingHorizontal: D.capsule.padX, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: D.capsule.gap },
  vcapText: { fontSize: D.capsule.font, fontWeight: D.capsule.weight },
  vcircle: { width: D.circle, height: D.circle, borderRadius: D.circle / 2, alignItems: 'center', justifyContent: 'center' },
  star: { position: 'absolute', top: -3, right: -2, fontSize: 11, fontWeight: '700' },
  rank: { width: 22, height: 22, borderRadius: 11, marginLeft: -4, alignItems: 'center', justifyContent: 'center' },
  symSwitch: { width: D.circle, height: D.circle, borderRadius: D.circle / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  toggle: { width: 51, height: 31, borderRadius: 999, padding: 2, flexDirection: 'row' },
  knob: { width: 27, height: 27, borderRadius: 999, backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' },
  seg: { flexDirection: 'row', padding: 3, borderRadius: 999, gap: 2 },
  segItem: { flex: 1, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 999, borderWidth: 1, padding: 2 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  notes: { minHeight: 96, borderRadius: D.field.radius, borderWidth: 1, padding: 12, fontSize: 16, textAlignVertical: 'top' },
});

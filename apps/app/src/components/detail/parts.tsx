// Bausteine für Teil-Detail, Wunschteil und Bearbeiten (VALET_DETAILSEITE_SPEC.md, Abschnitt 1)
import { Children, createElement, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { detail, personText } from '@valet/ui';
import { balanceRows, splitRows } from '@valet/core';
import { useTheme, DISPLAY } from '@/lib/theme';
import { personTone, type Person } from '@/lib/wardrobe';
import { glass } from '@/components/ui';

const D = detail;
const web = Platform.OS === 'web';

/** Linien-Symbol im 24er-Raster (Pfade „d“ und Kreise „c:cx,cy,r“) */
export function Glyph({ d, size = D.headIcon, color, stroke = 2 }: { d: string[]; size?: number; color: string; stroke?: number }) {
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {d.map((x, i) => {
        if (x.startsWith('c:')) { const [cx, cy, r] = x.slice(2).split(',').map(Number); return <Circle key={i} cx={cx} cy={cy} r={r} {...p} />; }
        if (x.startsWith('f:')) { const [cx, cy, r] = x.slice(2).split(',').map(Number); return <Circle key={i} cx={cx} cy={cy} r={r} fill={color} />; }
        return <Path key={i} d={x} {...p} />;
      })}
    </Svg>
  );
}

/** Symbole der Bedien-Ebene (Kopf, Werkzeugleiste) – aus der Leinwand */
export const GLYPHS = {
  back: ['M15 5l-7 7 7 7'],
  share: ['M12 3v12', 'M7 8l5-5 5 5', 'M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6'],
  edit: ['M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z', 'M13.5 6.5l4 4'],
  close: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  reset: ['M4 12a8 8 0 1 0 2.4-5.7', 'M4 4v4.5h4.5'],
  calendar: ['M6.5 5h11a3 3 0 0 1 3 3v9.5a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z', 'M8 3v4', 'M16 3v4', 'M3.5 10h17', 'M9.5 15l2 2 3.5-3.5'],
  plus: ['M12 5v14', 'M5 12h14'],
  /** Werkzeugleiste (Leinwand „D · Übersicht“) */
  reserve: ['M6.5 5h11a3 3 0 0 1 3 3v9.5a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z', 'M8 3v4', 'M16 3v4', 'M3.5 10h17', 'M9.5 15l2 2 3.5-3.5'],
  dice: ['M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4z', 'f:8.5,8.5,1.1', 'f:15.5,15.5,1.1', 'f:12,12,1.1'],
  hanger: ['M10 6a2 2 0 1 1 2 2v1.6l-8.4 5.7A1.5 1.5 0 0 0 4.4 18h15.2a1.5 1.5 0 0 0 .8-2.7L12 9.6'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4'],
  chevron: ['M9 6l6 6-6 6'],
  more: ['f:5,12,1.7', 'f:12,12,1.7', 'f:19,12,1.7'],
  search: ['c:11,11,6.5', 'M16 16l4.5 4.5'],
  minus: ['M5 12h14'],
  /** Wunschteil: Gekauft (Einkaufstüte mit Haken, Leinwand „E · Übersicht“) */
  bagCheck: ['M5 8h14l-1 12H6z', 'M9 8V6.5a3 3 0 0 1 6 0V8', 'M9.2 14.2l2 2 3.6-3.6'],
  /** Wunschteil ohne Kategorie: leerer Kreis */
  tagNone: ['c:12,12,7.5'],
} satisfies Record<string, string[]>;

/** Runder 44-px-Kopfknopf: Glas (Zurück, Teilen, Bearbeiten, X, Zurücksetzen) oder accent (Haken = Fertig) */
export function HeadButton({ glyph, label, onPress, primary, disabled }: { glyph: keyof typeof GLYPHS; label: string; onPress?: () => void; primary?: boolean; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} hitSlop={4}
      style={({ pressed }) => [s.head, primary ? { backgroundColor: t.accent, borderWidth: 0 } : glass(t), { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>
      <Glyph d={GLYPHS[glyph]} color={primary ? t.onAccent : t.ink} stroke={glyph === 'close' || glyph === 'check' ? 2.2 : 2} />
    </Pressable>
  );
}

/** Kopfzeile eines Blatts: X · Titel (Gloock 20, exakt mittig) · Haken */
export function SheetHead({ title, onCancel, onDone, doneDisabled }: { title: string; onCancel: () => void; onDone?: () => void; doneDisabled?: boolean }) {
  const t = useTheme();
  return (
    <View style={s.sheetHead}>
      <View style={s.side}><HeadButton glyph="close" label="Abbrechen" onPress={onCancel} /></View>
      <Text style={[s.sheetTitle, { color: t.ink }]} accessibilityRole="header" numberOfLines={1}>{title}</Text>
      <View style={[s.side, { alignItems: 'flex-end' }]}>{onDone && <HeadButton glyph="check" label="Fertig" primary onPress={onDone} disabled={doneDisabled} />}</View>
    </View>
  );
}

/**
 * Kapsel (Spec 1): 38 hoch, mind. 52 breit, 13 seitlich, Schrift 16/600, Text mittig.
 * Gewählt = gefüllt (ink auf bg), sonst feiner Rand. Erneut tippen hebt die Wahl auf (macht der Aufrufer). Kein X.
 */
export function Capsule({ label, selected, onPress, icon, leading, a11y, dashed }: {
  label: string; selected?: boolean; onPress?: () => void; icon?: (color: string) => React.ReactNode; leading?: React.ReactNode; a11y?: string; dashed?: boolean;
}) {
  const t = useTheme();
  const fg = selected ? t.bg : t.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} accessibilityLabel={a11y ?? label} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [s.capsule, leading ? { paddingLeft: 6 } : null,
        selected ? { backgroundColor: t.ink, borderColor: t.ink } : { borderColor: t.hairline, backgroundColor: 'transparent' },
        dashed && { borderStyle: 'dashed', borderColor: t.inkMuted }, { opacity: pressed ? 0.7 : 1 }]}>
      {leading}
      {icon?.(fg)}
      <Text style={[s.capsuleText, { color: fg }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Wert nur als Symbol: runder 38-px-Kreis (Saison, Farben, Pflege, Status, Wunsch-Kategorie) */
export function IconCircle({ children, selected, onPress, a11y, muted }: { children: React.ReactNode; selected?: boolean; onPress?: () => void; a11y: string; muted?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole={onPress ? 'button' : 'image'} accessibilityLabel={a11y} accessibilityState={{ selected: !!selected }} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [s.circle, selected ? { backgroundColor: t.ink, borderColor: t.ink } : { borderColor: t.hairline }, muted && { borderStyle: 'dashed' }, { opacity: pressed ? 0.7 : 1 }]}>
      {children}
    </Pressable>
  );
}

export { Monogram } from '@/components/Monogram';

/**
 * Gleichmäßig umbrechen (Spec 1): Breiten messen, Zeilenzahl wie beim normalen Umbruch,
 * dann möglichst gleich verteilen (5 → 3 + 2). align 'end' für Werte rechts in Zeilen.
 */
export function Wrap({ children, gap = 8, align = 'start' }: { children: React.ReactNode; gap?: number; align?: 'start' | 'end' }) {
  const items = Children.toArray(children);
  const [box, setBox] = useState(0);
  const [widths, setWidths] = useState<Record<number, number>>({});
  const known = items.length > 0 && items.every((_, i) => widths[i] != null) && box > 0;
  const counts = known ? balanceRows(items.map((_, i) => widths[i]!), box, gap) : null;
  const justify = align === 'end' ? 'flex-end' : 'flex-start';
  const measure = (i: number) => (e: { nativeEvent: { layout: { width: number } } }) => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    setWidths((m) => (m[i] === w ? m : { ...m, [i]: w }));
  };
  return (
    <View onLayout={(e) => setBox(Math.floor(e.nativeEvent.layout.width))} style={{ gap, alignSelf: 'stretch' }}>
      {counts
        ? splitRows(items.map((c, i) => ({ c, i })), counts).map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', gap, justifyContent: justify }}>
            {row.map(({ c, i }) => <View key={i} onLayout={measure(i)}>{c}</View>)}
          </View>
        ))
        : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, justifyContent: justify }}>
          {items.map((c, i) => <View key={i} onLayout={measure(i)}>{c}</View>)}
        </View>}
    </View>
  );
}

/** Kleine Überschrift über einem Feld */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ fontSize: D.field.label, lineHeight: 18, color: t.inkMuted }}>{children}</Text>;
}

/** Hinweis in klein (muted oder accent) */
export function Hint({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  const t = useTheme();
  return <Text style={{ fontSize: 12, lineHeight: 16, color: accent ? t.accent : t.inkMuted }}>{children}</Text>;
}

/** Textfeld mit Beschriftung */
export function TextField({ label, value, onChange, placeholder, keyboardType, autoFocus, extra, inputMode }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboardType?: 'default' | 'decimal-pad' | 'url'; autoFocus?: boolean;
  /** neben der Beschriftung, z. B. KI-Markierung */
  extra?: React.ReactNode; inputMode?: 'text' | 'decimal' | 'url';
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 6, flex: 1, minWidth: 0 }}>
      {extra ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><FieldLabel>{label}</FieldLabel>{extra}</View> : label ? <FieldLabel>{label}</FieldLabel> : null}
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} accessibilityLabel={label || placeholder} placeholderTextColor={t.inkMuted} keyboardType={keyboardType} autoFocus={autoFocus} inputMode={inputMode}
        autoCapitalize={keyboardType === 'url' ? 'none' : undefined}
        style={[s.input, { backgroundColor: t.surfaceSunken, borderColor: t.hairline, color: t.ink }, web ? ({ outlineStyle: 'none' } as object) : null]} />
    </View>
  );
}

/**
 * Datumsfeld (ISO JJJJ-MM-TT). Web/iPhone: natives Datumsfeld (Safari zeigt das Rad), sonst Textfeld TT.MM.JJJJ.
 */
export function DateField({ label, value, onChange, optional }: { label: string; value: string | null; onChange: (iso: string | null) => void; optional?: boolean }) {
  const t = useTheme();
  if (web) {
    return (
      <View style={{ gap: 6, flex: 1, minWidth: 0 }}>
        <FieldLabel>{label}</FieldLabel>
        {createElement('input', {
          type: 'date', value: value ?? '', 'aria-label': label,
          onChange: (e: { target: { value: string } }) => onChange(e.target.value || (optional ? null : value)),
          style: {
            height: D.field.height, borderRadius: D.field.radius, border: `1px solid ${t.hairline}`, background: t.surfaceSunken, color: t.ink,
            fontSize: 16, padding: '0 12px', boxSizing: 'border-box', width: '100%', WebkitAppearance: 'none', minWidth: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif', colorScheme: t.dark ? 'dark' : 'light',
          },
        })}
      </View>
    );
  }
  const de = value ? value.split('-').reverse().join('.') : '';
  return (
    <TextField label={label} value={de} placeholder="TT.MM.JJJJ" onChange={(v) => {
      const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v.trim());
      if (m) onChange(`${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`);
      else if (!v.trim() && optional) onChange(null);
    }} />
  );
}

const s = StyleSheet.create({
  head: { width: D.headButton, height: D.headButton, borderRadius: D.headButton / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  side: { flex: 1, flexBasis: 0 },
  sheetTitle: { fontFamily: DISPLAY, fontSize: D.font.sheetTitle, lineHeight: 24, textAlign: 'center', flexShrink: 0, maxWidth: '60%' },
  capsule: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: D.capsule.gap, height: D.capsule.height, minWidth: D.capsule.minWidth,
    paddingHorizontal: D.capsule.padX, borderRadius: 999, borderWidth: 1,
  },
  capsuleText: { fontSize: D.capsule.font, fontWeight: D.capsule.weight, textAlign: 'center' },
  circle: { width: D.circle, height: D.circle, borderRadius: D.circle / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  input: { height: D.field.height, borderRadius: D.field.radius, borderWidth: 1, paddingHorizontal: 12, fontSize: 16 },
});

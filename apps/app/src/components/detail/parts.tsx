// Bausteine für Teil-Detail, Wunschteil und Bearbeiten (VALET_DETAILSEITE_SPEC.md, Abschnitt 1)
import { Children, createElement, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { detail, personText } from '@valet/ui';
import { balanceRows, splitRows } from '@valet/core';
import { useTheme, DISPLAY } from '@/lib/theme';
import { personTone, type Person } from '@/lib/wardrobe';
import { glass } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { SymbolName } from '@valet/ui';

const D = detail;
const web = Platform.OS === 'web';

/** Runder 44-px-Kopfknopf: Glas (Zurück, Teilen, Bearbeiten, X, Zurücksetzen) oder accent (Haken = Fertig) */
export function HeadButton({ glyph, label, onPress, primary, disabled }: { glyph: SymbolName; label: string; onPress?: () => void; primary?: boolean; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} hitSlop={4}
      style={({ pressed }) => [s.head, primary ? { backgroundColor: t.accent, borderWidth: 0 } : glass(t), { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>
      <Icon name={glyph} size="button" color={primary ? t.onAccent : t.ink} />
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

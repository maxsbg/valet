import { useBottomInset } from '@/lib/bottomInset';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTheme, DISPLAY, space } from '@/lib/theme';

type Props = { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode;
  /** eigene Kopfzeile (z. B. SheetHead: X · Titel · Haken) statt des großen Titels */
  head?: React.ReactNode };

/** Sheet von unten mit Griff, Titel in Gloock und optionaler fester Fußzeile */
export function Sheet({ open, onClose, title, children, footer, head }: Props) {
  const t = useTheme();
  const bottom = useBottomInset();
  const { height, width } = useWindowDimensions();
  const [shown, setShown] = useState(open);
  const y = useRef(new Animated.Value(height)).current;
  useEffect(() => {
    if (open) {
      setShown(true);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 2, speed: 16 }).start();
    } else if (shown) {
      Animated.timing(y, { toValue: height, duration: 220, useNativeDriver: true }).start(() => setShown(false));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null;
  const op = y.interpolate({ inputRange: [0, height], outputRange: [1, 0] });
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(42,26,29,0.4)', opacity: op }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Schließen" />
      </Animated.View>
      <Animated.View style={[s.sheet, { backgroundColor: t.bg, maxHeight: height * 0.88, width: Math.min(width, 560), paddingBottom: Math.max(bottom, space.md), transform: [{ translateY: y }] }]}>
        <View style={[s.grab, { backgroundColor: t.hairline }]} />
        {head ?? <Text style={[s.title, { color: t.ink }]} accessibilityRole="header">{title}</Text>}
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.md }}>{children}</ScrollView>
        {footer && <View style={s.footer}>{footer}</View>}
      </Animated.View>
    </Modal>
  );
}

/** Zeile mit Häkchen für Einfachauswahl (Sortieren) */
export function OptionRow({ label, selected, onPress, last }: { label: string; selected: boolean; onPress: () => void; last?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}
      style={({ pressed }) => [s.row, { borderBottomColor: t.hairline, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth * 2, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={{ fontSize: 17, color: t.ink, fontWeight: selected ? '700' : '400' }}>{label}</Text>
      {selected && <Text style={{ fontSize: 20, color: t.ink }}>✓</Text>}
    </Pressable>
  );
}

export function SheetButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [s.btn, primary ? { backgroundColor: '#722638', borderColor: '#722638' } : { backgroundColor: t.surface, borderColor: t.hairline }, { opacity: pressed ? 0.8 : 1 }]}>
      <Text style={{ fontSize: 17, fontWeight: '600', color: primary ? '#fff' : t.ink }}>{label}</Text>
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={{ fontSize: 15, fontWeight: '700', color: t.ink, marginTop: space.md, marginBottom: space.xs }}>{children}</Text>;
}

const s = StyleSheet.create({
  sheet: { position: 'absolute', bottom: 0, alignSelf: 'center', borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: '0 -8px 32px rgba(42,26,29,0.14)' },
  grab: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 8 },
  title: { fontFamily: DISPLAY, fontSize: 28, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56, paddingHorizontal: space.xs },
  footer: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.xs },
  btn: { flex: 1, height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

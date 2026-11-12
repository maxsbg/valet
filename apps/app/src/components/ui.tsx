import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { ScrollView } from 'react-native';
import { Icons, Silhouette } from './Icon';
import { FIXED } from './Page';
import { useTheme, DISPLAY, space, radius } from '@/lib/theme';

/** Kopfzeile: Hilfe links, Schriftzug „valet“ mittig, Ansicht-Einstellungen rechts */
export function Header({ onHelp, onSettings }: { onHelp?: () => void; onSettings?: () => void }) {
  const t = useTheme();
  return (
    <View style={s.header}>
      <RoundButton label="Hilfe" onPress={onHelp}><Icons.help color={t.ink} /></RoundButton>
      <Text style={[s.wordmark, { color: t.dark ? t.accent : '#722638' }]} accessibilityRole="header">valet</Text>
      <RoundButton label="Ansicht" onPress={onSettings}><Icons.sliders color={t.ink} /></RoundButton>
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
export function Chip({ label, count, selected, onPress, dot, icon }: { label: string; count?: number; selected?: boolean; onPress?: () => void; dot?: string; icon?: React.ReactNode }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
      style={[s.chip, { backgroundColor: selected ? t.ink : t.surface, borderColor: selected ? t.ink : t.hairline }]}>
      {icon}
      {dot && <View style={[s.dot, { backgroundColor: dot }]} />}
      <Text style={[s.chipText, { color: selected ? t.bg : t.ink }]}>{label}</Text>
      {count != null && <Text style={[s.chipCount, { color: selected ? t.bg : t.inkMuted }]}>{count}</Text>}
    </Pressable>
  );
}

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

/** Gelbe Leiste „Heute“ über dem Schrank: leer mit „Outfit planen“, sonst die Teile von heute */
export function TodayBar({ items, onPress }: { items: { id: string; category: string; hex: string | null }[]; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.today} accessibilityRole="button">
      <View>
        <Text style={s.todayTitle}>Heute</Text>
        <Text style={s.todaySub}>{items.length ? `${items.length} ${items.length === 1 ? 'Teil' : 'Teile'}` : 'noch nichts geplant'}</Text>
      </View>
      {items.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginLeft: space.sm }} contentContainerStyle={{ gap: 6 }}>
          {items.map((i) => (
            <View key={i.id} style={s.todayThumb}><Silhouette category={i.category} color={i.hex ?? '#8e8e93'} /></View>
          ))}
        </ScrollView>
      ) : (
        <Text style={s.todayAction}>Outfit planen ›</Text>
      )}
    </Pressable>
  );
}

/** Orangefarbener Plus-Knopf unten rechts */
export function Fab({ onPress, bottom }: { onPress?: () => void; bottom: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Teil hinzufügen" onPress={onPress}
      style={({ pressed }) => [s.fab, FIXED, { bottom, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
      <Icons.plus color="#2a1a1d" size={26} />
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
    <Animated.View pointerEvents="none" style={[FIXED, { left: 0, right: 0, bottom, alignItems: 'center', zIndex: 20, opacity: op }]}>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingVertical: space.xs },
  wordmark: { fontFamily: DISPLAY, fontSize: 32, lineHeight: 38 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontSize: 15, fontWeight: '500' },
  chipCount: { fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 14, flex: 1 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  today: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 64, backgroundColor: '#FBF1C2', borderColor: '#F9E58A', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  todayTitle: { fontFamily: DISPLAY, fontSize: 18, color: '#2a1a1d' },
  todaySub: { fontSize: 13, color: '#6e5e60' },
  todayThumb: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(42,26,29,0.08)' },
  todayAction: { fontSize: 15, fontWeight: '600', color: '#B8430F' },
  fab: { position: 'absolute', zIndex: 10, right: space.md, width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF641F', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(42,26,29,0.22)' },
  toast: { backgroundColor: '#2a1a1d', borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10, boxShadow: '0 6px 20px rgba(42,26,29,0.2)' },
  toastText: { color: '#F5F0E8', fontSize: 15, fontWeight: '500' },
});

import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
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

/** Kopfzeile: Profil (Monogramm) links, Schriftzug „valet“ mittig, Einstellungen rechts */
export function Header() {
  const t = useTheme();
  const { wardrobe, session } = useSession();
  const [sheet, setSheet] = useState<'profile' | 'settings' | null>(null);
  const me = wardrobe?.persons.find((p) => p.user_id === session?.user.id);
  const tone = t.person[personKey(me?.color ?? null)];
  const letter = (me?.name ?? session?.user.email ?? '?').trim().slice(0, 1).toUpperCase();
  return (
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Profil" onPress={() => setSheet('profile')} hitSlop={4}
        style={({ pressed }) => [s.mono, { borderColor: tone + '73', backgroundColor: tone + '1F', opacity: pressed ? 0.7 : 1 }]}>
        <Text style={[s.monoText, { color: tone }]}>{letter}</Text>
      </Pressable>
      <Text style={[s.wordmark, { color: t.dark ? t.accent : '#722638' }]} accessibilityRole="header">valet</Text>
      <RoundButton label="Einstellungen" size={44} onPress={() => setSheet('settings')}><Icons.gear color={t.ink} size={21} /></RoundButton>
      <Sheet open={sheet === 'profile'} onClose={() => setSheet(null)} title={me?.name ?? 'Profil'}
        footer={<SheetButton label="Abmelden" onPress={() => { setSheet(null); supabase.auth.signOut(); }} />}>
        <Text style={{ fontSize: 15, color: t.inkMuted }}>{session?.user.email}</Text>
        {wardrobe && <Text style={{ fontSize: 15, color: t.inkMuted, marginTop: 4 }}>Schrank „{wardrobe.name}“</Text>}
      </Sheet>
      <Sheet open={sheet === 'settings'} onClose={() => setSheet(null)} title="Einstellungen">
        <OptionRow label="Alte Bilder zuordnen" selected={false} last onPress={() => { setSheet(null); router.push('/bilder-zuordnen'); }} />
      </Sheet>
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
export function Chip({ label, count, selected, onPress, onLongPress, dot, icon, tall, dashed }: { label: string; count?: number; selected?: boolean; onPress?: () => void; onLongPress?: () => void; dot?: string; icon?: React.ReactNode; tall?: boolean; dashed?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} onLongPress={onLongPress} delayLongPress={400}
      style={[s.chip, tall && s.chipTall, { backgroundColor: selected ? t.ink : t.surface, borderColor: selected ? t.ink : t.hairline }, dashed && { borderStyle: 'dashed', backgroundColor: 'transparent', borderColor: t.inkMuted }]}>
      {icon}
      {dot && <View style={[s.dot, { backgroundColor: dot }]} />}
      <Text style={[s.chipText, { color: selected ? t.bg : dashed ? t.inkMuted : t.ink }]}>{label}</Text>
      {count != null && <Text style={[s.chipCount, { color: selected ? t.bg : t.inkMuted }]}>{count}</Text>}
    </Pressable>
  );
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingVertical: space.xs },
  mono: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  monoText: { fontFamily: DISPLAY, fontSize: 20, lineHeight: 24 },
  wordmark: { fontFamily: DISPLAY, fontSize: 32, lineHeight: 38 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 14, flex: 1 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  chipTall: { height: 44, paddingHorizontal: 16 },
  chipText: { fontSize: 15, fontWeight: '500' },
  chipCount: { fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  fab: { position: 'absolute', zIndex: 10, right: space.md + 4, width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.28)' },
  toastWrap: { position: 'absolute', zIndex: 40, left: 0, right: 0, alignItems: 'center' },
  toast: { backgroundColor: '#2a1a1d', borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10, boxShadow: '0 6px 20px rgba(42,26,29,0.2)' },
  toastText: { color: '#F5F0E8', fontSize: 15, fontWeight: '500' },
});

import { useBottomInset } from '@/lib/bottomInset';
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icons } from '@/components/Icon';
import { useTheme, TAB_BAR } from '@/lib/theme';
import { FIXED } from '@/components/Page';

type Btn = TabTriggerSlotProps & { label: string; icon: keyof typeof Icons };

function TabButton({ label, icon, isFocused, ref, ...props }: Btn) {
  const t = useTheme();
  const I = Icons[icon];
  const c = isFocused ? (t.dark ? t.accent : '#722638') : t.inkMuted;
  return (
    <Pressable ref={ref as never} {...props} accessibilityRole="tab" accessibilityState={{ selected: isFocused }} style={s.btn}>
      <I color={c} size={24} />
      <Text style={[s.label, { color: c, fontWeight: isFocused ? '600' : '500' }]}>{label}</Text>
    </Pressable>
  );
}

export default function TabLayout() {
  const t = useTheme();
  const bottom = useBottomInset();
  return (
    <Tabs style={{ flex: 1, backgroundColor: t.bg }}>
      <TabSlot
        style={{ flex: 1 }}
        renderFn={Platform.OS === 'web'
          // Web: Seiten normal im Dokumentfluss (nicht übereinander gestapelt), damit das Dokument scrollt
          ? (d, { isFocused, loaded }) => (isFocused || loaded ? <View key={d.route.key} style={{ display: isFocused ? 'flex' : 'none', flexGrow: 1 }}>{d.render()}</View> : null)
          : undefined}
      />
      <TabList asChild>
        <View style={StyleSheet.flatten([s.bar, FIXED, { bottom: Math.max(bottom, 10), backgroundColor: t.glass, borderColor: t.glassBorder },
          Platform.OS === 'web' ? ({ backdropFilter: 'blur(24px) saturate(1.6)', WebkitBackdropFilter: 'blur(24px) saturate(1.6)' } as object) : null])}>
          <TabTrigger name="schrank" href="/" asChild><TabButton label="Schrank" icon="hanger" /></TabTrigger>
          <TabTrigger name="outfits" href="/outfits" asChild><TabButton label="Outfits" icon="layers" /></TabTrigger>
          <TabTrigger name="wunschliste" href="/wunschliste" asChild><TabButton label="Wunschliste" icon="heart" /></TabTrigger>
          <TabTrigger name="statistik" href="/statistik" asChild><TabButton label="Statistik" icon="chart" /></TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: { position: 'absolute', zIndex: 10, left: 12, right: 12, height: TAB_BAR, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, boxShadow: '0 6px 20px rgba(42,26,29,0.16)' },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, height: '100%' },
  label: { fontSize: 11 },
});

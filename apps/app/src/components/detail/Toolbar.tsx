// Werkzeugleiste unten (Spec 2): ersetzt auf der Detailseite die Tab-Leiste – Apple: Tab-Leiste = Navigation, Werkzeugleiste = Aktionen.
// Links eine Glas-Gruppe (Status bzw. Kategorie, Kalender), rechts Würfel in Glas + runde Hauptaktion (52, accent).
import { Platform, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { detail } from '@valet/ui';
import { useTheme } from '@/lib/theme';
import { useTabBarBottom } from '@/lib/bottomInset';
import { FIXED, glass } from '@/components/ui';

const T = detail.toolbar;

export type ToolButton = { label: string; icon: (color: string) => React.ReactNode; onPress: (e: GestureResponderEvent) => void; active?: boolean; disabled?: boolean };

export function Toolbar({ left, right, main }: { left: ToolButton[]; right: ToolButton[]; main: ToolButton }) {
  const t = useTheme();
  const bottom = useTabBarBottom();
  const group = (list: ToolButton[]) => (
    <View style={[s.group, glass(t), s.shadow]}>
      {list.map((b) => (
        <Pressable key={b.label} accessibilityRole="button" accessibilityLabel={b.label} accessibilityState={{ selected: !!b.active, disabled: !!b.disabled }}
          onPress={b.onPress} disabled={b.disabled} hitSlop={2}
          style={({ pressed }) => [s.btn, b.active && { backgroundColor: t.hairline }, { opacity: b.disabled ? 0.4 : pressed ? 0.6 : 1 }]}>
          {b.icon(t.ink)}
        </Pressable>
      ))}
    </View>
  );
  return (
    <View pointerEvents="box-none" style={[s.bar, FIXED, { bottom }]}>
      {group(left)}
      <View style={s.right}>
        {group(right)}
        <Pressable accessibilityRole="button" accessibilityLabel={main.label} accessibilityState={{ selected: !!main.active, disabled: !!main.disabled }}
          onPress={main.onPress} disabled={main.disabled}
          style={({ pressed }) => [s.main, { backgroundColor: t.accent, opacity: main.disabled ? 0.5 : pressed ? 0.85 : 1 }]}>
          {main.icon(t.onAccent)}
        </Pressable>
      </View>
    </View>
  );
}

/** Platz unter dem Inhalt, damit die Leiste nichts verdeckt */
export const TOOLBAR_SPACE = T.height + 40;

const s = StyleSheet.create({
  bar: { position: Platform.OS === 'web' ? undefined : 'absolute', left: T.side, right: T.side, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: T.gap, zIndex: 30 },
  group: { height: T.height, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  shadow: { boxShadow: '0 6px 20px rgba(42,26,29,0.16)' },
  btn: { width: T.button, height: T.button, borderRadius: T.button / 2, alignItems: 'center', justifyContent: 'center' },
  right: { flexDirection: 'row', alignItems: 'center', gap: T.gap },
  main: { width: T.main, height: T.main, borderRadius: T.main / 2, alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(42,26,29,0.22)' },
});

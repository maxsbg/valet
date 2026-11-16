// Pull-down-Menü wie bei Apple (Spec 6, Leinwand „D · Status-Menü“; Vorbild „Wo ist?“, Max 15.11.2026):
// Symbol links, Name rechts daneben, keine Punkte, keine Trennlinien zwischen den Zeilen (nur zwischen Abschnitten,
// eingerückt). Der aktuelle Eintrag ist etwas kräftiger gesetzt. Linksbündig mit der Glas-Gruppe darunter.
// Genutzt für den Status (Schrank-Teil) und die Kategorie (Wunschteil).
import { Fragment, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, AccessibilityInfo } from 'react-native';
import { STATUS_LIST, type StatusKey } from '@valet/core';
import { detail } from '@valet/ui';
import { useTheme } from '@/lib/theme';
import { Icon } from '@/components/Icon';
import type { SymbolName } from '@valet/ui';

const M = detail.menu;

/** Rechteck des auslösenden Knopfs bzw. der Glas-Gruppe im Fenster */
export type Anchor = { x: number; y: number; width: number; height: number };

export type MenuEntry = { key: string; label: string; icon?: SymbolName; current?: boolean; a11y?: string };

type MenuProps = {
  open: boolean;
  anchor: Anchor | null;
  label: string;
  /** Abschnitte; zwischen ihnen eine eingerückte Trennlinie */
  sections: MenuEntry[][];
  onPick: (key: string) => void;
  onClose: () => void;
};

export function PullMenu({ open, anchor, label, sections, onPick, onClose }: MenuProps) {
  const t = useTheme();
  const { width: W, height: H } = useWindowDimensions();
  const [shown, setShown] = useState(open);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let reduce = false;
    AccessibilityInfo.isReduceMotionEnabled?.().then((r) => { reduce = r; }).catch(() => {});
    if (open) {
      setShown(true);
      a.setValue(0);
      Animated.timing(a, { toValue: 1, duration: reduce ? 0 : 180, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
    } else if (shown) {
      Animated.timing(a, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => setShown(false));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null;

  // Über der Gruppe, linke Kante bündig mit ihr (bleibt im Bildschirm)
  const left = Math.max(8, Math.min(anchor?.x ?? 16, W - M.width - 8));
  const bottom = anchor ? Math.max(16, H - anchor.y + M.gap) : 92;
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const blur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(30px) saturate(1.6)', WebkitBackdropFilter: 'blur(30px) saturate(1.6)' } as object) : {};

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.18)', opacity: a }]}>
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Menü schließen" />
      </Animated.View>
      <Animated.View accessibilityRole="menu" aria-label={label}
        style={[s.menu, blur, { left, bottom, backgroundColor: t.glass, borderColor: t.glassBorder, opacity: a,
          transformOrigin: 'bottom left', transform: [{ scale }] } as object]}>
        {sections.filter((x) => x.length).map((sec, si) => (
          <Fragment key={si}>
            {si > 0 && <View style={[s.divider, { backgroundColor: t.hairline }]} />}
            {sec.map((d) => (
              <Pressable key={d.key} accessibilityRole="menuitem" accessibilityState={{ checked: !!d.current }} accessibilityLabel={d.a11y ?? d.label}
                onPress={() => onPick(d.key)}
                style={({ pressed }) => [s.row, pressed && { backgroundColor: t.hairline }]}>
                <View style={s.icon}>{d.icon && <Icon name={d.icon} size="row" color={t.ink} />}</View>
                <Text numberOfLines={1} style={[s.label, { color: t.ink }, d.current && { fontWeight: '600' }]}>{d.label}</Text>
              </Pressable>
            ))}
          </Fragment>
        ))}
      </Animated.View>
    </Modal>
  );
}

type StatusProps = { open: boolean; anchor: Anchor | null; current: StatusKey; onPick: (k: StatusKey) => void; onClose: () => void };

/** Status-Menü (Schrank-Teil) */
export function StatusMenu({ open, anchor, current, onPick, onClose }: StatusProps) {
  const entries: MenuEntry[] = STATUS_LIST.map((d) => ({
    key: d.key, label: d.label, icon: d.icon, current: d.key === current, a11y: `${d.label}${d.details ? ', mit Angaben' : ''}`,
  }));
  return <PullMenu open={open} anchor={anchor} label="Status" sections={[entries]} onPick={(k) => onPick(k as StatusKey)} onClose={onClose} />;
}

const s = StyleSheet.create({
  menu: { position: 'absolute', width: M.width, borderRadius: M.radius, borderWidth: 1, overflow: 'hidden', paddingVertical: 6, boxShadow: '0 12px 40px rgba(0,0,0,0.35)' },
  row: { height: M.row, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18 },
  icon: { width: M.icon + 4, alignItems: 'center' },
  label: { flex: 1, fontSize: M.font },
  divider: { height: StyleSheet.hairlineWidth * 2, marginHorizontal: 18, marginVertical: 6 },
});

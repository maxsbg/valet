// Status-Menü wie bei Apple (Pull-down) – Spec 6, Leinwand „D · Status-Menü“
// Symbol links, Name rechts daneben, ohne Haken; der aktuelle Status ist nur etwas kräftiger gesetzt (Max, 15.11.2026).
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, AccessibilityInfo } from 'react-native';
import { STATUS_LIST, type StatusKey } from '@valet/core';
import { detail } from '@valet/ui';
import { useTheme } from '@/lib/theme';
import { TileIcon } from './tile/TileIcons';

const M = detail.menu;

/** Rechteck des auslösenden Knopfs im Fenster (measureInWindow) */
export type Anchor = { x: number; y: number; width: number; height: number };

type Props = {
  open: boolean;
  anchor: Anchor | null;
  current: StatusKey;
  onPick: (k: StatusKey) => void;
  onClose: () => void;
};

export function StatusMenu({ open, anchor, current, onPick, onClose }: Props) {
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

  // Über dem Knopf, linksbündig mit ihm (bleibt im Bildschirm)
  const left = Math.max(16, Math.min((anchor?.x ?? 16), W - M.width - 16));
  const bottom = anchor ? Math.max(16, H - anchor.y + 12) : 92;
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const blur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(30px) saturate(1.6)', WebkitBackdropFilter: 'blur(30px) saturate(1.6)' } as object) : {};

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.18)', opacity: a }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Menü schließen" />
      </Animated.View>
      <Animated.View accessibilityRole="menu" aria-label="Status"
        style={[s.menu, blur, { left, bottom, backgroundColor: t.glass, borderColor: t.glassBorder, opacity: a,
          transformOrigin: 'bottom left', transform: [{ scale }] } as object]}>
        {STATUS_LIST.map((d, i) => {
          const on = d.key === current;
          return (
            <Pressable key={d.key} accessibilityRole="menuitem" accessibilityState={{ checked: on }} accessibilityLabel={`${d.label}${d.details ? ', mit Angaben' : ''}`}
              onPress={() => onPick(d.key)}
              style={({ pressed }) => [s.row, i < STATUS_LIST.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.hairline }, pressed && { backgroundColor: t.hairline }]}>
              <View style={s.icon}><TileIcon name={d.icon} color={t.ink} size={M.icon} /></View>
              <Text style={[s.label, { color: t.ink }, on && { fontWeight: '600' }]}>{d.label}{d.details ? ' …' : ''}</Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  menu: { position: 'absolute', width: M.width, borderRadius: M.radius, borderWidth: 1, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' },
  row: { height: M.row, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  icon: { width: M.icon + 4, alignItems: 'center' },
  label: { flex: 1, fontSize: M.font },
});

/** Anker aus dem Tipp-Ereignis (Fensterkoordinaten; im Web scrollt das Dokument → Scrollstand abziehen) */
export function anchorFromPress(e: { nativeEvent: { pageX?: number; pageY?: number } }): Anchor {
  const sx = Platform.OS === 'web' && typeof window !== 'undefined' ? window.scrollX : 0;
  const sy = Platform.OS === 'web' && typeof window !== 'undefined' ? window.scrollY : 0;
  const x = (e.nativeEvent.pageX ?? 0) - sx, y = (e.nativeEvent.pageY ?? 0) - sy;
  return { x: x - 22, y: y - 22, width: 44, height: 44 };
}

// Runder Knopf „Spiegeln“ auf jeder Bild-Vorschau (Neues Teil, Bilder zuordnen, Foto ändern, Bearbeiten).
// Spiegelt links/rechts über mirrorPicture (lib/cutout.ts) – das gespeicherte Bild ist wirklich gespiegelt.
// Erneut tippen hebt es auf (holt das ursprüngliche Bild unverändert zurück).
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { detail, itemTile } from '@valet/ui';
import { mirrorPicture, type Picture } from '@/lib/cutout';
import { TileIcon } from '@/components/tile/TileIcons';

const I = detail.image;

/** Milchglas der runden Knöpfe auf der Bild-Kachel (wie die Wende-Plakette in Bearbeiten) */
export const badgeGlass = [
  { backgroundColor: 'rgba(255,255,255,0.62)', boxShadow: 'inset 0 0.5px 0 #fff, inset 0 0 0 0.5px rgba(255,255,255,0.7), 0 0 0 0.5px rgba(42,26,29,0.10), 0 2px 6px rgba(42,26,29,0.12)' },
  Platform.OS === 'web' ? ({ backdropFilter: 'blur(10px) saturate(1.8)', WebkitBackdropFilter: 'blur(10px) saturate(1.8)' } as object) : {},
];

export function MirrorButton({ picture, onChange, load, onError, style }: {
  /** Bild in der Vorschau (null = noch nicht geladen → `load`) */
  picture: Picture | null;
  onChange: (p: Picture) => void;
  /** Vorhandenes Bild erst laden (Bearbeiten ohne neues Foto) */
  load?: () => Promise<Picture | null>;
  onError?: (message: string) => void;
  style?: ViewStyle;
}) {
  const [busy, setBusy] = useState(false);
  const on = !!picture?.mirrorOf;
  async function press() {
    if (busy) return;
    setBusy(true);
    try {
      const src = picture ?? (load ? await load() : null);
      if (src) onChange(await mirrorPicture(src));
    } catch (e) { onError?.((e as Error).message || 'Spiegeln hat nicht geklappt'); }
    finally { setBusy(false); }
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Spiegeln" accessibilityState={{ selected: on, busy }} onPress={press} hitSlop={4}
      style={({ pressed }) => [s.badge, badgeGlass, { opacity: pressed ? 0.8 : 1 }, style]}>
      {busy ? <ActivityIndicator size="small" color="#2a1a1d" />
        : <TileIcon name="mirror" color="#2a1a1d" scale={I.badgeIcon / itemTile.badge.icon.size} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  badge: { position: 'absolute', top: I.inset, left: I.inset, width: I.badge, height: I.badge, borderRadius: I.badge / 2, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
});

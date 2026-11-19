import { useState } from 'react';
import { Image, View, type ImageStyle, type ViewStyle } from 'react-native';
import { layoutKind } from '@valet/core';
import { Silhouette } from './Icon';

/** Seitenverhältnis (Höhe ÷ Breite) der Schrank-Kachel je Form (`Tile.size`) */
export const RATIO: Record<string, number> = { coat: 1.6, dress: 1.55, pants: 1.45, jacket: 1.2, sweater: 1.1, top: 1.1, sport: 1.1, skirt: 1.05, shorts: 0.95, bag: 0.95, shoe: 0.72, headwear: 0.72, accessory: 0.72 };
/** Kachelhöhe; nimmt die Form (kind) oder notfalls die Kategorie */
export const tileHeight = (kindOrCategory: string, width: number) =>
  Math.round(width * (RATIO[kindOrCategory] ?? RATIO[layoutKind(kindOrCategory)] ?? 0.9));

/**
 * Fotofläche in festen Rahmen (Detailbild, Wunschlisten-Karte, Bearbeiten; 17.11.2026, Max):
 * so hoch wie die Schrank-Kachel des Teils bei dieser Breite, mittig, höchstens der Rahmen.
 * Flache Teile (Kappen, Schuhe) bleiben so klein wie im Schrank; breite (Sonnenhut) stoßen an die Seiten wie dort.
 * Gibt den zusätzlichen Abstand oben/unten zurück.
 */
export function shapePad(kind: string, width: number, height: number): number {
  return Math.max(0, (height - Math.min(height, tileHeight(kind, width))) / 2);
}

/** Bild eines Teils; ohne Bild (oder wenn es nicht lädt) die Silhouette in der Hauptfarbe. */
export function ItemPicture({ uri, category, color, inset = '8%', style, imageStyle, label, shape }: {
  uri: string | null | undefined; category: string; color: string; label?: string; inset?: `${number}%` | number; style?: ViewStyle; imageStyle?: ImageStyle;
  /** fester Rahmen: Foto in der Form der Schrank-Kachel (`shapePad`); inset dann als Zahl */
  shape?: { kind: string; width: number; height: number };
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const ok = !!uri && failed !== uri;
  const pad = shape && typeof inset === 'number' ? shapePad(shape.kind, shape.width, shape.height) : 0;
  return (
    <View style={[{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }, style]}>
      {ok ? (
        <Image source={{ uri }} onError={() => setFailed(uri)} resizeMode="contain"
          style={[{ position: 'absolute', top: pad ? (inset as number) + pad : inset, bottom: pad ? (inset as number) + pad : inset, left: inset, right: inset }, imageStyle]} accessibilityIgnoresInvertColors accessibilityLabel={label ?? 'Bild des Teils'} />
      ) : (
        <Silhouette category={category} color={color} />
      )}
    </View>
  );
}

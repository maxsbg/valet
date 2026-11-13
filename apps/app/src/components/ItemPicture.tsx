import { useState } from 'react';
import { Image, View, type ImageStyle, type ViewStyle } from 'react-native';
import { Silhouette } from './Icon';

/** Bild eines Teils; ohne Bild (oder wenn es nicht lädt) die Silhouette in der Hauptfarbe. */
export function ItemPicture({ uri, category, color, inset = '8%', style, imageStyle }: { uri: string | null | undefined; category: string; color: string; inset?: `${number}%` | number; style?: ViewStyle; imageStyle?: ImageStyle }) {
  const [failed, setFailed] = useState<string | null>(null);
  const ok = !!uri && failed !== uri;
  return (
    <View style={[{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }, style]}>
      {ok ? (
        <Image source={{ uri }} onError={() => setFailed(uri)} resizeMode="contain"
          style={[{ position: 'absolute', top: inset, bottom: inset, left: inset, right: inset }, imageStyle]} accessibilityIgnoresInvertColors />
      ) : (
        <Silhouette category={category} color={color} />
      )}
    </View>
  );
}

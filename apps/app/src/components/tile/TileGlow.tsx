// Innenschein der Kacheln: einfarbig per box-shadow, „Bunt“ als Farbkreis nur am Rand (eigene Ebene unter dem Foto).
// Regeln: packages/core/src/glow.ts, docs/design/kachel/VALET_SCHEIN_REGELN.md
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { glowShadow, type Glow } from '@valet/core';

const web = Platform.OS === 'web';

/**
 * box-shadow für die Kachel. Bunt zeichnet im Web die Ebene (`TileGlow`), daher kein Schatten;
 * auf iOS gibt es den Farbkreis noch nicht → heller Ersatzton (glow.css).
 */
export function glowBoxShadow(glow: Glow, blur: number, spread: number): string {
  if (glow.kind === 'multicolor' && !web) return `inset 0 0 ${blur}px ${spread}px ${glow.css}`;
  return glowShadow(glow, blur, spread);
}

/**
 * Ebene für „Bunt“: Farbkreis (conic-gradient) mit weißer, weichgezeichneter Mitte darüber –
 * ergibt dieselbe Randform wie der einfarbige Schein (Rand `spread`, weich `blur`).
 * Als erstes Kind der Kachel einsetzen (unter dem Foto). Für alle anderen Farben: nichts.
 */
export function TileGlow({ glow, radius, blur, spread }: { glow: Glow; radius: number; blur: number; spread: number }) {
  if (glow.kind !== 'multicolor' || !web) return null;
  const ring = `conic-gradient(${[...glow.stops, glow.stops[0]].join(',')})`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { opacity: glow.alpha, backgroundImage: ring } as ViewStyle]} />
      <View style={{ position: 'absolute', top: spread, left: spread, right: spread, bottom: spread, backgroundColor: '#fff',
        borderRadius: Math.max(0, radius - spread), filter: `blur(${blur / 2}px)` } as ViewStyle} />
    </View>
  );
}

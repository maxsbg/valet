import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { fonts, itemTile } from '@valet/ui';
import { DISPLAY } from '@/lib/theme';

// Plaketten der Kachel: Milchglas, rund (20 px) oder als Kapsel (20 × 14 px).
// Optische Zentrierung (Spec 5.5, Pflicht):
//  - Web: text-box trim-both cap alphabetic schneidet die Textbox aus den Metriken der jeweiligen Schrift
//    auf Versalhöhe…Grundlinie zu → Flexbox zentriert die sichtbaren Zeichen (SF Pro/Systemschrift und Gloock).
//  - Native (kein text-box): lineHeight = Schriftgröße + fester Versatz je Schrift aus den Tokens
//    (numOffsetY / monoOffsetY) – auf dem iPhone nachmessen.

const b = itemTile.badge;
const web = Platform.OS === 'web';

/** Web-only CSS, das React Native nicht kennt (react-native-web reicht es als Inline-Stil durch) */
const css = (style: Record<string, string | number>) => (web ? (style as object) : null);

const glassWeb = css({
  backdropFilter: `blur(${b.blur}px) saturate(${b.saturate})`,
  WebkitBackdropFilter: `blur(${b.blur}px) saturate(${b.saturate})`,
});
// TODO iOS: Unschärfe über expo-blur (BlurView, intensity ≈ 10–15, tint light) bzw. unter iOS 26 expo-glass-effect.
// Spec 4: auf Weiß ändert sich das Aussehen ohne Unschärfe kaum. Bei 100+ Kacheln auf dem iPhone ruckelt es evtl. → dann weglassen.

// overflow: visible – numberOfLines={1} setzt im Browser overflow: hidden; die auf Versalhöhe zugeschnittene Box
// würde sonst die Rundungen oben (z. B. die „2“ in „+2“) und das hochgestellte Zeichen abschneiden
const trim = css({ display: 'block', textBox: 'trim-both cap alphabetic', overflow: 'visible' });
const raise = css({ verticalAlign: `${b.sym.raiseEm}em` });

/** circle 20 × 20 · capsule 20 × 14 (Anzahl unter Wendbar) · pill 20 hoch, wächst mit dem Inhalt (Preis) */
type Shape = 'circle' | 'capsule' | 'pill';

export function Glass({ shape = 'circle', label, style, scale = 1, children }: { shape?: Shape; label?: string; style?: ViewStyle; scale?: number; children: React.ReactNode }) {
  // scale: Outfit-Karte (× 1,5) – bleibt konzentrisch, weil Radius und Abstand mitwachsen
  const big = scale === 1 ? null
    : shape === 'capsule' ? { width: b.size * scale, height: b.countHeight * scale, borderRadius: b.pill }
    : shape === 'pill' ? { height: b.size * scale, minWidth: b.size * scale, borderRadius: b.radius * scale, paddingHorizontal: b.price.padX * scale }
    : { width: b.size * scale, height: b.size * scale, borderRadius: b.radius * scale };
  return (
    <View
      role={label ? 'img' : undefined}
      aria-label={label}
      accessibilityLabel={label}
      style={[s.glass, shape === 'capsule' && s.capsule, shape === 'pill' && s.pill, big, glassWeb, style]}
    >
      {children}
    </View>
  );
}

/** Ziffern mit kleinem Beizeichen: „2ד, „12ד, „99+“ bzw. „+3“ (Zeichen vorne) */
export function Num({ num, sym, symFirst, scale = 1 }: { num: string; sym: '×' | '+'; symFirst?: boolean; scale?: number }) {
  const big = scale !== 1;
  const symEl = <Text style={[s.sym, big && { fontSize: b.sym.size * scale }, raise]}>{sym}</Text>;
  return (
    <Text style={[s.num, big && { fontSize: b.num.size * scale, lineHeight: b.num.size * scale, letterSpacing: b.num.letterSpacing * scale }, trim]} numberOfLines={1}>
      {symFirst ? symEl : null}{num}{symFirst ? null : symEl}
    </Text>
  );
}

/** Monogramm in Gloock, in der Textfarbe der Person */
export function Mono({ letter, color, scale = 1 }: { letter: string; color: string; scale?: number }) {
  const big = scale !== 1 ? { fontSize: b.mono.size * scale, lineHeight: b.mono.size * scale, transform: web ? undefined : [{ translateY: b.monoOffsetY * scale }] } : null;
  return <Text style={[s.mono, { color }, big, trim]} numberOfLines={1}>{letter}</Text>;
}

/** Preis in ganzen Euro mit kleinem € dahinter (Wunschliste, unten links) */
export function Price({ label, scale = 1 }: { label: string; scale?: number }) {
  const e = b.price.eur;
  const big = scale !== 1 ? { fontSize: b.num.size * scale, lineHeight: b.num.size * scale, letterSpacing: b.num.letterSpacing * scale } : null;
  return (
    <Text style={[s.num, big, trim]} numberOfLines={1}>
      {label}
      <Text style={[{ fontSize: e.size * scale, fontWeight: e.weight }, css({ verticalAlign: `${e.raiseEm}em`, marginLeft: e.marginLeft * scale, marginRight: e.marginRight * scale })]}>€</Text>
    </Text>
  );
}

/** Bedenkzeit: Ring mit verbleibenden Tagen (Wunschliste, oben rechts) – liegt in einer runden Glass-Plakette */
export function WaitRing({ left, progress, warn }: { left: number; progress: number; warn: boolean }) {
  const w = b.wait;
  const c = 2 * Math.PI * w.r;
  const two = left > 9;
  return (
    <>
      <Svg width={b.size} height={b.size} viewBox={`0 0 ${b.size} ${b.size}`} style={StyleSheet.absoluteFill} aria-hidden>
        <Circle cx={b.size / 2} cy={b.size / 2} r={w.r} fill="none" stroke={w.track} strokeWidth={w.stroke} />
        <Circle cx={b.size / 2} cy={b.size / 2} r={w.r} fill="none" stroke={warn ? w.warn : w.color} strokeWidth={w.stroke}
          strokeLinecap="round" strokeDasharray={`${(c * progress).toFixed(2)} ${c.toFixed(2)}`}
          transform={`rotate(-90 ${b.size / 2} ${b.size / 2})`} />
      </Svg>
      <Text numberOfLines={1} style={[s.num, trim, two && {
        fontSize: w.twoDigits.size, lineHeight: w.twoDigits.size, letterSpacing: w.twoDigits.letterSpacing,
        marginRight: w.twoDigits.marginRight, transform: [{ translateY: w.twoDigits.offsetY + (web ? 0 : b.numOffsetY) }],
      }]}>{left}</Text>
    </>
  );
}

const s = StyleSheet.create({
  glass: {
    width: b.size,
    height: b.size,
    borderRadius: b.radius,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: b.glass,
    boxShadow: b.shadow,
  },
  capsule: { height: b.countHeight, borderRadius: b.pill },
  pill: { width: 'auto', minWidth: b.size, paddingHorizontal: b.price.padX },
  num: {
    // Web: Systemschrift-Stapel aus den Tokens; iOS: SF Pro ist Standard
    fontFamily: web ? fonts.text : undefined,
    fontSize: b.num.size,
    lineHeight: b.num.size,
    fontWeight: b.num.weight,
    letterSpacing: b.num.letterSpacing,
    fontVariant: ['tabular-nums'],
    color: b.ink,
    includeFontPadding: false,
    textAlignVertical: 'center',
    transform: web ? undefined : [{ translateY: b.numOffsetY }],
  },
  // TODO iOS: Beizeichen auf die Ziffernmitte heben (Web: vertical-align .12em) – verschachtelter Text kann sich nativ nicht verschieben.
  sym: { fontSize: b.sym.size, fontWeight: b.sym.weight },
  mono: {
    fontFamily: DISPLAY,
    fontSize: b.mono.size,
    lineHeight: b.mono.size,
    fontWeight: b.mono.weight,
    includeFontPadding: false,
    textAlignVertical: 'center',
    transform: web ? undefined : [{ translateY: b.monoOffsetY }],
  },
});

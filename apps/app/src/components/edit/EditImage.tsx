// Bild-Kachel der Bearbeiten-Seite (Spec 7): Radius 28, „Foto ändern“ und „Infos auslesen“;
// wendbar: Wende-Plakette oben rechts, „Seite A/B“, Punkte darunter, „Foto Seite A/B ändern“ für die gezeigte Seite.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { glowFor } from '@valet/core';
import { detail, itemTile } from '@valet/ui';
import { useTheme, DISPLAY } from '@/lib/theme';
import { canCutout, cutout, original, precutNote, type Picture } from '@/lib/cutout';
import { PhotoPicker } from '@/components/PhotoPicker';
import { ItemPicture } from '@/components/ItemPicture';
import { TileIcon } from '@/components/tile/TileIcons';
import { TileGlow, glowBoxShadow } from '@/components/tile/TileGlow';
import { Icon } from '@/components/Icon';
import { MirrorButton, badgeGlass } from './MirrorButton';

const I = detail.image;
/** Schein wie auf der Bild-Kachel im Teil-Detail */
const GLOW = { blur: 52, spread: 8 };
type Side = 'a' | 'b';


type Props = {
  width: number;
  /** aktuelle Bilder je Seite (Adresse) */
  current: Record<Side, string | null>;
  /** neu gewählte Bilder je Seite (werden beim Speichern hochgeladen) */
  pics: Record<Side, Picture | null>;
  onPick: (side: Side, p: Picture | null) => void;
  reversible: boolean;
  /** Form für den Platzhalter (layoutKind) */
  kind: string;
  /** Foto-Farbe (Platzhalter; Schein nur ohne Steckbrief-Farben) */
  hex: string | null;
  /** Steckbrief-Farben je Seite (live aus dem Formular) – bestimmen den Innenschein */
  colors: readonly string[];
  colorsB?: readonly string[];
  onInfo: () => void;
  /** Neues Teil: „Foto ändern“ führt zurück zum Fotoschritt */
  onChangePhoto?: () => void;
  /** Bearbeiten: gespeichertes Bild einer Seite laden (zum Spiegeln ohne neues Foto) */
  loadStored?: (side: Side) => Promise<Picture | null>;
  onError?: (message: string) => void;
};

export function EditImage({ width, current, pics, onPick, reversible, kind, hex, colors, colorsB, onInfo, onChangePhoto, loadStored, onError }: Props) {
  const t = useTheme();
  const [side, setSide] = useState<Side>('a');
  useEffect(() => { if (!reversible) setSide('a'); }, [reversible]);
  const fade = useRef(new Animated.Value(0)).current; // 0 = Seite A, 1 = Seite B
  useEffect(() => { Animated.timing(fade, { toValue: side === 'b' ? 1 : 0, duration: 260, useNativeDriver: true }).start(); }, [side, fade]);

  const flow = usePictureFlow((p) => onPick(side, p));
  const glow = glowFor(side === 'b' && reversible && colorsB?.length ? colorsB : colors, pics[side]?.colors[0]?.h ?? hex);
  const shadow = glowBoxShadow(glow, GLOW.blur, GLOW.spread);
  const sideName = side === 'a' ? 'Seite A' : 'Seite B';
  const h = Math.round(I.height * 300 / 380);

  if (flow.step !== 'idle') return <FlowPanel flow={flow} width={width} onError={onError} />;
  // Spiegeln: neues Foto direkt, sonst das gespeicherte erst laden; zurückgespiegelt auf das gespeicherte = keine Änderung
  const canMirror = canCutout && (!!pics[side] || (!!current[side] && !!loadStored));

  const layer = (s: Side) => {
    const uri = pics[s]?.preview ?? current[s];
    const op = s === 'a' ? fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : fade;
    const sc = s === 'a' ? fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) : fade.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
    return (
      <Animated.View key={s} pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: reversible ? op : 1, transform: [{ scale: reversible ? sc : 1 }] }]}>
        {/* Foto in der Form der Schrank-Kachel (Kappen bleiben klein wie im Schrank) */}
        <ItemPicture uri={uri} inset={20} category={kind} color={hex ?? itemTile.glow.fallback} shape={{ kind, width, height: h }}
          label={pics[s] ? (s === 'a' ? 'Bild Seite A' : 'Bild Seite B') : undefined} />
      </Animated.View>
    );
  };

  const changeLabel = reversible ? `Foto ${sideName} ändern` : 'Foto ändern';
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[s_.tile, { width, height: h, boxShadow: shadow }]}>
        <TileGlow glow={glow} radius={I.radius} blur={GLOW.blur} spread={GLOW.spread} />
        {layer('a')}
        {reversible && layer('b')}
        <View pointerEvents="none" style={s_.edge} />
        {canMirror && (
          <MirrorButton picture={pics[side]} load={loadStored ? () => loadStored(side) : undefined} onError={onError}
            onChange={(p) => onPick(side, p.stored ? null : p)} />
        )}
        {reversible && (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel={`Wenden, zeigt ${sideName}`} onPress={() => setSide(side === 'a' ? 'b' : 'a')}
              style={[s_.badge, badgeGlass]}>
              <TileIcon name="reversible" color="#2a1a1d" scale={detail.image.badgeIcon / itemTile.badge.icon.size} />
            </Pressable>
            <View pointerEvents="none" style={[s_.sidePill, badgeGlass]}><Text style={s_.pillText}>{sideName}</Text></View>
          </>
        )}
        <View style={s_.actions}>
          {onChangePhoto && side === 'a' ? (
            <Pressable accessibilityRole="button" onPress={onChangePhoto} style={[s_.action, badgeGlass]}>
              <Icon name="camera" size="inline" color="#2a1a1d" /><Text style={s_.pillText}>{changeLabel}</Text>
            </Pressable>
          ) : canCutout ? (
            <PhotoPicker onPick={flow.pick} label={changeLabel}>
              <View style={[s_.action, badgeGlass]}><Icon name="camera" size="inline" color="#2a1a1d" /><Text style={s_.pillText}>{changeLabel}</Text></View>
            </PhotoPicker>
          ) : <View />}
          <Pressable accessibilityRole="button" onPress={onInfo} style={[s_.action, badgeGlass]}>
            <Icon name="sparkle" size="inline" color="#2a1a1d" /><Text style={s_.pillText}>Infos auslesen</Text>
          </Pressable>
        </View>
      </View>
      {reversible && (
        <View style={s_.dots}>
          {(['a', 'b'] as const).map((x) => (
            <Pressable key={x} accessibilityRole="button" accessibilityLabel={x === 'a' ? 'Seite A' : 'Seite B'} onPress={() => setSide(x)} style={s_.dotHit}>
              <View style={[s_.dot, { width: side === x ? 18 : 7, backgroundColor: side === x ? t.ink : t.hairline }]} />
            </Pressable>
          ))}
        </View>
      )}
      {pics[side] && (
        <Pressable accessibilityRole="button" onPress={() => onPick(side, null)} hitSlop={8} style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 13, color: t.inkMuted }}>{pics[side]!.mirrorOf?.stored ? 'Spiegeln verwerfen' : 'Neues Foto verwerfen'}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------- Foto wählen → Freistellen → „Passt?“ ----------

type Step = 'idle' | 'work' | 'review';
type Flow = ReturnType<typeof usePictureFlow>;

/** Ablauf wie bisher (PictureEdit): Foto → Freistellen → Passt / Original behalten / Anderes Foto / Abbrechen */
export function usePictureFlow(onAccept: (p: Picture) => void) {
  const [step, setStep] = useState<Step>('idle');
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [picture, setPicture] = useState<Picture | null>(null);
  const [progress, setProgress] = useState<{ text: string; p?: number }>({ text: '' });
  const [failure, setFailure] = useState<string | null>(null);
  const run = useRef(0);
  const urls = useRef<string[]>([]);
  const keep = (u: string) => { urls.current.push(u); return u; };
  useEffect(() => () => { run.current++; urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  async function pick(file: File, model = false) {
    const n = ++run.current;
    setPhoto({ file, url: keep(URL.createObjectURL(file)) });
    setPicture(null); setFailure(null);
    if (!canCutout) return keepOriginal(file);
    setStep('work'); setProgress({ text: 'Starte Freistellen …', p: 0 });
    try {
      const p = await cutout(file, (text, p) => n === run.current && setProgress({ text, p }), { model });
      if (n !== run.current) return;
      keep(p.preview); setPicture(p);
    } catch (e) { if (n === run.current) setFailure((e as Error).message || String(e)); }
    if (n === run.current) setStep('review');
  }
  async function keepOriginal(file = photo?.file) {
    if (!file) return;
    const n = ++run.current;
    setStep('work'); setProgress({ text: 'Bild wird vorbereitet …', p: 1 });
    try {
      const p = await original(file);
      if (n !== run.current) return;
      keep(p.preview); onAccept(p); setStep('idle');
    } catch (e) { setFailure((e as Error).message); setStep('review'); }
  }
  const accept = (p: Picture) => { onAccept(p); setStep('idle'); };
  const cancel = () => { run.current++; setStep('idle'); };
  /** Vorschau gespiegelt (oder zurück) */
  const mirrored = (p: Picture) => { keep(p.preview); setPicture(p); };
  return { step, photo, picture, progress, failure, pick, keepOriginal, accept, cancel, mirrored };
}

function FlowPanel({ flow, width, onError }: { flow: Flow; width: number; onError?: (message: string) => void }) {
  const t = useTheme();
  const { step, photo, picture, progress, failure } = flow;
  return (
    <View style={{ width, gap: 12 }}>
      <View style={[s_.tile, { width, height: Math.round(I.height * 300 / 380), backgroundColor: step === 'review' && picture ? '#000' : t.surface, alignItems: 'center', justifyContent: 'center' }]}>
        {step === 'work' && photo && <Image source={{ uri: photo.url }} resizeMode="contain" style={[StyleSheet.absoluteFill, { opacity: 0.45 }]} accessibilityLabel="Foto wird freigestellt" />}
        {step === 'work' && <ActivityIndicator color={t.accent} size="large" />}
        {step === 'review' && picture && <Image source={{ uri: picture.preview }} resizeMode="contain" style={s_.img} accessibilityLabel="Freigestelltes Bild" />}
        {step === 'review' && picture && <MirrorButton picture={picture} onChange={flow.mirrored} onError={onError} />}
        {step === 'review' && !picture && (
          <View style={{ padding: 16, gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink, textAlign: 'center' }}>Freistellen hat nicht geklappt</Text>
            {!!failure && <Text style={{ fontSize: 14, color: t.inkMuted, textAlign: 'center' }}>{failure}</Text>}
          </View>
        )}
      </View>
      {step === 'work' ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 15, color: t.ink, textAlign: 'center' }}>{progress.text}</Text>
          <View style={[s_.track, { backgroundColor: t.surfaceSunken }]}><View style={[s_.fill, { width: `${Math.round((progress.p ?? 0) * 100)}%`, backgroundColor: t.accent }]} /></View>
          <Text style={{ fontSize: 13, color: t.inkMuted, textAlign: 'center' }}>Am iPhone dauert das etwa 10 Sekunden. Bitte die Seite geöffnet lassen.</Text>
          <FlowBtn label="Abbrechen" onPress={flow.cancel} />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {picture && <Text style={{ fontFamily: DISPLAY, fontSize: 22, textAlign: 'center', color: t.ink }}>Passt das so?</Text>}
          {!!precutNote(picture) && <Text style={{ fontSize: 13, lineHeight: 18, textAlign: 'center', color: t.inkMuted }}>{precutNote(picture)}</Text>}
          {picture && <FlowBtn primary label="Passt" onPress={() => flow.accept(picture)} />}
          {!!precutNote(picture) && photo && <FlowBtn label="Mit Modell freistellen" onPress={() => flow.pick(photo.file, true)} />}
          <FlowBtn label="Original behalten" onPress={() => flow.keepOriginal()} />
          <PhotoPicker onPick={flow.pick} label="Anderes Foto wählen"><FlowBtn label="Anderes Foto" /></PhotoPicker>
          <FlowBtn label="Abbrechen" onPress={flow.cancel} />
        </View>
      )}
    </View>
  );
}

function FlowBtn({ label, onPress, primary }: { label: string; onPress?: () => void; primary?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [s_.btn, primary ? { backgroundColor: t.accent, borderColor: t.accent } : { backgroundColor: t.surface, borderColor: t.hairline }, { opacity: pressed ? 0.8 : 1 }]}>
      <Text style={{ fontSize: 17, fontWeight: '600', color: primary ? t.onAccent : t.ink }}>{label}</Text>
    </Pressable>
  );
}

const s_ = StyleSheet.create({
  tile: { borderRadius: I.radius, backgroundColor: '#fff', overflow: 'hidden' },
  img: { position: 'absolute', top: 20, bottom: 20, left: 20, right: 20 },
  edge: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: I.radius, boxShadow: 'inset 0 0 0 1px rgba(42,26,29,0.09)' },
  badge: { position: 'absolute', top: I.inset, right: I.inset, width: I.badge, height: I.badge, borderRadius: I.badge / 2, alignItems: 'center', justifyContent: 'center' },
  sidePill: { position: 'absolute', top: 14, alignSelf: 'center', height: 28, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 13, fontWeight: '600', color: '#2a1a1d' },
  actions: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', justifyContent: 'space-between' },
  action: { height: 36, paddingHorizontal: 12, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dotHit: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 7, borderRadius: 4 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  btn: { height: 52, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

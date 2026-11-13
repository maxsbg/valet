import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { PhotoPicker } from '@/components/PhotoPicker';
import { ItemPicture } from '@/components/ItemPicture';
import { useTheme, DISPLAY, space, radius, tile } from '@/lib/theme';
import { canCutout, cutout, original, type Picture } from '@/lib/cutout';

const MAROON = '#722638';
type Step = 'idle' | 'work' | 'review';

/**
 * Bild eines Teils ändern (Bearbeiten-Seite): aktuelles Bild + „Bild ändern“.
 * Neues Foto → Freistellen → „Passt / Original behalten / Anderes Foto / Abbrechen“.
 * Das gewählte Bild wird über onChange gemeldet und erst beim Sichern gespeichert.
 */
export function PictureEdit({ title, current, value, onChange, category, color }: {
  title?: string; current: string | null; value: Picture | null; onChange: (p: Picture | null) => void; category: string; color: string;
}) {
  const t = useTheme();
  const accent = t.dark ? t.accent : MAROON;
  const [step, setStep] = useState<Step>('idle');
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [picture, setPicture] = useState<Picture | null>(null);
  const [progress, setProgress] = useState<{ text: string; p?: number }>({ text: '' });
  const [failure, setFailure] = useState<string | null>(null);
  const run = useRef(0); // verwirft Ergebnisse, wenn inzwischen ein anderes Foto gewählt oder abgebrochen wurde
  const urls = useRef<string[]>([]);
  const keep = (u: string) => { urls.current.push(u); return u; };
  useEffect(() => () => { run.current++; urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  async function pick(file: File) {
    const n = ++run.current;
    setPhoto({ file, url: keep(URL.createObjectURL(file)) });
    setPicture(null); setFailure(null);
    if (!canCutout) return keepOriginal(file);
    setStep('work'); setProgress({ text: 'Starte Freistellen …', p: 0 });
    try {
      const p = await cutout(file, (text, p) => n === run.current && setProgress({ text, p }));
      if (n !== run.current) return;
      keep(p.preview); setPicture(p);
    } catch (e) {
      if (n !== run.current) return;
      setFailure((e as Error).message || String(e));
    }
    setStep('review');
  }

  async function keepOriginal(file = photo?.file) {
    if (!file) return;
    const n = ++run.current;
    setStep('work'); setProgress({ text: 'Bild wird vorbereitet …', p: 1 });
    try {
      const p = await original(file);
      if (n !== run.current) return;
      keep(p.preview); accept(p);
    } catch (e) { setFailure((e as Error).message); setStep('review'); }
  }

  function accept(p: Picture) { onChange(p); setStep('idle'); }
  function cancel() { run.current++; setStep('idle'); }

  if (step === 'work') return (
    <View style={{ gap: space.md }}>
      <View style={[s.stage, { backgroundColor: t.surface }]}>
        {photo && <Image source={{ uri: photo.url }} resizeMode="contain" style={[StyleSheet.absoluteFill, { opacity: 0.45 }]} />}
        <ActivityIndicator color={accent} size="large" />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 15, color: t.ink, textAlign: 'center' }}>{progress.text}</Text>
        <View style={[s.track, { backgroundColor: t.surfaceSunken }]}>
          <View style={[s.fill, { width: `${Math.round((progress.p ?? 0) * 100)}%`, backgroundColor: accent }]} />
        </View>
        <Text style={[s.small, { color: t.inkMuted }]}>Am iPhone dauert das etwa 10 Sekunden. Bitte die Seite geöffnet lassen.</Text>
      </View>
      <Btn label="Abbrechen" onPress={cancel} />
    </View>
  );

  if (step === 'review') return (
    <View style={{ gap: space.md }}>
      {picture ? (
        <View style={[s.stage, { backgroundColor: '#000', boxShadow: '0 2px 8px rgba(42,26,29,0.18)' }]}>
          <Image source={{ uri: picture.preview }} resizeMode="contain" style={{ position: 'absolute', top: '6%', bottom: '6%', left: '6%', right: '6%' }} />
        </View>
      ) : (
        <View style={[s.stage, { backgroundColor: t.surface }]}>
          {photo && <Image source={{ uri: photo.url }} resizeMode="contain" style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} />}
          <View style={[s.note, { backgroundColor: t.bg }]}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink, textAlign: 'center' }}>Freistellen hat nicht geklappt</Text>
            {!!failure && <Text style={{ fontSize: 14, color: t.inkMuted, textAlign: 'center' }}>{failure}</Text>}
          </View>
        </View>
      )}
      {picture && <Text style={[s.question, { color: t.ink }]}>Passt das so?</Text>}
      <View style={{ gap: space.xs }}>
        {picture && <Btn primary label="Passt" onPress={() => accept(picture)} />}
        <Btn label="Original behalten" onPress={() => keepOriginal()} />
        <PhotoPicker onPick={pick} label="Anderes Foto wählen"><Btn label="Anderes Foto" /></PhotoPicker>
        <Btn label="Abbrechen" onPress={cancel} />
      </View>
    </View>
  );

  const shown = value?.preview ?? current;
  return (
    <View style={s.head}>
      <View style={[s.mini, { boxShadow: `inset 0 0 14px 2px ${(value?.colors[0]?.h ?? color)}73, 0 1px 4px rgba(42,26,29,0.10)` }]}>
        {value ? <Image source={{ uri: value.preview }} resizeMode="contain" style={{ position: 'absolute', top: 6, bottom: 6, left: 6, right: 6 }} />
          : <ItemPicture uri={shown} inset={6} category={category} color={color} />}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 15, color: t.ink }}>
          {title ? `${title} · ` : ''}{value ? (value.kind === 'cutout' ? 'Neu, freigestellt' : 'Neu, Original') : current ? 'Aktuelles Bild' : 'Noch kein Bild'}
        </Text>
        {canCutout ? (
          <PhotoPicker onPick={pick} label={current || value ? 'Bild ändern' : 'Bild hinzufügen'} style={{ alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: 15, color: accent, fontWeight: '600' }}>{current || value ? 'Bild ändern' : 'Bild hinzufügen'}</Text>
          </PhotoPicker>
        ) : (
          <Text style={{ fontSize: 13, color: t.inkMuted }}>Bilder ändern geht vorerst nur in der Web-App.</Text>
        )}
        {value && (
          <Pressable onPress={() => onChange(null)} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: 14, color: t.inkMuted }}>Änderung verwerfen</Text>
          </Pressable>
        )}
        {value && <Text style={{ fontSize: 12, color: t.inkMuted }}>Wird beim Sichern gespeichert.</Text>}
      </View>
    </View>
  );
}

function Btn({ label, onPress, primary }: { label: string; onPress?: () => void; primary?: boolean }) {
  const t = useTheme();
  const bg = primary ? (t.dark ? t.accent : MAROON) : t.surface;
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [s.btn, { backgroundColor: bg, borderColor: primary ? bg : t.hairline, opacity: pressed ? 0.8 : 1 }]}>
      <Text style={{ fontSize: 17, fontWeight: '600', color: primary ? (t.dark ? t.bg : '#fff') : t.ink }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mini: { width: 84, height: 84, borderRadius: 18, backgroundColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  stage: { height: 380, borderRadius: tile.radius, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  note: { margin: space.lg, padding: space.md, borderRadius: radius.md, gap: 6 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  small: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  question: { fontFamily: DISPLAY, fontSize: 22, textAlign: 'center' },
  btn: { height: 52, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

import { useBottomInset } from '@/lib/bottomInset';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Page, STICKY } from '@/components/Page';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/ui';
import { Icons } from '@/components/Icon';
import { PhotoPicker } from '@/components/PhotoPicker';
import { ItemFormFields, emptyForm, readForm, type ItemForm } from '@/components/ItemForm';
import { useSession } from '@/lib/session';
import { useTheme, DISPLAY, space, radius, tile } from '@/lib/theme';
import { canCutout, cutout, modelCached, original, type Picture } from '@/lib/cutout';
import { createItem, type NewItem } from '@/lib/item';
import { hexToName } from '@/lib/wardrobe';

type Step = 'start' | 'work' | 'review' | 'form';
const MAROON = '#722638';

/** Teil hinzufügen: Foto → Freistellen → „Passt / Original behalten / Nochmal“ → Formular → Speichern */
export default function Neu() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset();
  const toast = useToast(bottom + 90);
  const { wardrobe, session, reload } = useSession();
  const me = wardrobe?.persons.find((p) => p.user_id === session?.user.id);

  const [step, setStep] = useState<Step>('start');
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [picture, setPicture] = useState<Picture | null>(null);
  const [progress, setProgress] = useState<{ text: string; p?: number }>({ text: '' });
  const [failure, setFailure] = useState<string | null>(null);
  const [cached, setCached] = useState(true);
  const [f, setF] = useState<ItemForm | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const run = useRef(0); // verwirft Ergebnisse, wenn inzwischen ein anderes Foto gewählt wurde
  const urls = useRef<string[]>([]);

  useEffect(() => { modelCached().then(setCached); }, []);
  useEffect(() => () => { run.current++; urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);
  const keep = (u: string) => { urls.current.push(u); return u; };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  async function pick(file: File) {
    const n = ++run.current;
    setPhoto({ file, url: keep(URL.createObjectURL(file)) });
    setPicture(null); setFailure(null);
    if (!canCutout) return keepOriginal(file);
    setStep('work'); setProgress({ text: 'Starte Freistellen …', p: 0 });
    try {
      const p = await cutout(file, (text, p) => n === run.current && setProgress({ text, p }));
      if (n !== run.current) return;
      keep(p.preview); setPicture(p); setCached(true);
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
      keep(p.preview); toForm(p);
    } catch (e) { setFailure((e as Error).message); setStep('review'); }
  }

  /** Weiter zum Formular; Farbe aus dem Bild vorschlagen, solange noch keine gewählt ist */
  function toForm(p: Picture | null) {
    setPicture(p);
    const base = f ?? emptyForm(me?.id ?? null);
    const top = p?.colors[0]?.h;
    const suggestion = top ? hexToName(top) : null;
    setF(base.colors.length || !suggestion ? base : { ...base, colors: [suggestion] });
    setStep('form');
  }

  async function save() {
    if (!f || !wardrobe) return;
    const r = readForm(f);
    if ('error' in r) return toast.show(r.error);
    // Leere Angaben weglassen → Standardwerte der Datenbank
    const data = Object.fromEntries(Object.entries(r.change).filter(([, v]) => v !== null && v !== '')) as NewItem;
    setSaving(true);
    try {
      await createItem(wardrobe.id, data, picture);
      await reload();
      close();
    } catch (e) { toast.show('Speichern fehlgeschlagen: ' + (e as Error).message); }
    finally { setSaving(false); }
  }

  const glow = picture?.colors[0]?.h ?? '#d8d2c8';
  const accent = t.dark ? t.accent : MAROON;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.bar, STICKY, { paddingTop: insets.top + space.xs, backgroundColor: t.bg, borderBottomColor: t.hairline }]}>
        <Pressable onPress={close} hitSlop={10} style={s.barSide}><Text style={{ fontSize: 17, color: t.ink }}>Abbrechen</Text></Pressable>
        <Text style={{ fontFamily: DISPLAY, fontSize: 20, color: t.ink }}>Neues Teil</Text>
        <View style={[s.barSide, { alignItems: 'flex-end' }]}>
          {step === 'form' && (
            <Pressable onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: accent, opacity: saving ? 0.4 : 1 }}>{saving ? 'Speichert …' : 'Sichern'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Page contentContainerStyle={{ alignItems: 'center', paddingBottom: bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={s.col}>
          {step === 'start' && (
            <>
              {canCutout ? (
                <PhotoPicker onPick={pick} label="Foto aufnehmen oder auswählen" style={{ marginTop: space.md }}>
                  <View style={[s.drop, { borderColor: t.hairline, backgroundColor: t.surface }]}>
                    <View style={[s.dropIcon, { backgroundColor: '#FF641F' }]}><Icons.plus color="#2a1a1d" size={30} /></View>
                    <Text style={[s.dropTitle, { color: t.ink }]}>Foto aufnehmen{'\n'}oder auswählen</Text>
                    <Text style={[s.hint, { color: t.inkMuted }]}>Das Teil wird automatisch freigestellt. Am besten liegt es ganz im Bild auf ruhigem Untergrund.</Text>
                  </View>
                </PhotoPicker>
              ) : (
                <Text style={[s.hint, { color: t.inkMuted, marginTop: space.lg }]}>Fotos aufnehmen geht vorerst nur in der Web-App.</Text>
              )}
              {canCutout && !cached && (
                <Text style={[s.small, { color: t.inkMuted }]}>Beim ersten Mal lädt das Freistellen einmalig 44 MB – am besten im WLAN. Danach geht es ohne Download.</Text>
              )}
              <Pressable onPress={() => toForm(null)} style={s.link} accessibilityRole="button">
                <Text style={{ fontSize: 16, color: accent, fontWeight: '600' }}>Ohne Foto weiter</Text>
              </Pressable>
            </>
          )}

          {step === 'work' && (
            <View style={{ gap: space.md, marginTop: space.md }}>
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
            </View>
          )}

          {step === 'review' && (
            <View style={{ gap: space.md, marginTop: space.md }}>
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
                {picture && <Btn primary label="Passt" onPress={() => toForm(picture)} />}
                <Btn label="Original behalten" onPress={() => keepOriginal()} />
                <PhotoPicker onPick={pick} label="Nochmal mit neuem Foto">
                  <Btn label={picture ? 'Nochmal (neues Foto)' : 'Anderes Foto'} />
                </PhotoPicker>
              </View>
            </View>
          )}

          {step === 'form' && f && (
            <>
              <View style={s.formHead}>
                <View style={[s.mini, { boxShadow: `inset 0 0 14px 2px ${glow}73, 0 1px 4px rgba(42,26,29,0.10)` }]}>
                  {picture ? <Image source={{ uri: picture.preview }} resizeMode="contain" style={{ position: 'absolute', top: 6, bottom: 6, left: 6, right: 6 }} />
                    : <Text style={{ fontSize: 12, color: t.inkMuted, textAlign: 'center' }}>Kein Foto</Text>}
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 15, color: t.ink }}>{picture ? (picture.kind === 'cutout' ? 'Freigestellt' : 'Original') : 'Ohne Foto'}</Text>
                  <Pressable onPress={() => { run.current++; setStep('start'); }} hitSlop={8}>
                    <Text style={{ fontSize: 15, color: accent, fontWeight: '600' }}>{picture ? 'Foto ändern' : 'Foto hinzufügen'}</Text>
                  </Pressable>
                </View>
              </View>
              <ItemFormFields f={f} onChange={setF} persons={wardrobe?.persons ?? []} open={open} onOpen={setOpen} />
              <Btn primary label={saving ? 'Speichert …' : 'Teil sichern'} onPress={saving ? undefined : save} style={{ marginTop: space.md }} />
            </>
          )}
        </View>
      </Page>
      {toast.node}
    </KeyboardAvoidingView>
  );
}

function Btn({ label, onPress, primary, style }: { label: string; onPress?: () => void; primary?: boolean; style?: object }) {
  const t = useTheme();
  const bg = primary ? (t.dark ? t.accent : MAROON) : t.surface;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" disabled={!onPress && primary}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, borderColor: primary ? bg : t.hairline, opacity: pressed ? 0.8 : 1 }, style]}>
      <Text style={{ fontSize: 17, fontWeight: '600', color: primary ? (t.dark ? t.bg : '#fff') : t.ink }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingBottom: space.sm, borderBottomWidth: 1 },
  barSide: { minWidth: 90 },
  col: { width: '100%', maxWidth: 520, padding: space.md, gap: space.sm },
  drop: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl, paddingHorizontal: space.lg, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.lg },
  dropIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(42,26,29,0.18)' },
  dropTitle: { fontFamily: DISPLAY, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  hint: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  small: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  link: { alignItems: 'center', paddingVertical: space.md },
  stage: { height: 380, borderRadius: tile.radius, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  note: { margin: space.lg, padding: space.md, borderRadius: radius.md, gap: 6 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  question: { fontFamily: DISPLAY, fontSize: 22, textAlign: 'center' },
  btn: { height: 52, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xs },
  mini: { width: 84, height: 84, borderRadius: 18, backgroundColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});

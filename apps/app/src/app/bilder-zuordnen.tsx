import { useBottomInset } from '@/lib/bottomInset';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Page, STICKY } from '@/components/Page';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { categoryLabel } from '@valet/core';
import { PhotoPicker } from '@/components/PhotoPicker';
import { ItemPicture } from '@/components/ItemPicture';
import { useToast } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useTheme, DISPLAY, space, radius, tile } from '@/lib/theme';
import { saveImage } from '@/lib/item';
import type { Picture } from '@/lib/cutout';
import { colorDistance, loadMissing, originalPhoto, preparePhoto, type Missing } from '@/lib/assign';

const MAROON = '#722638';
type Photo = { id: number; file: File; status: 'wait' | 'work' | 'ready' | 'failed'; pic?: Picture; error?: string };

/**
 * Bilder zuordnen: mehrere Fotos wählen → werden nacheinander freigestellt → je Bild das passende Teil antippen.
 * Die Liste zeigt nur Teile (bzw. Seiten von Wendeteilen) ohne Bild, ähnliche Farbe zuerst.
 */
export default function BilderZuordnen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset();
  const toast = useToast(bottom + 40);
  const { wardrobe, reload } = useSession();
  const accent = t.dark ? t.accent : MAROON;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [missing, setMissing] = useState<Missing[] | null>(null);
  const [q, setQ] = useState('');
  const [step, setStep] = useState('');
  const [saving, setSaving] = useState(false);
  const [assigned, setAssigned] = useState(0);
  const nextId = useRef(1);
  const busy = useRef(false);
  const alive = useRef(true);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    if (wardrobe) loadMissing(wardrobe.items).then(setMissing, (e) => toast.show('Laden fehlgeschlagen: ' + (e as Error).message));
  }, [wardrobe?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { alive.current = false; urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  // Fotos nacheinander vorbereiten (Freistellen braucht am iPhone ~10 s je Foto)
  useEffect(() => {
    if (busy.current) return;
    const next = photos.find((p) => p.status === 'wait');
    if (!next) return;
    busy.current = true;
    update(next.id, { status: 'work' });
    preparePhoto(next.file, (text) => alive.current && setStep(text))
      .then((pic) => { urls.current.push(pic.preview); update(next.id, { status: 'ready', pic }); })
      .catch((e) => update(next.id, { status: 'failed', error: (e as Error).message }))
      .finally(() => { busy.current = false; setStep(''); setPhotos((p) => [...p]); });
  }, [photos]);

  function update(id: number, change: Partial<Photo>) {
    if (alive.current) setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, ...change } : p)));
  }
  const add = (files: File[]) => setPhotos((ps) => [...ps, ...files.map((file) => ({ id: nextId.current++, file, status: 'wait' as const }))]);
  const drop = (id: number) => setPhotos((ps) => ps.filter((p) => p.id !== id));
  const later = (id: number) => setPhotos((ps) => { const p = ps.find((x) => x.id === id); return p ? [...ps.filter((x) => x.id !== id), p] : ps; });

  const current = photos.find((p) => p.status === 'ready' || p.status === 'failed');
  const pending = photos.filter((p) => p.status === 'wait' || p.status === 'work').length;

  async function keepOriginal(p: Photo) {
    try { const pic = await originalPhoto(p.file); urls.current.push(pic.preview); update(p.id, { pic, status: 'ready' }); }
    catch (e) { toast.show((e as Error).message); }
  }

  async function assign(m: Missing) {
    if (!wardrobe || !current?.pic || saving) return;
    setSaving(true);
    try {
      await saveImage(wardrobe.id, m.item.id, m.side, current.pic);
      setMissing((ms) => ms?.filter((x) => !(x.item.id === m.item.id && x.side === m.side)) ?? null);
      drop(current.id);
      setAssigned((n) => n + 1);
      toast.show(`Gespeichert: ${m.item.name || categoryLabel(m.item.category)}`);
    } catch (e) { toast.show('Speichern fehlgeschlagen: ' + (e as Error).message); }
    finally { setSaving(false); }
  }

  async function close() {
    if (assigned) await reload();
    if (router.canGoBack()) router.back(); else router.replace('/');
  }

  const list = useMemo(() => {
    const top = current?.pic?.colors[0]?.h;
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (missing ?? [])
      .filter((m) => { const hay = `${m.item.name} ${m.item.brand ?? ''} ${categoryLabel(m.item.category)} ${m.item.color ?? ''}`.toLowerCase(); return words.every((w) => hay.includes(w)); })
      .map((m) => ({ m, d: colorDistance(top, m.item.hex) }))
      .sort((a, b) => a.d - b.d || a.m.item.name.localeCompare(b.m.item.name, 'de'))
      .map((x) => x.m);
  }, [missing, q, current?.pic]);

  const picker = (label: string, primary?: boolean) => (
    <PhotoPicker onPickMany={add} label={label}>
      <View style={[s.btn, { backgroundColor: primary ? accent : t.surface, borderColor: primary ? accent : t.hairline }]}>
        <Text style={{ fontSize: 17, fontWeight: '600', color: primary ? (t.dark ? t.bg : '#fff') : t.ink }}>{label}</Text>
      </View>
    </PhotoPicker>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.bar, STICKY, { paddingTop: insets.top + space.xs, backgroundColor: t.bg, borderBottomColor: t.hairline }]}>
        <Pressable accessibilityRole="button" onPress={close} hitSlop={10} style={s.barSide}><Text style={{ fontSize: 17, color: t.ink }}>Fertig</Text></Pressable>
        <Text style={{ fontFamily: DISPLAY, fontSize: 20, color: t.ink }}>Bilder zuordnen</Text>
        <View style={[s.barSide, { alignItems: 'flex-end' }]}>
          {missing && <Text style={{ fontSize: 13, color: t.inkMuted }}>{missing.length} ohne Bild</Text>}
        </View>
      </View>

      <Page contentContainerStyle={{ alignItems: 'center', paddingBottom: bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={s.col}>
          {Platform.OS !== 'web' && <Text style={[s.small, { color: t.inkMuted }]}>Geht vorerst nur in der Web-App.</Text>}

          {!photos.length && (
            <>
              <Text style={[s.text, { color: t.ink }]}>Wähle mehrere Fotos auf einmal. Sie werden nacheinander freigestellt, bereits freigestellte Bilder (PNG mit durchsichtigem Hintergrund) bleiben, wie sie sind. Danach tippst du je Bild das passende Teil an.</Text>
              {picker('Fotos auswählen', true)}
              {assigned > 0 && <Text style={[s.small, { color: t.inkMuted }]}>{assigned} Bilder zugeordnet.</Text>}
            </>
          )}

          {photos.length > 0 && !current && (
            <View style={[s.stage, { backgroundColor: t.surface }]}>
              <ActivityIndicator color={accent} size="large" />
              <Text style={[s.small, { color: t.inkMuted, marginTop: space.sm }]}>{step || 'Bild wird vorbereitet …'}</Text>
            </View>
          )}

          {current && (
            <>
              <View style={[s.stage, { backgroundColor: '#000', boxShadow: '0 2px 8px rgba(42,26,29,0.18)' }]}>
                {current.pic ? <Image source={{ uri: current.pic.preview }} resizeMode="contain" style={{ position: 'absolute', top: '6%', bottom: '6%', left: '6%', right: '6%' }} accessibilityLabel="Freigestelltes Bild" />
                  : <Text style={[s.small, { color: '#ff9a8f' }]}>Foto ließ sich nicht öffnen: {current.error}</Text>}
              </View>
              <Text style={[s.small, { color: t.inkMuted }]}>
                {current.pic ? (current.pic.source === 'shadow' ? 'Schatten entfernt' : current.pic.source === 'clean' ? 'Schon freigestellt' : current.pic.kind === 'cutout' ? 'Freigestellt' : 'Original') : 'Fehler'} · noch {photos.length} Fotos{pending ? `, ${pending} in Arbeit${step ? ` (${step.replace(/ …$/, '')})` : ''}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                <Small label="Später" onPress={() => later(current.id)} />
                {current.pic?.kind === 'cutout' && <Small label="Original" onPress={() => keepOriginal(current)} />}
                <Small label="Verwerfen" onPress={() => drop(current.id)} />
              </View>

              <Text style={[s.h, { color: t.ink }]}>Zu welchem Teil gehört das Bild?</Text>
              <TextInput value={q} onChangeText={setQ} placeholder="Suchen (Name, Marke, Kategorie)" placeholderTextColor={t.inkMuted}
                style={[s.search, { color: t.ink, backgroundColor: t.surface, borderColor: t.hairline }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} />
              {!missing && <ActivityIndicator color={accent} />}
              {missing && !list.length && <Text style={[s.small, { color: t.inkMuted }]}>{missing.length ? 'Nichts gefunden.' : 'Alle Teile haben schon ein Bild.'}</Text>}
              {list.slice(0, 60).map((m) => (
                <Pressable key={`${m.item.id}:${m.side}`} onPress={() => assign(m)} disabled={!current.pic || saving} accessibilityRole="button"
                  style={({ pressed }) => [s.row, { backgroundColor: t.surface, borderColor: t.hairline, opacity: pressed || saving ? 0.6 : 1 }]}>
                  <View style={s.rowPic}><ItemPicture uri={null} category={m.item.category} color={m.item.hex ?? '#8e8e93'} inset={4} /></View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>{m.item.name || categoryLabel(m.item.category)}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 13, color: t.inkMuted }}>
                      {[m.item.brand, categoryLabel(m.item.category), m.item.color, m.item.isWish ? 'Wunschliste' : null, m.item.reversible ? `Seite ${m.side.toUpperCase()}` : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {list.length > 60 && <Text style={[s.small, { color: t.inkMuted }]}>… {list.length - 60} weitere – über die Suche eingrenzen.</Text>}
              {picker('Weitere Fotos hinzufügen')}
            </>
          )}
        </View>
      </Page>
      {toast.node}
    </View>
  );
}

function Small({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.small2, { backgroundColor: t.surface, borderColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingBottom: space.sm, borderBottomWidth: 1 },
  barSide: { minWidth: 90 },
  col: { width: '100%', maxWidth: 520, padding: space.md, gap: space.sm },
  text: { fontSize: 16, lineHeight: 22 },
  h: { fontFamily: DISPLAY, fontSize: 20, marginTop: space.sm },
  small: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  stage: { height: 320, borderRadius: tile.radius, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  btn: { height: 52, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  small2: { flex: 1, height: 42, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  search: { height: 44, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md, borderWidth: 1 },
  rowPic: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});

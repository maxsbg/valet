import { useBottomInset } from '@/lib/bottomInset';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Page, STICKY } from '@/components/Page';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/ui';
import { PhotoPicker } from '@/components/PhotoPicker';
import { ItemEditor } from '@/components/edit/ItemEditor';
import { dropImageSuggestions, editChange, emptyEditForm, infoContext, infoUsable, kiMessage, infoSource, largestImages, mergeSources, setField, shopFromLink, sizeLabel, type EditForm, type Info, type PixelSize, type SourceInfo } from '@valet/core';
import { analyzePicture, kiError, readInfo, readPage } from '@/lib/ki';
import { fetchImage, findUrl, loadProduct, productError, type ProductPage } from '@/lib/produkt';
import { useSession } from '@/lib/session';
import { useTheme, DISPLAY, space, radius, tile } from '@/lib/theme';
import { canCutout, cutout, modelCached, original, precutNote, type Picture } from '@/lib/cutout';
import { createItem, saveSet } from '@/lib/item';
import type { SetDraft } from '@/components/edit/SetPicker';
import { Icon } from '@/components/Icon';
import { MirrorButton } from '@/components/edit/MirrorButton';
import { Dims, Glass } from '@/components/tile/TileBadge';
import { itemTile } from '@valet/ui';

type Step = 'start' | 'web' | 'work' | 'review' | 'sides' | 'side2' | 'more' | 'form';
/** Zweite Seite (Max 21.11.2026): keine · Rückseite (Backprint, gemeinsame Farben) · wendbar (eigene Farben) */
type Sides = 'one' | 'back' | 'reversible';
/** Ausgelesene Infos (Seite, Screenshot, Etikett) + Beschreibungstext der Seite – Kontext für die Bildanalyse */
type Extra = { infos: SourceInfo[]; description: string | null };
/** Fehler beim Laden einer Produktseite (kein KI-Fehler) – eigene Meldung */
const pageError = (message: string) => Object.assign(new Error(message), { page: true });
const MAROON = '#722638';

/**
 * Teil hinzufügen: Foto → Freistellen → „Passt / Original behalten / Nochmal“ → „Hast du noch weitere Infos?“
 * (Link · Screenshot oder Etikett · Weiter ohne; entfällt beim Start über einen Link) → Formular → Speichern.
 * Erst werden die Infos ausgelesen, dann läuft EINE Bildanalyse mit ihnen als Kontext (Spec 6.7).
 */
export default function Neu() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset();
  const toast = useToast(bottom + 90);
  const { wardrobe, session, reload } = useSession();
  const me = wardrobe?.persons.find((p) => p.user_id === session?.user.id);
  // Aus der Wunschliste: ?wunsch=1 (&liste=<id>) → Wunschteil, Liste vorbelegt
  // ?url=… (Teilen-Menü / Kurzbefehl) → Produktseite direkt laden
  const params = useLocalSearchParams<{ wunsch?: string; liste?: string; url?: string }>();
  const wish = params.wunsch === '1' ? { wishlistId: params.liste ?? null } : undefined;

  const [step, setStep] = useState<Step>('start');
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [picture, setPicture] = useState<Picture | null>(null);
  // Bild im Schritt „Passt das so?“ – gehört zur Seite targetRef (a = vorn, b = Rückseite/Seite B)
  const [cand, setCand] = useState<Picture | null>(null);
  const targetRef = useRef<'a' | 'b'>('a');
  // Zweite Seite: Antwort auf „Hat das Teil eine zweite Seite?“, zweites Foto aus der Mehrfachauswahl
  const [sides, setSidesState] = useState<Sides>('one');
  const sidesRef = useRef<Sides>('one');
  const setSides = (v: Sides) => { sidesRef.current = v; setSidesState(v); };
  const queued = useRef<File | null>(null);
  const [progress, setProgress] = useState<{ text: string; p?: number }>({ text: '' });
  const [failure, setFailure] = useState<string | null>(null);
  const [cached, setCached] = useState(true);
  const [f, setF] = useState<EditForm | null>(null);
  // Wendeteil: Foto der Seite B (im Formular gewählt)
  const [picB, setPicBState] = useState<Picture | null>(null);
  const picBRef = useRef<Picture | null>(null);
  const setPicB = (p: Picture | null) => { picBRef.current = p; setPicBState(p); };
  const [setDraft, setSetDraft] = useState<SetDraft>({ on: false, members: [], name: '' });
  const [saving, setSaving] = useState(false);
  // Per Link: geladene Produktseite; die KI liest ihren Text schon, während du ein Bild wählst
  const [linkText, setLinkText] = useState('');
  const [web, setWeb] = useState<{ url: string; page?: ProductPage; error?: string; loadingImg?: string } | null>(null);
  // Bildgröße der Produktbilder (Breite × Höhe in Pixeln), damit man das beste nehmen kann
  const [sizes, setSizes] = useState<Record<string, PixelSize | null>>({});
  const pageInfo = useRef<Promise<Info> | null>(null);
  const pageDesc = useRef<string | null>(null);
  // Schritt „Hast du noch weitere Infos?“
  const [moreLink, setMoreLink] = useState('');
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const earlySave = useRef(false);
  /** zuletzt gelesene Infos: bleiben beim Fotowechsel Kontext der neuen Bildanalyse (Werte stehen schon im Formular) */
  const lastExtra = useRef<Extra | null>(null);
  const run = useRef(0); // verwirft Ergebnisse, wenn inzwischen ein anderes Foto gewählt wurde
  const urls = useRef<string[]>([]);

  useEffect(() => { modelCached().then(setCached); }, []);
  // Größe jedes Produktbilds nachmessen (aus dem Browser-Cache, das Bild ist schon in der Auswahl geladen)
  useEffect(() => {
    const list = web?.page?.images ?? [];
    let live = true;
    list.forEach((src) => {
      if (src in sizes) return;
      Image.getSize(src,
        (w, h) => live && setSizes((m) => ({ ...m, [src]: { w, h } })),
        () => live && setSizes((m) => ({ ...m, [src]: null })));
    });
    return () => { live = false; };
  }, [web?.page]); // eslint-disable-line react-hooks/exhaustive-deps
  const best = largestImages(sizes);
  useEffect(() => { if (params.url) openLink(params.url); }, [params.url]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { run.current++; urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);
  const keep = (u: string) => { urls.current.push(u); return u; };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  /** Mehrfachauswahl: erstes Foto = Vorderseite, zweites = zweite Seite (Art wird danach gefragt) */
  function pickMany(files: File[]) {
    queued.current = files[1] ?? null;
    pick(files[0]!, false, 'a');
  }

  async function pick(file: File, model = false, target: 'a' | 'b' = targetRef.current) {
    targetRef.current = target;
    const n = ++run.current;
    setPhoto({ file, url: keep(URL.createObjectURL(file)) });
    setCand(null); setFailure(null);
    if (!canCutout) return keepOriginal(file);
    setStep('work'); setProgress({ text: 'Starte Freistellen …', p: 0 });
    try {
      const p = await cutout(file, (text, p) => n === run.current && setProgress({ text, p }), { model });
      if (n !== run.current) return;
      keep(p.preview); setCand(p); if (p.source === 'model') setCached(true);
    } catch (e) {
      if (n !== run.current) return;
      setFailure((e as Error).message || String(e));
    }
    setStep('review');
  }

  async function openLink(raw: string) {
    const url = findUrl(raw);
    if (!url) return toast.show('Kein Link gefunden');
    const n = ++run.current;
    pageInfo.current = null; pageDesc.current = null;
    setWeb({ url }); setStep('web');
    try {
      const page = await loadProduct(url);
      if (n !== run.current) return;
      if (page.text.length > 200) {
        pageInfo.current = readPage(page.text, page.facts);
        pageDesc.current = page.facts.description ?? null;
        pageInfo.current.catch(() => {}); // Fehler erst beim Formular melden
      } else if (!page.blocked) {
        toast.show('Auf der Seite steht zu wenig Text – Angaben wie Material und Pflege bitte selbst ergänzen.');
      }
      setWeb({ url, page, error: page.blocked ? 'Der Shop lässt die Seite nicht von außen laden.' : !page.images.length ? 'Auf der Seite wurden keine Bilder gefunden.' : undefined });
    } catch (e) {
      if (n === run.current) setWeb({ url, error: productError(e) });
    }
  }

  async function pickWebImage(src: string) {
    if (!web) return;
    setWeb({ ...web, loadingImg: src });
    try {
      const file = await fetchImage(src, web.url);
      setWeb((w) => (w ? { ...w, loadingImg: undefined } : w));
      await pick(file);
    } catch (e) {
      setWeb((w) => (w ? { ...w, loadingImg: undefined } : w));
      toast.show((e as Error).message);
    }
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

  /** „Passt“ bzw. Original: Bild der gerade bearbeiteten Seite übernehmen */
  function accept(p: Picture) {
    if (targetRef.current === 'b') { setPicB(p); targetRef.current = 'a'; return afterSides(picture); }
    setPicture(p);
    // zwei Fotos gewählt oder noch offen: nach der zweiten Seite fragen
    setStep('sides');
  }

  /** Antwort auf „Hat das Teil eine zweite Seite?“ */
  function answerSides(v: Sides) {
    setSides(v);
    if (v === 'one') { queued.current = null; setPicB(null); return afterSides(picture); }
    const next = queued.current;
    queued.current = null;
    if (next) return pick(next, false, 'b');
    targetRef.current = 'b';
    setStep('side2');
  }

  /** Seiten stehen: beim Start über einen Link gleich zum Formular, sonst erst nach weiteren Infos fragen */
  function afterSides(front: Picture | null) {
    if (web) return toForm(front);
    setStep('more');
  }

  /** „Link einfügen“: Seite laden und ihren Text auslesen (im Hintergrund, das Formular ist schon offen) */
  function moreFromLink() {
    const url = findUrl(moreLink);
    if (!url) return toast.show('Kein Link gefunden');
    toForm(picture, {
      link: url,
      // Fehler beim Laden der Seite eigens kennzeichnen (sonst sähe der Nutzer „Keine Verbindung zur KI“)
      read: loadProduct(url).catch((e) => { throw pageError(productError(e)); }).then(async (page): Promise<Extra> => {
        if (page.blocked) throw pageError('Der Shop lässt die Seite nicht von außen laden.');
        if (page.text.length <= 200) throw pageError('Auf der Seite steht zu wenig Text.');
        return { infos: [{ from: 'page', info: await readPage(page.text, page.facts) }], description: page.facts.description ?? null };
      }),
    });
  }

  /** „Screenshot oder Etikett“: Bild auslesen; ob Etikett oder Shop, erkennt die KI selbst */
  function moreFromShot(file: File) {
    toForm(picture, { read: readInfo(file, null).then((info): Extra => ({ infos: [{ from: infoSource(info), info }], description: null })) });
  }

  /**
   * Weiter zum Formular; Steckbrief schlägt die KI vor (nur Werte aus den festen Listen, nur leere oder offene Felder).
   * Reihenfolge: erst die Infos (Seite/Screenshot/Etikett) auslesen und zeigen, dann EINE Bildanalyse mit ihnen
   * als Kontext. Zusammengeführt wird nach der Rangfolge in mergeSources; das Profil kommt nur aus dem Bild.
   */
  function toForm(p: Picture | null, more?: { read: Promise<Extra>; link?: string }) {
    setPicture(p);
    const base0 = f ?? emptyEditForm({ ownerId: me?.id ?? null, wish });
    // Antwort „wendbar“ → Schalter Wendbar an (Rückseite bleibt Zustand dieser Seite)
    const base = sidesRef.current === 'reversible' && !base0.reversible ? setField(base0, 'reversible', true) : base0;
    const link = more?.link ?? web?.url;
    setF(link && !base.link ? { ...setField(base, 'link', link), shop: shopFromLink(base.shop, '', link) } : base);
    setStep('form');
    const page = pageInfo.current;
    const read: Promise<Extra> | null = more?.read
      ?? (page ? page.then((info) => ({ infos: [{ from: 'page' as const, info }], description: pageDesc.current })) : null);
    const kept = !read ? lastExtra.current : null;
    if (!p && !read) return;
    const n = run.current;
    earlySave.current = false;
    setAiBusy(read ? 'KI liest die Infos aus … Vorschläge erscheinen gleich in den Feldern.' : 'KI analysiert das Foto … Vorschläge erscheinen gleich in den Feldern.');
    (async () => {
      let extra: Extra = kept ?? { infos: [], description: null };
      const errors: unknown[] = [];
      let readFailed = false, imageFailed = false;
      if (read) { try { extra = await read; } catch (e) { errors.push(e); readFailed = true; } }
      if (n !== run.current) return;
      if (p) setAiBusy('KI analysiert das Foto … Vorschläge erscheinen gleich in den Feldern.');
      // leere Infos (nichts Lesbares) nicht übernehmen und nicht als Kontext zählen
      if (extra.infos.length && !extra.infos.some((x) => infoUsable(x.info, x.from))) toast.show('Auf dem Bild bzw. der Seite war nichts Lesbares – weiter nur mit dem Foto.');
      extra = { ...extra, infos: extra.infos.filter((x) => infoUsable(x.info, x.from)) };
      if (read) lastExtra.current = extra;
      // neu gelesene Infos übernehmen; behaltene (Fotowechsel) stehen schon im Formular und gehen nur als Kontext mit
      if (read && extra.infos.length) setF((cur) => cur && mergeSources(cur, { infos: extra.infos }));
      if (p) {
        try {
          // Rückseite (Backprint): die KI sieht beide Fotos – Farben, Anteile, Muster über das ganze Teil
          const back = sidesRef.current === 'back' ? picBRef.current : null;
          const a = await analyzePicture(p.main, infoContext(extra.infos, extra.description), back?.main ?? null);
          if (n !== run.current) return;
          // Infos sind schon übernommen (mit Herkunft); nur noch das Bild – so dreht es keine Eingaben des Nutzers zurück
          // Passform-Stufen und Größe der Infos noch einmal (late): im ersten Schritt fehlte evtl. die Kategorie
          setF((cur) => cur && mergeSources(cur, { image: a, late: extra.infos }));
        } catch (e) { errors.push(e); imageFailed = true; }
      }
      if (n === run.current) setAiBusy(null);
      if (n !== run.current || !errors.length) return;
      const first = errors[0] as { page?: boolean; message?: string };
      if (first?.page) return toast.show(`${first.message} Weiter nur mit dem Foto.`);
      const { code, status } = await kiError(first);
      // welcher Schritt scheiterte? Infos (Link/Screenshot/Etikett) oder die Fotoanalyse
      const step = readFailed && !imageFailed ? 'Infos konnten nicht gelesen werden – Vorschläge nur aus dem Foto. '
        : imageFailed && !readFailed && extra.infos.length ? 'Fotoanalyse fehlgeschlagen – Vorschläge nur aus den Infos. ' : '';
      toast.show(`${step}${kiMessage(code, status)} Felder bitte selbst prüfen.`);
    })();
  }

  async function save() {
    if (!f || !wardrobe) return;
    // KI läuft noch: erst hinweisen; zweites Tippen speichert ohne die ausstehenden Vorschläge
    if (aiBusy && !earlySave.current) {
      earlySave.current = true;
      return toast.show('Die KI ist gleich fertig. Nochmal „Fertig“ tippen, um ohne ihre Vorschläge zu speichern.');
    }
    const r = editChange(f, { isNew: true });
    if ('error' in r) return toast.show(r.error);
    // Leere Angaben weglassen → Standardwerte der Datenbank
    // (category bleibt: Spalte ist „not null“, leerer Text = ohne Kategorie)
    const data = Object.fromEntries(Object.entries(r.change).filter(([k, v]) => k === 'category' || (v !== null && v !== '')));
    setSaving(true);
    try {
      const newId = await createItem(wardrobe.id, data, picture, f.reversible || sides === 'back' ? picB : null);
      if (!f.isWish && setDraft.on && setDraft.members.length) await saveSet(null, [newId, ...setDraft.members], setDraft.name.trim() || null);
      await reload();
      close();
    } catch (e) { toast.show('Speichern fehlgeschlagen: ' + (e as Error).message); }
    finally { setSaving(false); }
  }

  const accent = t.dark ? t.accent : MAROON;

  if (step === 'form' && f) return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ItemEditor title={wish ? 'Neuer Wunsch' : 'Neues Teil'} form={f} onForm={(u) => setF((cur) => (typeof u === 'function' ? (cur ? u(cur) : cur) : u))} persons={wardrobe?.persons ?? []} meId={me?.id ?? null}
        wishlists={wardrobe?.wishlists ?? []} current={{ a: null, b: null }} pics={{ a: picture, b: picB }} back={sides === 'back'} onBack={(on) => setSides(on ? 'back' : f.reversible ? 'reversible' : 'one')}
        onPic={(side, p) => { if (side === 'b') return setPicB(p); setPicture(p); if (!p) { run.current++; setAiBusy(null); setF((cur) => cur && dropImageSuggestions(cur)); } }} hex={picture?.colors[0]?.h ?? null}
        saving={saving} aiBusy={aiBusy} onCancel={close} onSave={save} onChangePhoto={() => { run.current++; targetRef.current = 'a'; setAiBusy(null); setF((cur) => cur && dropImageSuggestions(cur)); setStep('start'); }} onError={(m) => toast.show(m)}
        set={{ draft: setDraft, onChange: setSetDraft, items: wardrobe?.items ?? [], currentId: null, setId: null }} />
      {toast.node}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.bar, STICKY, { paddingTop: insets.top + space.xs, backgroundColor: t.bg, borderBottomColor: t.hairline }]}>
        <Pressable accessibilityRole="button" onPress={close} hitSlop={10} style={s.barSide}><Text style={{ fontSize: 17, color: t.ink }}>Abbrechen</Text></Pressable>
        <Text style={{ fontFamily: DISPLAY, fontSize: 20, color: t.ink }}>{wish ? 'Neuer Wunsch' : 'Neues Teil'}</Text>
        <View style={s.barSide} />
      </View>

      <Page contentContainerStyle={{ alignItems: 'center', paddingBottom: bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={s.col}>
          {step === 'start' && (
            <>
              {canCutout ? (
                <PhotoPicker onPickMany={pickMany} label="Foto aufnehmen oder auswählen" style={{ marginTop: space.md }}>
                  <View style={[s.drop, { borderColor: t.hairline, backgroundColor: t.surface }]}>
                    <View style={[s.dropIcon, { backgroundColor: '#FF641F' }]}><Icon name="plus" size="large" color="#2a1a1d" /></View>
                    <Text style={[s.dropTitle, { color: t.ink }]}>Foto aufnehmen{'\n'}oder auswählen</Text>
                    <Text style={[s.hint, { color: t.inkMuted }]}>Das Teil wird automatisch freigestellt. Am besten liegt es ganz im Bild auf ruhigem Untergrund.</Text>
                    <Text style={[s.small, { color: t.inkMuted }]}>Backprint oder wendbar? Wähle gleich zwei Fotos: zuerst die Vorderseite, dann die Rückseite.</Text>
                  </View>
                </PhotoPicker>
              ) : (
                <Text style={[s.hint, { color: t.inkMuted, marginTop: space.lg }]}>Fotos aufnehmen geht vorerst nur in der Web-App.</Text>
              )}
              {canCutout && !cached && (
                <Text style={[s.small, { color: t.inkMuted }]}>Beim ersten Mal lädt das Freistellen einmalig 44 MB – am besten im WLAN. Danach geht es ohne Download.</Text>
              )}
              <View style={[s.web, { backgroundColor: t.surface, borderColor: t.hairline }]}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>Per Link aus einem Shop</Text>
                <View style={{ flexDirection: 'row', gap: space.xs }}>
                  <TextInput value={linkText} onChangeText={setLinkText} placeholder="Link einfügen" placeholderTextColor={t.inkMuted}
                    accessibilityLabel="Link zur Produktseite" inputMode="url" keyboardType="url" autoCapitalize="none" autoCorrect={false}
                    onSubmitEditing={() => openLink(linkText)} returnKeyType="go"
                    style={[s.input, { backgroundColor: t.surfaceSunken, borderColor: t.hairline, color: t.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} />
                  <Pressable onPress={() => openLink(linkText)} accessibilityRole="button" disabled={!linkText.trim()}
                    style={({ pressed }) => [s.go, { backgroundColor: accent, opacity: !linkText.trim() ? 0.4 : pressed ? 0.8 : 1 }]}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: t.dark ? t.bg : '#fff' }}>Laden</Text>
                  </Pressable>
                </View>
                <Text style={[s.small, { color: t.inkMuted, textAlign: 'left' }]}>Du wählst danach eines der Produktbilder. Beschreibung, Material und Pflege liest die KI von der Seite.</Text>
              </View>
              <Pressable onPress={() => toForm(null)} style={s.link} accessibilityRole="button">
                <Text style={{ fontSize: 16, color: accent, fontWeight: '600' }}>Ohne Foto weiter</Text>
              </Pressable>
            </>
          )}

          {step === 'web' && web && (
            <View style={{ gap: space.md, marginTop: space.md }}>
              <View style={{ gap: 4 }}>
                <Text style={[s.question, { color: t.ink }]}>{web.page ? 'Welches Bild?' : 'Seite wird geladen …'}</Text>
                <Text numberOfLines={1} style={[s.small, { color: t.inkMuted }]}>{web.page?.facts.name ?? web.page?.title ?? web.url}</Text>
              </View>
              {!web.page && !web.error && <ActivityIndicator color={accent} size="large" style={{ marginVertical: space.xl }} />}
              {!!web.error && (
                <View style={[s.note, { backgroundColor: t.surface, margin: 0 }]}>
                  <Text style={{ fontSize: 15, color: t.ink, textAlign: 'center' }}>{web.error}</Text>
                  <Text style={[s.small, { color: t.inkMuted }]}>Speichere das Produktbild aufs iPhone und wähle es als Foto aus – der Link wird trotzdem übernommen.</Text>
                </View>
              )}
              {!!web.page?.images.length && (
                <View style={s.grid}>
                  {web.page.images.map((src) => (
                    <Pressable key={src} onPress={() => pickWebImage(src)} disabled={!!web.loadingImg} accessibilityRole="button" accessibilityLabel="Dieses Bild nehmen"
                      style={({ pressed }) => [s.cell, { opacity: web.loadingImg && web.loadingImg !== src ? 0.4 : pressed ? 0.8 : 1 }]}>
                      <Image source={{ uri: src }} resizeMode="contain" style={StyleSheet.absoluteFill} />
                      <SizeBadge size={sizes[src]} best={best.has(src)} fill={t.fill} onFill={t.onFill} />
                      {web.loadingImg === src && <View style={[StyleSheet.absoluteFill, s.cellBusy]}><ActivityIndicator color={accent} /></View>}
                    </Pressable>
                  ))}
                </View>
              )}
              {best.size > 0 && (
                <Text style={[s.small, { color: t.inkMuted }]}>Bildgröße in Pixeln (Breite × Höhe) · farbig = größtes Bild</Text>
              )}
              <View style={{ gap: space.xs }}>
                <PhotoPicker onPick={pick} label="Stattdessen eigenes Foto"><Btn label="Eigenes Foto wählen" /></PhotoPicker>
                <Btn label="Anderer Link" onPress={() => { run.current++; setWeb(null); pageInfo.current = null; setStep('start'); }} />
              </View>
            </View>
          )}

          {step === 'work' && (
            <View style={{ gap: space.md, marginTop: space.md }}>
              <View style={[s.stage, { backgroundColor: t.surface }]}>
                {photo && <Image source={{ uri: photo.url }} resizeMode="contain" style={[StyleSheet.absoluteFill, { opacity: 0.45 }]} accessibilityLabel="Foto wird freigestellt" />}
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
              {cand ? (
                <View style={[s.stage, { backgroundColor: '#000', boxShadow: '0 2px 8px rgba(42,26,29,0.18)' }]}>
                  <Image source={{ uri: cand.preview }} resizeMode="contain" style={{ position: 'absolute', top: '6%', bottom: '6%', left: '6%', right: '6%' }} accessibilityLabel="Freigestelltes Bild" />
                  <MirrorButton picture={cand} onChange={(p) => { keep(p.preview); setCand(p); }} onError={(m) => toast.show(m)} />
                </View>
              ) : (
                <View style={[s.stage, { backgroundColor: t.surface }]}>
                  {photo && <Image source={{ uri: photo.url }} resizeMode="contain" style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} accessibilityLabel="Originalfoto" />}
                  <View style={[s.note, { backgroundColor: t.bg }]}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink, textAlign: 'center' }}>Freistellen hat nicht geklappt</Text>
                    {!!failure && <Text style={{ fontSize: 14, color: t.inkMuted, textAlign: 'center' }}>{failure}</Text>}
                  </View>
                </View>
              )}
              {cand && <Text style={[s.question, { color: t.ink }]}>{targetRef.current === 'b' ? (sides === 'back' ? 'Rückseite – passt das so?' : 'Seite B – passt das so?') : 'Passt das so?'}</Text>}
              {!!precutNote(cand) && <Text style={[s.small, { color: t.inkMuted, marginTop: -space.xs }]}>{precutNote(cand)}</Text>}
              <View style={{ gap: space.xs }}>
                {cand && <Btn primary label="Passt" onPress={() => accept(cand)} />}
                {!!precutNote(cand) && photo && <Btn label="Mit Modell freistellen" onPress={() => pick(photo.file, true)} />}
                <Btn label="Original behalten" onPress={() => keepOriginal()} />
                {!!web?.page?.images.length && <Btn label="Anderes Bild von der Seite" onPress={() => { run.current++; setStep(targetRef.current === 'b' ? 'side2' : 'web'); }} />}
                <PhotoPicker onPick={pick} label="Nochmal mit neuem Foto">
                  <Btn label={cand ? 'Nochmal (neues Foto)' : 'Anderes Foto'} />
                </PhotoPicker>
              </View>
            </View>
          )}

          {step === 'sides' && (
            <View style={{ gap: space.md, marginTop: space.md }}>
              {picture && (
                <View style={[s.mini, { alignSelf: 'center' }]}>
                  <Image source={{ uri: picture.preview }} resizeMode="contain" style={StyleSheet.absoluteFill} accessibilityLabel="Vorderseite" />
                </View>
              )}
              <View style={{ gap: 4 }}>
                <Text style={[s.question, { color: t.ink }]}>{queued.current ? 'Was zeigt das zweite Foto?' : 'Hat das Teil eine zweite Seite?'}</Text>
                <Text style={[s.small, { color: t.inkMuted }]}>Rückseite: z. B. ein Backprint – die KI sieht beide Seiten. Wendbar: beide Seiten sind tragbar und haben eigene Farben.</Text>
              </View>
              <View style={{ gap: space.xs }}>
                <SideBtn icon="backside" label="Rückseite (z. B. Backprint)" onPress={() => answerSides('back')} />
                <SideBtn icon="reversible" label="Wendbar" onPress={() => answerSides('reversible')} />
                <Btn label={queued.current ? 'Nur die Vorderseite verwenden' : 'Nein, nur eine Seite'} onPress={() => answerSides('one')} />
              </View>
            </View>
          )}

          {step === 'side2' && (
            <View style={{ gap: space.md, marginTop: space.md }}>
              <View style={{ gap: 4 }}>
                <Text style={[s.question, { color: t.ink }]}>{sides === 'back' ? 'Foto der Rückseite' : 'Foto der Seite B'}</Text>
                <Text style={[s.small, { color: t.inkMuted }]}>{web?.page?.images.length ? 'Wähle ein Bild von der Seite oder ein eigenes Foto.' : 'Wird wie die Vorderseite freigestellt.'}</Text>
              </View>
              {!!web?.page?.images.length && (
                <View style={s.grid}>
                  {web.page.images.map((src) => (
                    <Pressable key={src} onPress={() => pickWebImage(src)} disabled={!!web.loadingImg} accessibilityRole="button" accessibilityLabel="Dieses Bild als zweite Seite nehmen"
                      style={({ pressed }) => [s.cell, { opacity: web.loadingImg && web.loadingImg !== src ? 0.4 : pressed ? 0.8 : 1 }]}>
                      <Image source={{ uri: src }} resizeMode="contain" style={StyleSheet.absoluteFill} />
                      {web.loadingImg === src && <View style={[StyleSheet.absoluteFill, s.cellBusy]}><ActivityIndicator color={accent} /></View>}
                    </Pressable>
                  ))}
                </View>
              )}
              <View style={{ gap: space.xs }}>
                <PhotoPicker onPick={(file) => pick(file, false, 'b')} label="Foto der zweiten Seite"><Btn primary={!web?.page?.images.length} label={web?.page?.images.length ? 'Eigenes Foto wählen' : 'Foto aufnehmen oder auswählen'} /></PhotoPicker>
                <Btn label="Später in Bearbeiten ergänzen" onPress={() => { targetRef.current = 'a'; afterSides(picture); }} />
              </View>
            </View>
          )}

          {step === 'more' && (
            <View style={{ gap: space.md, marginTop: space.md }}>
              {picture && (
                <View style={[s.mini, { alignSelf: 'center' }]}>
                  <Image source={{ uri: picture.preview }} resizeMode="contain" style={StyleSheet.absoluteFill} accessibilityLabel="Gewähltes Bild" />
                </View>
              )}
              <View style={{ gap: 4 }}>
                <Text style={[s.question, { color: t.ink }]}>Hast du noch weitere Infos?</Text>
                <Text style={[s.small, { color: t.inkMuted }]}>Mit der Shopseite, einem Screenshot oder dem Etikett erkennt die KI Material, Farbe und Passform genauer.</Text>
              </View>
              <View style={[s.web, { backgroundColor: t.surface, borderColor: t.hairline, marginTop: 0 }]}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>Link einfügen</Text>
                <View style={{ flexDirection: 'row', gap: space.xs }}>
                  <TextInput value={moreLink} onChangeText={setMoreLink} placeholder="Link zur Produktseite" placeholderTextColor={t.inkMuted}
                    accessibilityLabel="Link zur Produktseite" inputMode="url" keyboardType="url" autoCapitalize="none" autoCorrect={false}
                    onSubmitEditing={moreFromLink} returnKeyType="go"
                    style={[s.input, { backgroundColor: t.surfaceSunken, borderColor: t.hairline, color: t.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} />
                  <Pressable onPress={moreFromLink} accessibilityRole="button" disabled={!moreLink.trim()}
                    style={({ pressed }) => [s.go, { backgroundColor: accent, opacity: !moreLink.trim() ? 0.4 : pressed ? 0.8 : 1 }]}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: t.dark ? t.bg : '#fff' }}>Laden</Text>
                  </Pressable>
                </View>
              </View>
              <View style={{ gap: space.xs }}>
                <PhotoPicker onPick={moreFromShot} label="Screenshot oder Etikett"><Btn label="Screenshot oder Etikett" /></PhotoPicker>
                <Btn label="Weiter ohne" onPress={() => toForm(picture)} />
              </View>
            </View>
          )}

        </View>
      </Page>
      {toast.node}
    </KeyboardAvoidingView>
  );
}

/** Antwort-Knopf mit Symbol (Rückseite / Wendbar) */
function SideBtn({ icon, label, onPress }: { icon: 'backside' | 'reversible'; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [s.btn, { backgroundColor: t.surface, borderColor: t.hairline, opacity: pressed ? 0.8 : 1, flexDirection: 'row', gap: 10 }]}>
      <Icon name={icon} size="row" color={t.ink} />
      <Text style={{ fontSize: 17, fontWeight: '600', color: t.ink }}>{label}</Text>
    </Pressable>
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

/** Bildgröße unten rechts auf dem Produktbild: Milchglas-Kapsel wie die Preis-Plakette der Wunsch-Kachel; größtes Bild gefüllt */
function SizeBadge({ size, best, fill, onFill }: { size: PixelSize | null | undefined; best: boolean; fill: string; onFill: string }) {
  const l = sizeLabel(size);
  if (!l) return null;
  return (
    <View pointerEvents="none" style={s.sizeBadge}>
      <Glass shape="pill" label={`${l.w} × ${l.h} Pixel${best ? ', größtes Bild' : ''}`} style={best ? { backgroundColor: fill } : undefined}>
        <Dims w={l.w} h={l.h} color={best ? onFill : undefined} />
      </Glass>
    </View>
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
  web: { gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 1, marginTop: space.md },
  input: { flex: 1, height: 48, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.md, fontSize: 16 },
  go: { height: 48, paddingHorizontal: space.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '31.5%', aspectRatio: 0.8, borderRadius: itemTile.radius, // wie die Schrank-Kachel → Plakette konzentrisch
  backgroundColor: '#fff', overflow: 'hidden' },
  sizeBadge: { position: 'absolute', right: itemTile.badge.inset, bottom: itemTile.badge.inset },
  cellBusy: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
  btn: { height: 52, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xs },
  mini: { width: 84, height: 84, borderRadius: 18, backgroundColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});

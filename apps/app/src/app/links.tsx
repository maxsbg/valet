// Links nachtragen (Max, 20.11.2026): Teile ohne Produktlink einzeln durchgehen. „Suchen“ öffnet die Google-Suche
// mit Marke + Name, Link einfügen → Seite auslesen (wie „Infos auslesen“) → Angaben als Vorschläge + Link speichern.
// „Später“ legt das Teil ans Ende. Ohne Link bleibt der Vermerk „Link fehlt“ (leeres Linkfeld, roter Punkt).
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { applyInfo, editChange, infoUsable, kiMessage, setField, shopFromLink } from '@valet/core';
import { Page, STICKY } from '@/components/Page';
import { ItemPicture } from '@/components/ItemPicture';
import { useToast } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useTheme, DISPLAY, space, radius, tile } from '@/lib/theme';
import { useBottomInset } from '@/lib/bottomInset';
import { updateItem } from '@/lib/item';
import { loadForm } from '@/lib/profileBatch';
import { kiError, readPage } from '@/lib/ki';
import { findUrl, loadProduct, productError } from '@/lib/produkt';

const MAROON = '#722638';
const MIN_PAGE_TEXT = 200;

export default function Links() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset();
  const toast = useToast(bottom + 40);
  const { item: first } = useLocalSearchParams<{ item?: string }>();
  const { wardrobe, reload } = useSession();
  const accent = t.dark ? t.accent : MAROON;
  const changed = useRef(false);
  const run = useRef(0);

  // Reihenfolge einmal festlegen (Teil aus der Detailseite zuerst); erledigte fallen raus, „Später“ ans Ende
  const initial = useMemo(() => {
    const ids = (wardrobe?.items ?? []).filter((i) => !i.isWish && i.link === null && i.status !== 'out' && i.status !== 'sold')
      .sort((a, b) => a.name.localeCompare(b.name, 'de')).map((i) => i.id);
    return first && ids.includes(first) ? [first, ...ids.filter((x) => x !== first)] : ids;
  }, [wardrobe?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // null = noch unverändert → Ausgangsliste (auch wenn der Schrank erst nach dem ersten Zeichnen kommt)
  const [own, setQueue] = useState<string[] | null>(null);
  const queue = own ?? initial;
  const [done, setDone] = useState(0);
  const [url, setUrl] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const current = queue[0] ?? null;
  const it = current ? wardrobe?.items.find((i) => i.id === current) : null;
  const next = (later: boolean) => {
    run.current++;
    setUrl(''); setState('idle'); setMessage('');
    setQueue((q) => { const cur = q ?? initial; return later ? [...cur.slice(1), cur[0]!] : cur.slice(1); });
  };
  const close = () => { run.current++; if (changed.current) reload(); if (router.canGoBack()) router.back(); else router.replace('/'); };

  const search = () => {
    if (!it) return;
    const q = [it.brand, it.name].filter(Boolean).join(' ');
    Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(q)}`).catch(() => {});
  };

  /** Link speichern; mit Info zusätzlich die ausgelesenen Angaben als Vorschläge */
  async function save(target: string, info?: Parameters<typeof applyInfo>[1]) {
    if (!current) return;
    const form = await loadForm(current);
    if (!form) throw new Error('load');
    const base = info ? applyInfo(form, info, 'page') : form;
    const withLink = { ...setField(base, 'link', target), shop: shopFromLink(base.shop, '', target) };
    const r = editChange(withLink);
    await updateItem(current, 'error' in r ? { link: target, shop: withLink.shop } : r.change);
    changed.current = true;
    setDone((n) => n + 1);
    next(false);
  }

  async function readAndSave() {
    const target = findUrl(url);
    if (!target) { setMessage('Kein Link gefunden.'); setState('error'); return; }
    const n = ++run.current;
    setState('busy'); setMessage('Seite wird geladen …');
    let page;
    try { page = await loadProduct(target); } catch (e) {
      if (n !== run.current) return;
      setMessage(productError(e)); setState('error'); return;
    }
    if (n !== run.current) return;
    if (page.blocked || page.text.length <= MIN_PAGE_TEXT) {
      setMessage(page.blocked ? 'Der Shop lässt die Seite nicht von außen laden.' : 'Auf der Seite steht zu wenig Text.'); setState('error'); return;
    }
    setMessage('Liest aus … das dauert ein paar Sekunden.');
    try {
      const info = await readPage(page.text, page.facts);
      if (n !== run.current) return;
      if (!infoUsable(info, 'page')) { setMessage('Auf der Seite war nichts Lesbares zu finden.'); setState('error'); return; }
      await save(target, info);
      toast.show('Gespeichert – Angaben als Vorschlag übernommen.');
    } catch (e) {
      if (n !== run.current) return;
      if ((e as Error)?.message === 'load') { setMessage('Speichern fehlgeschlagen. Bitte noch einmal versuchen.'); setState('error'); return; }
      const { code, status } = await kiError(e); setMessage(kiMessage(code, status)); setState('error');
    }
  }

  async function saveOnly() {
    const target = findUrl(url);
    if (!target) return;
    setState('busy'); setMessage('Speichert …');
    try { await save(target); toast.show('Link gespeichert.'); } catch { setMessage('Speichern fehlgeschlagen. Bitte noch einmal versuchen.'); setState('error'); }
  }

  const busy = state === 'busy';
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.bar, STICKY, { paddingTop: insets.top + space.xs, backgroundColor: t.bg, borderBottomColor: t.hairline }]}>
        <Pressable accessibilityRole="button" onPress={close} hitSlop={10} style={s.barSide}><Text style={{ fontSize: 17, color: t.ink }}>Fertig</Text></Pressable>
        <Text style={{ fontFamily: DISPLAY, fontSize: 20, color: t.ink }}>Links nachtragen</Text>
        <View style={[s.barSide, { alignItems: 'flex-end' }]}><Text style={{ fontSize: 13, color: t.inkMuted }}>{queue.length} ohne Link</Text></View>
      </View>

      <Page contentContainerStyle={{ alignItems: 'center', paddingBottom: bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={s.col}>
          {done > 0 && <Text style={[s.small, { color: t.inkMuted }]}>{done} Links gespeichert</Text>}
          {!it ? (
            <Text style={[s.text, { color: t.ink, textAlign: 'center', marginTop: space.lg }]}>Alle Teile haben einen Link.</Text>
          ) : (
            <>
              <View style={[s.stage, { backgroundColor: t.surface }]}>
                <ItemPicture uri={it.image ?? it.thumb} category={it.kind ?? it.category} color={it.hex ?? '#ccc'} inset="6%" />
              </View>
              <View style={{ gap: 2 }}>
                {!!it.brand && <Text style={{ fontSize: 14, color: t.inkMuted }}>{it.brand}</Text>}
                <Text style={{ fontSize: 20, fontWeight: '700', color: t.ink }}>{it.name}</Text>
              </View>

              <Pressable accessibilityRole="button" onPress={search}
                style={({ pressed }) => [s.btn, { backgroundColor: t.surface, borderColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>Bei Google suchen</Text>
              </Pressable>

              <TextInput value={url} onChangeText={(v) => { setUrl(v); if (state === 'error') setState('idle'); }} placeholder="Link zur Produktseite einfügen" placeholderTextColor={t.inkMuted}
                accessibilityLabel="Link zur Produktseite" inputMode="url" keyboardType="url" autoCapitalize="none" autoCorrect={false}
                onSubmitEditing={readAndSave} returnKeyType="go" editable={!busy}
                style={[s.input, { backgroundColor: t.surfaceSunken, borderColor: t.hairline, color: t.ink }]} />

              <Pressable accessibilityRole="button" disabled={!url.trim() || busy} onPress={readAndSave}
                style={({ pressed }) => [s.btn, { backgroundColor: accent, borderColor: accent, opacity: !url.trim() || busy ? 0.5 : pressed ? 0.8 : 1 }]}>
                {busy ? <ActivityIndicator color={t.dark ? t.bg : '#fff'} /> : <Text style={{ fontSize: 17, fontWeight: '600', color: t.dark ? t.bg : '#fff' }}>Auslesen und speichern</Text>}
              </Pressable>
              {!!message && <Text style={[s.small, { color: state === 'error' ? t.accent : t.inkMuted }]}>{message}</Text>}
              {state === 'error' && !!findUrl(url) && (
                <Pressable accessibilityRole="button" onPress={saveOnly}
                  style={({ pressed }) => [s.btn, { backgroundColor: t.surface, borderColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>Nur den Link speichern</Text>
                </Pressable>
              )}

              <Pressable accessibilityRole="button" onPress={() => next(true)} disabled={busy}
                style={({ pressed }) => [s.btn, { backgroundColor: 'transparent', borderColor: t.hairline, opacity: busy ? 0.5 : pressed ? 0.7 : 1 }]}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: t.inkMuted }}>Später</Text>
              </Pressable>
              <Text style={[s.small, { color: t.inkMuted }]}>Angaben von der Shopseite (Material, Marke, Preis …) landen als Vorschlag im Steckbrief. Ohne Link bleibt der Vermerk „Link fehlt“.</Text>
            </>
          )}
        </View>
      </Page>
      {toast.node}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingBottom: space.sm, borderBottomWidth: 1 },
  barSide: { minWidth: 90 },
  col: { width: '100%', maxWidth: 520, padding: space.md, gap: space.sm },
  text: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  stage: { height: 240, borderRadius: tile.radius, overflow: 'hidden' },
  btn: { height: 50, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  input: { height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
});

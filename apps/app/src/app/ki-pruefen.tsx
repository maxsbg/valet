// KI-Ergebnisse prüfen (Max, 20.11.2026): Der Stapellauf „Profile ergänzen“ analysiert im Hintergrund weiter,
// hier werden die Ergebnisse einzeln gezeigt – Übernehmen (alle Vorschläge bestätigen) oder Überspringen (ans Ende).
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { acceptReviewChange, analysisSections, skipReviewChange, type EditForm } from '@valet/core';
import { Page, STICKY } from '@/components/Page';
import { ItemPicture } from '@/components/ItemPicture';
import { useToast } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useTheme, DISPLAY, space, radius, tile } from '@/lib/theme';
import { useBottomInset } from '@/lib/bottomInset';
import { updateItem } from '@/lib/item';
import { loadForm, reviewQueue, startBatch, useBatch } from '@/lib/profileBatch';

const MAROON = '#722638';

export default function KiPruefen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset();
  const toast = useToast(bottom + 40);
  const { wardrobe, reload } = useSession();
  const b = useBatch();
  const accent = t.dark ? t.accent : MAROON;
  const [queue, setQueue] = useState<string[] | null>(null);
  const [loaded, setLoaded] = useState<{ id: string; form: EditForm | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(0);
  const changed = useRef(false);
  const running = b.phase === 'running' || b.phase === 'loading';

  // Liste laden; neue Ergebnisse des Laufs hinten anhängen, die eigene Reihenfolge bleibt
  const refresh = useCallback(() => {
    if (!wardrobe) return;
    reviewQueue(wardrobe.id).then((ids) => setQueue((cur) => {
      if (!cur) return ids;
      const keep = cur.filter((id) => ids.includes(id));
      return [...keep, ...ids.filter((id) => !keep.includes(id))];
    })).catch(() => toast.show('Laden fehlgeschlagen – bitte Verbindung prüfen.'));
  }, [wardrobe?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(refresh, [refresh, b.done]);

  const current = queue?.[0] ?? null;
  const loadCurrent = useCallback(() => {
    if (current) loadForm(current).then((f) => setLoaded({ id: current, form: f }));
  }, [current]);
  useEffect(() => { loadCurrent(); }, [loadCurrent]);
  const form = loaded && loaded.id === current ? loaded.form : null;
  // nach „Bearbeiten“ zurück: frisch laden
  useFocusEffect(useCallback(() => { if (current) loadCurrent(); }, [current])); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { if (changed.current) reload(); if (router.canGoBack()) router.back(); else router.replace('/statistik'); };

  async function act(kind: 'accept' | 'skip') {
    if (!form || !current || busy) return;
    setBusy(true);
    try {
      await updateItem(current, kind === 'accept' ? acceptReviewChange(form) : skipReviewChange(form.analysisBase));
      changed.current = true;
      setQueue((q) => (q ? (kind === 'accept' ? q.slice(1) : [...q.slice(1), q[0]!]) : q));
      if (kind === 'accept') setChecked((n) => n + 1);
    } catch { toast.show('Speichern fehlgeschlagen. Bitte noch einmal versuchen.'); }
    finally { setBusy(false); }
  }

  const tileOf = current ? wardrobe?.items.find((i) => i.id === current) : null;
  const sections = form ? analysisSections(form) : [];
  const pending = form?.aiPending.length ?? 0;
  const runText = running
    ? (b.phase === 'loading' ? 'Analyse startet …' : `Analyse läuft: ${b.processed} von ${b.total}`)
    : b.phase === 'paused' ? b.message : '';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.bar, STICKY, { paddingTop: insets.top + space.xs, backgroundColor: t.bg, borderBottomColor: t.hairline }]}>
        <Pressable accessibilityRole="button" onPress={close} hitSlop={10} style={s.barSide}><Text style={{ fontSize: 17, color: t.ink }}>Fertig</Text></Pressable>
        <Text style={{ fontFamily: DISPLAY, fontSize: 20, color: t.ink }}>KI-Ergebnisse</Text>
        <View style={[s.barSide, { alignItems: 'flex-end' }]}>
          {queue && <Text style={{ fontSize: 13, color: t.inkMuted }}>{queue.length} offen</Text>}
        </View>
      </View>

      <Page contentContainerStyle={{ alignItems: 'center', paddingBottom: bottom + space.xxl }}>
        <View style={s.col}>
          {!!runText && <Text style={[s.small, { color: t.inkMuted }]}>{runText}</Text>}
          {checked > 0 && <Text style={[s.small, { color: t.inkMuted }]}>{checked} übernommen</Text>}

          {queue == null ? <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
            : !current ? (
              <View style={[s.empty, { backgroundColor: t.surface }]}>
                {running ? <ActivityIndicator color={accent} /> : null}
                <Text style={[s.text, { color: t.ink, textAlign: 'center' }]}>
                  {running ? 'Warte auf das nächste Ergebnis …' : 'Keine offenen Ergebnisse.'}
                </Text>
                {!running && wardrobe && (
                  <Pressable accessibilityRole="button" onPress={() => startBatch(wardrobe.id)} style={({ pressed }) => [s.btn, { backgroundColor: t.surface, borderColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>Analyse starten bzw. fortsetzen</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                <View style={[s.stage, { backgroundColor: t.surface }]}>
                  <ItemPicture uri={tileOf?.image ?? tileOf?.thumb ?? null} category={tileOf?.kind ?? tileOf?.category ?? ''} color={tileOf?.hex ?? '#ccc'} inset="6%" />
                </View>
                <View style={{ gap: 2 }}>
                  {!!form?.brand && <Text style={{ fontSize: 14, color: t.inkMuted }}>{form.brand}</Text>}
                  <Text style={{ fontSize: 20, fontWeight: '700', color: t.ink }}>{form?.name ?? tileOf?.name ?? ''}</Text>
                  {form && <Text style={{ fontSize: 13, color: t.inkMuted }}>{pending ? `${pending} ${pending === 1 ? 'Feld' : 'Felder'} als Vorschlag ergänzt, dazu das KI-Profil.` : 'KI-Profil ergänzt, keine leeren Felder vorgeschlagen.'}</Text>}
                </View>

                {!form ? <ActivityIndicator color={accent} /> : sections.map((sec) => (
                  <View key={sec.key} style={[s.card, { backgroundColor: t.surface }]}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: sec.weak ? t.inkMuted : t.ink }}>{sec.title}{sec.weak ? ' (unsicher)' : ''}</Text>
                    {sec.rows.map((r) => (
                      <Text key={r.label} style={{ fontSize: 15, lineHeight: 21, color: t.ink }}>
                        <Text style={{ color: t.inkMuted }}>{r.label}: </Text>{r.value}
                      </Text>
                    ))}
                  </View>
                ))}

                <View style={{ gap: space.sm, marginTop: space.sm }}>
                  <Pressable accessibilityRole="button" disabled={!form || busy} onPress={() => act('accept')}
                    style={({ pressed }) => [s.btn, { backgroundColor: accent, borderColor: accent, opacity: !form || busy ? 0.5 : pressed ? 0.8 : 1 }]}>
                    <Text style={{ fontSize: 17, fontWeight: '600', color: t.dark ? t.bg : '#fff' }}>Übernehmen</Text>
                  </Pressable>
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <Pressable accessibilityRole="button" disabled={!form || busy} onPress={() => act('skip')}
                      style={({ pressed }) => [s.btn, s.half, { backgroundColor: t.surface, borderColor: t.hairline, opacity: !form || busy ? 0.5 : pressed ? 0.7 : 1 }]}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>Überspringen</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" disabled={!current} onPress={() => router.push(`/bearbeiten/${current}`)}
                      style={({ pressed }) => [s.btn, s.half, { backgroundColor: t.surface, borderColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>Bearbeiten</Text>
                    </Pressable>
                  </View>
                  <Text style={[s.small, { color: t.inkMuted }]}>Übernehmen bestätigt alle Vorschläge. Überspringen legt das Teil ans Ende der Liste.</Text>
                </View>
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
  stage: { height: 280, borderRadius: tile.radius, overflow: 'hidden' },
  card: { borderRadius: radius.md, padding: 14, gap: 4 },
  empty: { borderRadius: radius.md, padding: 24, gap: 14, alignItems: 'center', marginTop: space.md },
  btn: { height: 50, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  half: { flex: 1 },
});

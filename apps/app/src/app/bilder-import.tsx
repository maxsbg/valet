import { useBottomInset } from '@/lib/bottomInset';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoPicker } from '@/components/PhotoPicker';
import { useSession } from '@/lib/session';
import { useTheme, DISPLAY, space, radius } from '@/lib/theme';
import { cleanupTransfer, prepareStorage, prepareZip, runImport, type Prepared } from '@/lib/legacyImages';

type Step = 'start' | 'reading' | 'ready' | 'running' | 'done';
const MAROON = '#722638';

/**
 * Bilder aus dem alten Valet übernehmen.
 * Ablauf: im alten Valet „Direkt in die neue App übertragen“ → hier „Übertragene Bilder übernehmen“ → Übersicht → Übernehmen.
 * Ausweichweg: ZIP-Export aus dem alten Valet wählen (nur, wenn dort das Speichern als Datei geht).
 * Seiten, die schon ein Vorschaubild haben, bleiben unverändert; der Import kann also wiederholt werden.
 */
export default function BilderImport() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset();
  const { wardrobe, reload } = useSession();
  const accent = t.dark ? t.accent : MAROON;

  const [step, setStep] = useState<Step>('start');
  const [error, setError] = useState<string | null>(null);
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [result, setResult] = useState<{ ok: number; failed: { name: string; error: string }[] } | null>(null);
  const stop = useRef(false);

  useEffect(() => () => { stop.current = true; }, []);

  const close = () => (step === 'running' ? (stop.current = true) : router.canGoBack() ? router.back() : router.replace('/'));

  async function load(how: () => Promise<Prepared>) {
    setError(null); setPrep(null); setResult(null); setStep('reading');
    try { setPrep(await how()); setStep('ready'); }
    catch (e) { setError((e as Error)?.message || String(e)); setStep('start'); }
  }
  const fromStorage = () => wardrobe && load(() => prepareStorage(wardrobe.id));
  const pick = (file: File) => wardrobe && load(() => prepareZip(wardrobe.id, file));

  async function start() {
    if (!wardrobe || !prep) return;
    stop.current = false;
    setStep('running'); setProgress({ done: 0, total: prep.plan.jobs.length, failed: 0 });
    const lock = await wakeLock();
    try {
      const r = await runImport(wardrobe.id, prep, (done, total, failed) => setProgress({ done, total, failed }), () => stop.current);
      setResult({ ok: r.ok, failed: r.failed.map((f) => ({ name: f.job.legacyImageId, error: f.error })) });
      if (prep.source === 'storage' && r.ok) await cleanupTransfer(wardrobe.id).catch(() => 0); // Zwischendateien weg
      await reload();
    } catch (e) { setError((e as Error)?.message || String(e)); }
    finally { lock?.release().catch(() => {}); setStep('done'); }
  }

  const plan = prep?.plan;
  const pct = progress.total ? progress.done / progress.total : 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.bar, { paddingTop: insets.top + space.xs, borderBottomColor: t.hairline }]}>
        <Pressable onPress={close} hitSlop={10} style={s.barSide}>
          <Text style={{ fontSize: 17, color: t.ink }}>{step === 'running' ? 'Anhalten' : step === 'done' ? 'Fertig' : 'Abbrechen'}</Text>
        </Pressable>
        <Text style={{ fontFamily: DISPLAY, fontSize: 20, color: t.ink }}>Alte Bilder</Text>
        <View style={s.barSide} />
      </View>

      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: bottom + space.xxl }}>
        <View style={s.col}>
          {(step === 'start' || step === 'reading') && (
            <>
              <Text style={[s.text, { color: t.ink }]}>Übernimmt die Bilder aus dem alten Valet und legt für jedes Teil ein Vorschaubild für die Kacheln an.</Text>
              <View style={[s.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
                <Text style={[s.h, { color: t.ink }]}>So geht’s</Text>
                <Text style={[s.text, { color: t.ink }]}>1. Im alten Valet: Zahnrad → „Kleiderschrank exportieren“ → „Direkt in die neue App übertragen“ (mit deinem Login der neuen App).</Text>
                <Text style={[s.text, { color: t.ink }]}>2. Wenn dort „Fertig“ steht: hier „Übertragene Bilder übernehmen“.</Text>
              </View>
              {Platform.OS === 'web' ? (
                <>
                  <Btn primary label={step === 'reading' ? 'Wird geprüft …' : 'Übertragene Bilder übernehmen'} onPress={step === 'reading' ? undefined : fromStorage} />
                  <PhotoPicker onPick={pick} label="Stattdessen ZIP-Datei wählen" accept=".zip,application/zip,application/x-zip-compressed">
                    <Btn label="Stattdessen ZIP-Datei wählen" />
                  </PhotoPicker>
                </>
              ) : (
                <Text style={[s.small, { color: t.inkMuted }]}>Der Import geht vorerst nur in der Web-App.</Text>
              )}
              {step === 'reading' && <ActivityIndicator color={accent} />}
              {!!error && <Text style={[s.text, { color: '#b23a3a', textAlign: 'center' }]}>{error}</Text>}
            </>
          )}

          {step === 'ready' && prep && plan && (
            <>
              <View style={[s.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
                <Row label={prep.source === 'zip' ? 'Bilder in der Datei' : 'Übertragene Bilder'} value={prep.imageCount} />
                <Row label="Werden übernommen" value={plan.jobs.length} strong />
                <Row label="Schon vorhanden" value={plan.done} />
                {plan.missing.length > 0 && <Row label="Fehlen" value={plan.missing.length} />}
                {plan.unmatched.length > 0 && <Row label="Ohne passendes Teil" value={plan.unmatched.length} />}
              </View>
              {plan.missing.length > 0 && (
                <Text style={[s.small, { color: t.inkMuted }]}>„Fehlen“: Diese Teile verweisen auf Bilder, die nicht übertragen wurden (z. B. im alten Valet nicht mehr ladbar). Sie zeigen weiter die Silhouette.</Text>
              )}
              {plan.unmatched.length > 0 && (
                <Text style={[s.small, { color: t.inkMuted }]}>„Ohne passendes Teil“: Teile, die nach dem letzten Datenimport im alten Valet angelegt wurden. Sie kommen mit dem frischen Datenimport vor dem Umstieg.</Text>
              )}
              {plan.jobs.length > 0 ? (
                <>
                  <Btn primary label={`${plan.jobs.length} Bilder übernehmen`} onPress={start} />
                  <Text style={[s.small, { color: t.inkMuted }]}>Dauert etwa {Math.max(1, Math.round(plan.jobs.length / 60))} Minute(n). Bitte die Seite geöffnet lassen, am besten im WLAN.</Text>
                </>
              ) : (
                <Text style={[s.text, { color: t.ink, textAlign: 'center' }]}>Es gibt nichts zu übernehmen – alle passenden Teile haben schon ein Bild.</Text>
              )}
              <Btn label="Zurück" onPress={() => setStep('start')} />
            </>
          )}

          {step === 'running' && (
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <ActivityIndicator color={accent} size="large" />
              <Text style={[s.text, { color: t.ink, textAlign: 'center' }]}>Bild {Math.min(progress.done + 1, progress.total)} von {progress.total} …</Text>
              <View style={[s.track, { backgroundColor: t.surfaceSunken }]}>
                <View style={[s.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: accent }]} />
              </View>
              {progress.failed > 0 && <Text style={[s.small, { color: '#b23a3a' }]}>{progress.failed} Fehler bisher</Text>}
              <Text style={[s.small, { color: t.inkMuted }]}>Bitte die Seite geöffnet lassen. „Anhalten“ beendet nach dem aktuellen Bild; ein neuer Start macht dort weiter.</Text>
            </View>
          )}

          {step === 'done' && (
            <>
              <Text style={[s.title, { color: t.ink }]}>{result && !result.failed.length ? 'Fertig' : 'Beendet'}</Text>
              {result && <Text style={[s.text, { color: t.ink, textAlign: 'center' }]}>{result.ok} Bilder übernommen{result.failed.length ? `, ${result.failed.length} fehlgeschlagen` : ''}.</Text>}
              {!!error && <Text style={[s.text, { color: '#b23a3a', textAlign: 'center' }]}>{error}</Text>}
              {result && result.failed.length > 0 && (
                <View style={[s.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
                  {result.failed.slice(0, 12).map((f) => (
                    <Text key={f.name} style={[s.small, { color: t.inkMuted, textAlign: 'left' }]}>{f.name}: {f.error}</Text>
                  ))}
                  {result.failed.length > 12 && <Text style={[s.small, { color: t.inkMuted }]}>… und {result.failed.length - 12} weitere</Text>}
                </View>
              )}
              {prep && (result?.failed.length || (result && result.ok < prep.plan.jobs.length)) ? (
                <Btn primary label="Nochmal versuchen" onPress={() => setStep('start')} />
              ) : null}
              <Btn label="Zum Schrank" onPress={() => router.replace('/')} />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** Bildschirm während des Imports wach halten (Safari ab iOS 16.4), sonst egal */
async function wakeLock(): Promise<{ release: () => Promise<void> } | null> {
  try {
    const nav = (globalThis as { navigator?: { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } } }).navigator;
    return (await nav?.wakeLock?.request('screen')) ?? null;
  } catch { return null; }
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ fontSize: 16, color: t.ink, fontWeight: strong ? '700' : '400' }}>{label}</Text>
      <Text style={{ fontSize: 16, color: t.ink, fontWeight: strong ? '700' : '400' }}>{value}</Text>
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
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingBottom: space.sm, borderBottomWidth: 1 },
  barSide: { minWidth: 90 },
  col: { width: '100%', maxWidth: 520, padding: space.md, gap: space.md },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: 6 },
  h: { fontSize: 17, fontWeight: '700' },
  title: { fontFamily: DISPLAY, fontSize: 26, textAlign: 'center', marginTop: space.lg },
  text: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  btn: { height: 52, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

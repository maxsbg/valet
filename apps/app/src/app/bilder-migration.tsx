import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { migrateItemImagesToWebp, type ImageMigrationProgress, type ImageMigrationResult } from '@/lib/item';
import { useTheme } from '@/lib/theme';

const initial: ImageMigrationProgress = { total: 0, done: 0, migrated: 0, skipped: 0, cleanupPending: 0, currentPath: null };

export default function BilderMigration() {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(initial);
  const [result, setResult] = useState<ImageMigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(initial);
    try {
      setResult(await migrateItemImagesToWebp(setProgress));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pct = progress.total ? Math.round(progress.done / progress.total * 100) : 0;
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 16, backgroundColor: t.bg }}>
      <Text style={{ color: t.text, fontSize: 24, fontWeight: '600' }}>Bilder auf WebP umstellen</Text>
      <Text style={{ color: t.text, lineHeight: 22 }}>
        Die Ordnerstruktur und Dateinamen bleiben gleich. Nur die Endung wechselt zu .webp.
        Jede Datei wird erst nach erfolgreicher Formatprüfung in der Datenbank umgestellt;
        die alte Datei wird erst danach gelöscht.
      </Text>
      <Text style={{ color: t.text, lineHeight: 22 }}>
        Die Migration betrifft nur Bilder, für die dein angemeldetes Konto Lese- und Schreibrechte hat.
        Bei Fehlern bleiben die bisherigen PNG-Dateien erhalten. Du kannst die Migration erneut starten.
      </Text>
      <Pressable
        disabled={busy}
        onPress={run}
        style={{ backgroundColor: t.accent, padding: 14, borderRadius: 12, alignItems: 'center', opacity: busy ? 0.6 : 1 }}
      >
        {busy ? <ActivityIndicator color={t.bg} /> : <Text style={{ color: t.bg, fontWeight: '600' }}>Migration starten</Text>}
      </Pressable>
      {(busy || result) && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: t.text }}>{progress.done} von {progress.total} Einträgen geprüft ({pct} %)</Text>
          <View style={{ height: 8, borderRadius: 8, backgroundColor: t.line, overflow: 'hidden' }}>
            <View style={{ height: 8, width: `${pct}%`, backgroundColor: t.accent }} />
          </View>
          <Text style={{ color: t.text }}>Umgestellt: {progress.migrated} · Bereits WebP: {progress.skipped} · Alte Dateien noch aufzuräumen: {progress.cleanupPending}</Text>
          {progress.currentPath && <Text numberOfLines={2} style={{ color: t.muted, fontSize: 12 }}>{progress.currentPath}</Text>}
        </View>
      )}
      {result && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: t.text, fontWeight: '600' }}>Migration abgeschlossen</Text>
          <Text style={{ color: t.text }}>Erfolgreich: {result.migrated} · Übersprungen: {result.skipped} · Fehler: {result.failed.length}</Text>
          {result.failed.slice(0, 20).map((f, i) => <Text key={`${f.path}-${i}`} style={{ color: t.danger, fontSize: 12 }}>{f.path}: {f.error}</Text>)}
          {result.failed.length > 20 && <Text style={{ color: t.text }}>Weitere Fehler: {result.failed.length - 20}</Text>}
        </View>
      )}
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
    </ScrollView>
  );
}

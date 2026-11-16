import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { Sheet, SheetButton } from './Sheet';
import { shareFile, type Exported } from '@/lib/share';
import { useTheme, space } from '@/lib/theme';

/**
 * Bild exportieren: erst erstellen (Vorschau), dann „Teilen“ – das Teilen-Menü muss direkt aus einem Tippen kommen,
 * sonst blockiert Safari es. Im Menü des iPhones gibt es „Bild sichern“.
 */
export function ExportSheet({ open, onClose, title, name, make }: {
  open: boolean; onClose: () => void; title: string; name: string; make: () => Promise<Blob | Exported>;
}) {
  const t = useTheme();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setBlob(null); setErr(null); setUrl(null); setWarning(null);
    make().then((r) => {
      if (!alive) return;
      const b = r instanceof Blob ? r : r.blob;
      setBlob(b); setUrl(URL.createObjectURL(b));
      if (!(r instanceof Blob) && r.warning) setWarning(r.warning);
    }).catch((e) => alive && setErr((e as Error).message || 'Bild konnte nicht erstellt werden.'));
    return () => { alive = false; };
  }, [open, run]); // eslint-disable-line react-hooks/exhaustive-deps
  const share = () => {
    if (!blob) return;
    shareFile(blob, name).then((ok) => ok && onClose()).catch((e) => setErr('Teilen fehlgeschlagen: ' + (e as Error).message));
  };
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return (
    <Sheet open={open} onClose={onClose} title={title}
      footer={<>
        <SheetButton label="Schließen" onPress={onClose} />
        {err && !blob
          ? <SheetButton primary label="Erneut versuchen" onPress={() => setRun((n) => n + 1)} />
          : <SheetButton primary label={blob ? 'Teilen / Sichern' : 'Wird erstellt …'} onPress={share} />}
      </>}>
      <View style={{ height: 300, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface }}>
        {err && !blob ? <Text style={{ fontSize: 15, color: '#C8102E', padding: space.md, textAlign: 'center' }}>{err}</Text>
          : url ? <Image source={{ uri: url }} resizeMode="contain" style={{ width: '100%', height: '100%' }} accessibilityLabel="Vorschau" />
          : <ActivityIndicator color={t.accent} />}
      </View>
      {!!warning && <Text style={{ fontSize: 13, color: t.inkMuted, marginTop: space.sm, textAlign: 'center' }}>{warning}</Text>}
      {!!err && !!blob && <Text style={{ fontSize: 13, color: '#C8102E', marginTop: space.sm, textAlign: 'center' }}>{err}</Text>}
    </Sheet>
  );
}

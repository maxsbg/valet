import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { Sheet, SheetButton } from './Sheet';
import { shareFile } from '@/lib/share';
import { useTheme, space } from '@/lib/theme';

/**
 * Bild exportieren: erst erstellen (Vorschau), dann „Teilen“ – das Teilen-Menü muss direkt aus einem Tippen kommen,
 * sonst blockiert Safari es. Im Menü des iPhones gibt es „Bild sichern“.
 */
export function ExportSheet({ open, onClose, title, name, make }: {
  open: boolean; onClose: () => void; title: string; name: string; make: () => Promise<Blob>;
}) {
  const t = useTheme();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setBlob(null); setErr(null); setUrl(null);
    make().then((b) => { if (alive) { setBlob(b); setUrl(URL.createObjectURL(b)); } })
      .catch((e) => alive && setErr((e as Error).message));
    return () => { alive = false; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return (
    <Sheet open={open} onClose={onClose} title={title}
      footer={<>
        <SheetButton label="Schließen" onPress={onClose} />
        <SheetButton primary label={blob ? 'Teilen / Sichern' : 'Wird erstellt …'} onPress={() => { if (blob) shareFile(blob, name).then((ok) => ok && onClose()); }} />
      </>}>
      <View style={{ height: 300, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface }}>
        {err ? <Text style={{ fontSize: 15, color: '#C8102E', padding: space.md, textAlign: 'center' }}>{err}</Text>
          : url ? <Image source={{ uri: url }} resizeMode="contain" style={{ width: '100%', height: '100%' }} accessibilityLabel="Vorschau" />
          : <ActivityIndicator color={t.accent} />}
      </View>
    </Sheet>
  );
}

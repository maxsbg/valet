// Statistik → Werkzeuge → „Farbanteile nachtragen“ (Max 21.11.2026). Nur sichtbar, solange etwas offen ist oder läuft.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/lib/session';
import { useTheme, radius } from '@/lib/theme';
import { countShares, startShares, stopShares, useShares } from '@/lib/colorShareBatch';

export function ColorShareBatch() {
  const t = useTheme();
  const { wardrobe } = useSession();
  const b = useShares();
  const [count, setCount] = useState<number | null>(null);
  const running = b.phase === 'running' || b.phase === 'loading';
  useEffect(() => {
    if (!wardrobe) return;
    countShares(wardrobe.id).then(setCount).catch(() => setCount(null));
  }, [wardrobe?.id, b.phase, b.done]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!wardrobe || (!running && b.phase === 'idle' && !count)) return null;
  const status = running
    ? (b.phase === 'loading' ? 'Teile werden geladen …' : `${b.processed} von ${b.total} · ${b.done} ergänzt${b.failed ? ` · ${b.failed} fehlgeschlagen` : ''}`)
    : b.message || `${count} mehrfarbige ${count === 1 ? 'Teil' : 'Teile'} ohne Farbanteile.`;
  const canStart = !running && (count ?? 0) > 0;
  return (
    <View style={[s.panel, { borderColor: t.hairline, backgroundColor: t.surface }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: t.ink }}>Farbanteile nachtragen</Text>
          <Text style={{ fontSize: 14, color: t.inkMuted }}>{status}</Text>
        </View>
        {running && <ActivityIndicator color={t.accent} />}
        <Pressable accessibilityRole="button" disabled={!running && !canStart} onPress={() => (running ? stopShares() : startShares(wardrobe.id))}
          style={({ pressed }) => [s.btn, { backgroundColor: t.actionText + '24', opacity: !running && !canStart ? 0.4 : pressed ? 0.6 : 1 }]}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: t.actionText }}>{running ? 'Anhalten' : b.phase === 'paused' ? 'Weiter' : 'Starten'}</Text>
        </Pressable>
      </View>
      <Text style={{ fontSize: 12, color: t.inkMuted, marginTop: 8 }}>
        Die KI schätzt nur, wie viel Fläche jede Farbe einnimmt (z. B. Schwarz 95 %, Rot 5 %). Profil und Farben bleiben unverändert, nichts zu prüfen. Zählt zur gleichen Tagesgrenze wie „Profile ergänzen“. App dabei geöffnet lassen.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: radius.md, padding: 14, marginBottom: 14 },
  btn: { height: 38, borderRadius: 19, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
});

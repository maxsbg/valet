// Statistik → Werkzeuge → „Profile ergänzen“ (KI-Analyse v2, Spec 8). Schlicht: Stand, Start/Anhalten, Ergebnis.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BATCH_PER_DAY, BATCH_PER_MIN } from '@valet/core';
import { useSession } from '@/lib/session';
import { useTheme, radius } from '@/lib/theme';
import { countBatch, startBatch, stopBatch, usedToday, useBatch } from '@/lib/profileBatch';

export function ProfileBatch() {
  const t = useTheme();
  const { wardrobe, reload } = useSession();
  const b = useBatch();
  const [count, setCount] = useState<{ pending: number; skipped: number } | null>(null);
  const running = b.phase === 'running' || b.phase === 'loading';
  useEffect(() => {
    if (!wardrobe || running) return;
    countBatch(wardrobe.id).then(setCount).catch(() => setCount(null));
  }, [wardrobe?.id, b.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  // nach einem Lauf mit Ergänzungen den Schrank neu laden (Profile, Schein, Form wie nach „Neu analysieren“)
  useEffect(() => {
    if ((b.phase === 'done' || b.phase === 'paused') && b.done > 0) reload();
  }, [b.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!wardrobe) return null;
  const left = Math.max(0, BATCH_PER_DAY - usedToday());
  const status = running
    ? (b.phase === 'loading' ? 'Teile werden geladen …' : `${b.processed} von ${b.total} · ${b.done} ergänzt${b.failed ? ` · ${b.failed} fehlgeschlagen` : ''}`)
    : b.message || (count ? (count.pending ? `${count.pending} ${count.pending === 1 ? 'Teil' : 'Teile'} ohne KI-Profil.` : 'Alle Teile haben ein KI-Profil.') + (count.skipped ? ` ${count.skipped} übersprungen (3 Fehlversuche).` : '') : '');
  const canStart = !running && (count?.pending ?? 1) > 0 && left > 0;
  return (
    <View style={[s.panel, { borderColor: t.hairline, backgroundColor: t.surface }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: t.ink }}>Profile ergänzen</Text>
          <Text style={{ fontSize: 14, color: t.inkMuted }}>{status}</Text>
        </View>
        {running && <ActivityIndicator color={t.accent} />}
        <Pressable accessibilityRole="button" disabled={!running && !canStart} onPress={() => (running ? stopBatch() : startBatch(wardrobe.id))}
          style={({ pressed }) => [s.btn, { backgroundColor: t.actionText + '24', opacity: !running && !canStart ? 0.4 : pressed ? 0.6 : 1 }]}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: t.actionText }}>{running ? 'Anhalten' : b.phase === 'paused' ? 'Weiter' : 'Starten'}</Text>
        </Pressable>
      </View>
      <Text style={{ fontSize: 12, color: t.inkMuted, marginTop: 8 }}>
        Die KI ergänzt nur das Profil, der Steckbrief bleibt unverändert. Höchstens {BATCH_PER_MIN} Teile je Minute, {BATCH_PER_DAY} je Tag (heute noch {left}). App dabei geöffnet lassen.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: radius.md, padding: 14, marginBottom: 14 },
  btn: { height: 38, borderRadius: 19, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
});

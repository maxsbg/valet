// Blätter der Detailseite: Reservieren, „Stimmt das?“ für geschätzte Pflege (Spec 4), KI-Analyse (Analyse v2, Spec 14)
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { CARE, analysisNote, analysisSections, careLabel, colorCheck, hasProfile, reanalysisChange, type CareGroup, type CareValue, type EditForm } from '@valet/core';
import { analysisImage, updateItem } from '@/lib/item';
import { analyzeStored, kiError } from '@/lib/ki';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/lib/theme';
import { todayLocal, type Person } from '@/lib/wardrobe';
import { fmtShort } from '@/lib/outfits';
import { Sheet } from '@/components/Sheet';
import { Capsule, DateField, FieldLabel, Hint, Monogram, SheetHead, Wrap } from './parts';

// ---------- Reservieren ----------

const addDays = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); return todayLocal(new Date(y!, m! - 1, d! + n)); };
/** Nächstes Wochenende (Sa–So); am Sonntag nur heute */
function weekend(iso: string): [number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(y!, m! - 1, d!).getDay();
  return wd === 0 ? [0, 0] : [6 - wd, 7 - wd];
}

export type HoldRow = { id: string; personId: string | null; from: string; to: string; planned: boolean };

export function ReserveSheet({ open, persons, meId, holds, onSave, onClose }: {
  open: boolean; persons: Person[]; meId: string | null; holds: HoldRow[];
  onSave: (who: string | null, from: string, to: string) => Promise<void>; onClose: () => void;
}) {
  const today = todayLocal();
  const [who, setWho] = useState<string | null>(meId);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setWho(meId); setFrom(today); setTo(today); setError(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const other = holds.filter((h) => h.personId !== who && h.to >= from && h.from <= to);
  const text = (h: HoldRow) => `${h.from === h.to ? fmtShort(h.from) : `${fmtShort(h.from)} – ${fmtShort(h.to)}`}${persons.find((p) => p.id === h.personId) ? ` · ${persons.find((p) => p.id === h.personId)!.name}` : ''}`;
  async function done() {
    if (to < from) return setError('„Bis“ liegt vor „Von“.');
    if (to < today) return setError('Der Zeitraum liegt in der Vergangenheit.');
    setBusy(true);
    try { await onSave(who, from, to); } catch (e) { setError('Speichern fehlgeschlagen: ' + (e as Error).message); } finally { setBusy(false); }
  }
  const quick: [string, number, number][] = [['Heute', 0, 0], ['Morgen', 1, 1], ['Wochenende', ...weekend(today)], ['7 Tage', 0, 6]];
  return (
    <Sheet open={open} onClose={onClose} title="Reservieren" head={<SheetHead title="Reservieren" onCancel={onClose} onDone={done} doneDisabled={busy} />}>
      <View style={{ gap: 14, paddingTop: 14 }}>
        <FieldLabel>Für</FieldLabel>
        <Wrap>{persons.map((p) => <Capsule key={p.id} label={p.id === meId ? `${p.name} (du)` : p.name} selected={who === p.id} leading={<Monogram person={p} />} onPress={() => setWho(p.id)} />)}</Wrap>
        <FieldLabel>Schnell</FieldLabel>
        <Wrap>{quick.map(([l, a, b]) => {
          const f = addDays(today, a), e = addDays(today, b);
          return <Capsule key={l} label={l} selected={from === f && to === e} onPress={() => { setFrom(f); setTo(e); setError(null); }} />;
        })}</Wrap>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <DateField label="Von" value={from} onChange={(v) => { if (v) { setFrom(v); if (to < v) setTo(v); } setError(null); }} />
          <DateField label="Bis" value={to} onChange={(v) => { if (v) setTo(v); setError(null); }} />
        </View>
        {other.length > 0 && <Hint accent>Schon reserviert: {other.map(text).join(', ')}</Hint>}
        {error && <Hint accent>{error}</Hint>}
      </View>
    </Sheet>
  );
}

// ---------- „Stimmt das?“ (geschätzte Pflege) ----------

export function CareConfirmSheet({ group, value, onConfirm, onChange, onClose }: {
  group: CareGroup | null; value: CareValue | null; onConfirm: () => void; onChange: () => void; onClose: () => void;
}) {
  const t = useTheme();
  const label = group && value ? careLabel(group, value.v) : '';
  return (
    <Sheet open={!!group} onClose={onClose} title="Stimmt das?" head={<SheetHead title="Stimmt das?" onCancel={onClose} />}>
      <View style={{ gap: 14, paddingTop: 14 }}>
        <Text style={{ fontSize: 16, color: t.ink }}>{label}</Text>
        <Hint>Geschätzt aus dem Material (im Zweifel die vorsichtigere Stufe). Ein Etikett-Foto ersetzt jede Schätzung.</Hint>
        <Wrap>
          <Capsule label="Bestätigen" selected onPress={onConfirm} />
          <Capsule label="Ändern" onPress={onChange} />
        </Wrap>
      </View>
    </Sheet>
  );
}
export const CARE_GROUPS = CARE.map((c) => c.key);

// ---------- KI-Analyse (Spec 11 Schritt 5, 14) ----------

/**
 * Schlichtes Blatt: Abschnitte Details, Tragen (Steckbrief-Felder), Form, Oberfläche, Wirkung (Profil, nur activeProfile)
 * als Liste „Label: Wert“; Gruppen mit Konfidenz unter 6 grau. Darunter Modell + Datum und „Neu analysieren“.
 * Keine Bearbeitung – geändert wird in Bearbeiten.
 */
export function AnalysisSheet({ open, itemId, f, onSaved, onClose }: {
  open: boolean; itemId: string; f: EditForm; onSaved: (msg: string) => void; onClose: () => void;
}) {
  const t = useTheme();
  const [img, setImg] = useState<{ path: string; colors: { h: string; s: number }[] } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setError(null);
    analysisImage(itemId).then(setImg).catch(() => setImg(null));
  }, [open, itemId]);
  const sections = analysisSections(f);
  const profiled = hasProfile(f.analysisBase);
  const note = analysisNote(f.analysisBase);
  const checkColor = profiled && !!img && colorCheck(f.colors, img.colors);

  async function run() {
    if (!img) { setError('Kein Bild vorhanden – zuerst ein Foto hinzufügen.'); return; }
    setBusy(true); setError(null);
    try {
      const a = await analyzeStored(img.path);
      const row = { category: f.category, subcategory: f.subcategory, pattern: f.pattern, materials: f.materials, analysis: f.analysisBase, ai_pending: f.aiPending };
      await updateItem(itemId, reanalysisChange(f, row, a));
      onSaved('Neu analysiert.');
    } catch (e) {
      const { code } = await kiError(e);
      setError(code === 'rate_limited' ? 'Das Gratis-Kontingent ist gerade erschöpft. Bitte später noch einmal.' : 'Analyse fehlgeschlagen: ' + (code || (e as Error).message));
    } finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title="KI-Analyse" head={<SheetHead title="KI-Analyse" onCancel={onClose} />}>
      <View style={{ gap: 18, paddingTop: 14 }}>
        {checkColor && <Hint accent>Farbe prüfen: Die gewählte Farbe passt nicht zum Foto.</Hint>}
        {sections.map((sec) => {
          const muted = sec.weak;
          return (
            <View key={sec.key} style={{ gap: 6 }}>
              <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: '600', color: muted ? t.inkMuted : t.ink }} accessibilityRole="header">{sec.title}</Text>
              {sec.rows.map((r) => (
                <Text key={r.label} style={{ fontSize: 15, lineHeight: 21, color: muted ? t.inkMuted : t.ink }}>
                  <Text style={{ color: t.inkMuted }}>{r.label}: </Text>{r.value}
                </Text>
              ))}
            </View>
          );
        })}
        {!profiled && <Hint>Noch kein KI-Profil für dieses Teil.</Hint>}
        {!!note && <Hint>{note}</Hint>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Capsule label={busy ? 'Analysiere …' : 'Neu analysieren'} selected onPress={busy || img === undefined ? undefined : run}
            icon={(c) => <Icon name="sparkle" size="chip" color={c} />} />
          {busy && <ActivityIndicator color={t.accent} />}
        </View>
        {profiled && <Hint>Füllt nur leere oder noch unbestätigte Felder; das Profil wird ersetzt.</Hint>}
        {error && <Hint accent>{error}</Hint>}
      </View>
    </Sheet>
  );
}

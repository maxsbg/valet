// Blätter der Detailseite: Set bearbeiten (Spec 3.3), Reservieren, „Stimmt das?“ für geschätzte Pflege (Spec 4)
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CARE, careLabel, type CareGroup, type CareValue } from '@valet/core';
import { useTheme } from '@/lib/theme';
import { todayLocal, type Person, type Tile } from '@/lib/wardrobe';
import { fmtShort } from '@/lib/outfits';
import { Sheet } from '@/components/Sheet';
import { ItemPicture } from '@/components/ItemPicture';
import { Capsule, DateField, FieldLabel, Glyph, GLYPHS, Hint, Monogram, SheetHead, TextField, Wrap } from './parts';

// ---------- Set ----------

/** Set-Name, Suche, Schrank-Raster (gewählt = accent-Rahmen + Haken unten rechts), „Set auflösen“. Ein Teil ist in höchstens einem Set. */
export function SetSheet({ open, current, initial, name: name0, items, hasSet, onSave, onClose }: {
  open: boolean; current: Tile; initial: string[]; name: string | null; items: Tile[]; hasSet: boolean;
  onSave: (members: string[], name: string | null) => Promise<void>; onClose: () => void;
}) {
  const t = useTheme();
  const { width: W } = useWindowDimensions();
  const [members, setMembers] = useState<string[]>(initial);
  const [name, setName] = useState(name0 ?? '');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setMembers(initial); setName(name0 ?? ''); setQ(''); setError(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const query = q.trim().toLowerCase();
  const list = items
    .filter((m) => m.id !== current.id && !m.isWish && m.status !== 'sold' && (!query || [m.name, m.brand, m.color, m.subcategory, m.type].some((f) => f?.toLowerCase().includes(query))))
    .sort((a, b) => Number(members.includes(b.id)) - Number(members.includes(a.id)) || a.name.localeCompare(b.name, 'de'));
  const col = Math.floor((Math.min(W, 560) - 32 - 16) / 3);
  const save = async (m: string[]) => {
    setBusy(true);
    try { await onSave(m, name.trim() || null); } catch (e) { setError('Speichern fehlgeschlagen: ' + (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Set" head={<SheetHead title="Set" onCancel={onClose} onDone={() => save(members)} doneDisabled={busy} />}>
      <View style={{ gap: 14, paddingTop: 14 }}>
        <TextField label="Name (optional)" value={name} onChange={setName} placeholder="z. B. Flannel-Set" />
        <TextField label="Teile suchen" value={q} onChange={setQ} placeholder="Name, Marke, Farbe, Art" />
        <View style={s.grid}>
          {[current, ...list].slice(0, 61).map((m) => {
            const fixed = m.id === current.id;
            const on = fixed || members.includes(m.id);
            const other = !fixed && m.setId && m.setId !== current.setId;
            return (
              <Pressable key={m.id} disabled={fixed} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: fixed }}
                accessibilityLabel={`${m.name}${fixed ? ' (dieses Teil)' : ''}${other ? ', in anderem Set' : ''}`}
                onPress={() => setMembers((x) => (x.includes(m.id) ? x.filter((y) => y !== m.id) : [...x, m.id]))} style={{ width: col, gap: 4 }}>
                <View style={[s.tile, { height: col, boxShadow: on ? `inset 0 0 0 2px ${t.accent}` : 'inset 0 0 0 1px rgba(42,26,29,0.09)' }]}>
                  <ItemPicture uri={m.thumb} inset={8} category={m.kind} color={m.hex ?? '#d8d2c8'} />
                  {on && <View style={[s.check, { backgroundColor: t.accent }]}><Glyph d={GLYPHS.check} size={14} color={t.onAccent} stroke={2.6} /></View>}
                </View>
                <Text numberOfLines={1} style={{ fontSize: 12, color: fixed ? t.ink : t.inkMuted, fontWeight: fixed ? '600' : '400' }}>{fixed ? 'Dieses Teil' : other ? `${m.name} · anderes Set` : m.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <Hint>Teile, die zusammengehören (z. B. Anzug oder Pyjama). Ein Teil ist in höchstens einem Set. Im Outfit-Baukasten fragt Valet „Als Set tragen?“.</Hint>
        {hasSet && (
          <Pressable accessibilityRole="button" onPress={() => save([current.id])} style={({ pressed }) => [s.danger, { borderColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: t.accent }}>Set auflösen</Text>
          </Pressable>
        )}
        {error && <Hint accent>{error}</Hint>}
      </View>
    </Sheet>
  );
}

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
  const t = useTheme();
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

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { borderRadius: 14, backgroundColor: '#fff', overflow: 'hidden' },
  check: { position: 'absolute', right: 6, bottom: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  danger: { height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

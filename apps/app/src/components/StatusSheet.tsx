// Status-Blatt mit Zusatzangaben (Spec 6, Leinwand „D · Status“):
// X · „Status“ · Haken; sieben Status als Kapseln mit Symbol; darunter je Status die Angaben bzw. ein Satz, was er bewirkt.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { STATUS_LIST, STORED_PLACES, SOLD_PLACES, statusChange, statusDef, statusError, parseAmount, type StatusInfo, type StatusKey } from '@valet/core';
import { Sheet } from './Sheet';
import { TileIcon } from './tile/TileIcons';
import { Capsule, DateField, FieldLabel, Hint, Monogram, SheetHead, TextField, Wrap } from './detail/parts';
import { eur } from './ItemForm';
import type { Person } from '@/lib/wardrobe';

type Props = {
  open: boolean;
  /** Status, mit dem das Blatt öffnet (aus dem Menü gewählt) */
  start: StatusKey;
  /** bisherige Angaben des Teils (zum Vorbelegen) */
  info: StatusInfo;
  /** Personen, an die verliehen werden kann (ohne mich) */
  persons: Person[];
  today: string;
  onSave: (info: StatusInfo) => Promise<void> | void;
  onClose: () => void;
};

type Draft = { key: StatusKey; since: string; until: string | null; where: string; whereOther: boolean; person: string | null; otherOn: boolean; other: string; price: string; soldOn: string };

function draftFrom(start: StatusKey, i: StatusInfo, today: string): Draft {
  const same = (i.status ?? 'closet') === start;
  const where = same ? i.status_where ?? '' : '';
  const known = start === 'stored' ? (STORED_PLACES as readonly string[]) : start === 'sold' ? (SOLD_PLACES as readonly string[]) : [];
  return {
    key: start, since: (same && i.status_at) || today, until: same ? i.status_until : null,
    where, whereOther: !!where && start === 'stored' && !known.includes(where),
    person: same ? i.lent_person_id : null, otherOn: same && !i.lent_person_id && !!i.lent_to, other: same ? i.lent_to ?? '' : '',
    price: same && i.sold_price != null ? eur(i.sold_price) : '', soldOn: (same && i.sold_date) || today,
  };
}

export function StatusSheet({ open, start, info, persons, today, onSave, onClose }: Props) {
  const [d, setD] = useState<Draft>(() => draftFrom(start, info, today));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setD(draftFrom(start, info, today)); setError(null); } }, [open, start]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const pick = (k: StatusKey) => setD(draftFrom(k, info, today));

  async function done() {
    const price = d.price.trim() ? parseAmount(d.price) : null;
    if (d.key === 'sold' && d.price.trim() && price == null) { setError('Erlös ist keine Zahl.'); return; }
    const raw: Partial<StatusInfo> = {
      status_at: d.since, status_until: d.until, status_where: d.where, lent_person_id: d.person,
      lent_to: d.otherOn ? d.other : null, sold_price: price, sold_date: d.soldOn,
    };
    const err = statusError(d.key, raw);
    if (err) { setError(err); return; }
    setBusy(true);
    try { await onSave(statusChange(d.key, raw, today)); } catch (e) { setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'); } finally { setBusy(false); }
  }

  const def = statusDef(d.key);
  return (
    <Sheet open={open} onClose={onClose} title="Status" head={<SheetHead title="Status" onCancel={onClose} onDone={done} doneDisabled={busy} />}>
      <View style={{ gap: 16, paddingTop: 14 }}>
        <Wrap>
          {STATUS_LIST.map((s) => (
            <Capsule key={s.key} label={s.label} selected={d.key === s.key} onPress={() => pick(s.key)}
              icon={(c) => <TileIcon name={s.icon} color={c} size={18} />} />
          ))}
        </Wrap>

        {d.key === 'lent' && (
          <View style={{ gap: 12 }}>
            <FieldLabel>An wen</FieldLabel>
            <Wrap>
              {persons.map((p) => (
                <Capsule key={p.id} label={p.name} selected={d.person === p.id} leading={<Monogram person={p} />}
                  onPress={() => set({ person: d.person === p.id ? null : p.id, otherOn: false })} />
              ))}
              <Capsule label="+ Andere Person" selected={d.otherOn} onPress={() => set({ person: null, otherOn: !d.otherOn })} />
            </Wrap>
            {d.otherOn && <TextField label="Name" value={d.other} onChange={(v) => set({ other: v })} placeholder="z. B. Lisa" autoFocus />}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <DateField label="Seit" value={d.since} onChange={(v) => set({ since: v ?? today })} />
              <DateField label="Zurück bis (optional)" value={d.until} onChange={(v) => set({ until: v })} optional />
            </View>
          </View>
        )}

        {d.key === 'repair' && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <DateField label="Seit" value={d.since} onChange={(v) => set({ since: v ?? today })} />
            <TextField label="Wo (optional)" value={d.where} onChange={(v) => set({ where: v })} placeholder="z. B. Schneiderei" />
          </View>
        )}

        {d.key === 'stored' && (
          <View style={{ gap: 12 }}>
            <FieldLabel>Wo</FieldLabel>
            <Wrap>
              {STORED_PLACES.map((p) => <Capsule key={p} label={p} selected={!d.whereOther && d.where === p} onPress={() => set({ where: d.where === p ? '' : p, whereOther: false })} />)}
              <Capsule label="+ Ort" selected={d.whereOther} onPress={() => set({ whereOther: !d.whereOther, where: '' })} />
            </Wrap>
            {d.whereOther && <TextField label="Ort" value={d.where} onChange={(v) => set({ where: v })} placeholder="z. B. Garage" autoFocus />}
          </View>
        )}

        {d.key === 'sold' && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextField label="Erlös" value={d.price} onChange={(v) => set({ price: v })} placeholder="0,00 €" keyboardType="decimal-pad" />
              <DateField label="Verkauft am" value={d.soldOn} onChange={(v) => set({ soldOn: v ?? today })} />
            </View>
            <FieldLabel>Wo</FieldLabel>
            <Wrap>
              {SOLD_PLACES.map((p) => <Capsule key={p} label={p} selected={d.where === p} onPress={() => set({ where: d.where === p ? '' : p })} />)}
            </Wrap>
          </View>
        )}

        <Hint>{def.hint}</Hint>
        {error && <Hint accent>{error}</Hint>}
      </View>
    </Sheet>
  );
}

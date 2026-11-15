// Set in Bearbeiten (entschieden 15.11.2026, ersetzt Spec 3.3 „Sets in der Detailansicht“):
// Zeile „Set“ unter „Wendbar“ mit Symbol-Schalter (Link); an → darunter Set-Name und „Teile im Set“ als Kacheln
// mit einer Kachel „+“ am Ende. „+“ öffnet ein Blatt mit Suche und Auswahl (gewählt = accent-Rahmen + Haken).
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { setOrder } from '@valet/core';
import { useTheme } from '@/lib/theme';
import type { Tile } from '@/lib/wardrobe';
import { ItemPicture } from '@/components/ItemPicture';
import { Sheet } from '@/components/Sheet';
import { FieldLabel, Glyph, GLYPHS, Hint, SheetHead, TextField } from '@/components/detail/parts';

export type SetDraft = { on: boolean; members: string[]; name: string };

type Props = {
  draft: SetDraft;
  onChange: (d: SetDraft) => void;
  /** Teil, das gerade bearbeitet wird (beim neuen Teil ohne ID) */
  current: { id: string | null; name: string; setId: string | null; thumb?: string | null; kind?: string; hex?: string | null };
  items: Tile[];
  width: number;
};

export function SetPicker({ draft, onChange, current, items, width }: Props) {
  const t = useTheme();
  const [pick, setPick] = useState(false);
  const col = Math.floor((width - 28 - 16) / 3);
  const byId = new Map(items.map((i) => [i.id, i] as const));
  const chosen = setOrder(draft.members.map((m) => byId.get(m)).filter((x): x is Tile => !!x));
  return (
    <View style={{ gap: 12, paddingBottom: 14 }}>
      <TextField label="Set-Name (optional)" value={draft.name} onChange={(v) => onChange({ ...draft, name: v })} placeholder="z. B. Anzug" />
      <FieldLabel>Teile im Set</FieldLabel>
      <View style={s.grid}>
        <View style={{ width: col, gap: 4 }}>
          {/* Wie die übrigen Set-Teile mit Bild; accent-Ring markiert das Teil, das gerade bearbeitet wird */}
          <View style={[s.tile, { height: col, boxShadow: `inset 0 0 0 2px ${t.accent}` }]} accessibilityLabel={current.name || 'Dieses Teil'}>
            <ItemPicture uri={current.thumb} inset={8} category={current.kind ?? 'oberteil'} color={current.hex ?? '#d8d2c8'} />
          </View>
          <Text style={{ fontSize: 12, fontWeight: '600', color: t.ink }}>Dieses Teil</Text>
        </View>
        {chosen.map((m) => (
          <View key={m.id} style={{ width: col, gap: 4 }} accessibilityLabel={m.name}>
            <View style={[s.tile, { height: col, boxShadow: 'inset 0 0 0 1px rgba(42,26,29,0.09)' }]}>
              <ItemPicture uri={m.thumb} inset={8} category={m.kind} color={m.hex ?? '#d8d2c8'} />
            </View>
            <Text numberOfLines={1} style={{ fontSize: 12, color: t.inkMuted }}>{m.name}</Text>
          </View>
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="Teile hinzufügen oder entfernen" onPress={() => setPick(true)} style={{ width: col, gap: 4 }}>
          {({ pressed }) => (
            <View style={[s.tile, s.add, { height: col, borderColor: t.hairline, opacity: pressed ? 0.6 : 1 }]}>
              <Glyph d={GLYPHS.plus} size={26} color={t.ink} />
            </View>
          )}
        </Pressable>
      </View>
      {!chosen.length && <Hint>Mit „+“ die Teile wählen, die zusammengehören (z. B. Anzug oder Pyjama). Ein Teil ist in höchstens einem Set.</Hint>}
      <SetPickSheet open={pick} selected={draft.members} current={current} items={items}
        onDone={(members) => { onChange({ ...draft, members }); setPick(false); }} onClose={() => setPick(false)} />
    </View>
  );
}

/** Blatt: Suche + Schrank-Raster, gewählt = accent-Rahmen + Haken unten rechts */
function SetPickSheet({ open, selected, current, items, onDone, onClose }: {
  open: boolean; selected: string[]; current: Props['current']; items: Tile[]; onDone: (members: string[]) => void; onClose: () => void;
}) {
  const t = useTheme();
  const { width: W } = useWindowDimensions();
  const [sel, setSel] = useState<string[]>(selected);
  const [q, setQ] = useState('');
  useEffect(() => { if (open) { setSel(selected); setQ(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const query = q.trim().toLowerCase();
  const list = items
    .filter((m) => m.id !== current.id && !m.isWish && m.status !== 'sold' &&
      (!query || [m.name, m.brand, m.color, m.subcategory, m.type].some((f) => f?.toLowerCase().includes(query))))
    .sort((a, b) => Number(selected.includes(b.id)) - Number(selected.includes(a.id)) || a.name.localeCompare(b.name, 'de'));
  const col = Math.floor((Math.min(W, 560) - 32 - 16) / 3);
  return (
    <Sheet open={open} onClose={onClose} title="Teile im Set" head={<SheetHead title="Teile im Set" onCancel={onClose} onDone={() => onDone(sel)} />}>
      <View style={{ gap: 14, paddingTop: 14 }}>
        <TextField label="Suchen" value={q} onChange={setQ} placeholder="Name, Marke, Farbe, Art" />
        <View style={s.grid}>
          {list.slice(0, 60).map((m) => {
            const on = sel.includes(m.id);
            const other = !on && m.setId && m.setId !== current.setId;
            return (
              <Pressable key={m.id} onPress={() => setSel((x) => (x.includes(m.id) ? x.filter((y) => y !== m.id) : [...x, m.id]))}
                accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${m.name}${other ? ', in anderem Set' : ''}`} style={{ width: col, gap: 4 }}>
                <View style={[s.tile, { height: col, boxShadow: on ? `inset 0 0 0 2px ${t.accent}` : 'inset 0 0 0 1px rgba(42,26,29,0.09)' }]}>
                  <ItemPicture uri={m.thumb} inset={8} category={m.kind} color={m.hex ?? '#d8d2c8'} />
                  {on && <View style={[s.check, { backgroundColor: t.accent }]}><Glyph d={GLYPHS.check} size={14} color={t.onAccent} stroke={2.6} /></View>}
                </View>
                <Text numberOfLines={1} style={{ fontSize: 12, color: t.inkMuted }}>{other ? `${m.name} · anderes Set` : m.name}</Text>
              </Pressable>
            );
          })}
        </View>
        {!list.length && <Hint>Nichts gefunden.</Hint>}
        <Hint>Ein Teil ist in höchstens einem Set. Im Outfit-Baukasten fragt Valet „Als Set tragen?“.</Hint>
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { borderRadius: 14, backgroundColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  add: { borderWidth: 1, borderStyle: 'dashed', backgroundColor: 'transparent' },
  check: { position: 'absolute', right: 6, bottom: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});

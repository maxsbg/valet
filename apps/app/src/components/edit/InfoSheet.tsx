// „Infos auslesen“ (Spec 7, Leinwand „H · Infos auslesen“): Etikett / Shop-Screenshot / Bestellbestätigung, dann Kamera oder Fotos.
// KI-Anbindung folgt später – bis dahin nimmt das Blatt das Bild entgegen und sagt ehrlich, dass das Auslesen noch nicht geht.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { Sheet } from '@/components/Sheet';
import { PhotoPicker } from '@/components/PhotoPicker';
import { Hint, SheetHead } from '@/components/detail/parts';
import { DetailIcon, type DetailIconName } from '@/components/detail/DetailIcons';

export type InfoKind = 'label' | 'shop' | 'order';
const KINDS: { key: InfoKind; title: string; text: string; icon: DetailIconName }[] = [
  { key: 'label', title: 'Etikett', text: 'Pflegesymbole, Material in Prozent, Größe, Artikelnummer', icon: 'label' },
  { key: 'shop', title: 'Shop-Screenshot', text: 'Name, Marke, Preis und Streichpreis, Farbe, Passform, Material', icon: 'phone' },
  { key: 'order', title: 'Bestellbestätigung', text: 'Bezahlter Preis, Kaufdatum, Shop, Größe', icon: 'bag' },
];

export function InfoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const [kind, setKind] = useState<InfoKind | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const close = () => { setKind(null); setFile(null); onClose(); };
  const pick = (f: File) => setFile(f.name || 'Bild');
  return (
    <Sheet open={open} onClose={close} title="Infos auslesen" head={<SheetHead title="Infos auslesen" onCancel={close} onDone={close} />}>
      <View style={{ gap: 14, paddingTop: 14 }}>
        <Text style={{ fontSize: 14, lineHeight: 19, color: t.inkMuted }}>
          Lade ein Bild hoch, und die KI liest die Angaben daraus ab. Was sie findet, landet als Vorschlag im Steckbrief und im Kauf.
        </Text>
        {KINDS.map((k) => {
          const on = kind === k.key;
          return (
            <Pressable key={k.key} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setKind(on ? null : k.key)}
              style={({ pressed }) => [s.kind, { backgroundColor: t.surfaceSunken, borderColor: on ? t.ink : t.hairline, opacity: pressed ? 0.8 : 1 }]}>
              <View style={[s.kindIcon, { backgroundColor: t.surface }]}><DetailIcon name={k.icon} color={t.ink} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>{k.title}</Text>
                <Text style={{ fontSize: 13, lineHeight: 17, color: t.inkMuted }}>{k.text}</Text>
              </View>
              <DetailIcon name="chevronRight" size={16} color={t.inkMuted} />
            </Pressable>
          );
        })}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <PhotoPicker onPick={pick} label="Kamera" style={{ flex: 1 }}>
            <View style={[s.src, { borderColor: t.hairline }]}><DetailIcon name="camera" size={18} color={t.ink} /><Text style={[s.srcText, { color: t.ink }]}>Kamera</Text></View>
          </PhotoPicker>
          <PhotoPicker onPick={pick} label="Fotos" style={{ flex: 1 }}>
            <View style={[s.src, { borderColor: t.hairline }]}><DetailIcon name="photos" size={18} color={t.ink} /><Text style={[s.srcText, { color: t.ink }]}>Fotos</Text></View>
          </PhotoPicker>
        </View>
        {file
          ? <Hint accent>Bild erhalten. Das Auslesen per KI ist noch nicht angebunden – die Felder bitte vorerst selbst ausfüllen.</Hint>
          : <Hint>Die Art des Bildes erkennt die KI auch selbst. Die Auswahl hilft nur, wenn sie danebenliegt.</Hint>}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  kind: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1 },
  kindIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  src: { height: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  srcText: { fontSize: 15, fontWeight: '600' },
});

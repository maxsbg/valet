// „Infos auslesen“ (Spec 7, Leinwand „H · Infos auslesen“): Etikett / Shop-Screenshot / Bestellbestätigung, dann Kamera oder Fotos.
// Die KI (lib/ki.ts → readInfo) liest das Bild aus; das Ergebnis übernimmt der Editor als markierte Vorschläge.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { Sheet } from '@/components/Sheet';
import { PhotoPicker } from '@/components/PhotoPicker';
import { Hint, SheetHead } from '@/components/detail/parts';
import { Icon } from '@/components/Icon';
import type { SymbolName } from '@valet/ui';
import { infoUsable, kiMessage, type Info, type InfoKind } from '@valet/core';
import { kiError, readInfo } from '@/lib/ki';

const KINDS: { key: InfoKind; title: string; text: string; icon: SymbolName }[] = [
  { key: 'label', title: 'Etikett', text: 'Pflegesymbole, Material in Prozent, Größe, Artikelnummer', icon: 'label' },
  { key: 'shop', title: 'Shop-Screenshot', text: 'Name, Marke, Preis und Streichpreis, Farbe, Passform, Material', icon: 'phone' },
  { key: 'order', title: 'Bestellbestätigung', text: 'Bezahlter Preis, Kaufdatum, Shop, Größe', icon: 'bag' },
];

export function InfoSheet({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (info: Info) => void }) {
  const t = useTheme();
  const [kind, setKind] = useState<InfoKind | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const close = () => { setKind(null); setState('idle'); onClose(); };
  const pick = (f: File) => {
    setState('busy');
    readInfo(f, kind)
      // ausdrücklich gewählte Art gilt für die Rangfolge (z. B. Etikett: nur Material, Größe, Pflege …)
      .then((info) => {
        if (!infoUsable(info)) { setMessage('Auf dem Bild war nichts Lesbares zu finden.'); setState('error'); return; }
        onResult(kind ? { ...info, kind } : info); close();
      })
      .catch(async (e) => { const { code, status } = await kiError(e); setMessage(kiMessage(code, status)); setState('error'); });
  };
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
              <View style={[s.kindIcon, { backgroundColor: t.surface }]}><Icon name={k.icon} size="row" color={t.ink} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>{k.title}</Text>
                <Text style={{ fontSize: 13, lineHeight: 17, color: t.inkMuted }}>{k.text}</Text>
              </View>
              <Icon name="chevron" size="inline" color={t.inkMuted} />
            </Pressable>
          );
        })}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <PhotoPicker onPick={pick} label="Kamera" style={{ flex: 1 }}>
            <View style={[s.src, { borderColor: t.hairline }]}><Icon name="camera" size="chip" color={t.ink} /><Text style={[s.srcText, { color: t.ink }]}>Kamera</Text></View>
          </PhotoPicker>
          <PhotoPicker onPick={pick} label="Fotos" style={{ flex: 1 }}>
            <View style={[s.src, { borderColor: t.hairline }]}><Icon name="photos" size="chip" color={t.ink} /><Text style={[s.srcText, { color: t.ink }]}>Fotos</Text></View>
          </PhotoPicker>
        </View>
        {state === 'busy' ? <Hint accent>Liest aus … das dauert ein paar Sekunden.</Hint>
          : state === 'error' ? <Hint accent>Auslesen hat nicht geklappt. {message}</Hint>
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

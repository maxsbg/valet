// „Infos auslesen“ (Spec 7, Leinwand „H · Infos auslesen“): Link zur Produktseite oder Bild (Etikett / Shop-Screenshot /
// Bestellbestätigung, Kamera oder Fotos). Link = derselbe Ablauf wie „Neues Teil“ per Link (Seite über `produkt` laden,
// Text mit readPage auslesen, Quelle „page“). Das Ergebnis übernimmt der Editor als markierte Vorschläge.
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { Sheet } from '@/components/Sheet';
import { PhotoPicker } from '@/components/PhotoPicker';
import { Hint, SheetHead } from '@/components/detail/parts';
import { Icon } from '@/components/Icon';
import type { SymbolName } from '@valet/ui';
import { infoUsable, kiMessage, type Info, type InfoKind, type InfoSource } from '@valet/core';
import { kiError, readInfo, readPage } from '@/lib/ki';
import { findUrl, loadProduct, productError } from '@/lib/produkt';

/** Wie in „Neues Teil“: unter so viel Text lohnt das Auslesen nicht (vermutlich nur Gerüst einer JavaScript-Seite) */
const MIN_PAGE_TEXT = 200;

const KINDS: { key: InfoKind; title: string; text: string; icon: SymbolName }[] = [
  { key: 'label', title: 'Etikett', text: 'Pflegesymbole, Material in Prozent, Größe, Artikelnummer', icon: 'label' },
  { key: 'shop', title: 'Shop-Screenshot', text: 'Name, Marke, Preis und Streichpreis, Farbe, Passform, Material', icon: 'phone' },
  { key: 'order', title: 'Bestellbestätigung', text: 'Bezahlter Preis, Kaufdatum, Shop, Größe', icon: 'bag' },
];

export function InfoSheet({ open, onClose, onResult, hint = '', link = '' }: {
  open: boolean; onClose: () => void;
  /** `from` = Quelle für die Rangfolge (Link → „page“), `url` = geladener Link (für Feld Link + Shop) */
  onResult: (info: Info, from?: InfoSource, url?: string) => void;
  hint?: string;
  /** schon gespeicherter Produktlink: als Vorschlag im Feld */
  link?: string;
}) {
  const t = useTheme();
  const [kind, setKind] = useState<InfoKind | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [busyText, setBusyText] = useState('');
  const [url, setUrl] = useState(link);
  useEffect(() => { if (open) setUrl(link); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // Laufnummer: Schließen/Abbrechen macht ein noch laufendes Auslesen ungültig (Ergebnis wird verworfen)
  const run = useRef(0);
  const close = () => { run.current++; setKind(null); setState('idle'); onClose(); };
  /** Link: Seite laden und auslesen – derselbe Ablauf wie „Neues Teil“ per Link */
  const fromLink = async () => {
    const target = findUrl(url);
    if (!target) { setMessage('Kein Link gefunden.'); setState('error'); return; }
    const n = ++run.current;
    setState('busy'); setBusyText('Seite wird geladen …');
    let page;
    try { page = await loadProduct(target); } catch (e) {
      if (n !== run.current) return;
      setMessage(productError(e)); setState('error'); return;
    }
    if (n !== run.current) return;
    if (page.blocked) { setMessage('Der Shop lässt die Seite nicht von außen laden.'); setState('error'); return; }
    if (page.text.length <= MIN_PAGE_TEXT) { setMessage('Auf der Seite steht zu wenig Text.'); setState('error'); return; }
    setBusyText('Liest aus … das dauert ein paar Sekunden.');
    try {
      const info = await readPage(page.text, page.facts);
      if (n !== run.current) return;
      if (!infoUsable(info, 'page')) { setMessage('Auf der Seite war nichts Lesbares zu finden.'); setState('error'); return; }
      onResult(info, 'page', target); close();
    } catch (e) {
      if (n !== run.current) return;
      const { code, status } = await kiError(e); setMessage(kiMessage(code, status)); setState('error');
    }
  };
  const pick = (f: File) => {
    const n = ++run.current;
    setState('busy'); setBusyText('Liest aus … das dauert ein paar Sekunden.');
    readInfo(f, kind, hint)
      // ausdrücklich gewählte Art gilt für die Rangfolge (z. B. Etikett: nur Material, Größe, Pflege …)
      .then((info) => {
        if (n !== run.current) return;
        // gleiche Quelle wie beim Übernehmen: ausdrücklich gewählte Art vor der Art, die die KI erkannt hat
        if (!infoUsable({ ...info, kind: kind ?? info.kind })) { setMessage(kind === 'label' ? 'Auf dem Etikett war nichts Passendes zu finden (Marke, Material, Größe, Pflege).' : 'Auf dem Bild war nichts Lesbares zu finden.'); setState('error'); return; }
        onResult(kind ? { ...info, kind } : info); close();
      })
      .catch(async (e) => {
        if (n !== run.current) return;
        const { code, status } = await kiError(e); setMessage(kiMessage(code, status)); setState('error');
      });
  };
  return (
    <Sheet open={open} onClose={close} title="Infos auslesen" head={<SheetHead title="Infos auslesen" onCancel={close} onDone={state === 'busy' ? undefined : close} />}>
      <View style={{ gap: 14, paddingTop: 14 }}>
        <Text style={{ fontSize: 14, lineHeight: 19, color: t.inkMuted }}>
          Füge den Link zur Produktseite ein oder lade ein Bild hoch – die KI liest die Angaben daraus ab. Was sie findet, landet als Vorschlag im Steckbrief und im Kauf.
        </Text>
        <View style={[s.linkBox, { backgroundColor: t.surfaceSunken, borderColor: t.hairline }]}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink }}>Link einfügen</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={url} onChangeText={setUrl} placeholder="Link zur Produktseite" placeholderTextColor={t.inkMuted}
              accessibilityLabel="Link zur Produktseite" inputMode="url" keyboardType="url" autoCapitalize="none" autoCorrect={false}
              onSubmitEditing={fromLink} returnKeyType="go" editable={state !== 'busy'}
              style={[s.input, { backgroundColor: t.surface, borderColor: t.hairline, color: t.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} />
            <Pressable onPress={fromLink} accessibilityRole="button" accessibilityLabel="Seite laden" disabled={!url.trim() || state === 'busy'}
              style={({ pressed }) => [s.go, { backgroundColor: t.fill, opacity: !url.trim() || state === 'busy' ? 0.4 : pressed ? 0.8 : 1 }]}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: t.onFill }}>Laden</Text>
            </Pressable>
          </View>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '600', color: t.inkMuted, marginTop: 2 }}>ODER BILD</Text>
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
        {state === 'busy' ? <Hint accent>{busyText}</Hint>
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
  linkBox: { gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
  input: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  go: { height: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

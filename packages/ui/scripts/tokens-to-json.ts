// Erzeugt tokens.json im Format des Design-System-Artifacts aus src/tokens.ts (eine Quelle, keine Abschrift)
import { colors, status, space, radius, fonts, type, shadow, brand } from '../src/tokens';

const usage: Record<string, string> = {
  bg: 'Seitenhintergrund (Warm Ivory).',
  surface: 'Karten und Kleidungs-Kacheln: flach und hell, kein Verlauf.',
  surfaceSunken: 'Eingabefelder, Hintergrund von Segment-Steuerungen.',
  ink: 'Haupttext und Symbole auf bg und surface.',
  inkMuted: 'Nebentext (Marke, Preis, Datum) auf bg und surface.',
  hairline: 'Trennlinien, Rand der Kacheln.',
  accent: 'Schriftzug „valet“, Links, aktiver Tab. Im Dunkelmodus aufgehellt.',
  onAccent: 'Text auf accent-Flächen.',
  action: 'Hauptaktion (+ Hinzufügen, Primär-Knopf). Nur als Fläche, nie als Schrift.',
  onAction: 'Schrift und Symbole auf action. Weiß wäre zu kontrastarm (3:1).',
  actionText: 'Orange als Schrift auf hellem Grund (z. B. „Ändern“).',
  highlight: 'Sparsame Hervorhebung, z. B. Markierung „Heute“ im Kalender. Text darauf: ink.',
  blush: 'Personenfarbe, Markierungen. Text darauf: ink.',
  glass: 'Grundton der Glas-Ebene (Tab-Leiste, Sheets), mit Unschärfe darunter.',
  glassBorder: 'Lichtkante der Glas-Ebene.',
  scrim: 'Abdunklung hinter Sheets.',
};
const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

const colorTokens = Object.keys(colors.light).map((k) => ({
  name: kebab(k),
  value: { light: colors.light[k as keyof typeof colors.light].toLowerCase(), dark: colors.dark[k as keyof typeof colors.dark].toLowerCase() },
  usage: usage[k] ?? '',
}));
for (const [k, v] of Object.entries(status.light)) colorTokens.push({ name: `status-${k}`, value: { light: v.toLowerCase(), dark: status.dark[k as keyof typeof status.dark].toLowerCase() }, usage: `Status-Punkt „${k}“. Nur als Punkt/Symbol (≥ 3:1), Text daneben in ink.` });
for (const [k, v] of Object.entries(brand)) colorTokens.push({ name: `brand-${k}`, value: { light: v.toLowerCase(), dark: v.toLowerCase() }, usage: 'Markenfarbe (Rohwert). In Oberflächen die Rollen-Tokens oben verwenden.' });

const styles = Object.entries(type).filter(([k]) => k !== 'wordmark').map(([k, v]) => ({
  name: kebab(k), fontSize: `${v.size}px`, lineHeight: `${v.line}px`, fontWeight: v.weight,
}));

const out = {
  name: 'Valet',
  version: 1,
  color: { themes: [{ id: 'light', name: 'Hell' }, { id: 'dark', name: 'Dunkel' }], tokens: colorTokens },
  type: {
    fonts: [],
    families: { text: fonts.text, display: fonts.display },
    groups: [
      { name: 'Marke', family: 'display', styles: [
        { name: 'wordmark', fontSize: `${type.wordmark.size}px`, lineHeight: `${type.wordmark.line}px`, fontWeight: 400, sample: 'valet', usage: 'Nur der Schriftzug, klein geschrieben, in accent.' },
        { name: 'display-title', fontSize: '34px', lineHeight: '38px', fontWeight: 400, sample: 'Dein Schrank', usage: 'Große Titel auf Startseiten, sparsam.' },
      ] },
      { name: 'Text', family: 'text', styles },
    ],
  },
  spacing: { tokens: Object.entries(space).map(([k, v]) => ({ name: `space-${k}`, value: `${v}px`, usage: ({ xxs: 'Abstand Symbol zu Text.', xs: 'Abstand zwischen Kacheln im Mosaik, Chip-Innenabstand.', sm: 'Innenabstand kleiner Elemente, Zeilen-Abstand.', md: 'Seitenrand, Karten-Innenabstand.', lg: 'Abstand zwischen Abschnitten.', xl: 'Großer Abschnittsabstand.', xxl: 'Freiraum über großen Titeln.' } as Record<string, string>)[k] ?? '' })) },
  radius: { tokens: Object.entries(radius).map(([k, v]) => ({ name: `radius-${k}`, value: `${v}px`, usage: { sm: 'Knöpfe, Chips, Eingabefelder.', md: 'Karten, Kleidungs-Kacheln.', lg: 'Sheets, große Glasflächen.', pill: 'Segment-Steuerung, Tab-Leiste, Status-Plaketten.' }[k] ?? '' })) },
  shadow: { tokens: Object.entries(shadow).map(([k, v]) => ({ name: `shadow-${k}`, value: v, usage: k === 'float' ? 'Schwebende Knöpfe und Tab-Leiste.' : 'Sheets.' })) },
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');

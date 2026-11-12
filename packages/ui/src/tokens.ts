// Valet Designsystem – Tokens (einzige Quelle für Web und iOS)
// Markenfarben (festgelegt 09.11.2026): Vibrant Orange #FF641F, Deep Oxblood #722638,
// Blush Pink #EF91B0, Soft Sunny Yellow #F9E58A, Warm Ivory #F5F0E8.
// Grundsatz: Glas nur für die Bedien-Ebene (Tab-Leiste, Werkzeugleisten, Sheets, schwebende Knöpfe),
// Inhalte (Kleidung, Listen, Text) auf ruhigen, festen Flächen.

export const brand = {
  orange: '#FF641F',
  oxblood: '#722638',
  pink: '#EF91B0',
  yellow: '#F9E58A',
  ivory: '#F5F0E8',
} as const;

export type ThemeName = 'light' | 'dark';

/** Farbrollen je Thema. Kontraste geprüft (WCAG): Text ≥ 4.5:1, Symbole/Rahmen ≥ 3:1. */
export const colors = {
  light: {
    bg: brand.ivory,            // Seitenhintergrund
    surface: '#FFFCF7',         // Karten, Kacheln (flach, hell)
    surfaceSunken: '#EDE6DB',   // Eingabefelder, Segment-Hintergrund
    ink: '#2A1A1D',             // Haupttext (14.6:1 auf bg)
    inkMuted: '#6E5E60',        // Nebentext (5.4:1 auf bg)
    hairline: '#2A1A1D1F',      // Trennlinien, Kachelrand
    accent: brand.oxblood,      // Schriftzug, Links, aktive Tabs (9.0:1 auf bg)
    onAccent: '#FFFFFF',
    action: brand.orange,       // Hauptaktion (+), nur als Fläche
    onAction: '#2A1A1D',        // Schrift/Symbol auf Orange (5.6:1) – Weiß wäre nur 3.0:1
    actionText: '#B8430F',      // Orange als Schrift auf hellem Grund (4.8:1)
    highlight: brand.yellow,    // „Heute“, Hervorhebung (sparsam)
    blush: brand.pink,          // Person/Markierung
    glass: '#F5F0E8B8',         // warm getöntes Glas
    glassBorder: '#FFFFFF8C',
    scrim: '#2A1A1D66',
  },
  dark: {
    bg: '#17110F',
    surface: '#221A18',
    surfaceSunken: '#2C2321',
    ink: brand.ivory,           // 16.5:1
    inkMuted: '#A8999A',        // 6.8:1
    hairline: '#F5F0E824',
    accent: '#E8899F',          // Oxblood ist auf Dunkel zu schwach → aufgehelltes Rosé-Oxblood (7.6:1)
    onAccent: '#17110F',
    action: brand.orange,       // 6.3:1 auf bg
    onAction: '#2A1A1D',
    actionText: '#F09A73',      // 8.5:1
    highlight: brand.yellow,
    blush: brand.pink,
    glass: '#221A18B8',
    glassBorder: '#F5F0E81F',
    scrim: '#00000080',
  },
} as const satisfies Record<ThemeName, Record<string, string>>;

/** Status-Farben (aus dem alten Valet). Nur als Punkt/Symbol (≥ 3:1), Text bleibt ink. Im Dunklen aufgehellt. */
export const status = {
  light: { wash: '#3B7BBF', repair: '#555555', lent: '#B7791F', out: '#7A7468', sold: '#6D1F2C' },
  dark: { wash: '#6FA4DB', repair: '#9C9C9C', lent: '#D9A04A', out: '#A39C90', sold: '#D0687E' },
} as const;

/** Abstände (4er-Raster) */
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

/** Ecken */
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

/** Mindestgröße für Tippflächen (Apple HIG) */
export const hitTarget = 44;

/** Schrift: Systemschrift für alles Lesbare, Gloock nur für Schriftzug und große Titel */
export const fonts = {
  text: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  display: '"Gloock", Georgia, "Times New Roman", serif',
} as const;

/** Größenstufen wie iOS (pt bzw. px) */
export const type = {
  largeTitle: { size: 34, line: 41, weight: 700 },
  title1: { size: 28, line: 34, weight: 700 },
  title2: { size: 22, line: 28, weight: 700 },
  title3: { size: 20, line: 25, weight: 600 },
  headline: { size: 17, line: 22, weight: 600 },
  body: { size: 17, line: 22, weight: 400 },
  callout: { size: 16, line: 21, weight: 400 },
  subhead: { size: 15, line: 20, weight: 400 },
  footnote: { size: 13, line: 18, weight: 400 },
  caption: { size: 12, line: 16, weight: 500 },
  wordmark: { size: 30, line: 32, weight: 400 }, // „valet“ in Gloock, klein geschrieben, Oxblood
} as const;

/** Glas-Stufen: Unschärfe + Sättigung; iOS 26 nutzt natives Liquid Glass, Web backdrop-filter */
export const glass = {
  bar: { blur: 24, saturate: 1.6 },    // Tab-Leiste, Werkzeugleisten
  sheet: { blur: 32, saturate: 1.4 },  // Sheets, Menüs
  float: { blur: 18, saturate: 1.8 },  // schwebende Knöpfe
} as const;

/** Schatten nur für schwebende Bedien-Ebene */
export const shadow = {
  float: '0 6px 20px rgba(42, 26, 29, 0.16)',
  sheet: '0 -8px 32px rgba(42, 26, 29, 0.14)',
} as const;

/** Bewegung (Werte orientiert an den Messungen in docs/research.md, Abschnitt 2.3) */
export const motion = {
  tap: 90,           // sofortiges Feedback beim Antippen (ms)
  push: 250,         // Seitenwechsel
  sheet: 300,        // Sheet öffnen/schließen, leichte Feder
  stagger: 60,       // Versatz bei Listen-Einblendungen
  spring: { damping: 22, stiffness: 260 },
} as const;

export const tokens = { brand, colors, status, space, radius, hitTarget, fonts, type, glass, shadow, motion };
export default tokens;

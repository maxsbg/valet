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
    highlight: brand.yellow,    // Hervorhebung (sparsam); „Heute“ ist seit 14.11.2026 accent
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
  light: { wash: '#3B7BBF', repair: '#555555', lent: '#B7791F', stored: '#8A7A5C', out: '#7A7468', sold: '#6D1F2C' },
  dark: { wash: '#6FA4DB', repair: '#9C9C9C', lent: '#D9A04A', stored: '#B8A88A', out: '#A39C90', sold: '#D0687E' },
} as const;

/** Personenfarben (wie im alten Valet: Max rosa, Paul rot). Buchstabe auf der Kachel-Plakette; im Dunklen aufgehellt. */
export const person = {
  light: { pink: '#D9668E', red: '#C8102E' },
  dark: { pink: '#EF91B0', red: '#EF6B7E' },
} as const;

/**
 * Monogramm-Buchstaben auf der Kachel: dunklere Textvariante der Personenfarbe.
 * Plaketten sind immer hell (Milchglas auf weißer Kachel) → kein Dunkel-Wert.
 * Personen ohne Farbe: ink (schwarz).
 */
export const personText = { pink: '#A8325F', red: '#B00E28' } as const;

const radiusTile = 14;
const insetBadge = 4;

/**
 * Schrank-Kachel (ItemTile) – Spezifikation docs/design/kachel/VALET_KACHEL_SPEC.md, Abschnitt 7.
 * Die Kachel ist immer weiß, auch im dunklen Modus. Alle Maße in px.
 */
export const itemTile = {
  bg: '#FFFFFF',
  /** radius-tile */
  radius: radiusTile,
  /** tile-edge: feine 1-px-Kante innen, als Overlay über allem */
  edge: 'rgba(42,26,29,0.09)',
  edgeWidth: 1,
  /** Innenabstand des Fotos rundum */
  photoInset: 10,
  /** abwesende Teile (verliehen, Reparatur, eingelagert, verkauft): Foto abblenden */
  away: { opacity: 0.42, grayscale: 0.5 },
  /** Innenschein: inset 0 0 blur spread rgba(farbe, alpha) */
  glow: {
    blur: 22,          // glow-blur
    spread: 3,         // glow-spread
    alphaStrong: 0.52, // glow-alpha-strong
    alphaSoft: 0.28,   // glow-alpha-soft
    fallback: '#D8D2C8', // glow-fallback: ohne Hauptfarbe oder zu hell
    /** Grenzen der Farbregel (HSV): neutral = s < satMin oder v < valMin; „sehr hell“ = v > valLight */
    satMin: 0.25,
    valMin: 0.2,
    valLight: 0.85,
  },
  badge: {
    /** size-badge: Durchmesser der runden Plakette */
    size: 20,
    /** inset-badge: Abstand zum Kachelrand */
    inset: insetBadge,
    /** radius-badge = radius-tile − inset-badge (konzentrisch) */
    radius: radiusTile - insetBadge,
    /** size-count-h: Höhe der Anzahl-Kapsel unter Wendbar (Breite = size) */
    countHeight: 14,
    /** gap-badge-stack: Wendbar ↔ Anzahl */
    stackGap: 3,
    /** overlap-owner: Überlappung der Besitzer-Plaketten (Monogramm und „+N“ gleich) */
    ownerOverlap: 3,
    pill: 999,
    /** badge-glass */
    glass: 'rgba(255,255,255,0.62)',
    blur: 10,
    saturate: 1.8,
    shadow: 'inset 0 0.5px 0 #fff, inset 0 0 0 0.5px rgba(255,255,255,0.7), 0 0 0 0.5px rgba(42,26,29,0.10), 0 2px 6px rgba(42,26,29,0.12)',
    ink: '#2A1A1D',
    /** Symbole (24er-Raster): gerenderte Größe und Strichstärke (Strich 2 wie überall, entschieden 15.11.2026; vorher 2,2) */
    icon: { size: 11, stroke: 2 },
    /**
     * „Heute getragen“-Bügel (Symbol `wornToday` im Pool packages/ui/src/symbols.ts, gleiche Form wie „Heute tragen“ im Teil-Detail):
     * liegt im 24er-Raster nicht mittig (Inhalt y 4…18 → Mitte 11 statt 12).
     * offsetY schiebt ihn optisch in die Mitte: (12 − 11) / 24 × 12 px = 0,5 px. Bei neuem Symbol neu rechnen.
     */
    wornToday: { size: 12, stroke: 2, offsetY: 0.5 },
    /** font-badge-num: Ziffern (Anzahl, „+N“) */
    num: { size: 8.5, weight: '700', letterSpacing: -0.3 },
    /** font-badge-sym: Beizeichen × und + */
    sym: { size: 6.5, weight: '600', raiseEm: 0.12 },
    /** Monogramm in Gloock */
    mono: { size: 11, weight: '400' },
    /**
     * Optische Zentrierung (Spec 5.5). Web: text-box trim (aus den Schriftmetriken), kein Versatz nötig.
     * Native (kein text-box): fester Versatz je Schrift in px, translateY. NOCH AUF iOS NACHMESSEN (Ziel ≤ 0,25 px).
     */
    numOffsetY: 0,
    monoOffsetY: 0,
    /**
     * Wunschliste – Preis-Kapsel unten links: wächst mit der Stellenzahl, einstellig = Kreis (min. size).
     * € klein wie das × der Anzahl; optische Mitte im Browser gemessen (≤ 0,25 px).
     */
    price: { padX: 5, eur: { size: 6.5, weight: '600', raiseEm: 0.12, marginLeft: 0.5, marginRight: -0.4 } },
    /**
     * Wunschliste – Bedenkzeit-Ring oben rechts (Funktion vorerst aus, WISH_WAIT in @valet/core).
     * Ring mit Abstand zum Plakettenrand; zweistellig kleinere Ziffern, damit „14“ den Ring nicht berührt.
     */
    wait: {
      r: 7.5,
      stroke: 1.4,
      track: 'rgba(42,26,29,0.10)',
      color: brand.oxblood,
      warn: brand.orange,
      twoDigits: { size: 7.5, letterSpacing: -0.4, marginRight: 0.5, offsetY: -0.2 },
    },
  },
} as const;

/**
 * Outfit-Karte (entschieden 14.11.2026): weiß, ohne Fußzeile, nur Plaketten. Plaketten = Kachel-Regeln × 1,5,
 * konzentrisch zum Kartenradius: radius-badge = 22 − 7 = 15 → Plakette 30 px; Überlappung 3 × 1,5 = 4,5.
 */
const outfitRadius = 22;
const outfitScale = 1.5;
export const outfitCard = {
  radius: outfitRadius,
  scale: outfitScale,
  inset: outfitRadius - itemTile.badge.radius * outfitScale,
  overlap: itemTile.badge.ownerOverlap * outfitScale,
  /** Innenabstand der Collage */
  photoInset: itemTile.photoInset * outfitScale,
} as const;

/** Kachel im Mosaik (aus dem alten Valet übernommen) */
export const tile = {
  radius: 22,
  gap: 10,
  /** Farbschein am Rand in der Hauptfarbe des Teils: Weichzeichnung und Breite in px, Deckkraft 0–1 */
  glow: { blur: 22, spread: 3, opacity: 0.45 },
  badge: 26,
  /** Zeilenhöhe des Mosaiks; Kacheln belegen je nach Kategorie 2–4 Zeilen */
  row: 44,
  /** Auswahl im Outfit-Baukasten (vorläufig wie bisher – Darstellung auf der neuen Kachel noch offen) */
  select: { ring: 3, color: brand.oxblood, on: '#FFFFFF' },
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
  tile: '0 2px 8px rgba(42, 26, 29, 0.10)',
} as const;

/** Bewegung (Werte orientiert an den Messungen in docs/research.md, Abschnitt 2.3) */
export const motion = {
  tap: 90,           // sofortiges Feedback beim Antippen (ms)
  push: 250,         // Seitenwechsel
  sheet: 300,        // Sheet öffnen/schließen, leichte Feder
  stagger: 60,       // Versatz bei Listen-Einblendungen
  spring: { damping: 22, stiffness: 260 },
} as const;

/**
 * Teil-Detail, Wunschteil, Bearbeiten (docs/design/detailseite/VALET_DETAILSEITE_SPEC.md, 15.11.2026).
 * Bild-Kachel = Schrank-Kachel × 2: Plakette 40, Abstand 8, Radius 28 (konzentrisch 28 − 8 = 20).
 */
export const detail = {
  /** Kapsel wie die Filter-Kapseln im Schrank */
  capsule: { height: 38, minWidth: 52, padX: 13, font: 16, weight: '600', gap: 7, icon: 18 },
  /** Werte nur als Symbol (Saison, Farben, Pflege, Status, Wunsch-Kategorie): runde Kreise */
  circle: 38,
  /** Farbkreis in Kapseln und Kreisen, überall gleich */
  colorDot: 24,
  /** Monogramm in Kapseln */
  monogram: 24,
  /** runde Kopf-Knöpfe (Zurück, Teilen, Bearbeiten, X, Haken, Zurücksetzen) */
  headButton: 44,
  headIcon: 22,
  /** Werkzeugleiste unten (ersetzt die Tab-Leiste) */
  toolbar: { height: 52, button: 44, main: 52, icon: 22, side: 16, bottom: 28, gap: 8 },
  /** Pull-down-Menü (Status) */
  menu: { width: 250, radius: 26, row: 48, icon: 20, font: 17, gap: 10 },
  /** Bild-Kachel oben */
  image: { width: 358, height: 380, radius: 28, badge: 40, inset: 8, badgeIcon: 22 },
  /** Karten im Inhalt */
  card: { radius: 16, pad: 14, gap: 14 },
  /** Tragen-Kacheln: Werte gleich groß, gemeinsam höchstens bis 20 px kleiner */
  stat: { value: 22, valueMin: 20, label: 13, hint: 12 },
  /** Schrift (Gloock): Name 32, Karten-Überschrift 20, Titel in Kopfzeilen/Blättern 20, große Preise 32 */
  font: { name: 32, cardTitle: 20, sheetTitle: 20, price: 32, brand: 13, rowLabel: 15 },
  /** Eingabefelder */
  field: { height: 44, radius: 12, label: 13 },
} as const;

export const tokens = { brand, colors, status, person, personText, itemTile, outfitCard, tile, space, radius, hitTarget, fonts, type, glass, shadow, motion, detail };
export default tokens;

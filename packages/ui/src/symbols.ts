// Symbol-Pool von Valet – die EINZIGE Quelle für Symbole in der App (eingeführt 15.11.2026).
// Regeln und Übersicht: docs/design/symbole/VALET_SYMBOLE.md + symbol-katalog.html (erzeugt mit
// `pnpm symbole`). Neue Funktion → zuerst hier ein passendes Symbol suchen (Bedeutung + uses).
// Neues Symbol nur mit Max' Okay; packages/core/test/symbols.test.ts prüft Doppelungen.
//
// Elemente: Pfad „M…“ · Kreis „c:x,y,r“ · gefüllter Punkt „f:x,y,r“ · Text „t:x,y,größe,gewicht,TEXT“.
// Raster 24 (Pflege: 32), Strich 2 (im 32er-Raster 2,67 = gleiche Dicke), runde Enden und Ecken.
//
// Einige Formen sind vom freien Icon-Set Lucide abgeleitet (src: 'Lucide'):
// Lucide, ISC License, Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of
// Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

export type SymbolGroup = 'bedienung' | 'tab' | 'plakette' | 'status' | 'wunsch' | 'kategorie' | 'anlass' | 'saison' | 'wetter' | 'pflege';

export type SymbolDef = {
  group: SymbolGroup;
  /** feste Bedeutung – das Symbol steht für nichts anderes */
  meaning: string;
  /** alle Stellen/Funktionen, an denen es benutzt werden darf (jede Funktion hat genau ein Symbol) */
  uses: readonly string[];
  els: readonly string[];
  /** Raster (Standard 24) */
  grid?: 24 | 32;
  /** Herkunft der Form (Standard: eigen) */
  src?: 'Lucide';
  /** vorgemerkt, noch nicht in der App benutzt */
  reserved?: true;
};

/** Gruppen in der Reihenfolge des Katalogs */
export const SYMBOL_GROUPS: Record<SymbolGroup, string> = {
  bedienung: 'Bedienung', tab: 'Tab-Leiste', plakette: 'Plaketten', status: 'Status', wunsch: 'Wunsch-Kategorien',
  kategorie: 'Oberkategorien', anlass: 'Anlässe', saison: 'Saison', wetter: 'Wetter', pflege: 'Pflege',
};

export const SYMBOLS = {
  back: { group: 'bedienung', meaning: 'Zurück: Seite verlassen', uses: ['Kopfzeile Teil-, Wunschteil- und Outfit-Detail', 'Geöffnete Wunschliste schließen'],
    els: ['M15 5l-7 7 7 7'] },
  close: { group: 'bedienung', meaning: 'Schließen, Abbrechen, Entfernen', uses: ['Kopfknopf „Abbrechen“ (Bearbeiten, Blätter)', 'Suche schließen/leeren', 'Teil aus dem Baukasten entfernen'],
    els: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'] },
  check: { group: 'bedienung', meaning: 'Fertig, Bestätigen, Ausgewählt', uses: ['Kopfknopf „Fertig“', 'Ausgewählt in Listen und Auswahl', 'Heute getragen (erledigt) in der Werkzeugleiste', 'Auswahl-Plakette auf der Kachel'],
    els: ['M5 12.5l4.5 4.5L19 7.5'] },
  plus: { group: 'bedienung', meaning: 'Hinzufügen, Neu anlegen', uses: ['Plus-Knopf (neues Teil)', 'Neue Liste', 'Tag in der Wochenleiste planen', 'Neues Set', 'Anzahl erhöhen'],
    els: ['M12 5v14', 'M5 12h14'] },
  minus: { group: 'bedienung', meaning: 'Verringern', uses: ['Anzahl verringern'],
    els: ['M5 12h14'] },
  search: { group: 'bedienung', meaning: 'Suchen', uses: ['Suche öffnen (Schrank, Wunschliste, Baukasten)', 'Suchfeld'],
    els: ['c:11,11,6.5', 'm16 16 4 4'] },
  sort: { group: 'bedienung', meaning: 'Sortieren', uses: ['Sortierung wählen'],
    els: ['M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4'] },
  filter: { group: 'bedienung', meaning: 'Filtern', uses: ['Filter-Blatt öffnen'],
    els: ['M4 7h16M7 12h10M10 17h4'] },
  more: { group: 'bedienung', meaning: 'Mehr: Menü mit weiteren Aktionen', uses: ['Menü einer Wunschliste'],
    els: ['f:5,12,1.7', 'f:12,12,1.7', 'f:19,12,1.7'] },
  chevron: { group: 'bedienung', meaning: 'Weiter, Aufklappen, Blättern (Richtung durch Drehen)', uses: ['Zeile öffnen (nach rechts)', 'Zeile aufklappen (nach unten)', 'Woche/Monat blättern', 'Wochen-/Monatsansicht umschalten'],
    els: ['M9 6l6 6-6 6'] },
  arrowUp: { group: 'bedienung', meaning: 'Nach oben verschieben', uses: ['Reihenfolge: eins nach oben'],
    els: ['M12 19V5', 'M6.5 10.5 12 5l5.5 5.5'] },
  arrowDown: { group: 'bedienung', meaning: 'Nach unten verschieben', uses: ['Reihenfolge: eins nach unten'],
    els: ['M12 5v14', 'M6.5 13.5 12 19l5.5-5.5'] },
  grip: { group: 'bedienung', meaning: 'Ziehen zum Umsortieren', uses: ['vorgemerkt: Reihenfolge per Ziehen'],
    els: ['M5 8h14', 'M5 12h14', 'M5 16h14'], reserved: true },
  share: { group: 'bedienung', meaning: 'Teilen, Exportieren', uses: ['Bild teilen (Teil, Outfit)'],
    els: ['M12 3v12', 'M7 8l5-5 5 5', 'M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6'] },
  edit: { group: 'bedienung', meaning: 'Bearbeiten', uses: ['Teil bearbeiten', 'Outfit bearbeiten'],
    els: ['M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z', 'M13.5 6.5l4 4'] },
  undo: { group: 'bedienung', meaning: 'Zurücksetzen, Rückgängig', uses: ['vorgemerkt: Kopfknopf „Zurücksetzen“ in Bearbeiten (laut Spec)'],
    els: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'], reserved: true },
  calendar: { group: 'bedienung', meaning: 'Für einen Tag vormerken', uses: ['Teil reservieren', 'Kauftag planen', 'Outfit für einen Tag planen'],
    els: ['M5.5 5h13a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M8 3v4', 'M16 3v4', 'M3.5 10h17', 'M9.5 15l2 2 3.5-3.5'] },
  outfitNew: { group: 'bedienung', meaning: 'Outfit zusammenstellen (Baukasten)', uses: ['„Outfit damit“ (Teil-Detail)', '„Im Baukasten ausprobieren“ / „Im Outfit ansehen“ (Wunschteil)'],
    els: ['M6.5 7h8A2.5 2.5 0 0 1 17 9.5v9a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 4 18.5v-9A2.5 2.5 0 0 1 6.5 7Z', 'M8 7V5.5A2.5 2.5 0 0 1 10.5 3h7A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H17', 'M10.5 11v6', 'M7.5 14h6'] },
  dice: { group: 'bedienung', meaning: 'Outfit würfeln (Zufall)', uses: ['vorgemerkt: Outfit-Vorschlag würfeln'],
    els: ['M5.5 3.5h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z', 'f:8.5,8.5,1.1', 'f:15.5,15.5,1.1', 'f:12,12,1.1'], reserved: true },
  external: { group: 'bedienung', meaning: 'Außerhalb öffnen', uses: ['Shop-Link öffnen'],
    els: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4'], src: 'Lucide' },
  link: { group: 'bedienung', meaning: 'Set: verknüpfte Teile', uses: ['Set-Schalter in Bearbeiten', 'Set-Plakette auf Kachel und Detail-Bild (oben rechts, links neben Wendbar)'],
    els: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'], src: 'Lucide' },
  camera: { group: 'bedienung', meaning: 'Foto aufnehmen/ändern', uses: ['Foto ändern', 'Quelle „Kamera“'],
    els: ['M5 7.5h1.8l1.7-2.5h7l1.7 2.5H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2z', 'c:12,12.5,3.2'] },
  photos: { group: 'bedienung', meaning: 'Aus den Fotos wählen', uses: ['Quelle „Fotos“'],
    els: ['M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2z', 'c:9,10,1.6', 'M21 16l-5-5-8 8'], src: 'Lucide' },
  mirror: { group: 'bedienung', meaning: 'Bild spiegeln (links/rechts)', uses: ['Runder Knopf „Spiegeln“ neben der Bild-Vorschau (Neues Teil, Bilder zuordnen, Foto ändern, Bearbeiten)'],
    els: ['M12 3v18', 'M9.5 7v10H3z', 'M14.5 7v10H21z'] },
  label: { group: 'bedienung', meaning: 'Etikett', uses: ['Infos aus dem Etikett', 'Etikett im Steckbrief'],
    els: ['M11.6 3.6A2 2 0 0 0 10.2 3H5a2 2 0 0 0-2 2v5.2a2 2 0 0 0 .6 1.4l8.2 8.2a2 2 0 0 0 2.8 0l5.2-5.2a2 2 0 0 0 0-2.8z', 'c:7.5,7.5,1.4'], src: 'Lucide' },
  phone: { group: 'bedienung', meaning: 'Shop-Screenshot', uses: ['Infos aus einem Shop-Screenshot'],
    els: ['M8.21 3h7.58a1.89 1.89 0 0 1 1.89 1.9v14.2a1.89 1.89 0 0 1-1.89 1.9H8.21a1.89 1.89 0 0 1-1.89-1.9v-14.2a1.89 1.89 0 0 1 1.89-1.9z', 'M10.11 18.16h3.78', 'M9.16 7.27h5.68', 'M9.16 10.58h5.68'] },
  bag: { group: 'bedienung', meaning: 'Bestellung', uses: ['Infos aus der Bestellbestätigung'],
    els: ['M5.6 8h12.8a1 1 0 0 1 1 1.1l-.9 9.1a2 2 0 0 1-2 1.8H7.5a2 2 0 0 1-2-1.8l-.9-9.1a1 1 0 0 1 1-1.1z', 'M9 8V6.5a3 3 0 0 1 6 0V8'] },
  bagCheck: { group: 'bedienung', meaning: 'Gekauft', uses: ['Wunschteil „Gekauft – in den Schrank“'],
    els: ['M5.6 8h12.8a1 1 0 0 1 1 1.1l-.9 9.1a2 2 0 0 1-2 1.8H7.5a2 2 0 0 1-2-1.8l-.9-9.1a1 1 0 0 1 1-1.1z', 'M9 8V6.5a3 3 0 0 1 6 0V8', 'M9.2 14l2 2 3.6-3.6'] },
  sparkle: { group: 'bedienung', meaning: 'KI', uses: ['„Infos auslesen“ (KI)', 'KI-Hinweis'],
    els: ['M10 3.5l1.9 5.1L17 10.5l-5.1 1.9L10 17.5l-1.9-5.1L3 10.5l5.1-1.9Z', 'M18 14.5l0.8 2.2L21 17.5l-2.2 0.8L18 20.5l-0.8-2.2L15 17.5l2.2-0.8Z'], src: 'Lucide' },
  tagNone: { group: 'bedienung', meaning: 'Keine Kategorie gewählt', uses: ['Wunschteil ohne Kategorie'],
    els: ['c:12,12,7.5'] },
  wornToday: { group: 'plakette', meaning: 'Heute getragen, geplant oder reserviert', uses: ['Plakette unten links (Kachel, Outfit-Karte, Detail-Bild)', 'Werkzeugleiste „Heute tragen“'],
    els: ['M10 6a2 2 0 1 1 2 2v1.6l-8.4 5.7A1.5 1.5 0 0 0 4.4 18h15.2a1.5 1.5 0 0 0 .8-2.7L12 9.6'] },
  outfits: { group: 'tab', meaning: 'Outfits', uses: ['Tab „Outfits“'],
    els: ['M6.5 7h8A2.5 2.5 0 0 1 17 9.5v9a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 4 18.5v-9A2.5 2.5 0 0 1 6.5 7Z', 'M8 7V5.5A2.5 2.5 0 0 1 10.5 3h7A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H17'] },
  heart: { group: 'tab', meaning: 'Wunschliste', uses: ['Tab „Wunschliste“'],
    els: ['M12 20.5c-.4 0-.8-.15-1.1-.4C6.6 16.4 3 13.2 3 8.9 3 6.2 5.1 4 7.7 4c1.7 0 3.2.9 4.3 2.3C13.1 4.9 14.6 4 16.3 4 18.9 4 21 6.2 21 8.9c0 4.3-3.6 7.5-7.9 11.2-.3.25-.7.4-1.1.4Z'] },
  chart: { group: 'tab', meaning: 'Statistik', uses: ['Tab „Statistik“'],
    els: ['M3 3v16a2 2 0 0 0 2 2h16', 'M7 7h8M7 11.5h12M7 16h5'] },
  closet: { group: 'status', meaning: 'Im Schrank', uses: ['Status „Im Schrank“', 'Tab „Schrank“'],
    els: ['M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z', 'M12 3v18', 'M9.5 11v2', 'M14.5 11v2'] },
  wash: { group: 'status', meaning: 'Wäsche', uses: ['Status „Wäsche“'],
    els: ['M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'c:12,13,4.5', 'M7.5 6.5h2'] },
  repair: { group: 'status', meaning: 'Reparatur', uses: ['Status „Reparatur“'],
    els: ['c:6,6,3', 'c:6,18,3', 'M20 4L8.1 15.9', 'M14.5 14.5L20 20', 'M8.1 8.1L12 12'] },
  lent: { group: 'status', meaning: 'Verliehen', uses: ['Status „Verliehen“', 'Hinweis „Rückgabe fällig“'],
    els: ['M5.5 18.5l13-13', 'M7.5 5.5h11v11'] },
  stored: { group: 'status', meaning: 'Eingelagert', uses: ['Status „Eingelagert“'],
    els: ['M3 13l2.3-7.4A2 2 0 0 1 7.2 4h9.6a2 2 0 0 1 1.9 1.6L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M3 13h5l1.5 2.5h5L16 13h5'] },
  out: { group: 'status', meaning: 'Aussortiert', uses: ['Status „Aussortiert“'],
    els: ['M4.5 4h15a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1 -1.5 1.5h-15a1.5 1.5 0 0 1 -1.5 -1.5v-2a1.5 1.5 0 0 1 1.5 -1.5z', 'M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9', 'M10 13h4'] },
  sold: { group: 'status', meaning: 'Verkauft', uses: ['Status „Verkauft“'],
    els: ['c:12,12,9', 'M15.5 8.6a4.5 4.5 0 1 0 0 6.8', 'M7 11h6', 'M7 13.4h6'] },
  reversible: { group: 'plakette', meaning: 'Wendbar', uses: ['Plakette oben rechts', 'Schalter „Wendbar“ in Bearbeiten'],
    els: ['M4.5 11a7.5 7.5 0 0 1 13-4.5L19.5 8.5', 'M19.5 4v4.5H15', 'M19.5 13a7.5 7.5 0 0 1-13 4.5L4.5 15.5', 'M4.5 20v-4.5H9'] },
  grail: { group: 'wunsch', meaning: 'Grail', uses: ['Wunsch-Kategorie „Grail“'],
    els: ['M4.5 16l-1.2-8.5 5 3.8L12 5l3.7 6.3 5-3.8L19.5 16z', 'M4.5 19.5h15'] },
  watchlist: { group: 'wunsch', meaning: 'Watchlist', uses: ['Wunsch-Kategorie „Watchlist“'],
    els: ['M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z', 'c:12,12,2.6'] },
  nextcop: { group: 'wunsch', meaning: 'Next Cop', uses: ['Wunsch-Kategorie „Next Cop“'],
    els: ['M5 12h13', 'M13 6l6 6-6 6'] },
  someday: { group: 'wunsch', meaning: 'Someday', uses: ['Wunsch-Kategorie „Someday“'],
    els: ['M15.5 3.5l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z', 'M9.5 13.5l-6 6', 'M12.5 16.5l-3 3', 'M7 11l-3 3'] },
  gift: { group: 'wunsch', meaning: 'Geschenk', uses: ['Wunsch-Kategorie „Gift“', 'Eigenschaft „Geschenk“ (Bearbeiten, Kauf)'],
    els: ['M4 8.3h16v3H4z', 'M5.5 11.3V18.8h13v-7.5', 'M12 8.3V18.8', 'M12 8.3C10.5 4.8 7 4.3 7 6.3S10 8.3 12 8.3c2 0 5 0 5-2s-3.5-1.5-5 2'] },
  catOberbekleidung: { group: 'kategorie', meaning: 'Oberbekleidung', uses: ['Oberkategorie „Oberbekleidung“'],
    els: ['M8 3 4.7 4.3a2 2 0 0 0-1.3 1.6L2 18.9a1 1 0 0 0 1 1.1h2.1a1 1 0 0 0 1-.9L7 12v7a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-7l.9 7.1a1 1 0 0 0 1 .9H21a1 1 0 0 0 1-1.1L20.6 5.9a2 2 0 0 0-1.3-1.6L16 3', 'M8 3l4 4 4-4M12 7v14'] },
  catOberteil: { group: 'kategorie', meaning: 'Oberteil', uses: ['Oberkategorie „Oberteil“'],
    els: ['M19.54 4.31L15.6 3a3.6 3.6 0 0 1-7.2 0L4.46 4.31a1.8 1.8 0 0 0-1.21 2.01l.52 3.12a.9.9 0 0 0 .89.76H6.6v9c0 .99.81 1.8 1.8 1.8h7.2a1.8 1.8 0 0 0 1.8-1.8V10.2h1.94a.9.9 0 0 0 .89-.76l.52-3.12a1.8 1.8 0 0 0-1.21-2.01z'], src: 'Lucide' },
  catKleid: { group: 'kategorie', meaning: 'Kleid', uses: ['Oberkategorie „Kleid“'],
    els: ['M9.16 3v4.74M14.84 3v4.74', 'M8.21 7.74h7.58l-1.14 4.26 3.79 7.86a.85.85 0 0 1-.76 1.14H6.32a.85.85 0 0 1-.76-1.14l3.79-7.86Z'] },
  catHose: { group: 'kategorie', meaning: 'Hose', uses: ['Oberkategorie „Hose“'],
    els: ['M6.2 3h11.6a1 1 0 0 1 1 .95l.9 16a1 1 0 0 1-1 1.05H15a1 1 0 0 1-1-.85L12 10l-2 10.15a1 1 0 0 1-1 .85H5.3a1 1 0 0 1-1-1.05l.9-16A1 1 0 0 1 6.2 3Z', 'M5.4 7h13.2'] },
  catShorts: { group: 'kategorie', meaning: 'Shorts', uses: ['Oberkategorie „Shorts“'],
    els: ['M6.1 4.62h11.8a1.02 1.02 0 0 1 1.02.92l1.32 12.72a1.02 1.02 0 0 1-1.01 1.12h-4.69a1.02 1.02 0 0 1-1.01-.81L12 11.75l-1.53 6.82a1.02 1.02 0 0 1-1.01.81H4.77a1.02 1.02 0 0 1-1.01-1.12l1.32-12.72a1.02 1.02 0 0 1 1.02-.92Z', 'M5.49 8.69h13.02'] },
  catRock: { group: 'kategorie', meaning: 'Rock', uses: ['Oberkategorie „Rock“'],
    els: ['M7.46 3.92h9.08a1.01 1.01 0 0 1 1.01.81l2.93 14.13a1.01 1.01 0 0 1-1.01 1.22H4.53a1.01 1.01 0 0 1-1.01-1.22l2.93-14.13a1.01 1.01 0 0 1 1.01-.81Z', 'M6.75 7.46h10.5M9.98 7.46l-1.01 12.62M14.02 7.46l1.01 12.62'] },
  catSchuh: { group: 'kategorie', meaning: 'Schuh', uses: ['Oberkategorie „Schuh“'],
    els: ['M4 5.5h3a1 1 0 0 1 .9.6L9.5 9.5l9.4 2.5A4 4 0 0 1 22 15.9v.6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z', 'M2 14.5h20M10.5 9.8l-1 1.9M13.5 10.6l-1 1.9'] },
  catKopfbedeckung: { group: 'kategorie', meaning: 'Kopfbedeckung', uses: ['Oberkategorie „Kopfbedeckung“'],
    els: ['M2 14.37a7.89 7.89 0 0 1 15.79 0Z', 'M14.63 14.37h5.79a1.58 1.58 0 0 1 0 3.16h-4.74a3.16 3.16 0 0 1-3.15-3.16', 'M9.89 6.47v.01'] },
  catTasche: { group: 'kategorie', meaning: 'Tasche', uses: ['Oberkategorie „Tasche“'],
    els: ['M6.15 9.31h11.7a2.66 2.66 0 0 1 2.65 2.66v6.37a2.66 2.66 0 0 1-2.65 2.66H6.15a2.66 2.66 0 0 1-2.65-2.66v-6.37a2.66 2.66 0 0 1 2.65-2.66Z', 'M6.69 9.31l3.82-5.53a1.81 1.81 0 0 1 2.98 0l3.82 5.53M3.5 13.56h17M12 13.56v2.13'] },
  catAccessoire: { group: 'kategorie', meaning: 'Accessoire', uses: ['Oberkategorie „Accessoire“'],
    els: ['c:6,15,4', 'c:18,15,4', 'M14 15a2 2 0 0 0-4 0M2.5 13 5 7c.7-1.3 1.4-2 3-2M21.5 13 19 7c-.7-1.3-1.5-2-3-2'] },
  catSchmuck: { group: 'kategorie', meaning: 'Schmuck', uses: ['Oberkategorie „Schmuck“'],
    els: ['c:12,12,5.41', 'M12 10.21v1.8l.9.9M15.72 8.1l-.73-3.65a1.8 1.8 0 0 0-1.8-1.45h-2.42a1.8 1.8 0 0 0-1.76 1.45L8.28 8.1M8.29 15.94l.72 3.61a1.8 1.8 0 0 0 1.8 1.45h2.45a1.8 1.8 0 0 0 1.8-1.45l.73-3.65'], src: 'Lucide' },
  occAlltag: { group: 'anlass', meaning: 'Alltag', uses: ['Anlass „Alltag“'],
    els: ['M4.8 15.6v-2.14C4.8 11.55 3.87 10.65 3.9 8.4c0.03-2.45 1.34-5.4 4.05-5.4C9.63 3 10.2 4.62 10.2 6.15c0 2.8-1.8 5.09-1.8 7.81V15.6a1.8 1.8 0 1 1-3.6 0Z', 'M19.2 19.2v-2.14c0-1.91 0.93-2.81 0.9-5.06-0.03-2.45-1.34-5.4-4.05-5.4C14.37 6.6 13.8 8.22 13.8 9.75c0 2.8 1.8 5.09 1.8 7.81V19.2a1.8 1.8 0 1 0 3.6 0Z', 'M15.6 16.5h3.6', 'M4.8 12.9h3.6'], src: 'Lucide' },
  occBuero: { group: 'anlass', meaning: 'Büro', uses: ['Anlass „Büro“'],
    els: ['M5 7.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2z', 'M16 7.5V5.5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2'], src: 'Lucide' },
  occDate: { group: 'anlass', meaning: 'Date', uses: ['Anlass „Date“'],
    els: ['M8 21h8', 'M12 14v7', 'M7 3h10l-.4 5.5a4.6 4.6 0 0 1-9.2 0Z'] },
  occFormell: { group: 'anlass', meaning: 'Formell', uses: ['Anlass „Formell“'],
    els: ['M3 7v10l7-3.5v-3Z', 'M21 7v10l-7-3.5v-3Z', 'M11 10h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z'] },
  occUrlaub: { group: 'anlass', meaning: 'Urlaub', uses: ['Anlass „Urlaub“'],
    els: ['M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'], src: 'Lucide' },
  occLounge: { group: 'anlass', meaning: 'Loungewear', uses: ['Anlass „Loungewear“'],
    els: ['M4 9.5V6.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3', 'M2 11.5a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z', 'M5 17.5v2', 'M19 17.5v2'], src: 'Lucide' },
  occParty: { group: 'anlass', meaning: 'Party', uses: ['Anlass „Party“'],
    els: ['M12 2.5V5', 'c:12,12.8,7.8', 'M4.9 9.6h14.2', 'M4.9 16h14.2', 'M12 5c-3 2.4-3 13.2 0 15.6', 'M12 5c3 2.4 3 13.2 0 15.6'] },
  occSport: { group: 'anlass', meaning: 'Sport', uses: ['Anlass „Sport“'],
    els: ['M6.5 6.5v11', 'M17.5 6.5v11', 'M3 9.5v5', 'M21 9.5v5', 'M6.5 12h11'] },
  occBesonders: { group: 'anlass', meaning: 'Besonderer Anlass', uses: ['Anlass „Besonderer Anlass“'],
    els: ['c:12,9,6', 'M8.6 13.9 7 21l5-2.6 5 2.6-1.6-7.1'] },
  occCampus: { group: 'anlass', meaning: 'Campus', uses: ['Anlass „Campus“'],
    els: ['M22 10 12 5 2 10l10 5 10-5Z', 'M6 12v5c3 2 9 2 12 0v-5'], src: 'Lucide' },
  occStrand: { group: 'anlass', meaning: 'Strand', uses: ['Anlass „Strand“'],
    els: ['M3.48 11.55a8.52 8.52 0 0 1 17.04 0Z', 'M12 11.55l-2.37 9.47', 'M4.42 21.02h15.16'] },
  occCafe: { group: 'anlass', meaning: 'Café', uses: ['Anlass „Café“'],
    els: ['M16.23 8.71h0.95a3.79 3.79 0 0 1 0 7.58h-0.95', 'M2.98 8.71h13.25v8.52a3.79 3.79 0 0 1-3.78 3.79H6.77a3.79 3.79 0 0 1-3.79-3.79Z', 'M5.82 3.03v1.89', 'M9.61 3.03v1.89', 'M13.39 3.03v1.89'], src: 'Lucide' },
  occSonst: { group: 'anlass', meaning: 'Sonstiges', uses: ['Anlass „Sonstiges“'],
    els: ['M12 3.5l4.3 7.3H7.7Z', 'M5 13.5h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1 -1.5 1.5h-4a1.5 1.5 0 0 1 -1.5 -1.5v-4a1.5 1.5 0 0 1 1.5 -1.5z', 'c:17,17,3.5'] },
  sprout: { group: 'saison', meaning: 'Frühling', uses: ['Saison „Frühling“'],
    els: ['M12 20V10.5', 'M12 12.5C12 8.6 9.3 6 5.5 6c0 3.9 2.7 6.5 6.5 6.5Z', 'M12 10.5c0-4 2.6-6.5 6.5-6.5 0 4-2.6 6.5-6.5 6.5Z', 'M8 20h8'] },
  sun: { group: 'saison', meaning: 'Sommer', uses: ['Saison „Sommer“'],
    els: ['c:12,12,3.6', 'M12 3v1.6', 'M12 19.4V21', 'M5.64 5.64l1.13 1.13', 'M17.23 17.23l1.13 1.13', 'M3 12h1.6', 'M19.4 12H21', 'M5.64 18.36l1.13-1.13', 'M17.23 6.77l1.13-1.13'] },
  acorn: { group: 'saison', meaning: 'Herbst', uses: ['Saison „Herbst“'],
    els: ['M5.5 10.5c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5Z', 'M12 5V3', 'M7 10.5c0 5.3 2.7 9.4 5 10.5 2.3-1.1 5-5.2 5-10.5'] },
  snow: { group: 'saison', meaning: 'Winter', uses: ['Saison „Winter“'],
    els: ['M12 3v18', 'M4.21 7.5l15.58 9', 'M4.21 16.5l15.58-9', 'M9.6 4.4L12 6.5l2.4-2.1', 'M14.4 19.6L12 17.5l-2.4 2.1', 'M17.38 6.12l-.62 3.13 3.02 1.03', 'M6.62 17.88l.62-3.13-3.02-1.03', 'M19.78 13.72l-3.02 1.03.62 3.13', 'M4.22 10.28l3.02-1.03-.62-3.13'] },
  thermo: { group: 'wetter', meaning: 'Wärme', uses: ['Wärme-Skala'],
    els: ['M13.86 14.6V5.49a1.86 1.86 0 0 0-3.72 0v9.11a3.72 3.72 0 1 0 3.72 0z'], src: 'Lucide' },
  drop: { group: 'wetter', meaning: 'Regen', uses: ['Regen-Skala'],
    els: ['M12 3.5s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z'], src: 'Lucide' },
  w30: { group: 'pflege', meaning: 'Waschen 30 °C', uses: ['Pflege „Waschen 30 °C“'],
    els: ['M4 7.2l2.6 15h18.8L28 7.2', 'M4 7.2c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4-1.6 6 0', 't:16,19.2,8.5,700,30', 'M7 26.2h18'], grid: 32 },
  w40: { group: 'pflege', meaning: 'Waschen 40 °C', uses: ['Pflege „Waschen 40 °C“'],
    els: ['M4 7.2l2.6 15h18.8L28 7.2', 'M4 7.2c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4-1.6 6 0', 't:16,19.2,8.5,700,40', 'M7 26.2h18'], grid: 32 },
  w60: { group: 'pflege', meaning: 'Waschen 60 °C', uses: ['Pflege „Waschen 60 °C“'],
    els: ['M4 7.2l2.6 15h18.8L28 7.2', 'M4 7.2c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4-1.6 6 0', 't:16,19.2,8.5,700,60', 'M7 26.2h18'], grid: 32 },
  w95: { group: 'pflege', meaning: 'Waschen 95 °C', uses: ['Pflege „Waschen 95 °C“'],
    els: ['M4 7.2l2.6 15h18.8L28 7.2', 'M4 7.2c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4-1.6 6 0', 't:16,19.2,8.5,700,95', 'M7 26.2h18'], grid: 32 },
  hand: { group: 'pflege', meaning: 'Handwäsche', uses: ['Pflege „Handwäsche“'],
    els: ['M4 9l2.6 15h18.8L28 9', 'M4 9c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4-1.6 6 0', 'M12 22v-6.5a1.5 1.5 0 0 1 3 0V18m0-3.5v-1a1.5 1.5 0 0 1 3 0V19'], grid: 32 },
  nowash: { group: 'pflege', meaning: 'Nicht waschen', uses: ['Pflege „Nicht waschen“'],
    els: ['M4 9l2.6 15h18.8L28 9', 'M4 9c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4-1.6 6 0', 'M5 5l22 22', 'M27 5L5 27'], grid: 32 },
  bleach: { group: 'pflege', meaning: 'Bleichen erlaubt', uses: ['Pflege „Bleichen erlaubt“'],
    els: ['M16 5L29 27H3z'], grid: 32 },
  nochlor: { group: 'pflege', meaning: 'Nur Sauerstoffbleiche', uses: ['Pflege „Nur Sauerstoffbleiche“'],
    els: ['M16 5L29 27H3z', 'M13 13l-4 9', 'M18 13l-4 9'], grid: 32 },
  nobleach: { group: 'pflege', meaning: 'Nicht bleichen', uses: ['Pflege „Nicht bleichen“'],
    els: ['M16 4L29 26H3z', 'M8 10l16 18', 'M24 10L8 28'], grid: 32 },
  drylow: { group: 'pflege', meaning: 'Trockner schonend', uses: ['Pflege „Trockner schonend“'],
    els: ['M7 4h18a3 3 0 0 1 3 3v18a3 3 0 0 1 -3 3h-18a3 3 0 0 1 -3 -3v-18a3 3 0 0 1 3 -3z', 'c:16,16,8', 'f:16,16,1.4'], grid: 32 },
  drynorm: { group: 'pflege', meaning: 'Trockner normal', uses: ['Pflege „Trockner normal“'],
    els: ['M7 4h18a3 3 0 0 1 3 3v18a3 3 0 0 1 -3 3h-18a3 3 0 0 1 -3 -3v-18a3 3 0 0 1 3 -3z', 'c:16,16,8', 'f:13,16,1.4', 'f:19,16,1.4'], grid: 32 },
  nodry: { group: 'pflege', meaning: 'Nicht in den Trockner', uses: ['Pflege „Nicht in den Trockner“'],
    els: ['M7 4h18a3 3 0 0 1 3 3v18a3 3 0 0 1 -3 3h-18a3 3 0 0 1 -3 -3v-18a3 3 0 0 1 3 -3z', 'c:16,16,8', 'M5 5l22 22', 'M27 5L5 27'], grid: 32 },
  line: { group: 'pflege', meaning: 'Leinentrocknung', uses: ['Pflege „Leinentrocknung“'],
    els: ['M7 4h18a3 3 0 0 1 3 3v18a3 3 0 0 1 -3 3h-18a3 3 0 0 1 -3 -3v-18a3 3 0 0 1 3 -3z', 'M6 11c4-5 16-5 20 0'], grid: 32 },
  flat: { group: 'pflege', meaning: 'Liegend trocknen', uses: ['Pflege „Liegend trocknen“'],
    els: ['M7 4h18a3 3 0 0 1 3 3v18a3 3 0 0 1 -3 3h-18a3 3 0 0 1 -3 -3v-18a3 3 0 0 1 3 -3z', 'M9 16h14'], grid: 32 },
  iron1: { group: 'pflege', meaning: 'Bügeln niedrig', uses: ['Pflege „Bügeln niedrig“'],
    els: ['M4 24h24v-2c0-5-3.5-8-8-8H10L8 9H5', 'f:16.5,19.5,1.3'], grid: 32 },
  iron2: { group: 'pflege', meaning: 'Bügeln mittel', uses: ['Pflege „Bügeln mittel“'],
    els: ['M4 24h24v-2c0-5-3.5-8-8-8H10L8 9H5', 'f:14,19.5,1.3', 'f:19,19.5,1.3'], grid: 32 },
  iron3: { group: 'pflege', meaning: 'Bügeln hoch', uses: ['Pflege „Bügeln hoch“'],
    els: ['M4 24h24v-2c0-5-3.5-8-8-8H10L8 9H5', 'f:12,19.5,1.3', 'f:16.5,19.5,1.3', 'f:21,19.5,1.3'], grid: 32 },
  noiron: { group: 'pflege', meaning: 'Nicht bügeln', uses: ['Pflege „Nicht bügeln“'],
    els: ['M4 24h24v-2c0-5-3.5-8-8-8H10L8 9H5', 'M6 8l20 17', 'M26 8L6 25'], grid: 32 },
  prof: { group: 'pflege', meaning: 'Reinigung P', uses: ['Pflege „Reinigung P“'],
    els: ['c:16,16,11', 't:16,20.5,12,600,P'], grid: 32 },
  profF: { group: 'pflege', meaning: 'Reinigung F', uses: ['Pflege „Reinigung F“'],
    els: ['c:16,16,11', 't:16,20.5,12,600,F'], grid: 32 },
  profW: { group: 'pflege', meaning: 'Nassreinigung W', uses: ['Pflege „Nassreinigung W“'],
    els: ['c:16,16,11', 't:16,20.5,12,600,W'], grid: 32 },
  noprof: { group: 'pflege', meaning: 'Keine chemische Reinigung', uses: ['Pflege „Keine chemische Reinigung“'],
    els: ['c:16,16,11', 'M8 8l16 16', 'M24 8L8 24'], grid: 32 },
} as const satisfies Record<string, SymbolDef>;

export type SymbolName = keyof typeof SYMBOLS;

/** Strichstärke: überall 2 (im 32er-Raster 2,67, damit der Strich gleich dick wirkt) */
export const SYMBOL_STROKE = 2;
export const strokeFor = (name: SymbolName) => (((SYMBOLS[name] as SymbolDef).grid ?? 24) === 32 ? (SYMBOL_STROKE * 32) / 24 : SYMBOL_STROKE);

/**
 * Feste Symbol-Größen (px) mit Aufgabe. Plaketten (Kachel, Outfit-Karte, Detail-Bild) haben eigene Maße in itemTile/outfitCard/detail.
 * mini: X in Mini-Knöpfen · inline: Pfeile/Symbole neben Text · chip: Chips und Kapseln (alle Tabs gleich) · row: Zeilen, Listen, Menüs,
 * Schalter · button: runde Knöpfe (Kopfzeile, Werkzeugleiste, Suche/Sortieren) · bar: Tab-Leiste, Hauptknopf · large: große Einzel-Symbole
 */
export const ICON_SIZE = { mini: 12, inline: 16, chip: 18, row: 20, button: 22, bar: 24, large: 28 } as const;
export type IconSize = keyof typeof ICON_SIZE;

/**
 * Feste Monogramm-Größen (Durchmesser in px, entschieden 15.11.2026 mit Max: Variante A „wie die Kachel-Plakette“).
 * In Chips und Kapseln ist das Monogramm genau die Plakette der Kachel: weiße Scheibe 20 px, Gloock-Buchstabe 55 %
 * (= 11 px) in der Personen-Textfarbe – damit Kapsel und Kachel gleich aussehen und die Scheibe nur so groß wie ein
 * Symbol (chip 18) wirkt. Sitzt konzentrisch: Rand links = Rand oben/unten (Chip 36 → 8, Kapsel 38 → 9, hoher Chip 44 → 12).
 * text: neben 14-px-Text (Infozeilen, Balken, Kopf einer Liste) · chip: alle Chips und Kapseln
 * row: Listenzeile mit zwei Textzeilen (= Wert-Kreis 38) · button: Profil-Knopf (= runde Knöpfe 44)
 * Plaketten (Kachel, Outfit-Karte, Detail-Bild) haben ihre Maße in itemTile.badge (Kachel: 20 / 11, gleich wie chip).
 */
export const MONO_SIZE = { text: 18, chip: 20, row: 38, button: 44 } as const;
/** Buchstabe im Monogramm: Anteil am Durchmesser (wie auf der Kachel 11/20) */
export const MONO_LETTER = 0.55;
/** Rand links eines Monogramms in einer Pille dieser Höhe (konzentrisch, von der Außenkante; bei 1-px-Rand padding = Wert − 1) */
export const monoInset = (height: number) => (height - MONO_SIZE.chip) / 2;
export type MonoSize = keyof typeof MONO_SIZE;

/** Oberkategorie → Symbol (Schrank-Chips) */
export const CATEGORY_ICON: Record<string, SymbolName> = {'Oberbekleidung': 'catOberbekleidung', 'Oberteil': 'catOberteil', 'Kleid': 'catKleid', 'Hose': 'catHose', 'Shorts': 'catShorts', 'Rock': 'catRock', 'Schuh': 'catSchuh', 'Kopfbedeckung': 'catKopfbedeckung', 'Tasche': 'catTasche', 'Accessoire': 'catAccessoire', 'Schmuck': 'catSchmuck'};

/** Saison → Symbol */
export const SEASON_ICON: Record<string, SymbolName> = { Frühling: 'sprout', Sommer: 'sun', Herbst: 'acorn', Winter: 'snow' };

-- Status „eingelagert“ (z. B. im Keller, kein direkter Zugriff) getrennt von „aussortiert“ (soll verkauft werden).
-- Eingelagert zählt weiter zum Bestand, fällt aber aus Vorschlägen heraus.
alter type item_status add value if not exists 'stored' after 'lent';

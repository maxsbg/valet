import { itemTile, type SymbolName } from '@valet/ui';
import { SymbolSvg } from '@/components/Icon';

/**
 * Symbol auf einer Plakette (Kachel, Outfit-Karte × 1,5, Detail-Bild × 2) – Formen aus dem Symbol-Pool,
 * Maße aus itemTile.badge (Strich 2 wie überall). Außerhalb von Plaketten immer <Icon/> benutzen.
 * scale: ganze Plakette vergrößert – Größe und Versatz wachsen mit, die Strichstärke im Raster bleibt gleich.
 */
export function TileIcon({ name, color, scale = 1 }: { name: SymbolName; color: string; scale?: number }) {
  const base = name === 'wornToday' ? itemTile.badge.wornToday : itemTile.badge.icon;
  // Bügel optisch mittig (Versatz aus den Tokens), alle anderen Symbole sind im Raster zentriert
  const offsetY = name === 'wornToday' ? itemTile.badge.wornToday.offsetY * scale : 0;
  return <SymbolSvg name={name} px={base.size * scale} color={color} offsetY={offsetY} />;
}

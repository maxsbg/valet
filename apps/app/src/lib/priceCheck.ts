// Preis-Check der Wunschteile beim Öffnen der App (Max, 17.11.2026).
// Ohne KI: Die Edge Function `produkt` liest den Preis aus den strukturierten Angaben der Shopseite
// (JSON-LD, Shopify, og-Tags). Nur Teile mit Link; je Teil höchstens alle CHECK_EVERY_H Stunden,
// damit Shops nicht bei jedem Öffnen dutzendfach angefragt werden (sonst sperren sie eher).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { priceUpdate } from '@valet/core';
import { loadProduct } from './produkt';
import { supabase } from './supabase';
import type { Tile } from './wardrobe';

const CHECK_EVERY_H = 6;
const PARALLEL = 2;
const KEY = 'valet-preischeck';

type Row = { id: string; link: string | null; list_price: number | null; wish_price: number | null };

/** Prüft im Hintergrund; meldet geänderte Preise über `onChange` (für die Kacheln). Fehler werden still übergangen. */
export async function checkWishPrices(wardrobeId: string, onChange: (id: string, change: Partial<Tile>) => void): Promise<void> {
  let seen: Record<string, number> = {};
  try { seen = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}'); } catch { /* neu anfangen */ }
  const { data } = await supabase.from('items').select('id,link,list_price,wish_price')
    .eq('wardrobe_id', wardrobeId).eq('is_wish', true).not('link', 'is', null).neq('link', '');
  const due = ((data ?? []) as Row[]).filter((r) => r.link && Date.now() - (seen[r.id] ?? 0) > CHECK_EVERY_H * 3600_000);
  if (!due.length) return;

  const queue = [...due];
  const work = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      try {
        const page = await loadProduct(r.link!);
        const up = priceUpdate(r.list_price, r.wish_price, page.facts.price, page.facts.currency);
        if (up) {
          const { error } = await supabase.from('items').update(up).eq('id', r.id);
          if (!error) onChange(r.id, { listPrice: up.list_price, price: up.list_price });
        }
      } catch { /* Shop gesperrt oder offline – nächstes Mal wieder */ }
      seen[r.id] = Date.now();
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, work));
  AsyncStorage.setItem(KEY, JSON.stringify(seen)).catch(() => {});
}

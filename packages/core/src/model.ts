// Fachliches Datenmodell der neuen App (plattformunabhängig, entspricht dem Supabase-Schema)
import type { ItemStatus } from './catalog';

export type Side = 'a' | 'b';

export interface Payer {
  personId: string;
  amount: number | null;
}

export interface Item {
  id: string;
  ownerId: string | null;
  name: string;
  brand: string;
  category: string;
  color: string;
  altColor: string;
  size: string;
  material: string;
  style: string;
  seasons: string[];
  layer: string | null;
  qty: number;
  pricePaid: number | null;
  listPrice: number | null;
  payers: Payer[] | null;
  purchaseDate: string | null;
  shop: string;
  status: ItemStatus | null;
  statusAt: string | null;
  isWish: boolean;
  reversible: boolean;
  mainSide: Side;
  /** Bild-IDs pro Seite, sofern vorhanden */
  images: Partial<Record<Side, string>>;
}

export interface OutfitPlan {
  id: string;
  date: string; // YYYY-MM-DD
  personId: string | null;
}

export interface Outfit {
  id: string;
  ownerId: string | null;
  itemIds: string[];
  plans: OutfitPlan[];
  occasions: string[];
}

/** Explizit eingetragene Trage-Tage je Teil (Tabelle wears) */
export type WearLog = Record<string, string[]>;

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { loadWardrobe, type Tile, type Wardrobe } from './wardrobe';
import { loadOutfits, todayIds, todayWho } from './outfits';

type Ctx = {
  session: Session | null;
  ready: boolean;
  wardrobe: Wardrobe | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Teil lokal ändern, ohne neu zu laden */
  patch: (id: string, change: Partial<Tile>) => void;
  /** Teil heute getragen (bzw. nicht mehr) – lokal, ohne neu zu laden */
  setToday: (itemId: string, personId: string | null, worn: boolean) => void;
  /** Outfits, Planungen und Trage-Tage neu laden (nach Änderungen an Outfits) */
  reloadOutfits: () => Promise<void>;
};
const C = createContext<Ctx>({ session: null, ready: false, wardrobe: null, loading: false, error: null, reload: async () => {}, patch: () => {}, setToday: () => {}, reloadOutfits: async () => {} });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [wardrobe, setWardrobe] = useState<Wardrobe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setWardrobe(await loadWardrobe()); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (session) reload(); else setWardrobe(null); }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = useCallback((id: string, change: Partial<Tile>) =>
    setWardrobe((w) => (w ? { ...w, items: w.items.map((i) => (i.id === id ? { ...i, ...change } : i)) } : w)), []);
  const setToday = useCallback((itemId: string, personId: string | null, worn: boolean) => setWardrobe((w) => {
    if (!w) return w;
    const today = w.today.filter((x) => x !== itemId);
    const todayBy = { ...w.todayBy };
    if (worn) { today.push(itemId); todayBy[itemId] = personId; } else delete todayBy[itemId];
    return { ...w, today, todayBy };
  }), []);

  const wid = wardrobe?.id;
  const reloadOutfits = useCallback(async () => {
    if (!wid) return;
    const r = await loadOutfits(wid);
    setWardrobe((w) => {
      if (!w) return w;
      const ids = new Set(w.items.map((i) => i.id));
      const wears = r.wears.filter((x) => ids.has(x.itemId));
      return { ...w, outfits: r.outfits, wears, reservations: r.reservations, today: todayIds(r.outfits, wears, r.reservations), todayBy: todayWho(r.outfits, wears, r.reservations) };
    });
  }, [wid]);

  return <C.Provider value={{ session, ready, wardrobe, loading, error, reload, patch, setToday, reloadOutfits }}>{children}</C.Provider>;
}

export const useSession = () => useContext(C);

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { loadWardrobe, type Wardrobe } from './wardrobe';

type Ctx = {
  session: Session | null;
  ready: boolean;
  wardrobe: Wardrobe | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};
const C = createContext<Ctx>({ session: null, ready: false, wardrobe: null, loading: false, error: null, reload: async () => {} });

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

  return <C.Provider value={{ session, ready, wardrobe, loading, error, reload }}>{children}</C.Provider>;
}

export const useSession = () => useContext(C);

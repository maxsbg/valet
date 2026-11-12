import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Kleiner Zustand, der auf diesem Gerät gespeichert bleibt (z. B. Sortierung) */
export function usePersisted<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    AsyncStorage.getItem(key).then((s) => { if (s != null) try { setV(JSON.parse(s)); } catch {} }).catch(() => {});
  }, [key]);
  const set = (n: T) => { setV(n); AsyncStorage.setItem(key, JSON.stringify(n)).catch(() => {}); };
  return [v, set];
}

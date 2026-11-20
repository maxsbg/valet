// Kleine Anzeige-Einstellungen für alle Komponenten (auf diesem Gerät gespeichert).
// „Link fehlt“-Punkt auf den Kacheln (Max, 20.11.2026): an/aus im Profil-Blatt.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Settings = { linkDot: boolean };
const KEY = 'valet-settings';
let state: Settings = { linkDot: true };
const subs = new Set<() => void>();
AsyncStorage.getItem(KEY).then((s) => { if (s) try { state = { ...state, ...JSON.parse(s) }; subs.forEach((f) => f()); } catch { /* egal */ } }).catch(() => {});

export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  state = { ...state, [k]: v };
  subs.forEach((f) => f());
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}
export function useSettings(): Settings {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state, () => state);
}

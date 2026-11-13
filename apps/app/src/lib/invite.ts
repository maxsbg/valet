import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const KEY = 'valet.invite';
const PARAM = 'einladung';

/** Einladung aus der Adresse (…/valet/?einladung=…) merken – sie muss Anmelden und E-Mail-Bestätigung überstehen */
export async function captureInvite(): Promise<string | null> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    const token = url.searchParams.get(PARAM);
    if (token) {
      await AsyncStorage.setItem(KEY, token);
      url.searchParams.delete(PARAM);
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      return token;
    }
  }
  return AsyncStorage.getItem(KEY);
}

export const pendingInvite = () => AsyncStorage.getItem(KEY);
export const clearInvite = () => AsyncStorage.removeItem(KEY);

/** Adresse der App (mit baseUrl „/valet“) */
export function appUrl(): string {
  const base = (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '';
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://maxsbg.github.io';
  return `${origin}${base}/`;
}
export const inviteLink = (token: string) => `${appUrl()}?${PARAM}=${token}`;

/** Neue Einladung (7 Tage gültig, einmal einlösbar). Darf nur der Besitzer des Schranks. */
export async function createInvite(wardrobeId: string, userId: string): Promise<string> {
  const r = await supabase.from('wardrobe_invites').insert({ wardrobe_id: wardrobeId, created_by: userId, role: 'edit' }).select('token').single();
  if (r.error) {
    if (/row-level security|permission/i.test(r.error.message)) throw new Error('Nur wer den Schrank angelegt hat, kann einladen.');
    throw r.error;
  }
  return r.data.token as string;
}

/** Einladung einlösen → Mitglied im Schrank */
export async function acceptInvite(token: string): Promise<string> {
  const r = await supabase.rpc('accept_invite', { p_token: token });
  if (r.error) throw new Error(/ungültig|abgelaufen/i.test(r.error.message) ? 'Die Einladung ist ungültig oder abgelaufen. Lass dir einen neuen Link schicken.' : r.error.message);
  return r.data as string;
}

/** Person im Schrank mit dem eigenen Konto verbinden („Das bin ich“) */
export async function claimPerson(personId: string, userId: string) {
  const r = await supabase.from('persons').update({ user_id: userId }).eq('id', personId).is('user_id', null).select('id');
  if (r.error) throw r.error;
  if (!r.data?.length) throw new Error('Diese Person ist schon mit einem anderen Konto verbunden.');
}

/** Link teilen (Teilen-Menü am iPhone), sonst in die Zwischenablage */
export async function shareLink(url: string, text: string): Promise<'shared' | 'copied' | 'none'> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return 'none';
  if (navigator.share) {
    try { await navigator.share({ title: 'Valet', text, url }); return 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'none'; }
  }
  try { await navigator.clipboard.writeText(url); return 'copied'; } catch { return 'none'; }
}

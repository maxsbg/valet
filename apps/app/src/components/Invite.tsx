import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSession } from '@/lib/session';
import { useTheme, space, radius } from '@/lib/theme';
import { Monogram } from './Monogram';
import { claimPerson, createInvite, inviteLink, shareLink } from '@/lib/invite';

/** Personen im Schrank: wer schon ein Konto hat, wen man einladen kann, „Das bin ich“ */
export function Invite() {
  const t = useTheme();
  const { wardrobe, session, reload } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<{ person: string; url: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!wardrobe || !session) return null;
  const persons = wardrobe.persons;
  const me = persons.find((p) => p.user_id === session.user.id) ?? null;

  async function invite(personId: string, name: string) {
    setBusy(personId); setMsg(null);
    try {
      const token = await createInvite(wardrobe!.id, session!.user.id);
      const url = inviteLink(token);
      setLink({ person: personId, url });
      const r = await shareLink(url, `${name}, hier ist dein Zugang zu unserem Kleiderschrank in Valet:`);
      if (r === 'copied') setMsg('Link kopiert.');
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  }

  async function claim(personId: string) {
    setBusy(personId); setMsg(null);
    try { await claimPerson(personId, session!.user.id); await reload(); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  }

  return (
    <View style={[s.box, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      {persons.map((p, n) => {
        const linked = !!p.user_id;
        return (
          <View key={p.id} style={[s.row, n > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
            <Monogram person={p} size="row" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, color: t.ink }}>{p.name}{p.id === me?.id ? ' (ich)' : ''}</Text>
              <Text style={{ fontSize: 13, color: t.inkMuted }}>{linked ? 'hat ein Konto' : 'noch kein Konto'}</Text>
            </View>
            {busy === p.id ? <ActivityIndicator color={t.accent} /> : !linked && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {!me && <SmallBtn label="Das bin ich" onPress={() => claim(p.id)} />}
                {me && <SmallBtn primary label={link?.person === p.id ? 'Neuer Link' : 'Einladen'} onPress={() => invite(p.id, p.name)} />}
              </View>
            )}
          </View>
        );
      })}
      {link && (
        <View style={{ gap: 6, paddingTop: space.sm }}>
          <Text style={{ fontSize: 13, color: t.inkMuted }}>Schick diesen Link an {persons.find((p) => p.id === link.person)?.name}. Er gilt 7 Tage und nur einmal. Darüber legt {persons.find((p) => p.id === link.person)?.name} ein Konto an und tippt danach auf „Das bin ich“.</Text>
          <TextInput value={link.url} editable={false} selectTextOnFocus multiline
            style={[s.link, { color: t.ink, borderColor: t.hairline, backgroundColor: t.bg }, Platform.OS === 'web' ? ({ outlineStyle: 'none', userSelect: 'all' } as object) : null]} />
          <SmallBtn label="Nochmal teilen" onPress={() => shareLink(link.url, 'Dein Zugang zu Valet:').then((r) => r === 'copied' && setMsg('Link kopiert.'))} />
        </View>
      )}
      {msg && <Text style={{ fontSize: 14, color: t.ink, paddingTop: space.sm }}>{msg}</Text>}
    </View>
  );
}

function SmallBtn({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6}
      style={({ pressed }) => [s.btn, primary ? { backgroundColor: '#722638', borderColor: '#722638' } : { borderColor: t.hairline, backgroundColor: t.surface }, { opacity: pressed ? 0.8 : 1 }]}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: primary ? '#fff' : t.ink }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56, paddingVertical: 6 },
  btn: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start' },
  link: { fontSize: 13, borderWidth: 1, borderRadius: radius.sm, padding: space.xs },
});

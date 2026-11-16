import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { pendingInvite } from '@/lib/invite';
import { useTheme, DISPLAY, space, radius } from '@/lib/theme';

export default function Login() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [invited, setInvited] = useState(false);
  const [signUp, setSignUp] = useState(false);
  useEffect(() => { pendingInvite().then((x) => { if (x) { setInvited(true); setSignUp(true); } }); }, []);

  async function signIn() {
    setBusy(true); setMsg(null);
    if (signUp) {
      if (password.length < 8) { setBusy(false); return setMsg('Das Passwort braucht mindestens 8 Zeichen.'); }
      // Nach der E-Mail-Bestätigung zurück in die App; die Einladung ist auf dem Gerät gemerkt
      const redirect = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined;
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirect } });
      setBusy(false);
      if (error) return setMsg(/registered|already/i.test(error.message) ? 'Mit dieser E-Mail gibt es schon ein Konto – bitte anmelden.' : error.message);
      if (!data.session) setMsg('Fast geschafft: Bestätige deine E-Mail über den Link, den du gerade bekommen hast. Öffne ihn am besten in Safari auf diesem Gerät.');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMsg(error.message === 'Invalid login credentials' ? 'E-Mail oder Passwort stimmt nicht.' : error.message);
  }

  const field = [s.field, { backgroundColor: t.surface, borderColor: t.hairline, color: t.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null];
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.wrap, { backgroundColor: t.bg }]}>
      <View style={s.box}>
        <Text style={[s.word, { color: t.dark ? t.accent : '#722638' }]}>valet</Text>
        <Text style={[s.sub, { color: t.inkMuted }]}>{invited ? 'Du wurdest zu einem Kleiderschrank eingeladen.' : 'Euer Kleiderschrank'}</Text>
        <TextInput style={field} placeholder="E-Mail" placeholderTextColor={t.inkMuted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={field} placeholder={signUp ? 'Passwort (mind. 8 Zeichen)' : 'Passwort'} placeholderTextColor={t.inkMuted} secureTextEntry autoComplete={signUp ? 'new-password' : 'current-password'} value={password} onChangeText={setPassword} onSubmitEditing={signIn} />
        {msg && <Text style={[s.msg, { color: '#B3261E' }]}>{msg}</Text>}
        <Pressable onPress={signIn} disabled={busy || !email || !password} accessibilityRole="button"
          style={({ pressed }) => [s.btn, { opacity: busy || !email || !password ? 0.4 : pressed ? 0.85 : 1 }]}>
          <Text style={s.btnText}>{busy ? (signUp ? 'Konto wird angelegt …' : 'Anmelden …') : signUp ? 'Konto anlegen' : 'Anmelden'}</Text>
        </Pressable>
        {invited && (
          <Pressable accessibilityRole="button" onPress={() => { setSignUp(!signUp); setMsg(null); }} hitSlop={8} style={{ alignSelf: 'center', marginTop: space.xs }}>
            <Text style={{ fontSize: 15, color: t.inkMuted }}>{signUp ? 'Schon ein Konto? Anmelden' : 'Noch kein Konto? Konto anlegen'}</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  box: { width: '100%', maxWidth: 360, gap: space.sm },
  word: { fontFamily: DISPLAY, fontSize: 56, textAlign: 'center' },
  sub: { fontSize: 15, textAlign: 'center', marginBottom: space.md },
  field: { height: 50, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: space.md, fontSize: 17 },
  msg: { fontSize: 14 },
  btn: { height: 50, borderRadius: radius.sm, backgroundColor: '#722638', alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});

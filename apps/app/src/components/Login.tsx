import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useTheme, DISPLAY, space, radius } from '@/lib/theme';

export default function Login() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function signIn() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMsg(error.message === 'Invalid login credentials' ? 'E-Mail oder Passwort stimmt nicht.' : error.message);
  }

  const field = [s.field, { backgroundColor: t.surface, borderColor: t.hairline, color: t.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null];
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.wrap, { backgroundColor: t.bg }]}>
      <View style={s.box}>
        <Text style={[s.word, { color: t.dark ? t.accent : '#722638' }]}>valet</Text>
        <Text style={[s.sub, { color: t.inkMuted }]}>Euer Kleiderschrank</Text>
        <TextInput style={field} placeholder="E-Mail" placeholderTextColor={t.inkMuted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={field} placeholder="Passwort" placeholderTextColor={t.inkMuted} secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} onSubmitEditing={signIn} />
        {msg && <Text style={[s.msg, { color: '#B3261E' }]}>{msg}</Text>}
        <Pressable onPress={signIn} disabled={busy || !email || !password} accessibilityRole="button"
          style={({ pressed }) => [s.btn, { opacity: busy || !email || !password ? 0.4 : pressed ? 0.85 : 1 }]}>
          <Text style={s.btnText}>{busy ? 'Anmelden …' : 'Anmelden'}</Text>
        </Pressable>
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

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Sheet, OptionRow, SheetButton } from './Sheet';
import { useSession } from '@/lib/session';
import { useTheme, space } from '@/lib/theme';
import { acceptInvite, claimPerson, clearInvite } from '@/lib/invite';

/** Nach dem Anmelden: Einladung einlösen, danach „Wer bist du?“ (Person mit dem Konto verbinden) */
export function Join({ token }: { token: string | null }) {
  const t = useTheme();
  const { session, wardrobe, reload } = useSession();
  const [step, setStep] = useState<'idle' | 'who' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !session) return;
    acceptInvite(token)
      .then(async () => { await clearInvite(); await reload(); setStep('who'); })
      .catch(async (e) => { await clearInvite(); setMsg((e as Error).message); setStep('error'); });
  }, [token, session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const me = wardrobe?.persons.find((p) => p.user_id === session?.user.id);
  const free = (wardrobe?.persons ?? []).filter((p) => !p.user_id);
  const open = step === 'error' || (step === 'who' && !me && free.length > 0);

  async function pick(personId: string) {
    setBusy(true);
    try { await claimPerson(personId, session!.user.id); await reload(); setStep('idle'); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onClose={() => setStep('idle')} title={step === 'error' ? 'Einladung' : 'Willkommen! Wer bist du?'}
      footer={<SheetButton label={step === 'error' ? 'OK' : 'Später'} onPress={() => setStep('idle')} />}>
      {step === 'error' ? (
        <Text style={{ fontSize: 15, color: t.ink }}>{msg}</Text>
      ) : (
        <View>
          <Text style={{ fontSize: 15, color: t.inkMuted, marginBottom: space.xs }}>
            Du bist jetzt im Schrank „{wardrobe?.name}“. Wähl aus, wer du bist – dann sind deine Teile, Outfits und Statistik dir zugeordnet.
          </Text>
          {free.map((p, n) => <OptionRow key={p.id} label={p.name} selected={false} last={n === free.length - 1} onPress={() => !busy && pick(p.id)} />)}
          {msg && <Text style={{ fontSize: 14, color: t.ink, marginTop: space.xs }}>{msg}</Text>}
        </View>
      )}
    </Sheet>
  );
}

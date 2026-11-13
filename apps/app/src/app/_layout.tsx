import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Gloock_400Regular } from '@expo-google-fonts/gloock';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import Login from '@/components/Login';
import { Join } from '@/components/Join';
import { captureInvite } from '@/lib/invite';
import { useEffect, useState } from 'react';

function Gate() {
  const { session, ready } = useSession();
  const t = useTheme();
  // Einladungslink (…?einladung=…) zuerst merken, damit er Anmelden und E-Mail-Bestätigung übersteht
  const [invite, setInvite] = useState<string | null | undefined>(undefined);
  useEffect(() => { captureInvite().then(setInvite).catch(() => setInvite(null)); }, []);
  if (!ready || invite === undefined) return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={t.accent} /></View>;
  if (!session) return <Login />;
  return (
    <>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="teil/[id]" />
      <Stack.Screen name="bearbeiten/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="neu" options={{ presentation: 'modal' }} />
      <Stack.Screen name="bilder-zuordnen" options={{ presentation: 'modal' }} />
      <Stack.Screen name="outfit/[id]" />
      <Stack.Screen name="outfit-bauen" options={{ presentation: 'modal' }} />
    </Stack>
    <Join token={invite} />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Gloock_400Regular });
  const t = useTheme();
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <Gate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

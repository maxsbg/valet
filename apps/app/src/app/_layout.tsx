import { Slot, Stack } from 'expo-router';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Gloock_400Regular } from '@expo-google-fonts/gloock';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import Login from '@/components/Login';

function Gate() {
  const { session, ready } = useSession();
  const t = useTheme();
  if (!ready) return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={t.accent} /></View>;
  if (!session) return <Login />;
  // Web: ohne gestapelte Karten, damit das Dokument selbst scrollt (Inhalt läuft unter der Safari-Leiste weiter)
  if (Platform.OS === 'web') return <Slot />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="teil/[id]" />
      <Stack.Screen name="bearbeiten/[id]" options={{ presentation: 'modal' }} />
    </Stack>
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

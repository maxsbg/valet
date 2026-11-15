import { StyleSheet, Text, View } from 'react-native';
import { MONO_SIZE, personText, type MonoSize } from '@valet/ui';
import { DISPLAY } from '@/lib/theme';
import { personTone, type Person } from '@/lib/wardrobe';

/**
 * Monogramm-Plakette einer Person (Gloock, person-*-text auf Weiß) – nie Farbpunkt.
 * Steht überall vor Personennamen in Kapseln, Chips und Zeilen (15.11.2026).
 * size = feste Stufe (MONO_SIZE): text 20 · chip 24 · tall 30 · row 38 · button 44.
 */
export function Monogram({ person, size: step = 'chip' }: { person: Pick<Person, 'name' | 'color'>; size?: MonoSize }) {
  const size = MONO_SIZE[step];
  const tone = personTone(person.color);
  return (
    <View style={[s.mono, { width: size, height: size, borderRadius: size / 2 }]} aria-hidden>
      <Text style={{ fontFamily: DISPLAY, fontSize: Math.round(size * 0.54), lineHeight: Math.round(size * 0.66), color: tone ? personText[tone] : '#2A1A1D' }}>
        {person.name.trim().slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  mono: { backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 0 1px rgba(42,26,29,0.12)' },
});

import { useColorScheme } from 'react-native';
import { colors, status, person, tile, space, radius, fonts } from '@valet/ui';

type Strings<T> = { [K in keyof T]: string };
export type Theme = Strings<(typeof colors)['light']> & {
  status: Strings<(typeof status)['light']>;
  person: Strings<(typeof person)['light']>;
  dark: boolean;
};

/** Aktuelles Farbschema (hell/dunkel nach Systemeinstellung). */
export function useTheme(): Theme {
  const dark = useColorScheme() === 'dark';
  const mode = dark ? 'dark' : 'light';
  return { ...colors[mode], status: status[mode], person: person[mode], dark };
}

export { tile, space, radius, fonts };

/** Schriftfamilie für Schriftzug und große Titel (nach dem Laden von Gloock). */
export const DISPLAY = 'Gloock_400Regular';

/** Höhe der schwebenden Tab-Leiste (für Abstände am Seitenende) */
export const TAB_BAR = 64;

import { useTabBarBottom } from './bottomInset';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, TAB_BAR } from './theme';

/** Inhaltsbreite (auf großen Bildschirmen begrenzt wie ein Handy) und Abstände zur Tab-Leiste */
export function useScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarBottom();
  const content = Math.min(width, 520) - 2 * space.md;
  const barTop = bottom + TAB_BAR;
  return { content, top: insets.top, barTop, fabBottom: barTop + space.md };
}

import { Children, isValidElement, useEffect } from 'react';
import { Platform, ScrollView, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Scrollbare Seite. Im Web scrollt das Dokument selbst (nicht ein inneres Element) –
 * nur so läuft der Inhalt in Safari hinter der durchscheinenden Adressleiste weiter.
 * Auf dem iPhone (nativ) ist es ein normales ScrollView.
 */
const saved = new Map<string, number>();

/** Web: Scrollposition einer Seite merken und beim Zurückkommen wiederherstellen (sobald genug Inhalt da ist) */
export function useRestoreScroll(key: string, ready: boolean) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !ready) return;
    const y = saved.get(key) ?? 0;
    if (y) requestAnimationFrame(() => window.scrollTo(0, y));
    const save = () => saved.set(key, window.scrollY);
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [key, ready]);
}

export function Page({ children, contentContainerStyle, stickyHeaderIndices, refreshControl, ...rest }: ScrollViewProps) {
  if (Platform.OS !== 'web') {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={contentContainerStyle} stickyHeaderIndices={stickyHeaderIndices} refreshControl={refreshControl} {...rest}>
        {children}
      </ScrollView>
    );
  }
  const insets = useSafeAreaInsets(); // eslint-disable-line react-hooks/rules-of-hooks
  const sticky = new Set(stickyHeaderIndices ?? []);
  return (
    <View style={contentContainerStyle}>
      {Children.toArray(children).map((c, i) =>
        sticky.has(i) && isValidElement(c) ? (
          <View key={i} style={[{ position: 'sticky', top: insets.top, zIndex: 5, alignSelf: 'stretch', alignItems: 'center' } as unknown as ViewStyle]}>{c}</View>
        ) : c,
      )}
    </View>
  );
}

/** Im Web fest am Bildschirm (position: fixed), nativ absolut */
export const FIXED = (Platform.OS === 'web' ? { position: 'fixed' } : { position: 'absolute' }) as unknown as ViewStyle;

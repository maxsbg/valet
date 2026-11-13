import { useCallback } from 'react';
import { Animated, Platform, View, type ScrollViewProps } from 'react-native';
import { useFocusEffect, usePathname } from 'expo-router';

type Props = ScrollViewProps & { children: React.ReactNode; scrollY?: Animated.Value };

// Merkt sich je Seite, wie weit gescrollt war (Web: alle Seiten teilen sich das eine Dokument)
const memory = new Map<string, number>();

/**
 * Scrollbarer Seiteninhalt.
 * iOS: ScrollView. Web: die Seite selbst scrollt (kein Kasten), damit Safari den Inhalt auch unter seiner Leiste zeigt
 * und klebende Leisten (position: sticky) am Bildschirm kleben. Scroll-Stand wird je Seite gemerkt und wiederhergestellt.
 */
export function Page({ children, scrollY, contentContainerStyle, ...rest }: Props) {
  if (Platform.OS !== 'web') {
    return (
      <Animated.ScrollView style={{ flex: 1 }} contentContainerStyle={contentContainerStyle} scrollEventThrottle={16}
        onScroll={scrollY ? Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false }) : undefined}
        {...rest}>
        {children}
      </Animated.ScrollView>
    );
  }
  return <WebPage scrollY={scrollY} style={contentContainerStyle}>{children}</WebPage>;
}

function WebPage({ children, scrollY, style }: { children: React.ReactNode; scrollY?: Animated.Value; style: ScrollViewProps['contentContainerStyle'] }) {
  const path = usePathname();
  // Nur die sichtbare Seite hört aufs Scrollen; beim Zurückkommen (auch Tab-Wechsel) Stand wiederherstellen
  useFocusEffect(useCallback(() => {
    const y = memory.get(path) ?? 0;
    window.scrollTo(0, y);
    scrollY?.setValue(window.scrollY);
    const f = () => { memory.set(path, window.scrollY); scrollY?.setValue(window.scrollY); };
    // Inhalte (Bilder, Daten) können später nachwachsen → kurz danach nochmal
    const id = setTimeout(() => { if (y && Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y); scrollY?.setValue(window.scrollY); }, 120);
    window.addEventListener('scroll', f, { passive: true });
    return () => { clearTimeout(id); window.removeEventListener('scroll', f); };
  }, [path, scrollY]));
  return <View style={style}>{children}</View>;
}

/** Web: Leiste klebt oben, während die Seite darunter scrollt (iOS: Leiste steht ohnehin außerhalb der ScrollView) */
export const STICKY = (Platform.OS === 'web' ? { position: 'sticky', top: 0, zIndex: 20 } : {}) as object;

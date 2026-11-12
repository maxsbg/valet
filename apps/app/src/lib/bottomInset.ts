import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Höhe der Browserleiste unten (Safari), unter der die App weiterläuft.
 * Die App ist auf dem Web so hoch wie der größtmögliche Bildschirm (100lvh), damit der Inhalt
 * hinter der durchscheinenden Leiste sichtbar ist. Was unten bedienbar sein muss, wird um diesen Wert angehoben.
 */
function browserBar(): number {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return 0;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:100lvh;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const lvh = probe.getBoundingClientRect().height;
  probe.remove();
  const visible = window.visualViewport?.height ?? window.innerHeight;
  return Math.max(0, Math.round(lvh - visible));
}

/** Abstand nach unten: Browserleiste (Safari) oder sonst der sichere Bereich (Home-Indikator) */
export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
  const [bar, setBar] = useState(browserBar);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const f = () => setBar(browserBar());
    window.addEventListener('resize', f);
    window.visualViewport?.addEventListener('resize', f);
    const id = setTimeout(f, 300);
    return () => { window.removeEventListener('resize', f); window.visualViewport?.removeEventListener('resize', f); clearTimeout(id); };
  }, []);
  return bar > 0 ? bar : insets.bottom;
}

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Wie weit ein am unteren Bildschirmrand fixiertes Element von der Browserleiste (Safari) verdeckt würde.
 * Die Seite selbst läuft unter der durchscheinenden Leiste weiter; Bedienelemente werden um diesen Wert angehoben.
 */
function browserBar(): number {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || !document.body) return 0;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;height:1px;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const fixedBottom = probe.getBoundingClientRect().bottom;
  probe.remove();
  const vv = window.visualViewport;
  const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  return Math.max(0, Math.round(fixedBottom - visibleBottom));
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
    window.visualViewport?.addEventListener('scroll', f);
    const id = setTimeout(f, 300);
    return () => { window.removeEventListener('resize', f); window.visualViewport?.removeEventListener('resize', f); window.visualViewport?.removeEventListener('scroll', f); clearTimeout(id); };
  }, []);
  return bar > 0 ? bar : insets.bottom;
}

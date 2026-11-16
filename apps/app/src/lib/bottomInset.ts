import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Im Web scrollt die Seite selbst; feste Leisten hängen per position:fixed am Bildschirm.
 * Gemessen wird, wie weit „bottom: 0“ eines festen Elements unter dem sichtbaren Bereich liegt
 * (z. B. hinter einer Browserleiste). Meist 0.
 */
function hiddenBelow(): number {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return 0;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;height:1px;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const fixedBottom = probe.getBoundingClientRect().bottom;
  probe.remove();
  const vv = window.visualViewport;
  const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  return Math.max(0, Math.round(fixedBottom - visibleBottom));
}

function useHiddenBelow(): number {
  const [h, setH] = useState(hiddenBelow);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const f = () => setH(hiddenBelow());
    window.addEventListener('resize', f);
    window.visualViewport?.addEventListener('resize', f);
    const id = setTimeout(f, 300);
    return () => { window.removeEventListener('resize', f); window.visualViewport?.removeEventListener('resize', f); clearTimeout(id); };
  }, []);
  return h;
}

/** Abstand nach unten für feste Elemente und Seitenende: verdeckter Bereich (Browser) oder sicherer Bereich (Home-Indikator) */
export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
  const hidden = useHiddenBelow();
  return hidden + insets.bottom;
}

/**
 * Abstand der schwebenden Tab-Leiste zum unteren Rand, wie bei Apple Music:
 * 25 pt über dem Bildschirmrand (mit Home-Indikator), ohne Indikator bzw. über einer Browserleiste 12 pt.
 */
export function useTabBarBottom(): number {
  const insets = useSafeAreaInsets();
  const hidden = useHiddenBelow();
  return hidden + (insets.bottom > 0 ? Math.max(insets.bottom - 9, 12) : 12);
}

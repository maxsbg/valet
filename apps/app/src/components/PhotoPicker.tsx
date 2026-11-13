import { createElement } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';

/**
 * Fläche, die beim Antippen die Foto-Auswahl öffnet (iPhone: Kamera, Mediathek oder Datei).
 * Im Web liegt ein unsichtbares Datei-Feld über dem Inhalt – so öffnet Safari die Auswahl zuverlässig.
 */
export function PhotoPicker({ onPick, children, style, label }: { onPick: (file: File) => void; children: React.ReactNode; style?: ViewStyle; label: string }) {
  if (Platform.OS !== 'web') return <View style={style}>{children}</View>;
  return (
    <View style={[{ position: 'relative' }, style]}>
      {children}
      {createElement('input', {
        type: 'file',
        accept: 'image/*',
        'aria-label': label,
        onChange: (e: { target: HTMLInputElement }) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // dasselbe Foto erneut wählbar
          if (file) onPick(file);
        },
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', fontSize: 0 },
      })}
    </View>
  );
}

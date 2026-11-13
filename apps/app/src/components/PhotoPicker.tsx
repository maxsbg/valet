import { createElement } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';

/**
 * Fläche, die beim Antippen die Foto-Auswahl öffnet (iPhone: Kamera, Mediathek oder Datei).
 * Im Web liegt ein unsichtbares Datei-Feld über dem Inhalt – so öffnet Safari die Auswahl zuverlässig.
 */
export function PhotoPicker({ onPick, onPickMany, children, style, label, accept = 'image/*' }: {
  onPick?: (file: File) => void; /** mehrere Fotos auf einmal (Mehrfachauswahl) */ onPickMany?: (files: File[]) => void;
  children: React.ReactNode; style?: ViewStyle; label: string; accept?: string;
}) {
  if (Platform.OS !== 'web') return <View style={style}>{children}</View>;
  return (
    <View style={[{ position: 'relative' }, style]}>
      {children}
      {createElement('input', {
        type: 'file',
        accept,
        multiple: !!onPickMany,
        'aria-label': label,
        onChange: (e: { target: HTMLInputElement }) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = ''; // dasselbe Foto erneut wählbar
          if (!files.length) return;
          if (onPickMany) onPickMany(files); else onPick?.(files[0]!);
        },
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', fontSize: 0 },
      })}
    </View>
  );
}

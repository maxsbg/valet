// Auswahlen in aufgeklappten Zeilen: Farben, Skalen, Pflege (Spec 7)
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CARE, COLORS, LAYERS, RAIN, WARMTH, nuancesOf, tapMainColor, tapNuance, type Care, type CareGroup, type ColorPick, type FitScale,
  CAP_ADJUSTABLE, CAP_FITTED, COLLAR_SIZES, ONE_SIZE, PANTS_LENGTH, PANTS_WAIST, RING_SIZES, SHOE_SIZES, SIZES, SIZE_SYSTEMS,
  composeWL, hasCollarSize, pantsWaistOnly, parseWL, type SizeKind, type SizeSystemAny,
} from '@valet/core';
import { useTheme } from '@/lib/theme';
import { Capsule, FieldLabel, Hint, Wrap } from '@/components/detail/parts';
import { DetailIcon, type DetailIconName } from '@/components/detail/DetailIcons';
import { ColorDot, Toggle } from './fields';

// ---------- Farben ----------

/**
 * Alle eigenständigen Farben als Kapseln mit Farbkreis; Hauptfarbe antippen → ihre Nuancen in einer abgesetzten Fläche.
 * Rang als Zahl im Farbkreis, höchstens 3 (Hinweis in accent).
 */
export function ColorPicker({ pick, onChange }: { pick: ColorPick; onChange: (p: ColorPick) => void }) {
  const t = useTheme();
  const rank = (n: string) => pick.colors.indexOf(n) + 1;
  const famSelected = (main: string) => pick.colors.some((c) => c === main || nuancesOf(main).some((x) => x.name === c));
  const nu = pick.open ? nuancesOf(pick.open) : [];
  return (
    <View style={{ gap: 10 }}>
      <Wrap>
        {COLORS.map((c) => (
          <Capsule key={c.name} label={c.name} selected={famSelected(c.name)} a11y={rank(c.name) ? `${c.name}, Rang ${rank(c.name)}` : c.name}
            leading={<ColorDot name={c.name} rank={rank(c.name) || undefined} />} onPress={() => onChange(tapMainColor(pick, c.name))} />
        ))}
      </Wrap>
      {nu.length > 0 && (
        <View style={[s.nuances, { backgroundColor: t.surfaceSunken }]}>
          <FieldLabel>{pick.open}</FieldLabel>
          <Wrap>
            {nu.map((n) => (
              <Capsule key={n.name} label={n.name} selected={rank(n.name) > 0} a11y={rank(n.name) ? `${n.name}, Rang ${rank(n.name)}` : n.name}
                leading={<ColorDot name={n.name} rank={rank(n.name) || undefined} />} onPress={() => onChange(tapNuance(pick, n.name))} />
            ))}
          </Wrap>
        </View>
      )}
      <Hint accent={pick.full}>{pick.full ? 'Höchstens 3 Farben – erst eine abwählen.' : 'Bis zu 3 Farben. Die Zahl im Punkt ist die Reihenfolge nach Anteil, 1 = Hauptfarbe.'}</Hint>
    </View>
  );
}

// ---------- Skalen ----------

/** Eine Skala: Kopf (Bezeichnung · Wert), antippbare Striche (44 px Tippfläche), darunter die Enden oder Beschriftungen */
export function Scale({ caption, value, steps, on, onPick, lo, hi, labels, icon, a11y }: {
  caption: string; value: string; steps: number; on: (i: number) => boolean; onPick: (i: number) => void;
  lo?: string; hi?: string; labels?: readonly string[]; icon?: DetailIconName; a11y: (i: number) => string;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <View style={s.scaleHead}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon && <DetailIcon name={icon} size={16} color={t.ink} />}
          <Text style={{ fontSize: 14, color: t.ink }}>{caption}</Text>
        </View>
        <Text style={{ fontSize: 14, color: t.inkMuted }}>{value}</Text>
      </View>
      <View accessibilityRole="radiogroup" aria-label={caption} style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: steps }, (_, i) => (
          <Pressable key={i} accessibilityRole="button" accessibilityLabel={a11y(i)} accessibilityState={{ selected: on(i) }} onPress={() => onPick(i)} style={s.seg}>
            <View style={[s.bar, { backgroundColor: on(i) ? t.accent : t.hairline }]} />
            {labels && <Text style={{ fontSize: 12, lineHeight: 15, textAlign: 'center', color: on(i) ? t.ink : t.inkMuted, fontWeight: on(i) ? '600' : '400' }}>{labels[i]}</Text>}
          </Pressable>
        ))}
      </View>
      {lo && hi && (
        <View style={[s.scaleHead, { marginTop: -6 }]}>
          <Text style={{ fontSize: 12, color: t.inkMuted }}>{lo}</Text>
          <Text style={{ fontSize: 12, color: t.inkMuted }}>{hi}</Text>
        </View>
      )}
    </View>
  );
}

/** Passform: Skalen je Kategorie (Stufen-Index) */
export function FitPicker({ scales, fit, onPick }: { scales: readonly FitScale[]; fit: Record<FitScale['key'], number | null>; onPick: (k: FitScale['key'], i: number) => void }) {
  return (
    <View style={{ gap: 14 }}>
      {scales.map((sc) => {
        const v = fit[sc.key];
        return (
          <Scale key={sc.key} caption={sc.label} value={v == null ? '–' : sc.steps[v]!} steps={sc.steps.length} on={(i) => v === i}
            onPick={(i) => onPick(sc.key, i)} lo={sc.steps[0]} hi={sc.steps[sc.steps.length - 1]} a11y={(i) => `${sc.label}: ${sc.steps[i]}`} />
        );
      })}
    </View>
  );
}

/** Lagen: 4 Stufen von innen nach außen, mehrere möglich; darunter „Auch allein tragbar“ */
export function LayersPicker({ layers, standalone, onToggle, onStandalone }: { layers: number[]; standalone: boolean; onToggle: (i: number) => void; onStandalone: () => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <Scale caption="Lagen von innen nach außen" value="" steps={LAYERS.length} on={(i) => layers.includes(i)} onPick={onToggle}
        labels={LAYERS} a11y={(i) => `Lage: ${LAYERS[i]}`} />
      <View style={[s.scaleHead, { minHeight: 44 }]}>
        <Text style={{ fontSize: 15, color: t.ink }}>Auch allein tragbar</Text>
        <Toggle on={standalone} onToggle={onStandalone} label="Auch allein tragbar" />
      </View>
    </View>
  );
}

/** Wetter: Wärme 0–3 (sehr leicht … warm) und Regen 0–2 (schlecht … gut) als Balken */
export function WeatherPicker({ warmth, rain, onWarmth, onRain }: { warmth: number | null; rain: number | null; onWarmth: (v: number | null) => void; onRain: (v: number | null) => void }) {
  // Wärme: Wert v → v Striche (0 = „sehr leicht“ ohne Strich); Regen: Wert r → r + 1 Striche
  const tapWarm = (i: number) => onWarmth(warmth === i + 1 ? i : warmth === i && i === 0 ? null : i + 1);
  const tapRain = (i: number) => onRain(rain === i ? (i === 0 ? null : i - 1) : i);
  return (
    <View style={{ gap: 14 }}>
      <Scale caption="Wärme" icon="thermo" value={warmth == null ? '–' : WARMTH[warmth]!} steps={3} on={(i) => warmth != null && i < warmth}
        onPick={tapWarm} a11y={(i) => `Wärme: ${WARMTH[i + 1]}`} />
      <Scale caption="Regen" icon="drop" value={rain == null ? '–' : RAIN[rain]!} steps={3} on={(i) => rain != null && i <= rain}
        onPick={tapRain} a11y={(i) => `Regen: ${RAIN[i]}`} />
    </View>
  );
}

// ---------- Pflege ----------

/** Je Gruppe Chips mit Symbol und kurzer Beschriftung, je Gruppe ein Wert, alles optional */
export function CarePicker({ care, onChange }: { care: Care; onChange: (c: Care) => void }) {
  const pick = (g: CareGroup, id: string) => {
    const next = { ...care };
    if (care[g]?.v === id && care[g]?.src !== 'geschaetzt') delete next[g];
    else next[g] = { v: id, src: 'hand' };
    onChange(next);
  };
  return (
    <View style={{ gap: 14 }}>
      {CARE.map((g) => (
        <View key={g.key} style={{ gap: 8 }}>
          <FieldLabel>{g.label}</FieldLabel>
          <Wrap>
            {g.options.map((o) => (
              <Capsule key={o.id} label={o.short} a11y={`${g.label}: ${o.short}`} selected={care[g.key]?.v === o.id} onPress={() => pick(g.key, o.id)}
                icon={(c) => <DetailIcon name={o.id as DetailIconName} size={20} color={c} />} />
            ))}
          </Wrap>
        </View>
      ))}
      <Hint>Je Gruppe ein Wert, alles optional. Die KI füllt hier nur aus einem Etikettfoto aus; ohne Etikett schätzt sie aus dem Material (grau mit Stern).</Hint>
    </View>
  );
}

const s = StyleSheet.create({
  nuances: { borderRadius: 16, padding: 10, gap: 8 },
  scaleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seg: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center', gap: 6 },
  bar: { height: 8, borderRadius: 4, width: '100%' },
});

// ---------- Größe je Art (Spec 7 und 8a) ----------


type SizeProps = {
  kind: SizeKind; sub: string | null; system: SizeSystemAny | null; size: string | null; collarSize: string | null;
  onSystem: (s: SizeSystemAny) => void; onSize: (s: string | null) => void; onCollar: (s: string | null) => void;
};

/** Größe: Kleidung (Buchstaben/Zahlen), Hose (W/L oder Buchstaben), Schuh (EU), Kappe (verstellbar/Fitted), Ring */
export function SizePicker({ kind, sub, system, size, collarSize, onSystem, onSize, onCollar }: SizeProps) {
  const [fitted, setFitted] = useState(!!size && (CAP_FITTED as readonly string[]).includes(size));
  const caps = (list: readonly string[], cur: string | null, pick: (v: string | null) => void) =>
    <Wrap>{list.map((x) => <Capsule key={x} label={x} selected={cur === x} onPress={() => pick(cur === x ? null : x)} />)}</Wrap>;
  if (kind === 'shoe') return <View style={{ gap: 8 }}><FieldLabel>EU-Größe</FieldLabel>{caps(SHOE_SIZES, size, onSize)}</View>;
  if (kind === 'ring') return <View style={{ gap: 8 }}><FieldLabel>Ringgröße</FieldLabel>{caps(RING_SIZES, size, onSize)}</View>;
  if (kind === 'cap') {
    return (
      <View style={{ gap: 10 }}>
        <Wrap>
          <Capsule label={CAP_ADJUSTABLE} selected={size === CAP_ADJUSTABLE} onPress={() => { setFitted(false); onSize(size === CAP_ADJUSTABLE ? null : CAP_ADJUSTABLE); }} />
          <Capsule label="Fitted" selected={fitted} onPress={() => { setFitted(!fitted); if (size === CAP_ADJUSTABLE || fitted) onSize(null); }} />
        </Wrap>
        {fitted && <><FieldLabel>Fitted-Größe</FieldLabel>{caps(CAP_FITTED, size, onSize)}</>}
      </View>
    );
  }
  if (kind === 'pants') {
    const wl = system !== 'letters';
    const { w, l } = parseWL(size);
    return (
      <View style={{ gap: 10 }}>
        <FieldLabel>System</FieldLabel>
        <Wrap>
          <Capsule label="W/L" selected={wl} onPress={() => onSystem('wl')} />
          <Capsule label="Buchstaben" selected={!wl} onPress={() => onSystem('letters')} />
        </Wrap>
        {wl ? <>
          <FieldLabel>Bundweite</FieldLabel>
          {caps(PANTS_WAIST, w, (v) => onSize(composeWL(v, pantsWaistOnly(sub) ? null : l)))}
          {!pantsWaistOnly(sub) && <><FieldLabel>Länge</FieldLabel>{caps(PANTS_LENGTH, l, (v) => onSize(composeWL(w, v)))}</>}
        </> : <><FieldLabel>Größe</FieldLabel>{caps(SIZES.letters, size, onSize)}</>}
      </View>
    );
  }
  // Kleidung
  const sys = system === 'letters' || system === 'numbers' ? system : null;
  return (
    <View style={{ gap: 10 }}>
      <FieldLabel>System</FieldLabel>
      <Wrap>{(Object.keys(SIZE_SYSTEMS) as ('letters' | 'numbers')[]).map((k) => <Capsule key={k} label={SIZE_SYSTEMS[k]} selected={sys === k} onPress={() => onSystem(k)} />)}</Wrap>
      <FieldLabel>Größe</FieldLabel>
      {caps(sys ? SIZES[sys] : [ONE_SIZE], size, onSize)}
      {hasCollarSize(sub) && <><FieldLabel>Kragenweite</FieldLabel>{caps(COLLAR_SIZES, collarSize, onCollar)}</>}
    </View>
  );
}

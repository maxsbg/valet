import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BOARD_AR } from '@valet/core';
import { Icons } from './Icon';
import { OutfitBoard } from './OutfitBoard';
import { useTheme, space, radius, DISPLAY } from '@/lib/theme';
import { addDays, dateOf, fmtLong, mondayOf, plansOn, weekday, type Outfit } from '@/lib/outfits';
import type { Tile } from '@/lib/wardrobe';

type Props = {
  outfits: Outfit[];
  byId: Map<string, Tile>;
  today: string;
  /** volle Breite der Karte */
  width: number;
  onDay: (date: string) => void;
};

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const PAD = 12;
/** Ring ums heutige Outfit: 2 px, 1,5 px Abstand – darf den Kreis der Tageszahl nicht berühren */
const RING = 2;
const RING_GAP = 1.5;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Wochenleiste oben im Outfits-Tab (entschieden 14.11.2026). Titel antippen klappt die Karte zur Monatsansicht auf.
 * Heute: Wochentag und Zahl in accent. Felder: Mini-Outfit · vergangen leer „–“ · heute offen (accent) · Zukunft „+“.
 * Monat: Mini-Outfit nur an Tagen mit Outfit, leere Tage ohne Rahmen, andere Monate blass.
 */
export function WeekCalendar({ outfits, byId, today, width, onDay }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [week, setWeek] = useState(0);
  const [month, setMonth] = useState(0);

  const colW = (width - 2 * PAD - 2) / 7;

  // ---- Woche ----
  const monday = addDays(mondayOf(today), week * 7);
  const days = Array.from({ length: 7 }, (_, n) => addDays(monday, n));
  const slotW = Math.min(42, colW - 6);
  const slotH = Math.round(slotW * BOARD_AR) + 4;

  // ---- Monat ----
  const td = dateOf(today);
  const first = new Date(td.getFullYear(), td.getMonth() + month, 1);
  const mKey = iso(first).slice(0, 7);
  const start = mondayOf(iso(first));
  const last = iso(new Date(first.getFullYear(), first.getMonth() + 1, 0));
  const weeks = Math.ceil((((dateOf(last).getTime() - dateOf(start).getTime()) / 86400000) + 1) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, n) => addDays(start, n));
  const mW = Math.min(34, colW - 8);

  const title = open
    ? `${MONTHS[first.getMonth()]} ${first.getFullYear()}`
    : week === 0 ? 'Diese Woche' : week === 1 ? 'Nächste Woche' : week === -1 ? 'Letzte Woche' : `${fmtDay(days[0]!)} – ${fmtDay(days[6]!)}`;
  const prev = () => (open ? setMonth(month - 1) : setWeek(week - 1));
  const next = () => (open ? setMonth(month + 1) : setWeek(week + 1));
  const toggle = () => {
    if (open) {
      // zurück zur Woche des gezeigten Monats (heute, wenn es der aktuelle Monat ist)
      setWeek(month === 0 ? 0 : Math.round((dateOf(mondayOf(iso(first))).getTime() - dateOf(mondayOf(today)).getTime()) / (7 * 86400000)));
    } else {
      setMonth((dateOf(monday).getFullYear() - td.getFullYear()) * 12 + dateOf(monday).getMonth() - td.getMonth());
    }
    setOpen(!open);
  };

  const ring = { position: 'absolute' as const, top: -(RING + RING_GAP), left: -(RING + RING_GAP), right: -(RING + RING_GAP), bottom: -(RING + RING_GAP), borderWidth: RING, borderColor: t.accent };

  const num = (d: string, size: number, dim = false) => {
    const isToday = d === today;
    return (
      <View style={[s.num, { width: size, height: size, borderRadius: size / 2 }, isToday && { backgroundColor: t.accent }]}>
        <Text style={{ fontSize: size > 28 ? 16 : 15, fontWeight: isToday ? '700' : '400', color: isToday ? t.onAccent : dim ? t.inkMuted : t.ink }}>{Number(d.slice(8))}</Text>
      </View>
    );
  };

  return (
    <View style={[s.card, { width, backgroundColor: t.surface, borderColor: t.hairline }]}>
      <View style={s.head}>
        <Pressable onPress={prev} accessibilityRole="button" accessibilityLabel={open ? 'Voriger Monat' : 'Vorige Woche'} style={s.arrow}>
          <Icons.back color={t.inkMuted} size={20} />
        </Pressable>
        <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={open ? 'Zur Wochenansicht' : 'Monat anzeigen'} style={s.titleBtn}>
          <Text style={[s.title, { color: t.ink }]} numberOfLines={1}>{title}</Text>
          <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}><Icons.chevron color={t.inkMuted} size={15} /></View>
        </Pressable>
        <Pressable onPress={next} accessibilityRole="button" accessibilityLabel={open ? 'Nächster Monat' : 'Nächste Woche'} style={[s.arrow, { transform: [{ rotate: '180deg' }] }]}>
          <Icons.back color={t.inkMuted} size={20} />
        </Pressable>
      </View>

      {!open ? (
        <View style={s.row}>
          {days.map((d) => {
            const ps = plansOn(outfits, d);
            const isToday = d === today;
            const past = d < today;
            return (
              <Pressable key={d} onPress={() => onDay(d)} accessibilityRole="button"
                accessibilityLabel={`${fmtLong(d)}${isToday ? ', heute' : ''}, ${ps.length ? `${ps.length} Outfit` : past ? 'nichts eingetragen' : 'nichts geplant'}`}
                style={({ pressed }) => [s.col, { width: colW, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={[s.wd, { color: isToday ? t.accent : t.inkMuted, fontWeight: isToday ? '700' : '400' }]}>{weekday(d)}</Text>
                {num(d, 30)}
                <View style={{ height: 6 }} />
                {ps.length ? (
                  <View style={{ width: slotW, height: slotH }}>
                    <View style={[s.slotFull, { width: slotW, height: slotH }]}>
                      <OutfitBoard pieces={ps[0]!.outfit.pieces} byId={byId} width={slotW - 4} />
                    </View>
                    {isToday && <View pointerEvents="none" style={[ring, { borderRadius: 10 + RING + RING_GAP }]} />}
                    {ps.length > 1 && <Text style={s.more}>+{ps.length - 1}</Text>}
                  </View>
                ) : (
                  <View style={[s.slot, { width: slotW, height: slotH, borderColor: isToday ? t.accent : t.hairline }, isToday && { backgroundColor: t.accent + '1A' }]}>
                    {past ? <Text style={{ fontSize: 16, color: t.inkMuted, opacity: 0.6 }}>–</Text> : <Icons.plus color={isToday ? t.accent : t.inkMuted} size={isToday ? 18 : 16} />}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <>
          <View style={[s.row, { marginBottom: 6 }]}>
            {WD.map((w, i) => {
              const isTodayCol = month === 0 && (td.getDay() + 6) % 7 === i;
              return <Text key={w} style={[s.wd, { width: colW, textAlign: 'center', color: isTodayCol ? t.accent : t.inkMuted, fontWeight: isTodayCol ? '700' : '400' }]}>{w}</Text>;
            })}
          </View>
          <View style={[s.row, { flexWrap: 'wrap' }]}>
            {cells.map((d) => {
              const inMonth = d.slice(0, 7) === mKey;
              const ps = inMonth ? plansOn(outfits, d) : [];
              const isToday = d === today;
              return (
                <Pressable key={d} disabled={!inMonth} onPress={() => onDay(d)} accessibilityRole="button"
                  accessibilityLabel={`${fmtLong(d)}${isToday ? ', heute' : ''}${ps.length ? `, ${ps.length} Outfit` : ''}`}
                  style={({ pressed }) => [s.col, { width: colW, paddingBottom: 6, opacity: !inMonth ? 0.3 : pressed ? 0.7 : 1 }]}>
                  {num(d, 28, d < today && !isToday)}
                  <View style={{ height: 8 }} />
                  {ps.length ? (
                    <View>
                      <View style={[s.slotFull, { borderRadius: 9 }]}>
                        <OutfitBoard pieces={ps[0]!.outfit.pieces} byId={byId} width={mW} />
                      </View>
                      {isToday && <View pointerEvents="none" style={[ring, { borderRadius: 9 + RING + RING_GAP }]} />}
                    </View>
                  ) : <View style={{ width: mW, height: Math.round(mW * BOARD_AR) + 4 }} />}
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const fmtDay = (d: string) => `${Number(d.slice(8))}.${Number(d.slice(5, 7))}.`;

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: PAD, paddingTop: 4, paddingBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleBtn: { flexShrink: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.xs },
  title: { fontFamily: DISPLAY, fontSize: 22 },
  row: { flexDirection: 'row' },
  col: { alignItems: 'center', gap: 4 },
  wd: { fontSize: 13, lineHeight: 18 },
  num: { alignItems: 'center', justifyContent: 'center' },
  slotFull: { backgroundColor: '#fff', borderRadius: 10, padding: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  slot: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  more: { position: 'absolute', right: 2, bottom: 2, fontSize: 10, fontWeight: '700', color: '#2a1a1d', backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 3, overflow: 'hidden' },
});

// Prüfseite Outfit-Zusammenstellung (läuft im Browser, gebündelt von erstellen.ts).
// Würfelt Outfits aus einem Schrank-Abzug und zeigt, wofür jedes Outfit Punkte bekommt.

import {
  DEFAULT_OUTFIT_CONFIG, OCCASIONS, SLOT_LABEL, generateOutfits, seasonOfMonth, warmthOf,
  type BuiltOutfit, type DayContext, type OutfitConfig, type OutfitItem, type Parts, type Slot,
} from '@valet/core';

declare const DATA: { items: (OutfitItem & { thumb?: string | null })[]; imgBase: string; stand: string };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const cfg: OutfitConfig = structuredClone(DEFAULT_OUTFIT_CONFIG) as OutfitConfig;
const PART_LABEL: Record<keyof Parts, string> = { color: 'Farbe', statement: 'Auffälligkeit/Muster', formality: 'Formalität', proportion: 'Proportion', surface: 'Oberfläche', metal: 'Metallton', variety: 'Vielfalt' };
const REASON_ORDER: Slot[] = ['outer', 'open', 'mid', 'base', 'bottom', 'shoes'];

function controls() {
  const occ = $<HTMLSelectElement>('occ');
  occ.innerHTML = OCCASIONS.map((o) => `<option value="${o.key}">${o.label}</option>`).join('');
  occ.value = 'everyday';
  $<HTMLInputElement>('month').value = String(new Date().getMonth() + 1);
  const w = $('weights');
  w.innerHTML = (Object.keys(cfg.weights) as (keyof Parts)[]).map((k) =>
    `<label class="w"><span>${PART_LABEL[k]}</span><input type="range" min="0" max="50" value="${cfg.weights[k]}" data-k="${k}"><b>${cfg.weights[k]}</b></label>`).join('');
  w.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    cfg.weights[el.dataset.k as keyof Parts] = Number(el.value);
    (el.nextElementSibling as HTMLElement).textContent = el.value;
  });
  $<HTMLInputElement>('temp').addEventListener('input', (e) => { $('tempv').textContent = (e.target as HTMLInputElement).value + ' °C'; });
  $('roll').addEventListener('click', run);
  occ.addEventListener('change', () => { $<HTMLInputElement>('rainOn').checked = !cfg.rainOffByDefault.includes(occ.value as never); });
}

function ctx(): DayContext {
  cfg.colorClash = $<HTMLSelectElement>('clash').value as OutfitConfig['colorClash'];
  cfg.navyBlackNearSame = $<HTMLInputElement>('navy').checked;
  const month = Number($<HTMLInputElement>('month').value) || 11;
  return {
    tempC: Number($<HTMLInputElement>('temp').value),
    rain: $<HTMLSelectElement>('rain').value as DayContext['rain'],
    rainOn: $<HTMLInputElement>('rainOn').checked,
    rainSoft: $<HTMLInputElement>('rainSoft').checked,
    occasion: $<HTMLSelectElement>('occ').value as DayContext['occasion'],
    month,
    date: new Date().toISOString().slice(0, 10),
    includeStored: $<HTMLInputElement>('stored').checked,
  };
}

const img = (i: OutfitItem & { thumb?: string | null }) =>
  i.thumb ? `<img src="${DATA.imgBase}${i.thumb}" alt="" loading="lazy">` : `<div class="noimg">${i.name ?? ''}</div>`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function card(o: BuiltOutfit, n: number) {
  const slots = (['outer', 'open', 'mid', 'base', 'bottom', 'shoes'] as Slot[]).filter((s) => o.slots[s]);
  const pieces = slots.map((s) => {
    const i = o.slots[s]! as OutfitItem & { thumb?: string | null };
    const w = warmthOf(i);
    return `<figure>${img(i)}<figcaption><i>${SLOT_LABEL[s]}</i>${esc(i.name ?? '')}<small>Wärme ${w.v}${w.est ? ' (geschätzt)' : ''}</small></figcaption></figure>`;
  }).join('');
  const bars = (Object.keys(o.parts) as (keyof Parts)[]).map((k) =>
    `<div class="bar"><span>${PART_LABEL[k]}</span><div><em style="width:${Math.round(o.parts[k] * 100)}%"></em></div><b>${Math.round(o.parts[k] * 100)}</b></div>`).join('');
  const notes = o.notes.length ? `<ul>${o.notes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="ok">Keine Abzüge</p>';
  return `<article><header><span>#${n + 1}</span><strong>${o.score}</strong><small>${o.estimated} von ${slots.length} Teilen mit geschätzten Werten</small></header>
    <div class="pieces">${pieces}</div><div class="bars">${bars}</div>${notes}</article>`;
}

function run() {
  const c = ctx();
  const { outfits, info } = generateOutfits(DATA.items, c, 20, cfg);
  outfits.sort((a, b) => b.score - a.score);
  const reasons = Object.entries(info.reasons).sort((a, b) => b[1] - a[1]).map(([r, k]) => `${esc(r)}: ${k}`).join(' · ');
  const counts = REASON_ORDER.map((s) => `${SLOT_LABEL[s]} ${info.counts[s]}`).join(' · ');
  $('info').innerHTML = `<p><b>Saison:</b> ${seasonOfMonth(c.month)} · <b>Kandidaten:</b> ${counts}</p><p><b>Aussortiert:</b> ${reasons || '–'}</p>`
    + (outfits.length ? '' : '<p class="warn">Kein Outfit möglich – zu wenige passende Teile für das Gerüst.</p>');
  $('list').innerHTML = outfits.map(card).join('');
}

function init() {
  controls();
  const prof = DATA.items.filter((i) => i.profile && Object.keys(i.profile).length).length;
  const warm = DATA.items.filter((i) => i.warmth != null).length;
  $('stand').textContent = `Abzug vom ${DATA.stand}: ${DATA.items.length} Teile · ${prof} mit KI-Profil · ${warm} mit Wärme/Regen`;
  run();
}
init();

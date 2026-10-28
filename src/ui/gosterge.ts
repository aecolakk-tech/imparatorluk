/** v2.0.1 Şehir Göstergesi: population, unemployed, bread price, memnuniyet and hazine with 5-game-day charts. */
import type { World } from '../sim/types';
import { h } from './dom';
import { quoted, unemployed } from '../sim/market2';

const SERIES: { i: number; label: string; color: string; fmt: (v: number) => string }[] = [
  { i: 2, label: '👥 Nüfus', color: '#8fc0ff', fmt: (v) => String(v) },
  { i: 3, label: '🧺 İşsiz', color: '#ff9a7a', fmt: (v) => String(v) },
  { i: 4, label: '🍞 Ekmek fiyatı', color: '#f3d27a', fmt: (v) => `${(v / 100).toFixed(2)} D` },
  { i: 5, label: '🙂 Halkın memnuniyeti', color: '#9be28f', fmt: (v) => `${v}/100` },
  { i: 6, label: '💰 Hazine', color: '#e6c35a', fmt: (v) => `${Math.round(v).toLocaleString('tr-TR')} D` },
];
function spark(pts: number[], color: string): SVGSVGElement {
  const W = 260, H = 54, ns = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'gs-spark');
  if (pts.length < 2) return svg;
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const d = pts.map((v, k) => `${k ? 'L' : 'M'}${((k / (pts.length - 1)) * (W - 4) + 2).toFixed(1)},${(H - 4 - ((v - lo) / span) * (H - 10)).toFixed(1)}`).join(' ');
  const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d); path.setAttribute('fill', 'none'); path.setAttribute('stroke', color); path.setAttribute('stroke-width', '2'); svg.append(path);
  return svg;
}
export function gostergeModal(w: World, close: () => void): HTMLElement {
  const hist = w.cityHist ?? []; const first = hist[0];
  const now = [0, 0, w.people.length, unemployed(w), Math.round(quoted(w, 'ekmek') * 100), hist.at(-1)?.[5] ?? 0, Math.round(w.treasury)];
  const cards = SERIES.map((s) => { const pts = hist.map((r) => r[s.i]!); const lo = pts.length ? Math.min(...pts) : now[s.i]!, hi = pts.length ? Math.max(...pts) : now[s.i]!;
    return h('div', { class: 'card gs-card' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', {}, s.label), h('b', { style: `color:${s.color}` }, s.fmt(now[s.i]!))), spark(pts, s.color), h('div', { class: 'muted' }, `en düşük ${s.fmt(lo)} · en yüksek ${s.fmt(hi)}`)); });
  const el = h('div', { class: 'modal gosterge-modal' }, h('div', { class: 'box parchment' }, h('button', { class: 'close icon', onclick: close }, '✕'),
    h('h2', {}, '📊 Şehir Göstergesi'), h('div', { class: 'muted' }, first ? `Son 5 oyun günü (${first[0]}. gün ${String(first[1]).padStart(2, '0')}:00’dan bu yana, saatlik).` : 'Veri toplanıyor…'), ...cards));
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  return el;
}

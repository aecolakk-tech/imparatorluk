/** Kayzer / Başkan full-screen state room: treasury, economy, army & rebellion map, laws (builder), Meclis, officials, reports, petitions, family. */
import type { Good, World } from '../sim/types';
import { GOODS } from '../sim/types';
import { BASE_PRICE, GOOD_LABEL, MAP_W, MAP_H, PROF_LABEL, STATE_PROFS } from '../sim/constants';
import { LAW_FIELDS, LAW_KIND_LABEL, lawTitle, previewLaw, type LawKind, type LawSpec } from '../sim/laws';
import { strength } from '../sim/isyan';
import { findPerson } from '../sim/world';
import { bar, fmt, h, select } from './dom';
import { familyPanel, pendingSanctions, type Ctx } from './panels';

const num = (v: number, min: number, max: number, step = 1): HTMLInputElement => h('input', { type: 'number', value: String(v), min: String(min), max: String(max), step: String(step), style: 'width:90px' });

export const rulerTitle = (w: World): string => (w.regime === 'cumhuriyet' ? 'Başkan' : 'Kayzer');

/** Reusable parameterized law builder. onSubmit receives the spec. */
export function lawBuilder(w: World, submitLabel: string, onSubmit: (s: LawSpec) => void, kinds?: LawKind[]): HTMLElement {
  const ks = kinds ?? (Object.keys(LAW_KIND_LABEL) as LawKind[]);
  const kind = select(ks.map((k): [string, string] => [k, LAW_KIND_LABEL[k]]));
  const good = select(GOODS.map((g): [string, string] => [g, GOOD_LABEL[g]]));
  const name = h('input', { placeholder: 'Kanunun adı (isteğe bağlı)', maxlength: '40', style: 'width:200px' });
  const fields = h('div', { class: 'row' }); const out = h('div', { class: 'muted', style: 'margin:4px 0' });
  let v1 = num(0, 0, 1); let v2: HTMLInputElement | null = null;
  const spec = (): LawSpec => ({ kind: kind.value as LawKind, good: LAW_FIELDS[kind.value as LawKind].good ? (good.value as Good) : undefined, value: Number(v1.value), value2: v2 ? Number(v2.value) : undefined, name: name.value.trim() || undefined });
  const refresh = (): void => {
    const f = LAW_FIELDS[kind.value as LawKind]; fields.replaceChildren();
    if (f.good) fields.append('Mal:', good);
    v1 = num(f.value[2], f.value[0], f.value[1], f.value[1] <= 10 ? 0.25 : 1); v2 = f.value2 ? num(f.value2[2], f.value2[0], f.value2[1]) : null;
    if (f.value[1] > 0) fields.append(f.value[3], v1);
    if (v2 && f.value2) fields.append(f.value2[3], v2);
    out.textContent = previewLaw(w, spec());
  };
  kind.addEventListener('change', refresh); good.addEventListener('change', () => { out.textContent = previewLaw(w, spec()); });
  refresh();
  return h('div', { class: 'card' }, h('div', { class: 'row' }, kind, name), fields, out,
    h('div', { class: 'row' }, h('button', { onclick: () => { out.textContent = previewLaw(w, spec()); } }, '🔮 Etkiyi tahmin et'),
      h('button', { class: 'primary', onclick: () => onSubmit(spec()) }, submitLabel)));
}

function spark(vals: number[], color: string): HTMLCanvasElement {
  const cv = h('canvas', { width: '260', height: '50', style: 'background:#0006;border-radius:4px' }); const g = cv.getContext('2d')!;
  if (vals.length > 1) { const mn = Math.min(...vals), mx = Math.max(...vals) || 1; g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
    vals.forEach((v, i) => { const x = i / (vals.length - 1) * 256 + 2, y = 46 - (v - mn) / Math.max(1, mx - mn) * 42; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); }
  return cv;
}

function hazine(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {});
  const book = w.treasuryBook ?? []; const last = book.filter((d) => d.day < w.day).slice(-3);
  const sum: Record<string, number> = {}; for (const d of last) for (const [k, v] of Object.entries(d.items)) sum[k] = (sum[k] ?? 0) + v / Math.max(1, last.length);
  const today = book.find((d) => d.day === w.day)?.items ?? {};
  const rows = (sign: string) => Object.entries(sum).filter(([k]) => k[0] === sign).sort((a, b) => b[1] - a[1]);
  const inc = rows('+'), exp = rows('-'); const ti = inc.reduce((a, x) => a + x[1], 0), te = exp.reduce((a, x) => a + x[1], 0);
  box.append(h('h3', {}, `💰 Hazine: ${fmt(w.treasury)} Dinar`), spark(w.stats.slice(-30).map((s) => s.treasury), '#e8c14a'),
    h('div', { class: 'muted' }, `Son ${last.length} günün ortalaması: gelir ${fmt(ti)} · gider ${fmt(te)} · net ${ti - te >= 0 ? '+' : ''}${fmt(ti - te)} D/gün. Bugün şimdiye dek: +${fmt(w.dailyIncome)} / −${fmt(w.dailyExpense)}.`));
  const tbl = (title: string, list: [string, number][]) => { const t = h('table', {}, h('tr', {}, h('th', {}, title), h('th', {}, 'ort./gün'), h('th', {}, 'bugün')));
    for (const [k, v] of list.slice(0, 12)) t.append(h('tr', {}, h('td', {}, k.slice(1)), h('td', {}, fmt(v)), h('td', {}, fmt(today[k] ?? 0)))); return t; };
  box.append(h('div', { class: 'row', style: 'align-items:flex-start' }, tbl('Gelir', inc), tbl('Gider', exp)));
  const tax = num(w.taxRate, 0, 40); const head = num(w.headTax, 0, 10, 0.25);
  box.append(h('h3', {}, '⚖️ Vergiler'), h('div', { class: 'row' }, 'Satış vergisi %', tax, h('button', { onclick: () => c.act({ t: 'setTax', rate: Number(tax.value) }) }, 'Uygula'), 'Baş vergisi', head, h('button', { onclick: () => c.act({ t: 'setHeadTax', amount: Number(head.value) }) }, 'Uygula')));
  const army = w.people.filter((p) => p.prof === 'asker'); const upkeep = army.length * (w.salaries.asker ?? 0);
  box.append(h('h3', {}, '⚔️ Ordu gideri'), h('div', {}, `${army.length} asker × ${w.salaries.asker ?? 0} D = ${fmt(upkeep)} D/gün · ortalama sadakat ${Math.round(army.reduce((a, p) => a + p.loyalty, 0) / Math.max(1, army.length))}`));
  const sal = h('table', {}, h('tr', {}, h('th', {}, 'Görev'), h('th', {}, 'Kişi'), h('th', {}, 'Maaş'), h('th', {}, 'Toplam')));
  for (const pr of STATE_PROFS) { const n = w.people.filter((p) => p.prof === pr).length; const inp = num(w.salaries[pr] ?? 0, 0, 60);
    sal.append(h('tr', {}, h('td', {}, PROF_LABEL[pr]), h('td', {}, String(n)), h('td', {}, inp, h('button', { onclick: () => c.act({ t: 'setSalary', prof: pr, amount: Number(inp.value) }) }, '✓')), h('td', {}, fmt(n * (w.salaries[pr] ?? 0))))); }
  box.append(h('h3', {}, '💼 Maaşlar'), sal);
  return box;
}

function ekonomi(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {});
  const t = h('table', {}, h('tr', {}, ...['Mal', 'Fiyat', '7g ort.', 'Normal', 'Tezgâhta', 'Satılan', 'Karşılanmayan', 'Durum'].map((x) => h('th', {}, x))));
  for (const g of GOODS) {
    const hist = w.priceHist?.[g] ?? []; const avg = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : w.prices[g];
    const left = w.listings.filter((l) => l.good === g).reduce((s, l) => s + l.qty, 0); const ch = w.prices[g] / Math.max(0.01, avg);
    const tags = [w.bans.includes(g) ? '⛔ yasak' : '', w.priceCaps[g] ? `narh ${w.priceCaps[g]}` : '', ch > 1.35 ? '📈 fırladı' : ch < 0.75 ? '📉 düştü' : ''].filter(Boolean).join(' ');
    t.append(h('tr', {}, h('td', {}, GOOD_LABEL[g]), h('td', {}, w.prices[g].toFixed(2)), h('td', {}, avg.toFixed(2)), h('td', {}, String(BASE_PRICE[g])), h('td', {}, String(left)), h('td', {}, String(w.market.sold[g] ?? 0)), h('td', { style: (w.market.unmet[g] ?? 0) > 0 ? 'color:#f77' : '' }, String(w.market.unmet[g] ?? 0)), h('td', {}, tags)));
  }
  box.append(h('h3', {}, '📊 Pazar'), t);
  box.append(h('h3', {}, '🌾 Tahıl ambarı'), h('div', {}, bar(w.granary / 15, '#d9b35a'), ` ${Math.round(w.granary)} buğday`, w.nature ? ` · ⚠️ ${w.nature.kind} sürüyor` : ''),
    h('div', { class: 'muted' }, 'Kuraklıkta ambar her gün piyasaya buğday salar; bolluk günlerinde hazine ucuz buğday alıp doldurur.'),
    h('div', { class: 'row' }, ...[50, 150].map((n) => h('button', { onclick: () => c.act({ t: 'granary', op: 'buy', qty: n }) }, `+${n} satın al`)), h('button', { onclick: () => c.act({ t: 'granary', op: 'release', qty: 100 }) }, '100 piyasaya sal')));
  if (w.caravan && w.day <= w.caravan.until) box.append(h('div', { class: 'card' }, `🐪 ${w.caravan.name} limanda (${w.caravan.until}. güne kadar).`));
  const sus = Object.entries(w.suspicion ?? {}).filter(([, v]) => v > 5).sort((a, b) => b[1] - a[1]).slice(0, 8);
  box.append(h('h3', {}, '🕵️ İstifçilik şüphesi (bekçi raporu)'), ...(sus.length ? sus.map(([id, v]) => { const p = findPerson(w, id); return h('div', { class: 'row', style: 'cursor:pointer', onclick: () => p && c.openPerson(id) }, h('b', {}, p?.name ?? '?'), bar(v, '#c55'), ` ${Math.round(v)}`); }) : [h('div', { class: 'muted' }, 'Şüpheli istifçi yok.')]));
  return box;
}

function ordu(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {}); const s = strength(w);
  const cv = h('canvas', { width: String(MAP_W * 4), height: String(MAP_H * 4), style: 'width:100%;max-width:520px;image-rendering:pixelated;background:#2d4a2a;border-radius:6px' }); const g = cv.getContext('2d')!;
  const occ = new Set(w.isyan?.occupied ?? []);
  for (const b of w.buildings) { g.fillStyle = occ.has(b.id) ? '#d33' : b.kind === 'kisla' ? '#36c' : b.kind === 'saray' ? '#e8c14a' : '#8a7a5a'; g.fillRect(b.x * 4, b.y * 4, b.w * 4, b.h * 4); }
  let k = 0; const occList = [...occ];
  for (const p of w.people) { const reb = w.isyan?.rebels.includes(p.id); if (!reb && p.prof !== 'asker') continue;
    const b = w.buildings.find((x) => x.id === (reb && occList.length ? occList[k % occList.length] : p.work)); if (!b) continue; k++;
    g.fillStyle = reb ? '#f55' : '#7af'; g.fillRect((b.x + (k * 7 % Math.max(1, b.w))) * 4, (b.y + b.h + (k % 3)) * 4, 3, 3); }
  box.append(h('h3', {}, w.isyan ? '🔥 İSYAN HARİTASI' : '🗺 Ordu ve güvenlik haritası'), cv,
    h('div', { class: 'muted' }, '🟥 isyancı / işgal edilmiş bina · 🟦 asker / kışla · 🟨 saray'),
    h('div', {}, `Sadık asker ${s.loyal} · isyancı ${s.rebels}${w.isyan ? ` · işgal: ${[...occ].join(', ') || '—'} · ölü ${w.isyan.killed}` : ''}`));
  if (w.isyan) box.append(h('div', { class: 'row' }, ...(['dagit', 'tutukla', 'saldir'] as const).map((k) => h('button', { class: k === 'saldir' ? 'danger' : '', onclick: () => c.act({ t: 'isyanCmd', cmd: k }) }, { dagit: '📯 Dağılın çağrısı', tutukla: '⛓ Elebaşları tutukla', saldir: '⚔️ Saldır' }[k]))));
  const ris = w.people.filter((p) => p.prof !== 'naip' && (p.loyalty < 30 || p.mood < 25)).length;
  box.append(h('div', { class: 'card' }, `Memnuniyet ${Math.round(w.stats.at(-1)?.mood ?? 0)} · cumhuriyet isteği ${Math.round(w.stats.at(-1)?.cumhuriyet ?? 0)} · huzursuz ${ris} kişi`));
  return box;
}

function kanunlar(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {});
  const rep = w.regime === 'cumhuriyet';
  box.append(h('h3', {}, '✍️ Yeni kanun yaz'), h('div', { class: 'muted' }, rep ? 'Başkan vergi, narh, destek ve servet kanunlarını kararname ile çıkarabilir; yasak, sokağa çıkma, zorunlu hizmet ve sert ceza için Meclis oyu gerekir.' : 'Ferman: hemen yürürlüğe girer. Aynı türden eski kanunun yerini alır.'),
    lawBuilder(w, rep ? '📜 Kararname çıkar' : '📜 Ferman ilan et', (law) => c.act({ t: 'enactLaw', law })));
  const cl = w.customLaws ?? [];
  box.append(h('h3', {}, `📚 Yürürlükteki özel kanunlar (${cl.length})`), ...(cl.length ? cl.map((l) => h('div', { class: 'card' }, h('b', {}, l.name), h('div', { class: 'muted' }, `${lawTitle(l)} · ${l.via === 'meclis' ? 'Meclis' : 'ferman'} · ${l.day}. gün`), h('button', { onclick: () => c.act({ t: 'repealLaw', lawId: l.id }) }, 'Kaldır'))) : [h('div', { class: 'muted' }, 'Henüz yok.')]));
  box.append(h('h3', {}, '📜 Temel kanunlar'));
  for (const l of w.laws) { const p = l.param !== undefined ? num(l.param, 0, 100) : null;
    box.append(h('div', { class: 'card' }, h('b', {}, `${l.active ? '🟢' : '⚪'} ${l.name}`), h('div', { class: 'muted' }, l.desc), h('div', { class: 'row' }, p ? l.paramLabel ?? '' : '', p ?? '', h('button', { onclick: () => c.act({ t: 'toggleLaw', lawId: l.id, active: !l.active, param: p ? Number(p.value) : undefined }) }, l.active ? 'Kaldır' : 'Yürürlüğe koy')))); }
  return box;
}

function gorevliler(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {});
  for (const pr of STATE_PROFS) {
    const ps = w.people.filter((p) => p.prof === pr); if (!ps.length && !['bekci', 'asker', 'savci', 'hakim'].includes(pr)) continue;
    box.append(h('h3', {}, `${PROF_LABEL[pr]} (${ps.length}) · ${w.salaries[pr] ?? 0} D`), ...ps.map((p) => h('div', { class: 'row', style: 'cursor:pointer', onclick: () => c.openPerson(p.id) }, h('b', {}, p.name), h('span', { class: 'muted' }, `sadakat ${Math.round(p.loyalty)} · dürüstlük ${Math.round(p.honesty)} · sağlık ${Math.round(p.health)}${p.playerId ? ' · 🎮' : ''}`))));
  }
  const cand = w.people.filter((p) => p.prof !== 'naip' && !STATE_PROFS.includes(p.prof) && p.id !== w.kayzerId).sort((a, b) => b.loyalty + b.honesty - a.loyalty - a.honesty).slice(0, 40);
  const who = select(cand.map((p): [string, string] => [p.id, `${p.name} (${PROF_LABEL[p.prof]}, sad. ${Math.round(p.loyalty)})`])); const role = select(STATE_PROFS.map((x): [string, string] => [x, PROF_LABEL[x]]));
  box.append(h('h3', {}, '🎖 Atama'), h('div', { class: 'row' }, who, role, h('button', { class: 'primary', onclick: () => c.act({ t: 'appoint', personId: who.value, prof: role.value as never }) }, 'Ata')));
  return box;
}

function raporlar(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {});
  for (const gz of w.gazette.slice(-6).reverse()) box.append(h('div', { class: 'card' }, h('b', {}, `Gün ${gz.day}: ${gz.headline}`), ...gz.lines.map((l) => h('div', { class: 'muted' }, l))));
  box.append(h('h3', {}, 'Son olaylar'), ...w.events.slice(-20).reverse().map((l) => h('div', { class: 'msg' }, `Gün ${l.day} ${l.hour}:00 · ${l.text}`)));
  return box;
}

function dilekce(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {}); const pend = w.petitions.filter((p) => p.status === 'bekliyor');
  if (!pend.length) box.append(h('div', { class: 'muted' }, 'Bekleyen dilekçe yok.'));
  for (const p of pend) { const from = findPerson(w, p.fromId);
    box.append(h('div', { class: 'card' }, h('b', {}, from?.name ?? '?'), h('span', { class: 'muted' }, ` · ${p.kind}${p.amount ? ` · ${p.amount} D` : ''} · son gün ${p.expires}`), h('div', {}, `“${p.text}”`),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => c.act({ t: 'answer', petitionId: p.id, accept: true }) }, '✔ Kabul'), h('button', { onclick: () => c.act({ t: 'answer', petitionId: p.id, accept: false }) }, '✖ Ret')))); }
  const ps = pendingSanctions(c);
  box.append(h('h3', {}, `🏛 Meclis kararları onay bekliyor (${ps.length})`), ...(ps.length ? ps : [h('div', { class: 'muted' }, 'Yok.')]));
  return box;
}

const TABS: [string, string, (c: Ctx) => HTMLElement][] = [
  ['hazine', '💰 Hazine', hazine], ['ekonomi', '📊 Ekonomi', ekonomi], ['ordu', '⚔️ Ordu/İsyan', ordu], ['kanun', '📜 Kanunlar', kanunlar],
  ['dilekce', '📨 Dilekçe & Meclis', dilekce], ['gorev', '🎖 Görevliler', gorevliler], ['rapor', '📰 Raporlar', raporlar], ['aile', '👪 Aile/Varis', familyPanel],
];
let tab = 'hazine';
export function rulerScreen(c: Ctx): HTMLElement {
  const w = c.w; const pend = w.petitions.filter((p) => p.status === 'bekliyor').length;
  const head = h('div', { class: 'row', style: 'flex-wrap:wrap;gap:4px;position:sticky;top:0;background:#1c1712;padding:4px 0;z-index:2' }, ...TABS.map(([id, label]) => h('button', { class: id === tab ? 'primary' : '', onclick: () => { tab = id; body.replaceChildren(TABS.find((x) => x[0] === id)![2](c)); head.querySelectorAll('button').forEach((b, i) => b.className = TABS[i]![0] === id ? 'primary' : ''); } }, label, id === 'dilekce' && pend ? h('span', { class: 'badge' }, String(pend)) : '')));
  const body = h('div', {}, (TABS.find((x) => x[0] === tab) ?? TABS[0]!)[2](c));
  return h('div', { class: 'ruler' }, h('h2', {}, `${w.regime === 'cumhuriyet' ? '🗽 Başkanlık Makamı' : '👑 Kayzer’in Divanı'} · Gün ${w.day}`), head, body);
}

/** v2.0 UI: inventory & chest, weapon shop, event popups, empire name, “Neler yeni?”, map overlays. */
import type { Building, Good, Person, World } from '../sim/types';
import type { Ctx } from './panels';
import { h } from './dom';
import { GOOD_LABEL } from '../sim/constants';
import { findPerson } from '../sim/world';
import { ARM_LABEL, ARM_PRICE, ARM_WEIGHT, CARRY_MAX, carryWeight, isUniformed, WEAPONS, type ArmItem } from '../sim/arms';
import { RANSOM, RECRUIT_MAX, RECRUIT_PAY } from '../sim/events2';
import { REBUILD_COST } from '../sim/events3';

export const APP_NAME = 'Medieval Empire';
export const VERSION = 'v2.0';
const EAT: Good[] = ['ekmek', 'et', 'balik', 'yumurta', 'sut', 'su'];

/** 🎒 Çanta: carried weapons (draw / holster), food & water (use), and the house chest. */
export function inventoryBody(c: Ctx): HTMLElement {
  const w = c.w; const m = c.me; const box = h('div', { class: 'stack inv' }, h('h2', {}, '🎒 Çanta ve sandık')); if (!m) return box;
  const a = m.arms ?? {};
  box.append(h('div', { class: 'muted' }, `Taşınan silah yükü: ${carryWeight(a).toFixed(1)} / ${CARRY_MAX} kg. Çekili silah: ${m.drawn ? ARM_LABEL[m.drawn] : 'yok'}.${!isUniformed(m) ? ' Sivilken silah çekili gezmek suçtur: bekçi görürse el koyar ve 15 D ceza keser. Kınındaki kayıtlı silah yasaldır; evdeki sandıkta olan güvendedir.' : ' Görevlisiniz: silah taşımanız serbest.'}`));
  const rows: HTMLElement[] = [];
  for (const k of [...WEAPONS, 'kalkan', 'ok'] as ArmItem[]) {
    const n = a[k] ?? 0; if (!n) continue;
    const btns: HTMLElement[] = [];
    if ((WEAPONS as string[]).includes(k)) btns.push(m.drawn === k ? h('button', { onclick: () => c.act({ t: 'drawWeapon', kind: null }) }, 'Kınına koy') : h('button', { class: 'primary', onclick: () => c.act({ t: 'drawWeapon', kind: k as never }) }, 'Çek'));
    btns.push(h('button', { onclick: () => c.act({ t: 'stash', item: k, qty: k === 'ok' ? n : 1, toChest: true }) }, 'Sandığa'));
    rows.push(h('div', { class: 'card row inv-row' }, h('b', { style: 'flex:1' }, `${ARM_LABEL[k]} × ${n}`), h('span', { class: 'muted' }, `${(ARM_WEIGHT[k] * n).toFixed(1)} kg`), ...btns));
  }
  box.append(h('h3', {}, '⚔ Silahlar'), ...(rows.length ? rows : [h('div', { class: 'muted' }, 'Silahınız yok. Demirci’den (Zanaat Atölyesi) alabilirsiniz; asker ve bekçiler Kışla’dan bedava alır.')]));
  const food = EAT.filter((g) => (m.inv[g] ?? 0) > 0);
  box.append(h('h3', {}, '🍞 Yiyecek ve su'), ...(food.length ? food.map((g) => h('div', { class: 'card row inv-row' }, h('b', { style: 'flex:1' }, `${GOOD_LABEL[g]} × ${m.inv[g]}`), h('button', { class: 'primary', onclick: () => c.act({ t: 'useItem', good: g }) }, g === 'su' || g === 'sut' ? 'İç' : 'Ye'), h('button', { onclick: () => c.act({ t: 'stash', item: g, qty: 1, toChest: true }) }, 'Sandığa'))) : [h('div', { class: 'muted' }, 'Çantanızda yiyecek yok. Pazardan alın.')]));
  const other = (Object.keys(m.inv) as Good[]).filter((g) => !EAT.includes(g) && (m.inv[g] ?? 0) > 0);
  if (other.length) box.append(h('div', { class: 'muted' }, `Diğer: ${other.map((g) => `${GOOD_LABEL[g]} ${m.inv[g]}`).join(', ')}`));
  const ch = m.home ? w.chests?.[m.home] : undefined; const home = w.buildings.find((b) => b.id === m.home);
  box.append(h('h3', {}, '🧰 Evdeki sandık'));
  if (!home || home.burned) box.append(h('div', { class: 'muted' }, home?.burned ? 'Eviniz yandı; sandık da yandı.' : 'Sandık için bir eviniz (satın alınmış ya da kiralık) olmalı.'));
  else {
    const items: [string, number, boolean][] = [...(Object.entries(ch?.arms ?? {}) as [string, number][]).map(([k, n]) => [k, n, true] as [string, number, boolean]), ...(Object.entries(ch?.goods ?? {}) as [string, number][]).map(([k, n]) => [k, n, false] as [string, number, boolean])].filter(([, n]) => n > 0);
    box.append(h('div', { class: 'muted' }, `${home.name}. Sandığı kullanmak için evinizde olmalısınız (otomatik yürürsünüz).`));
    box.append(...(items.length ? items.map(([k, n, isArm]) => h('div', { class: 'card row inv-row' }, h('b', { style: 'flex:1' }, `${isArm ? ARM_LABEL[k as ArmItem] : GOOD_LABEL[k as Good]} × ${n}`), h('button', { onclick: () => c.act({ t: 'stash', item: k, qty: k === 'ok' ? n : 1, toChest: false }) }, 'Al'))) : [h('div', { class: 'muted' }, 'Sandık boş.')]));
  }
  return box;
}
/** Demirci shop (Zanaat Atölyesi) and Kışla kit. */
export function armsShop(c: Ctx, b: Building): HTMLElement | null {
  const m = c.me; if (!m) return null;
  if (b.id === 'atolye') {
    const smith = c.w.people.find((p) => p.prof === 'demirci' && p.jailedDays === 0);
    return h('div', { class: 'stack' }, h('h3', {}, `⚒ Demirci${smith ? ` (${smith.name})` : ''}: silah satışı`), h('div', { class: 'muted' }, 'Sabit fiyat. Her silah adınıza kaydedilir. Fiyatın %30’u demir/kereste için şehir dışına gider.'),
      ...(['hancer', 'kilic', 'yay', 'kalkan'] as ArmItem[]).map((k) => h('div', { class: 'card row inv-row' }, h('b', { style: 'flex:1' }, ARM_LABEL[k]), h('span', { class: 'muted' }, `${ARM_PRICE[k]} D · ${ARM_WEIGHT[k]} kg`), h('button', { onclick: () => c.act({ t: 'buyArm', item: k }) }, 'Al'))),
      h('div', { class: 'card row inv-row' }, h('b', { style: 'flex:1' }, 'Ok (10 adet)'), h('span', { class: 'muted' }, `${ARM_PRICE.ok * 10} D`), h('button', { onclick: () => c.act({ t: 'buyArm', item: 'ok', qty: 10 }) }, 'Al')),
      h('div', { class: 'muted' }, 'Kılıç güçlü yakın dövüş; hançer ucuz ve gizlenir ama zayıf; yay uzaktan vurur, her atış 1 ok harcar, ok darbesi kılıçtan zayıf; kalkan her darbeden 15 can azaltır. Öldürmek için iki darbe gerekir: ilki yaralar.'));
  }
  if (b.id === 'kisla') return h('div', { class: 'stack' }, h('h3', {}, '🛡 Kışla cephaneliği'), h('div', { class: 'muted' }, 'Asker ve bekçilere bedava: kılıç + kalkan + yay + 20 ok (2 günde bir).'), h('button', { class: 'primary', onclick: () => c.act({ t: 'kislaKit' }) }, 'Teçhizatımı al'));
  if (b.burned) return h('div', { class: 'card warn' }, h('b', {}, `🔥 ${b.name} yandı (gün ${b.burned.day}).`), h('div', {}, `Yeniden yapım ${REBUILD_COST} D.${b.kind === 'ev' ? ' Yapan evin sahibi olur.' : ''}`), h('button', { class: 'primary', onclick: () => c.act({ t: 'rebuild', buildingId: b.id }) }, `Yeniden yap (${REBUILD_COST} D)`));
  return null;
}
export function personExtras(c: Ctx, p: Person): HTMLElement | null {
  const m = c.me; if (!m || m.id === p.id) return null; const out = h('div', { class: 'row' });
  if (p.drawn) out.append(h('span', { class: 'chip warn' }, `⚔ elinde ${ARM_LABEL[p.drawn]}`));
  if (p.infected) out.append(h('span', { class: 'chip warn' }, '🦠 hasta'));
  if (m.prof === 'bekci' && m.jailedDays === 0) out.append(h('button', { onclick: () => c.act({ t: 'searchPerson', personId: p.id }) }, '🔎 Üstünü ara'));
  return out.childNodes.length ? out : null;
}

const ICON: Record<string, string> = { kuraklik: '☀️', salgin: '🦠', sel: '🌊', kitlik: '🍞', yangin: '🔥', yangin_sonu: '🔥', kervan: '🐪', tehdit: '⚔️', zafer: '🏆', yenilgi: '💀', baskin_uyari: '🗡', baskin: '🗡', baskin_zafer: '🏆', baskin_sonu: '🗡', devlet: '📜', devlet_sonu: '📜', savas: '⚔️', cikarma: '⛵', savas_zafer: '🏆', savas_yenilgi: '💀', isim: '👑' };
const TITLE: Record<string, string> = { kuraklik: 'KURAKLIK', salgin: 'SALGIN', sel: 'SEL', kitlik: 'KITLIK', yangin: 'YANGIN', yangin_sonu: 'YANGIN SÖNDÜ', kervan: 'TÜCCARLAR GELDİ', tehdit: 'SINIRDA TEHLİKE', zafer: 'ZAFER', yenilgi: 'YENİLGİ', baskin_uyari: 'EŞKIYA UYARISI', baskin: 'EŞKIYA BASKINI', baskin_zafer: 'EŞKIYA PÜSKÜRTÜLDÜ', baskin_sonu: 'BASKIN BİTTİ', devlet: 'YABANCI ELÇİ', devlet_sonu: 'DİPLOMASİ', savas: 'SAVAŞ', cikarma: 'ÇIKARMA!', savas_zafer: 'SAVAŞ KAZANILDI', savas_yenilgi: 'SAVAŞ KAYBEDİLDİ', isim: 'DEVLETİN ADI' };
export interface PopupEnv { w: World; me: Person | null; ruler: boolean; act: (a: never) => void; goTo: (bid: string) => void }
/** Options under each event popup. */
export function eventOptions(kind: string, env: PopupEnv, close: () => void): HTMLElement[] {
  const { w, me, ruler } = env; const o: HTMLElement[] = []; const go = (bid: string, label: string): HTMLElement => h('button', { class: 'primary', onclick: () => { close(); env.goTo(bid); } }, label);
  const act = (a: unknown, label: string, cls = ''): HTMLElement => h('button', { class: cls, onclick: () => { close(); env.act(a as never); } }, label);
  if (kind === 'kervan' && w.caravan) { const goods = w.listings.filter((l) => l.sellerId === 'dis' && l.qty > 0).map((l) => `${GOOD_LABEL[l.good]} ${l.qty} × ${l.price} D`).join(' · '); if (goods) o.push(h('div', { class: 'muted' }, goods)); o.push(go(w.caravan.ship ? 'liman' : 'pazar', w.caravan.ship ? '⛵ Limana git, gemiden al' : '🐪 Pazara git, kervandan al')); }
  if (kind === 'tehdit' && w.threat) { if (ruler) o.push(h('div', { class: 'row' }, act({ t: 'tribute', pay: true }, `Haracı öde (${w.threat.demand} D)`), act({ t: 'tribute', pay: false }, '⚔️ Reddet, ordu savaşsın', 'danger'))); else o.push(h('div', { class: 'muted' }, 'Kararı Kayzer verir.')); }
  if ((kind === 'baskin_uyari' || kind === 'baskin' || kind === 'cikarma') && me) { if (me.home) o.push(act({ t: 'goHome' }, '🏠 Eve git (güvende kal)', 'primary')); if (isUniformed(me)) o.push(go('kisla', '🛡 Kışla’dan teçhizat al')); }
  if (kind === 'devlet' && w.foreign?.phase === 'talep') { if (ruler) o.push(h('div', { class: 'row' }, act({ t: 'foreignAnswer', choice: 'pay' }, `Haraç öde (${w.foreign.demand} D)`), act({ t: 'foreignAnswer', choice: 'vassal' }, 'Vergiye bağlan'), act({ t: 'foreignAnswer', choice: 'war' }, '⚔️ Reddet: savaş', 'danger'))); else o.push(h('div', { class: 'muted' }, 'Kararı Kayzer verir.')); }
  if ((kind === 'savas' || kind === 'devlet') && w.foreign && ruler) o.push(act({ t: 'recruit', n: 5 }, `Ücretli 5 asker topla (${w.foreign.recruits.length}/${RECRUIT_MAX}, günde ${RECRUIT_PAY} D)`));
  if (kind === 'savas_yenilgi' && ruler) for (const p of w.people.filter((x) => x.captive)) o.push(act({ t: 'ransom', personId: p.id }, `🕊 ${p.name} için fidye öde (${RANSOM} D)`));
  if ((kind === 'salgin' || kind === 'yangin_sonu' || kind === 'baskin_sonu' || kind === 'savas_yenilgi') && me && (me.infected || me.wounded)) o.push(go('hekimhane', '🩺 Hekimhane’ye git'));
  if (kind === 'yangin' && me && w.fire?.bid === me.home) o.push(act({ t: 'leaveHome' }, '🏃 Hemen dışarı çık!', 'danger'));
  return o;
}
export function eventTitle(kind: string): string { return `${ICON[kind] ?? '⚠'} ${TITLE[kind] ?? 'OLAY'}`; }

export const WHATS_NEW: string[] = [
  '👑 Oyunun yeni adı Medieval Empire; yeni simge.',
  '🏷 Kayzer devletimize isim koyar; isim herkese duyurulur ve Tarih Kitabı’na yazılır.',
  '⚔ Silahlar: kılıç, hançer, yay + ok, kalkan. Demirci satar, asker/bekçi Kışla’dan bedava alır. Silahsız yaralayamaz, öldüremezsiniz; öldürmek iki darbe ister.',
  '🎒 Çanta ve ev sandığı: silahı çekip kınına koyun, ekmeği/suyu çantadan yiyip için, eşyayı evdeki sandıkta saklayın. Sivilken çekili silahla gezmek suç: bekçi el koyar.',
  '🗡 Silahlı eşkıya baskını: gündüz uyarı gelir, gece 10 eşkıya dışarıdakileri soyar. Evde kalın; asker ve bekçiler savaşır.',
  '⛵ Yabancı devlet: haraç, vergiye bağlanma ya da savaş. Savaşta düşman gemilerle nehirden çıkar; Kayzer ücretli asker toplayabilir, esirler fidyeyle geri alınır.',
  '🐪 Develi kervanlar Pazar’a, Venedik gemisi Liman’a gelir: kıt mal pahalı, diğerleri ucuz.',
  '🔥 Yangın binayı yıkar: içeridekiler kaçmazsa ölür ya da yaralanır; harabe yeniden yapılabilir.',
  '🦠 Salgın kişiden kişiye bulaşır: hastaysanız üstte 🦠 görünür, hekime gidin.',
  '📣 Her olay için açıklamalı, seçenekli ayrı açılır pencere.',
  '🧑‍⚖ Mahkemede tanık çağırma, küçük ekranlarda kayıt düzeltmesi, hata ve takılma düzeltmeleri.',
];
export function whatsNewModal(onClose: () => void): HTMLElement {
  const el = h('div', { class: 'modal whatsnew' }, h('div', { class: 'box' }, h('h2', {}, `✨ Neler yeni? (${VERSION})`), h('div', { class: 'stack' }, ...WHATS_NEW.map((t) => h('div', { class: 'msg' }, t))), h('button', { class: 'primary', onclick: () => { el.remove(); onClose(); } }, 'Harika!')));
  return el;
}
export function empireNameModal(send: (name: string) => Promise<string | null>, current?: string): HTMLElement {
  const inp = h('input', { maxlength: '40', placeholder: 'ör. Anadolu İmparatorluğu', value: current ?? '' }); const err = h('div', { class: 'muted' });
  const el = h('div', { class: 'modal' }, h('div', { class: 'box' }, h('h2', {}, '👑 Devletinize isim verin'), h('div', { class: 'muted' }, 'Bu isim her yerde (üst bilgi, duyurular, diplomasi, Tarih Kitabı) kullanılacak ve herkese duyurulacak. 3–40 harf.'), inp, err,
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => { void send(inp.value).then((e) => { if (e) err.textContent = e; else el.remove(); }); } }, 'İlan et'), h('button', { onclick: () => el.remove() }, 'Sonra'))));
  return el;
}

// ---------------- map overlays ----------------
type Cam = { x: number; y: number; z: number };
const PAZAR = { x: 36, y: 28.6 }; const LIMAN = { x: 36, y: 49.2 };
function camel(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, f: number): void {
  ctx.fillStyle = '#c49a5a'; ctx.fillRect(x - s * 0.45, y - s * 0.55, s * 0.9, s * 0.3); // body
  ctx.fillRect(x - s * 0.15, y - s * 0.75, s * 0.3, s * 0.22); // hump
  ctx.fillRect(x + s * 0.38, y - s * 0.85, s * 0.12, s * 0.35); ctx.fillRect(x + s * 0.38, y - s * 0.9, s * 0.25, s * 0.1); // neck/head
  ctx.fillStyle = '#8a6a3a'; const l = f ? s * 0.05 : 0; for (const dx of [-0.35, -0.15, 0.15, 0.32]) ctx.fillRect(x + dx * s + (dx > 0 ? l : -l), y - s * 0.25, s * 0.07, s * 0.27);
  ctx.fillStyle = '#b03030'; ctx.fillRect(x - s * 0.3, y - s * 0.6, s * 0.4, s * 0.08); // saddle cloth
}
function ship(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, flag: string): void {
  ctx.fillStyle = '#6b4423'; ctx.beginPath(); ctx.moveTo(x - s * 1.2, y - s * 0.3); ctx.lineTo(x + s * 1.2, y - s * 0.3); ctx.lineTo(x + s * 0.9, y); ctx.lineTo(x - s * 0.9, y); ctx.fill();
  ctx.fillStyle = '#3a2614'; ctx.fillRect(x - s * 0.04, y - s * 1.5, s * 0.08, s * 1.2);
  ctx.fillStyle = '#f2ead8'; ctx.beginPath(); ctx.moveTo(x, y - s * 1.45); ctx.lineTo(x + s * 0.7, y - s * 0.45); ctx.lineTo(x, y - s * 0.45); ctx.fill();
  ctx.fillStyle = flag; ctx.fillRect(x, y - s * 1.65, s * 0.3, s * 0.18);
}
function figure(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, cloak: string, f: number, bow: boolean): void {
  ctx.fillStyle = cloak; ctx.fillRect(x - s * 0.18, y - s * 0.75, s * 0.36, s * 0.5); ctx.fillStyle = '#e0b08a'; ctx.fillRect(x - s * 0.1, y - s * 0.92, s * 0.2, s * 0.17);
  ctx.fillStyle = '#222'; ctx.fillRect(x - s * 0.12 + (f ? s * 0.04 : 0), y - s * 0.25, s * 0.08, s * 0.25); ctx.fillRect(x + s * 0.04 - (f ? s * 0.04 : 0), y - s * 0.25, s * 0.08, s * 0.25);
  ctx.strokeStyle = bow ? '#7a5a2a' : '#cfd6dc'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.beginPath(); if (bow) ctx.arc(x + s * 0.25, y - s * 0.55, s * 0.22, -1.2, 1.2); else { ctx.moveTo(x + s * 0.2, y - s * 0.4); ctx.lineTo(x + s * 0.45, y - s * 0.95); } ctx.stroke();
}
const hsh = (s: string): number => { let x = 0; for (const ch of s) x = (x * 31 + ch.charCodeAt(0)) | 0; return Math.abs(x); };
export function drawV2(ctx: CanvasRenderingContext2D, w: World, cam: Cam, z: number, sz: number, now: number): void {
  const P = (x: number, y: number): [number, number] => [(x - cam.x) * z, (y - cam.y) * z];
  // burned buildings and the fire
  for (const b of w.buildings) {
    if (!b.burned && w.fire?.bid !== b.id) continue; const [x, y] = P(b.x, b.y); const bw = b.w * z, bh = b.h * z;
    if (b.burned) { ctx.fillStyle = 'rgba(30,26,24,0.85)'; ctx.fillRect(x, y, bw, bh); ctx.fillStyle = '#4a4440'; for (let i = 0; i < 6; i++) ctx.fillRect(x + ((hsh(b.id) >> i) % 10) / 10 * bw, y + ((hsh(b.id) >> (i + 3)) % 10) / 10 * bh, z * 0.6, z * 0.3); }
    else for (let i = 0; i < 14; i++) { const k = (now / 300 + i * 0.7) % 1; ctx.fillStyle = i % 2 ? `rgba(255,${120 + 80 * k | 0},0,${1 - k})` : `rgba(255,220,60,${1 - k})`; ctx.beginPath(); ctx.arc(x + ((i * 37) % 13) / 13 * bw, y + bh * 0.5 - k * z * 3, z * (0.9 - k * 0.5), 0, Math.PI * 2); ctx.fill(); }
  }
  // caravan / ship
  const cv = w.caravan;
  if (cv && w.day <= cv.until) {
    const t = Math.min(1, (now - (cv.arriveAt ?? now - 120_000)) / 90_000);
    if (cv.ship) { const [x, y] = P(100 - (100 - LIMAN.x) * t, LIMAN.y + 1.6); ship(ctx, x, y, sz * 1.1, '#c8102e'); }
    else for (let i = 0; i < 6; i++) { const sx = 101 - (101 - PAZAR.x - 1.2 * i) * t + i * 1.2 * (1 - t); const [x, y] = P(sx, PAZAR.y + (i % 2) * 0.6); camel(ctx, x, y, sz * 1.05, t < 1 ? Math.floor(now / 250 + i) % 2 : 0); }
  }
  // raid robbers
  if (w.raid?.phase === 'gece') for (const r of w.raid.robbers ?? []) {
    if (r.hp <= 0) continue; const k = hsh(r.id); const x = 10 + (k % 70) + Math.sin(now / 4000 + k) * 6; const y = 20 + ((k >> 4) % 16) + Math.cos(now / 5300 + k) * 3;
    const [px, py] = P(x, y); figure(ctx, px, py, sz, '#2b2b2b', Math.floor(now / 220 + k) % 2, k % 3 === 0);
  }
  // foreign ships + troops
  const f = w.foreign;
  if (f && f.phase === 'savas') {
    const ships = Math.max(2, Math.ceil(f.troops / 8));
    if (f.landed) for (let i = 0; i < ships; i++) { const [x, y] = P(46 + i * 6, 51.5); ship(ctx, x, y, sz * 1.2, '#2a4a9a'); }
    else if (w.day >= (f.landDay ?? 0) - 1) for (let i = 0; i < ships; i++) { const [x, y] = P(95 - i * 5 - (now / 3000 % 10), 52); ship(ctx, x, y, sz * 1.0, '#2a4a9a'); }
    if (f.landed) { const k = Math.min(1, (now - (f.landAt ?? now)) / 120_000); for (let i = 0; i < (f.alive ?? 0); i++) { const x = 44 + (i % 8) * 1.3 + Math.sin(now / 900 + i) * 0.3; const y = 48 - k * 16 - Math.floor(i / 8) * 1.2; const [px, py] = P(x, y); figure(ctx, px, py, sz, '#2a4a9a', Math.floor(now / 220 + i) % 2, i % 3 === 0); } }
  }
}
export { findPerson };

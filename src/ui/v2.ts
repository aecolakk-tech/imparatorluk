/** v2.0 UI: inventory & chest, weapon shop, event popups, empire name, “Neler yeni?”, map overlays. */
import type { Building, Good, Person, World } from '../sim/types';
import type { Ctx } from './panels';
import { h } from './dom';
import { GOOD_LABEL } from '../sim/constants';
import { findPerson } from '../sim/world';
import { ARM_LABEL, ARM_PRICE, ARM_WEIGHT, CARRY_MAX, carryWeight, isUniformed, WEAPONS, type ArmItem } from '../sim/arms';
import { RANSOM, RECRUIT_MAX, RECRUIT_PAY } from '../sim/events2';
import { REBUILD_COST } from '../sim/events3';
import { foeMoving, foePos, SAIL_MS } from '../sim/combatpos';
import { myPos } from '../sim/v16';
import { distToBuilding, REACH } from '../sim/move';
import { assignSlot, hotbarSlots } from './controls';
import { marketPrice } from '../sim/economy';

export const APP_NAME = 'Medieval Empire';
export const VERSION = 'v2.0.1';
const EAT: Good[] = ['ekmek', 'et', 'balik', 'yumurta', 'sut', 'su'];

/** 🎒 Çanta: carried weapons (draw / holster), food & water (use), and the house chest. */
export function inventoryBody(c: Ctx): HTMLElement {
  const w = c.w; const m = c.me; const box = h('div', { class: 'stack inv' }, h('h2', {}, '🎒 Çanta ve sandık')); if (!m) return box;
  const a = m.arms ?? {};
  box.append(h('div', { class: 'muted' }, `Taşınan silah yükü: ${carryWeight(a).toFixed(1)} / ${CARRY_MAX} kg. Çekili silah: ${m.drawn ? ARM_LABEL[m.drawn] : 'yok'}.${!isUniformed(m) ? ' Sivilken silah çekili gezmek suçtur: bekçi görürse el koyar ve 15 D ceza keser. Kınındaki kayıtlı silah yasaldır; evdeki sandıkta olan güvendedir.' : ' Görevlisiniz: silah taşımanız serbest.'}`));
  const homeB = w.buildings.find((b) => b.id === m.home); const atHome = !!homeB && !homeB.burned && ((m.homeUntil ?? 0) > Date.now() || distToBuilding(homeB, myPos(w, m, Date.now())) <= REACH + 0.5);
  const slots = hotbarSlots(m);
  const slotSel = (k: string): HTMLElement => { const sel = h('select', { title: 'Hızlı çubuktaki yuvası', style: 'width:auto' }, h('option', { value: '' }, 'Çubuk —'), ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => h('option', { value: String(i - 1), ...(slots[i - 1] === k ? { selected: 'selected' } : {}) }, `Yuva ${i}`))) as HTMLSelectElement; sel.addEventListener('change', () => { if (sel.value !== '') { assignSlot(m, k, +sel.value); dispatchEvent(new Event('imp-refresh')); } }); return sel; };
  const toChest = (k: string, n: number): HTMLElement => atHome ? h('button', { onclick: () => c.act({ t: 'stash', item: k, qty: n, toChest: true }) }, 'Sandığa') : h('button', { disabled: 'disabled', title: 'Sandık evinizde – önce eve gidin' }, 'Sandık: evde');
  const rows: HTMLElement[] = [];
  for (const k of [...WEAPONS, 'kalkan', 'ok'] as ArmItem[]) {
    const n = a[k] ?? 0; if (!n) continue;
    const btns: HTMLElement[] = [];
    if ((WEAPONS as string[]).includes(k)) btns.push(m.drawn === k ? h('button', { onclick: () => c.act({ t: 'drawWeapon', kind: null }) }, 'Kınına koy') : h('button', { class: 'primary', onclick: () => c.act({ t: 'drawWeapon', kind: k as never }) }, 'Çek'));
    if (k !== 'ok') btns.push(slotSel(k)); btns.push(toChest(k, k === 'ok' ? n : 1));
    rows.push(h('div', { class: 'card row inv-row' }, h('b', { style: 'flex:1' }, `${ARM_LABEL[k]} × ${n}`), h('span', { class: 'muted' }, `${(ARM_WEIGHT[k] * n).toFixed(1)} kg`), ...btns));
  }
  box.append(h('h3', {}, '⚔ Silahlar'), ...(rows.length ? rows : [h('div', { class: 'muted' }, 'Silahınız yok. Demirci’den (Zanaat Atölyesi) alabilirsiniz; asker ve bekçiler Kışla’dan bedava alır.')]));
  const food = EAT.filter((g) => (m.inv[g] ?? 0) > 0);
  box.append(h('h3', {}, '🍞 Yiyecek ve su'), ...(food.length ? food.map((g) => h('div', { class: 'card row inv-row' }, h('b', { style: 'flex:1' }, `${GOOD_LABEL[g]} × ${m.inv[g]}`), h('button', { class: 'primary', onclick: () => c.act({ t: 'useItem', good: g }) }, g === 'su' || g === 'sut' ? 'İç' : 'Ye'), slotSel(g), toChest(g, 1))) : [h('div', { class: 'muted' }, 'Çantanızda yiyecek yok. Fırın’dan ekmek, Kuyu’dan su “Çantaya al” ile alın.')]));
  const other = (Object.keys(m.inv) as Good[]).filter((g) => !EAT.includes(g) && (m.inv[g] ?? 0) > 0);
  if (other.length) box.append(h('h3', {}, '📦 Diğer eşyalar'), ...other.map((g) => h('div', { class: 'card row inv-row' }, h('b', { style: 'flex:1' }, `${GOOD_LABEL[g]} × ${m.inv[g]}`), toChest(g, 1), atHome && (m.inv[g] ?? 0) > 1 ? h('button', { onclick: () => c.act({ t: 'stash', item: g, qty: m.inv[g], toChest: true }) }, 'Hepsini sandığa') : '')));
  const ch = m.home ? w.chests?.[m.home] : undefined; const home = w.buildings.find((b) => b.id === m.home);
  box.append(h('h3', {}, '🧰 Evdeki sandık'));
  if (!home || home.burned) box.append(h('div', { class: 'muted' }, home?.burned ? 'Eviniz yandı; sandık da yandı.' : 'Sandık için bir eviniz (satın alınmış ya da kiralık) olmalı.'));
  else {
    const items: [string, number, boolean][] = [...(Object.entries(ch?.arms ?? {}) as [string, number][]).map(([k, n]) => [k, n, true] as [string, number, boolean]), ...(Object.entries(ch?.goods ?? {}) as [string, number][]).map(([k, n]) => [k, n, false] as [string, number, boolean])].filter(([, n]) => n > 0);
    box.append(h('div', { class: 'muted' }, atHome ? `${home.name} – sandığın başındasınız.` : `${home.name}. Sandığı yalnız evinizdeyken kullanabilirsiniz.`), atHome ? '' : h('button', { onclick: () => c.act({ t: 'goHome' } as never) }, '🏠 Eve git'));
    box.append(...(items.length ? items.map(([k, n, isArm]) => h('div', { class: 'card row inv-row' }, h('b', { style: 'flex:1' }, `${isArm ? ARM_LABEL[k as ArmItem] : GOOD_LABEL[k as Good]} × ${n}`), atHome ? h('button', { onclick: () => c.act({ t: 'stash', item: k, qty: k === 'ok' ? n : 1, toChest: false }) }, 'Al') : '')) : [h('div', { class: 'muted' }, 'Sandık boş.')]));
  }
  return box;
}
/** Demirci shop (Zanaat Atölyesi) and Kışla kit. */
export function armsShop(c: Ctx, b: Building): HTMLElement | null {
  const m = c.me; if (!m) return null;
  const goods: Good[] = b.id === 'firin' ? ['ekmek'] : b.id === 'kuyu' ? ['su'] : b.kind === 'pazar' ? ['ekmek', 'su'] : [];
  if (goods.length && !b.burned) return h('div', { class: 'stack' }, h('h3', {}, '🎒 Çantaya al (sonra Çanta’dan ya da hızlı çubuktan ücretsiz yer/içersiniz)'),
    ...goods.map((g) => h('div', { class: 'row' }, h('b', { style: 'flex:1' }, `${GOOD_LABEL[g]} (~${marketPrice(c.w, g).toFixed(2)} D) · çantada ${m.inv[g] ?? 0}`), h('button', { class: 'primary', onclick: () => c.act({ t: 'buyBag', good: g, qty: 1 } as never) }, '1 al'), h('button', { onclick: () => c.act({ t: 'buyBag', good: g, qty: 5 } as never) }, '5 al'))));
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
  '⚔ Gerçek zamanlı savaş: eşkıya ve düşman askerleri haritada dolaşan gerçek hedefler. Silahınızı seçip dokunun ya da “Saldır”a basın; kılıç/hançer yakından, yay uzaktan vurur (ok harcar), kalkan darbeyi azaltır.',
  '⛵ Macar çıkarması artık görünür: gemiler nehirden yelken açıp Liman’a yanaşır, askerler karaya çıkıp şehre yürür; asker ve bekçilerimiz onlarla çarpışır. Hasar sayıları, can çubukları, kırmızı parlama.',
  '🐢 Baskın ve savaş sırasında oyun otomatik 0,25x yavaşlar; bitince Kayzer’in hızına döner.',
  '🎮 Yeni kontroller: yürümek için sol altta joystick (bilgisayarda WASD/oklar); sağ altta “Saldır” ve “Etkileşim”, altta 8 yuvalı hızlı çubuk (1–8 tuşları; Boşluk/F saldır, E etkileşim). Haritaya dokunmak artık yürütmez: kişiye dokununca adı ve canı, binaya dokununca bina seçilir; yanına gidip “Etkileşim” ile girersiniz.',
  '🕰 Yeni saat: 1 oyun günü = 20 gerçek dakika. Gündüz (06–22) her oyun saati 1 dakika, gece (22–06) 30 saniye. Yürümek saat yakmaz; kısa bir yol birkaç saniye sürer. Günde 3 öğün ve 3 kez su yeter.',
  '👤 Birine dokununca adı ve canı görünür; yanındayken “Etkileşim” ile konuşma penceresi açılır ve o kişi siz konuşurken bekler.',
  '🎒 Fırın/Kuyu/Pazar’da “Çantaya al”; Ye/Su iç önce çantadan ücretsiz kullanır, yoksa fiyatı düğmede yazar. Sandık yalnız evde; her eşya sandığa konabilir.',
  '💰 Kese geçmişi (keseye dokunun): her gelir/giderin sebebi; para kaybında bildirim. Kese kuruşuyla gösterilir.',
  '📍 Yer bul: Fırın, Kuyu, Demirci… birine basınca karakteriniz oraya yürür, varınca açılır. Haritada dokunmak artık rastgele panel açmaz.',
  '🆕 Yeni karakterler tok, susuz değil ve dinç başlar; çantada ekmek ve su var; tanıtım sırasında ihtiyaçlar durur. Pencereler sırayla açılır.',
  '🔧 Su daha yavaş azalır; çubuklar “100 = iyi” gösterir; karakteriniz siz çevrimiçiyken arkanızdan yiyip içmez (yalnız çok acil durumda, bildirimle); menü donması, teklif kartı, sekme taşması, fare tekerleği ve diğer hatalar düzeltildi.',
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
export function drawV2(ctx: CanvasRenderingContext2D, w: World, cam: Cam, z: number, sz: number, now: number, placed?: { p: Person; x: number; y: number; visible: boolean }[]): void {
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
  drawCombat(ctx, w, P, z, sz, now, placed);
}
function hpBar(ctx: CanvasRenderingContext2D, x: number, y: number, wd: number, v: number, max: number, col: string): void {
  const k = Math.max(0, Math.min(1, v / max)); ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - wd / 2 - 1, y - 1, wd + 2, 5);
  ctx.fillStyle = k > 0.5 ? col : k > 0.25 ? '#e0a020' : '#d03020'; ctx.fillRect(x - wd / 2, y, wd * k, 3);
}
/** v2.0.1: real-time fight – foes with health bars, the enemy fleet sailing in and docking, floating damage numbers. */
export function drawCombat(ctx: CanvasRenderingContext2D, w: World, P: (x: number, y: number) => [number, number], z: number, sz: number, now: number, placed?: { p: Person; x: number; y: number; visible: boolean }[]): void {
  const f = w.foreign; const c = w.combat;
  if (f && f.phase === 'savas') {
    const ships = Math.max(3, Math.ceil(f.troops / 6));
    const dock = (i: number): [number, number] => [LIMAN.x - 7 + i * (14 / Math.max(1, ships - 1)), 49.6 + (i % 2) * 1.3];
    const sail = c?.kind === 'war' ? Math.min(1, Math.max(0, (now - c.startAt) / SAIL_MS)) : f.landed ? 1 : -1;
    for (let i = 0; i < ships; i++) {
      const [dx, dy] = dock(i); const bob = Math.sin(now / 600 + i) * 0.12;
      let x: number, y: number;
      if (sail < 0) { if (w.day < (f.landDay ?? 0) - 1) continue; x = 93 + i * 1.6; y = 52 + (i % 3) * 1.4; } // waiting downstream
      else { const e = 1 - Math.pow(1 - sail, 2); const sx = 93 + i * 1.6, sy = 52 + (i % 3) * 1.4; x = sx + (dx - sx) * e; y = sy + (dy - sy) * e; }
      const [px, py] = P(x, y + bob); ship(ctx, px, py, sz * 1.25, '#2a4a9a');
      if (sail >= 0 && sail < 1) { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, z * 0.08); ctx.beginPath(); ctx.moveTo(px + sz * 1.3, py); ctx.lineTo(px + sz * 2.6, py + sz * 0.15); ctx.stroke(); } // wake
    }
    if (c?.kind === 'war' && !c.spawned) { const [lx, ly] = P(LIMAN.x, 47.6); const left = Math.max(0, Math.ceil((c.spawnAt - now) / 1000)); ctx.font = `bold ${Math.max(11, z * 0.7)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#000a'; ctx.fillText(`⚓ Gemiler yanaşıyor… ${left} sn`, lx + 1, ly + 1); ctx.fillStyle = '#ffd36a'; ctx.fillText(`⚓ Gemiler yanaşıyor… ${left} sn`, lx, ly); }
  }
  if (!c) return;
  for (const fo of c.foes) {
    if (fo.hp <= 0) continue; const pt = foePos(fo, now); const [px, py] = P(pt.x, pt.y);
    const mov = foeMoving(fo, now);
    figure(ctx, px, py, sz, fo.kind === 'eskiya' ? '#2b2b2b' : '#2a4a9a', mov ? Math.floor(now / 220 + hsh(fo.id)) % 2 : 0, fo.bow);
    if (fo.kind === 'eskiya') { ctx.fillStyle = '#7a1010'; ctx.fillRect(px - sz * 0.14, py - sz * 0.86, sz * 0.28, sz * 0.07); } else { ctx.fillStyle = '#c8102e'; ctx.fillRect(px - sz * 0.05, py - sz * 0.7, sz * 0.1, sz * 0.3); ctx.fillRect(px - sz * 0.15, py - sz * 0.6, sz * 0.3, sz * 0.08); }
    hpBar(ctx, px, py - sz * 1.12, Math.max(18, sz * 0.8), fo.hp, fo.max, '#e04040');
  }
  if (placed) for (const q of placed) { if (!q.visible) continue; const fight = !!c.assign[q.p.id] || (!!q.p.playerId && !q.p.npc); if (!fight) continue; const [px, py] = P(q.x, q.y); hpBar(ctx, px, py - sz * 1.15, Math.max(18, sz * 0.8), q.p.health, 100, '#40c040'); }
  // floating numbers
  ctx.textAlign = 'center';
  for (const hi of c.hits) {
    const age = now - hi.at; if (age < 0 || age > 1400) continue; const k = age / 1400; const [px, py] = P(hi.x, hi.y);
    const txt = hi.k === 'miss' ? 'ıska' : hi.k === 'rob' ? `−${hi.dmg} D` : hi.k === 'down' ? '✝' : `−${hi.dmg}`;
    ctx.font = `bold ${Math.max(12, Math.round(z * (hi.k === 'kill' ? 0.95 : 0.75)))}px sans-serif`;
    ctx.globalAlpha = 1 - k; ctx.fillStyle = '#000'; ctx.fillText(txt, px + 1, py - sz * (1.3 + k) + 1);
    ctx.fillStyle = hi.k === 'miss' ? '#ddd' : hi.k === 'block' ? '#8fc8ff' : hi.k === 'rob' ? '#ffd36a' : hi.to.startsWith('E') || hi.to.startsWith('M') ? '#ffe070' : '#ff5050';
    ctx.fillText(txt, px, py - sz * (1.3 + k)); ctx.globalAlpha = 1;
  }
}
export { findPerson };

/** v2.0.1 one-page controls screen (after character creation). Needs stand still while it is open (onboardPause). */
export function controlsModal(onClose: () => void): HTMLElement {
  const slot = (n: number, t: string): HTMLElement => h('div', { class: 'cm-slot' }, h('small', {}, String(n)), t);
  const el = h('div', { class: 'modal controls-modal' }, h('div', { class: 'box' },
    h('h2', {}, '🎮 Kontroller'),
    h('div', { class: 'cm-grid' },
      h('div', { class: 'cm-item' }, h('div', { class: 'cm-joy' }, h('i', {})), h('b', {}, 'Joystick (sol alt)'), h('div', { class: 'muted' }, 'Basılı tutup kaydırın: karakteriniz o yöne yürür. Bilgisayarda WASD / ok tuşları. Haritaya dokunmak yürütmez.')),
      h('div', { class: 'cm-item' }, h('div', { class: 'cm-btn atk' }, '⚔'), h('b', {}, 'Saldır (sağ alt)'), h('div', { class: 'muted' }, 'Seçili silahla en yakın düşmana vurur (kılıç/hançer yakından, yay uzaktan). Klavye: Boşluk / F.')),
      h('div', { class: 'cm-item' }, h('div', { class: 'cm-btn itr' }, '✋'), h('b', {}, 'Etkileşim'), h('div', { class: 'muted' }, 'Yanınızdaki kişiyle konuşun ya da seçtiğiniz binaya girin. Bir kişiye/binaya dokununca seçilir. Klavye: E.')),
    ),
    h('div', { class: 'cm-item wide' }, h('div', { class: 'cm-bar' }, slot(1, '🗡'), slot(2, '🏹'), slot(3, '🛡'), slot(4, '🍞'), slot(5, '💧'), slot(6, ''), slot(7, ''), slot(8, '')), h('b', {}, '8 yuvalı hızlı çubuk (alt orta)'),
      h('div', { class: 'muted' }, 'Bir yuvaya dokunun: silahı çeker/kınına koyar, ekmeği yer, suyu içer. Klavye: 1–8. Yuvaları Menü → Çanta’dan değiştirirsiniz.')),
    h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { onclick: () => { el.remove(); onClose(); } }, 'Atla'), h('button', { class: 'primary', onclick: () => { el.remove(); onClose(); } }, 'Anladım')),
    h('div', { class: 'muted' }, 'Bu ekran açıkken açlık, susuzluk ve yorgunluğunuz ilerlemez.')));
  return el;
}

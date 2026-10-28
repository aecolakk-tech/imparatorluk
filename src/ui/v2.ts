import { campaignButtons } from './campaign';
import { PRODUCES } from '../sim/constants';
/** v2.0 UI: inventory & chest, weapon shop, event popups, empire name, “Neler yeni?”, map overlays. */
import type { Building, Good, Person, World } from '../sim/types';
import type { Ctx } from './panels';
import { h } from './dom';
import { GOOD_LABEL } from '../sim/constants';
import { findPerson } from '../sim/world';
import { ARM_LABEL, ARM_PRICE, ARM_WEIGHT, CARRY_MAX, carryWeight, isUniformed, WEAPONS, type ArmItem } from '../sim/arms';
import { RANSOM, RECRUIT_MAX, RECRUIT_PAY } from '../sim/events2';
import { REBUILD_COST } from '../sim/events3';
import { tween } from './tween';
import { berth, foeMoving, foePos, SAIL_MS, shipCount } from '../sim/combatpos';
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
  if (!p.playerId && PRODUCES[p.prof]) out.append(h('button', { class: 'primary', title: 'Esnaf itibarınıza ve rütbenize bakar; uygunsa sizi çırak alır.', onclick: () => c.act({ t: 'askJob', personId: p.id }) }, '💼 Bir iş var mı?'));
  for (const d of (c.w.meclis.dilekceler ?? []).filter((x) => x.status === 'acik' && x.by === m.id && !x.signers.includes(p.id)).slice(0, 2)) out.append(h('button', { title: `${d.signers.length}/20 imza`, onclick: () => c.act({ t: 'dilekceIste', id: d.id, personId: p.id }) }, `✍ Dilekçemi imzalat (${d.signers.length}/20)`));
  out.append(...campaignButtons(c, p)); // v2.0.2 kapı kapı, ikram, destek, kara propaganda
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
  '🏛 Yeni Meclis ekranı: üstte hazine, hükümet, sonraki seçim; sekmeler Gündem / Teklif Ver / Geçmiş / Üyeler / Partiler / Seçim-Kampanya.',
  '📊 Bütçe Komisyonu: 200 D ve üstü harcamalara “Hazine karşılar mı?” raporu. Hazinenin karşılayamadığı harcama ancak “Borçlanma” etiketiyle önerilir.',
  '✍ Halk dilekçesi: herkes Meclis’te dilekçe açabilir; 20 imza toplanınca konu doğrudan gündeme girer. Etkileşimde “Dilekçemi imzalat”.',
  '🗳 Gerçek sandık: seçim günü Meclis binasına yürüyüp oy verin. “Oyunuz kaydedildi”, canlı katılım oranı, oylar gizli.',
  '⏳ “Oylama başladı, X saat kaldı” bildirimi ve sayaç; yeter sayı (16’da 9) uygulanıyor. Boş sandalyeler ara seçimle hemen doluyor.',
  '📜 Yürürlükteki genelge ve kanunların bitiş günü görünür; yeni “Kanunu/genelgeyi kaldır” teklifi.',
  '🗽 Cumhuriyet İlanı (anayasa): 14/16 evet, vicdan oyu (parti disiplini yok), Kayzer veto edemez.',
  '🤖 Tek başına oynanabilir: NPC’ler seçim kampanyası yapıyor, parti kuruyor, dilekçe imzalıyor, iş arıyor, terfi ediyor, camiye gidiyor; Kayzer yokken naip vergi, ambar ve narhı yönetiyor ve bekleyen kararları zamanında onaylıyor ya da reddediyor.',
  '🌾 Ekonomi düzeltmeleri: ekmek zinciri (çiftçi→değirmen→fırın) artık kopmuyor, esnaf kredisi, gerçek doğumlar, kıtlıkta göç tamamen durmuyor.',
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
/** v2.0.2: a weapon held in the hand (kılıç / hançer / yay), swinging when swing ∈ [0,1] (−1 = idle). dir = facing (±1). */
export function drawHeld(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, kind: string, dir: number, swing: number): void {
  const hx = x + dir * s * 0.24, hy = y - s * 0.42; ctx.save(); ctx.translate(hx, hy); if (dir < 0) ctx.scale(-1, 1);
  if (kind === 'yay') {
    const draw = swing >= 0 ? Math.sin(Math.min(1, swing) * Math.PI) : 0; // string pulled back while shooting
    ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.beginPath(); ctx.arc(0, 0, s * 0.3, -1.25, 1.25); ctx.stroke();
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.cos(-1.25) * s * 0.3, Math.sin(-1.25) * s * 0.3); ctx.lineTo(-draw * s * 0.18, 0); ctx.lineTo(Math.cos(1.25) * s * 0.3, Math.sin(1.25) * s * 0.3); ctx.stroke();
  } else {
    const len = kind === 'hancer' ? s * 0.32 : s * 0.62; // idle: raised; swing: an arc from up-back to down-front
    const ang = swing >= 0 ? -2.2 + Math.min(1, swing) * 2.9 : -1.1; ctx.rotate(ang);
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-s * 0.03, -s * 0.03, s * 0.12, s * 0.06); // grip
    ctx.fillStyle = '#c9a43a'; ctx.fillRect(s * 0.08, -s * 0.08, s * 0.03, s * 0.16); // guard
    ctx.fillStyle = '#dfe6ec'; ctx.beginPath(); ctx.moveTo(s * 0.11, -s * 0.035); ctx.lineTo(s * 0.11 + len, 0); ctx.lineTo(s * 0.11, s * 0.035); ctx.fill();
    if (swing >= 0 && swing < 1) { ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - swing)})`; ctx.lineWidth = Math.max(1, s * 0.05); ctx.beginPath(); ctx.arc(0, 0, len * 0.9, -0.8 - swing * 1.6, 0.4); ctx.stroke(); } // motion trail
  }
  ctx.restore();
}
/** Local swings (own attacks show at once, before the server answers). */
const localSwing = new Map<string, number>();
export function markSwing(id: string): void { localSwing.set(id, performance.now()); }
/** 0..1 progress of a strike by `id` (server hits with from=id or a local press), −1 when idle. */
export function swingOf(w: World, id: string, now: number): number {
  const l = localSwing.get(id); if (l !== undefined) { const k = (performance.now() - l) / 380; if (k <= 1) return k; }
  const hs = w.combat?.hits; if (!hs) return -1;
  for (let i = hs.length - 1; i >= 0; i--) { const hi = hs[i]!; if (hi.from !== id) continue; const age = now - hi.at; if (age < -100) continue; if (age > 420) break; return Math.max(0, age) / 420; }
  return -1;
}
/** Bow aim indicator (set by main.ts while Saldır is held). */
export const aim: { on: boolean; x: number; y: number; fx: number; fy: number; r: number; lock: boolean } = { on: false, x: 0, y: 0, fx: 0, fy: 0, r: 1.3, lock: false };
function figure(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, cloak: string, f: number, bow: boolean, dir = 1, swing = -1, flash = 0): void {
  ctx.fillStyle = cloak; ctx.fillRect(x - s * 0.18, y - s * 0.75, s * 0.36, s * 0.5); ctx.fillStyle = '#e0b08a'; ctx.fillRect(x - s * 0.1, y - s * 0.92, s * 0.2, s * 0.17);
  ctx.fillStyle = '#5a5a5a'; ctx.fillRect(x - s * 0.12, y - s * 1.0, s * 0.24, s * 0.1); // helmet
  ctx.fillStyle = '#222'; ctx.fillRect(x - s * 0.12 + (f ? s * 0.04 : 0), y - s * 0.25, s * 0.08, s * 0.25); ctx.fillRect(x + s * 0.04 - (f ? s * 0.04 : 0), y - s * 0.25, s * 0.08, s * 0.25);
  drawHeld(ctx, x, y, s, bow ? 'yay' : 'kilic', dir, swing);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(x - s * 0.2, y - s * 1.02, s * 0.4, s * 1.02); } // hit flash
}
function arrowAt(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, k: number, s: number): void {
  const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * s * 0.6; // slight arc
  const a = Math.atan2(y1 - y0 - Math.cos(k * Math.PI) * s * 1.2, x1 - x0); // nose follows the arc
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.strokeStyle = '#4a3020'; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.beginPath(); ctx.moveTo(-s * 0.35, 0); ctx.lineTo(s * 0.3, 0); ctx.stroke();
  ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(s * 0.38, 0); ctx.lineTo(s * 0.26, -s * 0.06); ctx.lineTo(s * 0.26, s * 0.06); ctx.fill();
  ctx.fillStyle = '#e8e0d0'; ctx.fillRect(-s * 0.38, -s * 0.05, s * 0.1, s * 0.1); ctx.restore();
}
export const ARROW_MS = 380;
function lastHit<T>(a: T[], f: (x: T) => boolean): T | undefined { for (let i = a.length - 1; i >= 0; i--) if (f(a[i]!)) return a[i]; return undefined; }
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
  // v2.0.2 E7: Panayır day – festive bunting over the Pazar, striped tents and a banner
  if (w.panayir === w.day && w.hour >= 8 && w.hour < 22) { const pz = w.buildings.find((b) => b.id === 'pazar');
    if (pz) { const cols = ['#e63946', '#f4d35e', '#2a9d8f', '#f77f00', '#8338ec'];
      for (const row of [0, 1]) { const y0 = pz.y - 0.3 + row * (pz.h + 0.4); const [ax, ay] = P(pz.x - 0.5, y0), [bx] = P(pz.x + pz.w + 0.5, y0); const n = Math.max(6, Math.round((bx - ax) / (sz * 0.45)));
        ctx.strokeStyle = '#3b2a1a'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n; const sag = Math.sin(Math.PI * i / n) * sz * 0.25; if (i) ctx.lineTo(x, ay + sag); else ctx.moveTo(x, ay + sag); } ctx.stroke();
        for (let i = 0; i < n; i++) { const x = ax + (bx - ax) * (i + 0.5) / n; const sag = Math.sin(Math.PI * (i + 0.5) / n) * sz * 0.25; const fl = Math.sin(now / 300 + i) * sz * 0.03; ctx.fillStyle = cols[i % cols.length]!; ctx.beginPath(); ctx.moveTo(x - sz * 0.13, ay + sag); ctx.lineTo(x + sz * 0.13, ay + sag); ctx.lineTo(x + fl, ay + sag + sz * 0.3); ctx.closePath(); ctx.fill(); } }
      for (let i = 0; i < 3; i++) { const [x, y] = P(pz.x + pz.w + 1.2 + i * 1.6, pz.y + pz.h + 0.9); ctx.fillStyle = i % 2 ? '#f4d35e' : '#e63946'; ctx.beginPath(); ctx.moveTo(x - sz * 0.6, y); ctx.lineTo(x, y - sz * 0.9); ctx.lineTo(x + sz * 0.6, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff8'; ctx.fillRect(x - sz * 0.05, y - sz * 0.85, sz * 0.1, sz * 0.85); }
      const [tx, ty] = P(pz.x + pz.w / 2, pz.y - 0.9); ctx.font = `bold ${Math.max(10, sz * 0.32)}px sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000a'; ctx.strokeText('🎪 PANAYIR', tx, ty); ctx.fillStyle = '#ffd36a'; ctx.fillText('🎪 PANAYIR', tx, ty); } }
  // v2.0.2 U4: party Ocakları – a flag in each party's colour on the Pazar's north side (meetings, dues)
  w.meclis.factions.slice(0, 8).forEach((f, i) => { const [x, y] = P(31 + i * 1.5, 21.95); ctx.fillStyle = '#4a3420'; ctx.fillRect(x - 1, y - sz * 0.95, 2, sz * 0.95); const wave = Math.sin(now / 400 + i) * sz * 0.04; ctx.fillStyle = f.color; ctx.beginPath(); ctx.moveTo(x + 1, y - sz * 0.95); ctx.lineTo(x + sz * 0.5, y - sz * 0.83 + wave); ctx.lineTo(x + 1, y - sz * 0.68); ctx.fill(); if (z > 14) { ctx.font = `${Math.max(8, z * 0.32)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#000b'; ctx.fillText(f.name.split(' ')[0]!.slice(0, 8), x, y + z * 0.35); } });
  drawCombat(ctx, w, P, z, sz, now, placed);
}
function hpBar(ctx: CanvasRenderingContext2D, x: number, y: number, wd: number, v0: number, max: number, col: string, key?: string): void {
  const v = key ? tween(`hp-${key}`, v0, 350) : v0; const k = Math.max(0, Math.min(1, v / max)); const old = key ? Math.max(0, Math.min(1, tween(`hpo-${key}`, v0, 1200) / max)) : k;
  if (old > k) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - wd / 2 - 1, y - 1, wd + 2, 5); ctx.fillStyle = '#fff3'; ctx.fillRect(x - wd / 2, y, wd * old, 3); } // recent damage: a pale trail
  if (old <= k) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - wd / 2 - 1, y - 1, wd + 2, 5); }
  ctx.fillStyle = k > 0.5 ? col : k > 0.25 ? '#e0a020' : '#d03020'; ctx.fillRect(x - wd / 2, y, wd * k, 3);
}
/** v2.0.1: real-time fight – foes with health bars, the enemy fleet sailing in and docking, floating damage numbers. */
export function drawCombat(ctx: CanvasRenderingContext2D, w: World, P: (x: number, y: number) => [number, number], z: number, sz: number, now: number, placed?: { p: Person; x: number; y: number; visible: boolean }[]): void {
  const f = w.foreign; const c = w.combat;
  if (f && f.phase === 'savas') {
    const ships = shipCount((c as { troops?: number } | null)?.troops ?? f.troops);
    const dock = (i: number): [number, number] => { const b = berth(i, ships); return [b.x, b.y]; };
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
    if (fo.hp <= 0 || now < fo.walk.t0) continue; // still on board (v2.0.2: troops disembark in waves)
    const pt = foePos(fo, now); const [px, py] = P(pt.x, pt.y);
    const mov = foeMoving(fo, now); const lastTo = lastHit(c.hits, (x) => x.to === fo.id && x.k !== 'miss'); const fl = lastTo ? Math.max(0, 1 - (now - lastTo.at) / 220) : 0;
    const tgt = lastHit(c.hits, (x) => x.from === fo.id); const dir = tgt ? (tgt.x < pt.x ? -1 : 1) : (fo.walk.path.length > 1 ? ((fo.walk.path.at(-1)!.x < pt.x) ? -1 : 1) : -1);
    figure(ctx, px, py, sz, fo.kind === 'eskiya' ? '#2b2b2b' : '#2a4a9a', mov ? Math.floor(now / 220 + hsh(fo.id)) % 2 : 0, fo.bow, dir, swingOf(w, fo.id, now), fl);
    if (fo.kind === 'eskiya') { ctx.fillStyle = '#7a1010'; ctx.fillRect(px - sz * 0.14, py - sz * 0.86, sz * 0.28, sz * 0.07); } else { ctx.fillStyle = '#c8102e'; ctx.fillRect(px - sz * 0.05, py - sz * 0.7, sz * 0.1, sz * 0.3); ctx.fillRect(px - sz * 0.15, py - sz * 0.6, sz * 0.3, sz * 0.08); }
    hpBar(ctx, px, py - sz * 1.12, Math.max(18, sz * 0.8), fo.hp, fo.max, '#e04040', fo.id);
  }
  // gangplank wave counter: troops still aboard
  if (c.kind === 'war' && c.spawned) { const aboard = c.foes.filter((x) => x.hp > 0 && now < x.walk.t0).length; if (aboard) { const [lx, ly] = P(LIMAN.x, 47.6); ctx.font = `bold ${Math.max(11, z * 0.6)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#000a'; ctx.fillText(`⚓ ${aboard} asker daha gemiden iniyor`, lx + 1, ly + 1); ctx.fillStyle = '#ffd36a'; ctx.fillText(`⚓ ${aboard} asker daha gemiden iniyor`, lx, ly); } }
  // arrows in flight (players, soldiers and enemy archers)
  for (const hi of c.hits) { if (!hi.arrow || hi.fx === undefined || hi.fy === undefined) continue; const age = now - hi.at; if (age < 0 || age > ARROW_MS) continue; const [x0, y0] = P(hi.fx, hi.fy - 0.45); const [x1, y1] = P(hi.x, hi.y - 0.45); arrowAt(ctx, x0, y0, x1, y1, age / ARROW_MS, sz); }
  // bow aim indicator
  if (aim.on) { const [x0, y0] = P(aim.fx, aim.fy - 0.4); const [x1, y1] = P(aim.x, aim.y); ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = aim.lock ? 'rgba(255,90,60,0.95)' : 'rgba(255,240,150,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.ellipse(x1, y1, aim.r * z, aim.r * z * 0.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x1 - 6, y1); ctx.lineTo(x1 + 6, y1); ctx.moveTo(x1, y1 - 6); ctx.lineTo(x1, y1 + 6); ctx.stroke(); ctx.font = `bold ${Math.max(11, z * 0.55)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#000a'; ctx.fillText(`${Math.hypot(aim.x - aim.fx, aim.y - aim.fy).toFixed(1)} kare`, x1 + 1, y1 - aim.r * z * 0.5 - 4); ctx.fillStyle = aim.lock ? '#ff8060' : '#ffe070'; ctx.fillText(`${Math.hypot(aim.x - aim.fx, aim.y - aim.fy).toFixed(1)} kare`, x1, y1 - aim.r * z * 0.5 - 5); ctx.restore(); }
  if (placed) for (const q of placed) { if (!q.visible) continue; const fight = !!c.assign[q.p.id] || (!!q.p.playerId && !q.p.npc); if (!fight) continue; const [px, py] = P(q.x, q.y); hpBar(ctx, px, py - sz * 1.15, Math.max(18, sz * 0.8), q.p.health, 100, '#40c040', q.p.id); }
  // floating numbers
  ctx.textAlign = 'center';
  for (const hi of c.hits) {
    const age = now - hi.at - (hi.arrow ? ARROW_MS : 0); if (age < 0 || age > 1400) continue; const k = age / 1400; const [px, py] = P(hi.x, hi.y);
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

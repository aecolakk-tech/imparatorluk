/**
 * v2.0.1 economy: one price source (shelf prices), Liman toptancısı vs Çarşı price gap, tüccar arbitrage,
 * Panayır every 5 days, sipariş ilanları, wage index, poverty effects (complaints, hunger, petitions, migration),
 * Kayzer tools (ithalat izni, ambar dağıtımı, narh → karaborsa), price-spike news and the Şehir Göstergesi history.
 * All money moves through transfer() (money is conserved; 'dis' is the outside world).
 */
import { use } from './usage';
import type { Good, Person, World } from './types';
import { BASE_PRICE, GOOD_LABEL, PRODUCES, PROF_LABEL } from './constants';
import { buy, groupOf, lawOn, lawParam, transfer } from './economy';
import { chance, clamp, nextId, pick, rand } from './rng';
import { findPerson } from './world';
import { log, personal } from './log';
import { openPetition } from './ai';

export const PANAYIR_EVERY = 5; // game days between Panayırlar
export const WHOLESALE: Partial<Record<Good, number>> = { bugday: 60, un: 20, odun: 20, yun: 8, kumas: 4, alet: 2 };
export const WHOLESALE_MUL = 0.85; // Liman toptan price vs normal price
const STATE_PROFS = ['memur', 'tahsildar', 'bekci', 'savci', 'hakim', 'asker', 'hoca', 'imam', 'kayzer', 'naip'];

/** The one price players, NPCs and the gazete see: the cheapest listing in stock (optionally in one market group). null = Tükendi. */
export function shelf(w: World, g: Good, group?: string, wholesale = false): { price: number | null; qty: number } {
  const ls = w.listings.filter((l) => l.good === g && l.qty > 0 && (!l.wholesale || wholesale) && (!group || groupOf(l.market) === group) && !(w.bans.includes(g) && l.sellerId !== 'dis'));
  if (!ls.length) return { price: null, qty: 0 };
  let p = Math.min(...ls.map((l) => l.price));
  if (g === 'su' && lawOn(w, 'devletsuyu')) p = Math.min(p, lawParam(w, 'devletsuyu', 2));
  return { price: Math.round(p * 100) / 100, qty: ls.reduce((s, l) => s + l.qty, 0) };
}
/** Price quoted in the gazete / Göstergesi: the Çarşı shelf price, else the last known market price. */
export function quoted(w: World, g: Good): number { return shelf(w, g, 'carsi').price ?? shelf(w, g).price ?? w.prices[g]; }
export const isPanayir = (w: World): boolean => w.day % PANAYIR_EVERY === 0;
const adults = (w: World): Person[] => w.people.filter((p) => p.prof !== 'naip' && p.prof !== 'kayzer');
export function unemployed(w: World): number { return adults(w).filter((p) => !STATE_PROFS.includes(p.prof) && p.unemployedDays >= 2).length; }

/** One-time migration: flour chain, wage index, orders. Existing saves keep their people and money. */
export function migrateEcon(w: World): void {
  if ((w.econV ?? 0) >= 1) return; w.econV = 1;
  if (w.prices.un === undefined) w.prices.un = BASE_PRICE.un;
  w.market.sold.un ??= 0; w.market.unmet.un ??= 0;
  for (const p of w.people) p.inv.un ??= 0;
  w.wageIdx ??= 1; w.orders ??= []; w.imports ??= true; w.cityHist ??= [];
  // three millers from the idle hands (NPCs only, never a player or a Meclis member)
  for (let i = w.people.filter((p) => p.prof === 'degirmenci').length; i < 3; i++) {
    const d = w.people.find((p) => !p.playerId && !p.meclis && p.prof === 'hamal') ?? w.people.find((p) => !p.playerId && !p.meclis && p.prof === 'insaatci');
    if (!d) break; d.prof = 'degirmenci'; d.work = 'degirmen'; d.xp = 30;
  }
  for (const f of w.people.filter((p) => p.prof === 'firinci')) f.inv.un += 20; // bakers keep baking while the mill starts
}

/** Hourly economy step (called from stepHour after the hour advanced). */
export function marketHour(w: World): void {
  migrateEcon(w);
  if (w.hour === 7) limanRestock(w);
  if (w.hour === 9) { if (isPanayir(w)) panayir(w); postOrders(w); }
  if (w.hour === 20) exportsDay(w);
  if (w.hour === 21) arbitrage(w);
  sampleCity(w);
}
/** Daily economy step (end of day, after settleMarket). */
export function marketDay(w: World): void {
  migrateEcon(w);
  wageIndex(w); poverty(w); capKaraborsa(w); priceNews(w);
  w.orders = (w.orders ?? []).filter((o) => o.until > w.day && (o.byId === 'saray' || !!findPerson(w, o.byId)));
}

// ---------- Liman toptancısı (imports) and exports ----------
function blocked(w: World): boolean { return w.imports === false || w.raid?.phase === 'gece' || w.foreign?.phase === 'savas' || !!w.combat; }
export function limanRestock(w: World): void {
  w.listings = w.listings.filter((l) => !(l.wholesale && l.sellerId === 'dis'));
  if (blocked(w)) return;
  for (const [g, q] of Object.entries(WHOLESALE) as [Good, number][]) {
    const price = Math.round(BASE_PRICE[g] * WHOLESALE_MUL * (g === 'bugday' && w.nature?.kind === 'kuraklik' ? 1.4 : 1) * 100) / 100;
    w.listings.push({ id: nextId(w, 'L'), sellerId: 'dis', good: g, qty: q, price, market: 'liman', wholesale: true });
  }
}
/** Foreign buyers at the Liman take some of the city's cheap surplus – money comes back in, not only out. */
function exportsDay(w: World): void {
  if (blocked(w)) return;
  let budget = 40 + Math.min(200, w.ledger.filter((e) => e.day === w.day && e.to === 'dis' && /alımı/.test(e.reason)).reduce((s, e) => s + e.amount, 0) * 0.7);
  for (const g of ['bugday', 'balik', 'kumas', 'yun', 'odun', 'un'] as Good[]) {
    for (const l of w.listings.filter((x) => x.good === g && x.qty > 0 && x.sellerId !== 'dis' && x.sellerId !== 'saray' && x.price <= BASE_PRICE[g] * 0.9).sort((a, b) => a.price - b.price)) {
      while (l.qty > 0 && budget >= l.price) { transfer(w, 'dis', l.sellerId, l.price, `ihracat (${GOOD_LABEL[g]})`); const s = findPerson(w, l.sellerId); if (s) { s.incomeToday += l.price; s.taxDue += l.price * w.taxRate / 100; } l.qty -= 1; budget -= l.price; w.market.sold[g] += 1; }
    }
  }
}
/** NPC tüccarlar buy at the Liman when the Çarşı is dearer and relist in the Çarşı next morning (traderRelist). */
export function arbitrage(w: World): void {
  for (const t of w.people.filter((p) => p.prof === 'tuccar' && p.npc !== false && !p.playerId && p.jailedDays === 0)) {
    for (const g of Object.keys(WHOLESALE) as Good[]) {
      const lim = shelf(w, g, 'liman', true).price; const car = shelf(w, g, 'carsi').price ?? w.prices[g] * 1.3;
      if (lim === null || car < lim * 1.25) continue;
      const q = Math.min(15, Math.floor((t.money - 30) / lim)); if (q > 0 && buy(w, t.id, g, q, car * 0.85, { group: 'liman', wholesale: true })) use(w, 'liman_ticaret', t);
    }
  }
}
export const TRADE_GOODS: Good[] = ['kumas', 'alet', 'odun', 'bugday', 'un', 'yun'];

// ---------- Panayır ----------
export function panayir(w: World): void {
  if (w.panayir === w.day) return; w.panayir = w.day;
  const rare: Good[] = ['elbise', 'mobilya', 'alet', 'kumas', 'icki'];
  const bring: Partial<Record<Good, number>> = blocked(w) ? {} : { bugday: 80, odun: 20, ...Object.fromEntries(rare.map((g) => [g, g === 'mobilya' ? 2 : g === 'icki' ? 12 : 5])) };
  const lines: string[] = [];
  for (const [g, q] of Object.entries(bring) as [Good, number][]) {
    const price = Math.round(Math.max(BASE_PRICE[g] * 0.7, w.prices[g] * 0.85) * 100) / 100;
    w.listings.push({ id: nextId(w, 'L'), sellerId: 'dis', good: g, qty: q, price, market: 'pazar' });
    w.prices[g] = Math.round(Math.max(BASE_PRICE[g] * 0.6, w.prices[g] * 0.95) * 100) / 100; // fresh stock: the market cools
    lines.push(`${GOOD_LABEL[g]} ${price.toFixed(2)} D`);
  }
  for (const p of w.people) p.mood = clamp(p.mood + 1); use(w, 'panayir');
  log(w, `🎪 PANAYIR! ${lines.length ? `Kervanlar geldi: ${lines.join(', ')}. Nadir mallar (elbise, mobilya, alet) bugün ucuz.` : 'Bu hafta kervan gelmedi (ithalat kapalı ya da savaş var).'} Çarşı kalabalık, davul zurna çalıyor.`);
}

// ---------- sipariş ilanları ----------
const INPUT_OF: Partial<Record<string, Good>> = { firinci: 'un', degirmenci: 'bugday', terzi: 'kumas', demirci: 'odun', mobilyaci: 'odun', dokumaci: 'yun', barci: 'bugday' };
export function postOrders(w: World): void {
  const os = (w.orders ??= []); if (os.length >= 4) return;
  for (const p of [...w.people].sort(() => rand(w) - 0.5)) {
    const g = INPUT_OF[p.prof]; if (!g || p.playerId || os.some((o) => o.byId === p.id)) continue;
    const need = (PRODUCES[p.prof]?.inputs?.[g] ?? 0); if (p.inv[g] >= need * 0.5) continue;
    const short = w.market.unmet[g] > 0 || w.prices[g] > BASE_PRICE[g] * 1.3 || (shelf(w, g, 'carsi').qty < need);
    if (!short) continue;
    const qty = Math.max(5, Math.min(100, need * 2)); const reward = Math.round(qty * Math.max(w.prices[g], BASE_PRICE[g]) * 1.3);
    if (p.money < reward + 10) continue;
    os.push({ id: nextId(w, 'S'), good: g, qty, reward, byId: p.id, day: w.day, until: w.day + 3 }); use(w, 'siparis_ilani', p);
    log(w, `📜 Sipariş: ${p.name} – “${qty} ${GOOD_LABEL[g]} getirene ${reward} D!” (Pazar’daki ilan tahtası, 3 gün)`, p.id);
    if (os.length >= 4) break;
  }
}
export function fulfillOrder(w: World, me: Person, id: string): string | null {
  const os = w.orders ?? []; const o = os.find((x) => x.id === id); if (!o) return 'Bu sipariş artık yok.';
  if (o.byId === me.id) return 'Kendi siparişinizi teslim edemezsiniz.';
  if (me.inv[o.good] < o.qty) return `${o.qty} ${GOOD_LABEL[o.good]} gerekiyor; çantanızda ${me.inv[o.good]} var.`;
  if (!transfer(w, o.byId, me.id, o.reward, `sipariş teslimi (${o.qty} ${GOOD_LABEL[o.good]})`)) { w.orders = os.filter((x) => x !== o); return 'Siparişi veren artık ödeyemiyor; ilan kaldırıldı.'; }
  me.inv[o.good] -= o.qty; const by = findPerson(w, o.byId); if (by) by.inv[o.good] += o.qty; else if (o.byId === 'saray' && o.good === 'bugday') w.granary += o.qty;
  me.xp += 3; me.rep = clamp(me.rep + 2, -100, 100); if (by) by.relations[me.id] = clamp((by.relations[me.id] ?? 0) + 8, -100, 100);
  w.orders = os.filter((x) => x !== o); use(w, 'siparis_teslim', me);
  log(w, `${me.name}, ${by?.name ?? 'Saray'} için ${o.qty} ${GOOD_LABEL[o.good]} getirdi ve ${o.reward} D aldı.`, me.id);
  return null;
}

// ---------- wages ----------
export function wageIndex(w: World): void {
  const hist = w.stats.slice(-5).map((s) => s.prices.ekmek ?? BASE_PRICE.ekmek);
  const bread = (hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : w.prices.ekmek) / BASE_PRICE.ekmek;
  const u = unemployed(w) / Math.max(1, adults(w).length);
  const target = clamp(bread ** 0.6 * (1 - Math.max(0, u - 0.1) * 1.2), 0.6, 2.5);
  w.wageIdx = Math.round(((w.wageIdx ?? 1) + (target - (w.wageIdx ?? 1)) * 0.1) * 1000) / 1000;
}
export const wageMul = (w: World): number => w.wageIdx ?? 1;

// ---------- people: poverty effects ----------
const COMPLAINTS = ['Ekmek {p} D olmuş, nasıl geçineceğiz?', 'Çocuklar aç yattı, fırıncı insaf etsin!', 'Kesemde para kalmadı; bu fiyatlarla yaşanmaz.', 'Pazar’a gidip eli boş döndüm.'];
export function poverty(w: World): void {
  const bread = quoted(w, 'ekmek');
  for (const p of w.people) {
    if (p.prof === 'naip' || p.id === w.kayzerId) continue;
    if (p.cantAfford !== undefined && w.day - p.cantAfford <= 0) p.poorDays = (p.poorDays ?? 0) + 1; else p.poorDays = Math.max(0, (p.poorDays ?? 0) - 1);
    const d = p.poorDays ?? 0; if (!d) continue;
    p.mood = clamp(p.mood - Math.min(4, 1 + d)); p.loyalty = clamp(p.loyalty - 0.5);
    if (p.playerId && !p.npc) { if (d === 1) personal(w, p.playerId, `💸 Bugün temel ihtiyaçlarınızı (ekmek/su/odun) almaya paranız yetmedi. Ekmek ${bread.toFixed(2)} D.`); continue; }
    if (chance(w, 0.35)) { const t = pick(w, COMPLAINTS).replace('{p}', bread.toFixed(2)); p.thought = t; if (chance(w, 0.3)) log(w, `${p.name}: “${t}”`, p.id); }
    if (d >= 3 && chance(w, 0.4)) openPetition(w, p, 'sikayet', `Fiyatlar çok yüksek (ekmek ${bread.toFixed(2)} D); narh konsun ya da ambardan dağıtılsın.`);
    if (d >= 8 && !p.spouse && !p.meclis && !p.soylu && p.home !== 'kisla' && !w.people.some((c) => c.parents.includes(p.id)) && chance(w, 0.3)) emigrate(w, p);
  }
}
/** A poor NPC leaves the city with whatever he owns (money goes 'dis', so it stays accounted for). */
export function emigrate(w: World, p: Person): void {
  if (p.money > 0) transfer(w, p.id, 'dis', p.money, 'göç (şehirden ayrıldı)');
  w.listings = w.listings.filter((l) => l.sellerId !== p.id);
  for (const b of w.buildings) if (b.ownerId === p.id) b.ownerId = undefined;
  w.people = w.people.filter((x) => x !== p);
  for (const x of w.people) delete x.relations[p.id];
  log(w, `🧳 ${p.name} (${PROF_LABEL[p.prof]}) pahalılık yüzünden şehri terk etti.`);
}

// ---------- narh → karaborsa ----------
/** A price ceiling below the market price: part of the stock disappears under the counter, sold to the rich at a premium. */
export function capKaraborsa(w: World): void {
  w.karaborsaToday = 0;
  for (const [g, cap] of Object.entries(w.priceCaps) as [Good, number][]) {
    if (!cap || cap >= w.prices[g] * 0.9) continue;
    const black = w.prices[g] * 1.2; const rich = w.people.filter((p) => p.money > 150 && !p.playerId).sort((a, b) => b.money - a.money).slice(0, 8);
    for (const l of w.listings.filter((x) => x.good === g && x.sellerId !== 'dis' && x.sellerId !== 'saray')) {
      const hide = Math.floor(l.qty * 0.3); if (!hide) continue; l.qty -= hide;
      for (let i = 0; i < hide && rich.length; i++) { const r = rich[i % rich.length]!; if (transfer(w, r.id, l.sellerId, black, `karaborsa ${GOOD_LABEL[g]}`)) { r.inv[g] += 1; w.karaborsaToday += 1; } }
    }
    w.market.unmet[g] += 5; // poor buyers find empty shelves
  }
  if ((w.karaborsaToday ?? 0) > 5) log(w, `🕶 Narh yüzünden karaborsa: ${w.karaborsaToday} mal tezgâh altından zenginlere pahalıya satıldı; yoksulun rafı boş.`);
}

// ---------- Kayzer tools ----------
export function granaryDistribute(w: World, qty: number): number {
  const q = Math.min(Math.floor(w.granary), qty); if (q <= 0) return 0;
  const millers = w.people.filter((p) => p.prof === 'degirmenci' && p.jailedDays === 0); const bakers = w.people.filter((p) => p.prof === 'firinci' && p.jailedDays === 0);
  const to = millers.length ? millers : bakers; if (!to.length) return 0;
  w.granary -= q; const share = Math.floor(q / to.length);
  for (const m of to) { if (millers.length) m.inv.bugday += share; else m.inv.un += Math.floor(share * 0.9); }
  for (const p of w.people) if ((p.poorDays ?? 0) > 0) p.mood = clamp(p.mood + 3);
  log(w, `🌾 Ferman: ambardan ${q} buğday değirmenlere bedava dağıtıldı; un ve ekmek ucuzlayacak.`);
  return q;
}

// ---------- news ----------
export function priceNews(w: World): void {
  const prev = w.stats[w.stats.length - 1]?.prices; if (!prev) return;
  for (const g of ['ekmek', 'su', 'un', 'bugday', 'odun', 'et', 'balik'] as Good[]) {
    const a = prev[g] ?? w.prices[g], b = w.prices[g]; if (!a) continue;
    const ch = (b - a) / a;
    if (ch >= 0.2) log(w, `📈 ${GOOD_LABEL[g]} fiyatı bir günde %${Math.round(ch * 100)} arttı (${a.toFixed(2)} → ${b.toFixed(2)} D).`);
    else if (ch <= -0.25) log(w, `📉 ${GOOD_LABEL[g]} ucuzladı: ${a.toFixed(2)} → ${b.toFixed(2)} D.`);
  }
}

// ---------- Şehir Göstergesi ----------
export const HIST_HOURS = 5 * 24;
export function sampleCity(w: World): void {
  const h = (w.cityHist ??= []); const ad = adults(w);
  const mood = Math.round(ad.reduce((s, p) => s + p.mood, 0) / Math.max(1, ad.length));
  h.push([w.day, w.hour, w.people.length, unemployed(w), Math.round(quoted(w, 'ekmek') * 100), mood, Math.round(w.treasury)]);
  if (h.length > HIST_HOURS) h.splice(0, h.length - HIST_HOURS);
}

/**
 * Daily life: needs (3 meals + 5 water), health & doctors, religiosity (cami / meyhane / vaaz / devlet yönlendirmesi),
 * crafts that matter (elbise, mobilya, alet, odun), nature (kuraklık every 180 days, salgın, sel, bereket),
 * the tahıl ambarı, caravans & border threats, crime with arrests and bribe offers, tahsildar tax collection,
 * smuggling & karaborsa, wealth tax, reputation & rumours, achievements, newcomer quests, job switching.
 */
import type { Arrest, CrimeKind, Good, Person, World } from './types';
import { BASE_PRICE, GOOD_LABEL, PRODUCES, PROF_LABEL, STOCK_LIMIT } from './constants';
import { addListing, buy, lawOn, marketPrice, rankOf, transfer } from './economy';
import { chance, clamp, nextId, pick, rand } from './rng';
import { findPerson, WORKPLACE } from './world';
import { log, personal } from './log';
import { fullAI, openCase } from './ai';
import { die } from './family';
import { crimeFactor, curfewAt, customLawsDay, wealthThreshold } from './laws';
import { hoarderAI, patrolDay } from './hoard';

export const DOCTOR_FEE = 10;
export const MEALS = 3; export const WATERS = 5;
/** The ruler and nobles living in the Saray eat from the palace kitchen (paid by the treasury). */
const palace = (w: World, p: Person): boolean => p.id === w.kayzerId || (p.soylu && p.home === 'saray');
const active = (p: Person): boolean => p.prof !== 'naip' && p.jailedDays === 0 && p.exiledDays === 0;
const rel = (a: Person, b: Person, d: number, why: string): void => {
  a.relations[b.id] = clamp((a.relations[b.id] ?? 0) + d, -100, 100); a.relNote[b.id] = why;
  const keys = Object.keys(a.relNote); if (keys.length > 14) delete a.relNote[keys[0]!];
};
export { rel as relate };

// ---------------- needs ----------------
const FOOD_JOY: Partial<Record<Good, number>> = { ekmek: 0.6, balik: 2, et: 2.5 };
/** Eat one meal: from home stock, else buy (fish/meat if affordable – more happiness – else bread). */
export function eatMeal(w: World, p: Person): boolean {
  if (p.prof === 'naip') { p.meals += 1; return true; }
  if (palace(w, p)) { if (transfer(w, 'saray', 'dis', 1, 'saray mutfağı')) { p.meals += 1; p.hunger = clamp(p.hunger - 35); p.mood = clamp(p.mood + 1); return true; } }
  if (p.jailedDays > 0) { p.meals += 1; p.hunger = clamp(p.hunger - 30); return true; } // zindan ekmeği
  const prefs: Good[] = p.money > 30 && chance(w, 0.5) ? (chance(w, 0.5) ? ['et', 'balik', 'ekmek'] : ['balik', 'et', 'ekmek']) : ['ekmek', 'balik', 'et'];
  for (const g of prefs) {
    if (p.inv[g] <= 0) buy(w, p.id, g, 1, Math.max(0, p.money * 0.6));
    if (p.inv[g] > 0) { p.inv[g] -= 1; p.meals += 1; p.hunger = clamp(p.hunger - 35); p.mood = clamp(p.mood + (FOOD_JOY[g] ?? 0.5)); return true; }
  }
  // askıda ekmek / state bread fallback handled elsewhere
  p.hunger = clamp(p.hunger + 15); return false;
}
export function drinkWater(w: World, p: Person): boolean {
  if (p.prof === 'naip' || p.jailedDays > 0) { p.drinks += 1; return true; }
  if (palace(w, p) && transfer(w, 'saray', 'dis', 0.3, 'saray mutfağı')) { p.drinks += 1; p.thirst = clamp(p.thirst - 25); return true; }
  if (p.inv.su <= 0) buy(w, p.id, 'su', 2, Math.max(0, p.money * 0.5));
  if (p.inv.su > 0) { p.inv.su -= 1; p.drinks += 1; p.thirst = clamp(p.thirst - 25); return true; }
  p.thirst = clamp(p.thirst + 15); return false;
}
/** End of day: anyone who missed 3 meals or 5 waters loses 10 health. Below 30 (or wounded) only a doctor helps. */
export function needsEndOfDay(w: World, p: Person): void {
  if (p.prof === 'naip') { p.meals = 0; p.drinks = 0; return; }
  const fresh = w.day <= 1 || (p.protectedUntil ?? 0) > w.day + 4; // the first (partial) day never counts
  const ok = fresh || (p.meals >= MEALS && p.drinks >= WATERS);
  if (!ok) { p.health = clamp(p.health - 10); p.mood = clamp(p.mood - 3); }
  else if (p.health >= 30 && !p.wounded) p.health = clamp(p.health + 3);
  if ((p.health < 30 || p.wounded) && ok) p.health = clamp(p.health - 1);
  // crafts at home matter
  if (p.inv.elbise > 0) { p.mood = clamp(p.mood + 0.4); p.rep = clamp(p.rep + 0.1, -100, 100); if (p.health >= 30) p.health = clamp(p.health + 0.5); }
  if (p.inv.mobilya > 0) { p.mood = clamp(p.mood + 0.8); if (p.health >= 30) p.health = clamp(p.health + 0.5); }
  if (p.inv.odun > 0) { if (w.day % 3 === 0) p.inv.odun -= 1; p.mood = clamp(p.mood + 0.4); }
  p.meals = 0; p.drinks = 0; p.bought = {};
  if (p.health < 5) p.health = 5; // nobody starves to death outright; the weak must see a doctor
}
export function needsHelp(p: Person): boolean { return p.health < 30 || p.wounded; }

export function seeDoctor(w: World, p: Person, stateFunds = false): string {
  const hs = w.people.filter((x) => x.prof === 'hekim' && active(x) && x.id !== p.id);
  const h = hs.sort((a, b) => b.xp - a.xp)[0]; if (!h) return 'Şehirde hekim yok!';
  const fee = Math.round(DOCTOR_FEE * rankOf(h).mult);
  const payer = transfer(w, p.id, h.id, fee, 'hekim ücreti') ? p.id : stateFunds && transfer(w, 'saray', h.id, fee * 0.6, 'darülaceze') ? 'saray' : null;
  if (!payer) return `Hekim ${fee} Dinar istiyor; paranız yetmiyor.`;
  h.incomeToday += fee; h.xp += 1; p.health = clamp(Math.max(p.health, 70) + 10); p.wounded = false;
  rel(p, h, 4, 'beni iyileştirdi');
  return `${h.name} sizi iyileştirdi (${payer === 'saray' ? 'darülaceze ödedi' : `${fee} Dinar`}).`;
}

// ---------------- religion ----------------
export function pray(w: World, p: Person): string {
  p.din = clamp(p.din + 2); p.mood = clamp(p.mood + 1.5); p.lastAction = 'camide namaz kıldı';
  const imam = w.people.find((x) => x.prof === 'imam' && active(x));
  if (p.money > 60 && chance(w, 0.3) && imam) { transfer(w, p.id, imam.id, 2, 'cami bağışı'); p.rep = clamp(p.rep + 1, -100, 100); }
  return 'Camide namaz kıldınız (dindarlık +2, mutluluk +1,5).';
}
export function drinkAlcohol(w: World, p: Person): string {
  if (w.bans.includes('icki')) return 'İçki yasak; meyhane kapalı.';
  if (p.inv.icki <= 0) buy(w, p.id, 'icki', 1, Math.max(0, p.money * 0.5));
  if (p.inv.icki <= 0) return 'Meyhanede içki yok ya da paranız yetmiyor.';
  p.inv.icki -= 1; p.mood = clamp(p.mood + 4); p.din = clamp(p.din - 3); p.lastAction = 'meyhanede içti';
  if (chance(w, 0.08)) { p.health = clamp(p.health - 5); }
  return 'Meyhanede bir kadeh içtiniz (mutluluk +4, dindarlık −3).';
}
/** Friday sermon at the cami by the imam/hoca, or a player imam's chosen topic. */
export function sermon(w: World, by: Person, topic: 'namaz' | 'icki' | 'sabir'): string {
  const hearers = w.people.filter((p) => active(p) && p.din > 35 && p.id !== by.id);
  for (const p of hearers) {
    p.din = clamp(p.din + (topic === 'namaz' ? 3 : 1.5));
    if (topic === 'icki' && p.din > 50) p.inv.icki = 0;
    if (topic === 'sabir') { p.mood = clamp(p.mood + 1); p.republic = clamp(p.republic - 1); }
  }
  log(w, `${by.name} cuma vaazı verdi (${topic === 'namaz' ? 'namaza çağrı' : topic === 'icki' ? 'içkinin zararları' : 'sabır ve itaat'}); ${hearers.length} kişi dinledi.`, by.id);
  return `${hearers.length} kişi vaazınızı dinledi.`;
}
/** State directive: namaz teşviki, içkiye karşı kampanya, or laik yönlendirme. */
export function directive(w: World, topic: 'namaz' | 'icki' | 'laik'): string {
  for (const p of w.people) {
    if (!active(p) || p.id === w.kayzerId) continue;
    if (topic === 'namaz') { p.din = clamp(p.din + (p.din > 30 ? 4 : 1)); if (p.din < 30) p.loyalty = clamp(p.loyalty - 3); else p.loyalty = clamp(p.loyalty + 1); }
    if (topic === 'icki') { p.din = clamp(p.din + 2); if (p.din < 40) p.loyalty = clamp(p.loyalty - 3); }
    if (topic === 'laik') { p.din = clamp(p.din - 4); if (p.din > 65) p.loyalty = clamp(p.loyalty - 4); else p.loyalty = clamp(p.loyalty + 1); }
  }
  log(w, `Devlet yönlendirmesi: ${topic === 'namaz' ? 'halk namaza teşvik ediliyor' : topic === 'icki' ? 'içkiye karşı kampanya' : 'laik eğitim ve yaşam teşviki'}.`);
  return 'Yönlendirme ilan edildi.';
}

// ---------------- daily routines ----------------
/** Hourly need handling: meals at 7/13/19, water at 7/10/13/16/19. Players' characters too (conservative AI keeps them alive). */
export function needsHour(w: World): void {
  const h = w.hour;
  const meal = h === 7 || h === 13 || h === 19; const water = h === 7 || h === 10 || h === 13 || h === 16 || h === 19;
  if (!meal && !water) return;
  for (const p of w.people) { if (water) drinkWater(w, p); if (meal) eatMeal(w, p); }
  if (h === 19) { // top-up: anyone still short tries again (players' offline AI included)
    for (const p of w.people) { while (p.drinks < WATERS && drinkWater(w, p)) { /* */ } while (p.meals < MEALS && eatMeal(w, p)) { /* */ } }
  }
}

export function lifeHour(w: World): void {
  const h = w.hour;
  if (h === 9) { karaborsa(w); patrolDay(w); }
  if (h === 11) { hoarderAI(w); hamalWork(w); }
  if (h === 13) for (const p of w.people) if (fullAI(p) && active(p) && p.din > 55 && chance(w, 0.4)) pray(w, p);
  if (h === 13 && w.day % 7 === 5) { const imam = w.people.find((x) => (x.prof === 'imam' || x.prof === 'hoca') && active(x) && fullAI(x)); if (imam) sermon(w, imam, pick(w, ['namaz', 'icki', 'sabir'] as const)); }
  if (h === 14) for (const p of w.people) if (fullAI(p) || p.npc) { if (needsHelp(p) && active(p)) seeDoctor(w, p, true); }
  if (h === 14) for (const p of w.people) if (!fullAI(p) && needsHelp(p) && p.money > DOCTOR_FEE * 2) seeDoctor(w, p, false); // offline players: conservative AI still sees the doctor
  if (h === 15) collectTaxes(w);
  if (h === 18) for (const p of w.people) if (fullAI(p) && active(p)) shop(w, p);
  if (h === 20) for (const p of w.people) if (fullAI(p) && active(p) && p.din < 45 && p.money > 10 && chance(w, 0.35)) drinkAlcohol(w, p);
  if (h === 21) for (const p of w.people) if (fullAI(p) && active(p)) p.nightOut = chance(w, (p.honesty < 35 ? 0.25 : 0.05) * (lawOn(w, 'gece') || curfewAt(w, 23) ? 0.3 : 1) * crimeFactor(w));
  if (h === 6) for (const p of w.people) if (fullAI(p)) p.nightOut = false;
  if (h === 7 || h === 20) resolveArrests(w);
  if (h === 23) nightCrime(w);
}

/** Crafts are bought because they matter: clothes (health, reputation), furniture (rest), tools (output), wood (warmth). */
function shop(w: World, p: Person): void {
  if (p.inv.elbise <= 0 && p.money > 45) buy(w, p.id, 'elbise', 1, p.money * 0.4);
  if (p.inv.mobilya <= 0 && p.money > 120 && p.home !== 'kisla') buy(w, p.id, 'mobilya', 1, p.money * 0.4);
  if (p.inv.alet <= 0 && PRODUCES[p.prof] && p.money > 50) buy(w, p.id, 'alet', 1, p.money * 0.4);
  if (p.inv.odun <= 0 && p.money > 10 && chance(w, 0.4)) buy(w, p.id, 'odun', 1, p.money * 0.2);
}

export function endOfDayLife(w: World): void {
  for (const p of [...w.people]) needsEndOfDay(w, p);
  customLawsDay(w); nature(w); granaryDay(w); outsideWorld(w); wealthTax(w); switchJobs(w); rumorsDay(w); achievements(w);
  w.arrests = w.arrests.filter((a) => a.status === 'bekliyor' && w.day - a.day <= 1);
  w.offers = w.offers.filter((o) => w.day - o.day <= 2);
  w.talks = w.talks.filter((t) => w.day - t.day <= 0);
  if (w.rumors.length > 30) w.rumors.splice(0, w.rumors.length - 30);
}

// ---------------- nature ----------------
const NATURE_TEXT = { kuraklik: 'KURAKLIK başladı! İki hafta boyunca buğday az çıkacak, ekmek pahalanacak.', salgin: 'SALGIN! Hastalık yayılıyor; hekimler çok çalışacak.', sel: 'SEL baskını! Tarlalar ve liman zarar gördü.', bereket: 'BEREKET yılı: tarlalar bol ürün veriyor.', balik: 'Denizde balık bolluğu var!' } as const;
export function nature(w: World): void {
  const n = w.nature;
  if (n && w.day > n.until) { log(w, `${n.kind === 'kuraklik' ? 'Kuraklık' : n.kind === 'salgin' ? 'Salgın' : n.kind === 'sel' ? 'Sel' : n.kind === 'bereket' ? 'Bereket' : 'Balık bolluğu'} sona erdi.`); w.nature = null; }
  if (!w.nature && w.day >= w.nextDrought) { w.nature = { kind: 'kuraklik', start: w.day, until: w.day + 13 }; w.nextDrought = w.day + 180; log(w, NATURE_TEXT.kuraklik); }
  else if (!w.nature && chance(w, 0.02)) {
    const kind = pick(w, ['salgin', 'sel', 'bereket', 'balik'] as const);
    w.nature = { kind, start: w.day, until: w.day + (kind === 'bereket' ? 7 : kind === 'salgin' ? 5 : 3) }; log(w, NATURE_TEXT[kind]);
  }
  if (w.nature?.kind === 'salgin') for (const p of w.people) if (p.prof !== 'naip' && chance(w, 0.25)) p.health = clamp(p.health - 12);
}

// ---------------- tahıl ambarı ----------------
export function granaryBuy(w: World, qty: number): number {
  let got = 0;
  const offers = w.listings.filter((l) => l.good === 'bugday' && l.qty > 0).sort((a, b) => a.price - b.price);
  for (const l of offers) while (got < qty && l.qty > 0 && l.price <= BASE_PRICE.bugday * 1.1) {
    if (!transfer(w, 'saray', l.sellerId, l.price, 'ambar alımı')) return got;
    const s = findPerson(w, l.sellerId); if (s) s.incomeToday += l.price;
    l.qty -= 1; got += 1; w.granary += 1; w.market.sold.bugday += 1;
  }
  return got;
}
export function granaryRelease(w: World, qty: number): number {
  const q = Math.min(Math.floor(w.granary), qty); if (q <= 0) return 0;
  w.granary -= q;
  const ex = w.listings.find((l) => l.sellerId === 'saray' && l.good === 'bugday');
  const price = Math.round(BASE_PRICE.bugday * 2 * 100) / 100;
  if (ex) { ex.qty += q; ex.price = price; } else w.listings.push({ id: nextId(w, 'L'), sellerId: 'saray', good: 'bugday', qty: q, price, market: 'ambar' });
  return q;
}
function granaryDay(w: World): void {
  w.granary = Math.max(0, w.granary * 0.99); // surplus grain spoils slowly
  const drought = w.nature?.kind === 'kuraklik' || w.nature?.kind === 'sel';
  if (drought && w.granary > 0) { const q = granaryRelease(w, 40); if (q) log(w, `Tahıl ambarından ${q} buğday sabit fiyatla satışa çıktı.`); }
  else if (!drought && w.prices.bugday <= BASE_PRICE.bugday * 0.9 && w.granary < 700 && w.treasury > 2500) granaryBuy(w, 30);
}

// ---------------- outside world ----------------
function outsideWorld(w: World): void {
  // caravans: when a staple stays expensive, or every ~2 weeks
  const short = (['ekmek', 'bugday', 'su'] as Good[]).filter((g) => w.prices[g] > BASE_PRICE[g] * 2.2);
  if (w.caravan && w.day > w.caravan.until) { caravanBuys(w, true); for (const l of w.listings.filter((x) => x.sellerId === 'dis')) l.qty = 0; w.listings = w.listings.filter((l) => l.qty > 0); w.caravan = null; }
  w.shortDays = short.length ? (w.shortDays ?? 0) + 1 : 0;
  if (w.caravan && w.day <= w.caravan.until) caravanBuys(w);
  if (!w.caravan && ((short.length && (w.shortDays ?? 0) >= 3) || chance(w, 0.06))) {
    const goods: Partial<Record<Good, number>> = {};
    for (const g of short.length ? short : (['alet', 'elbise', 'icki', 'yun'] as Good[])) goods[g] = g === 'bugday' ? 200 : g === 'su' ? 150 : g === 'ekmek' ? 80 : 8;
    w.caravan = { day: w.day, until: w.day + 2, goods, name: pick(w, ['Halep kervanı', 'Venedik gemisi', 'Bağdat kervanı', 'Ceneviz tüccarları']) };
    for (const [g, q] of Object.entries(goods) as [Good, number][]) w.listings.push({ id: nextId(w, 'L'), sellerId: 'dis', good: g, qty: q, price: Math.round(Math.max(BASE_PRICE[g] * 1.6, w.prices[g] * 1.15) * 100) / 100, market: 'liman' });
    log(w, `${w.caravan.name} limana geldi: ${Object.keys(goods).map((g) => GOOD_LABEL[g as Good]).join(', ')} (pahalıca) satıyor. Hazine gümrük alır.`);
  }
  // border threats
  if (!w.threat && w.day > 15 && chance(w, 0.025)) {
    const strength = 6 + Math.round(rand(w) * 10);
    w.threat = { name: pick(w, ['Dağ aşiretleri', 'Korsanlar', 'Komşu bey', 'Eşkıya çetesi']), demand: 150 + strength * 25, day: w.day, deadline: w.day + 2, strength };
    log(w, `SINIRDA TEHLİKE: ${w.threat.name} ${w.threat.demand} Dinar haraç istiyor! Ödenmezse ${w.threat.deadline}. gün saldıracaklar.`);
  }
  if (w.threat && w.day >= w.threat.deadline) borderBattle(w);
}
/** Caravans also buy the city's surplus crafts and grain – money flows in, not only out. */
function caravanBuys(w: World, leaving = false): void {
  const c = w.caravan!; let budget = 60 + (c.earned ?? 0) * 0.9 - (c.spent ?? 0); const start = budget;
  for (const g of ['ekmek', 'balik', 'kumas', 'elbise', 'mobilya', 'alet', 'bugday', 'yun', 'odun', 'et', 'icki'] as Good[]) {
    const offers = w.listings.filter((l) => l.good === g && l.sellerId !== 'dis' && l.sellerId !== 'saray' && l.price <= BASE_PRICE[g] * (leaving ? 3 : 1.3)).sort((a, b) => a.price - b.price);
    for (const l of offers) while (l.qty > 0 && budget > l.price) {
      transfer(w, 'dis', l.sellerId, l.price, `kervana ${g} satışı`); const s = findPerson(w, l.sellerId); if (s) { s.incomeToday += l.price; s.taxDue += l.price * w.taxRate / 100; }
      l.qty -= 1; budget -= l.price; w.market.sold[g] += 1;
    }
  }
  c.spent = (c.spent ?? 0) + (start - budget);
}
export function armyPower(w: World): number { return w.people.filter((p) => p.prof === 'asker' && active(p)).reduce((s, p) => s + 0.5 + p.loyalty / 100 + (p.inv.alet > 0 ? 0.2 : 0), 0); }
export function payTribute(w: World): string {
  const t = w.threat; if (!t) return 'Haraç isteyen yok.';
  if (!transfer(w, 'saray', 'dis', t.demand, 'haraç')) return 'Hazine haraca yetmiyor!';
  for (const p of w.people) if (p.prof === 'asker') p.loyalty = clamp(p.loyalty - 3);
  log(w, `${t.name}'a ${t.demand} Dinar haraç ödendi. Ordu bu aşağılanmadan hoşnut değil.`); w.threat = null; return 'Haraç ödendi.';
}
export function borderBattle(w: World): void {
  const t = w.threat; if (!t) return; w.threat = null;
  const ours = armyPower(w) * (0.8 + rand(w) * 0.4);
  if (ours >= t.strength) {
    const loot = Math.round(t.demand * 0.6); transfer(w, 'dis', 'saray', loot, 'ganimet');
    for (const p of w.people) { if (p.prof === 'asker') { p.loyalty = clamp(p.loyalty + 6); p.xp += 3; } p.mood = clamp(p.mood + 2); }
    log(w, `ZAFER! Ordu ${t.name}'nı püskürttü; ${loot} Dinar ganimet hazineye girdi.`);
  } else {
    const loss = Math.min(w.treasury, t.demand * 1.5); transfer(w, 'saray', 'dis', loss, 'yağma');
    const dead = w.people.filter((p) => p.prof === 'asker' && !p.playerId).slice(0, 2);
    for (const p of dead) die(w, p, `Asker ${p.name} sınırda şehit düştü.`);
    for (const p of w.people) { p.mood = clamp(p.mood - 5); p.loyalty = clamp(p.loyalty - 4); }
    log(w, `YENİLGİ! ${t.name} şehri yağmaladı: hazineden ${Math.round(loss)} Dinar gitti.`);
  }
}

// ---------------- taxes, smuggling, karaborsa, wealth tax ----------------
export function collectTaxes(w: World): void {
  const ts = w.people.filter((p) => p.prof === 'tahsildar' && active(p));
  for (const p of w.people) {
    if (p.taxDue < 0.5) continue;
    const t = ts.length ? pick(w, ts) : null;
    if (t && fullAI(p) && p.honesty < 40 && p.taxDue > 6 && chance(w, 0.4)) {
      const bribe = Math.round(p.taxDue * 0.4 * 100) / 100;
      if (t.honesty < 55 && chance(w, (100 - t.loyalty) / 100 + 0.2) && transfer(w, p.id, t.id, bribe, 'rüşvet')) {
        p.taxDue = 0; t.incomeToday += bribe;
        if (chance(w, 0.15)) rumor(w, `${t.name} vergi toplarken rüşvet alıyormuş.`, t.id, -6);
        continue;
      }
    }
    const pay = Math.min(p.money, p.taxDue * (t ? 1 : 0.8));
    if (transfer(w, p.id, 'saray', pay, 'satış vergisi')) p.taxDue = Math.max(0, p.taxDue - pay / (t ? 1 : 0.8));
    if (t) t.xp += 0.05;
  }
  // smugglers risk getting caught
  for (const p of w.people.filter((x) => x.smuggle && active(x))) if (chance(w, 0.12)) arrest(w, p, 'kacakcilik', null, 20);
}
function karaborsa(w: World): void {
  // banned goods cannot be sold openly (detection of hoards: see hoard.ts patrolDay)
  for (const l of w.listings.filter((x) => w.bans.includes(x.good) && x.sellerId !== 'dis')) l.qty = 0;
}
function wealthTax(w: World): void {
  if (!lawOn(w, 'servet')) return;
  const th = wealthThreshold(w); for (const p of w.people) if (p.money > th && p.id !== w.kayzerId) transfer(w, p.id, 'saray', Math.min(25, (p.money - th) * 0.02), 'servet vergisi');
}

// ---------------- jobs ----------------
const STAPLE_PROFS = ['ciftci', 'firinci', 'sucu', 'kasap', 'balikci'];
function switchJobs(w: World): void {
  const count = (prof: string): number => w.people.filter((x) => x.prof === prof).length;
  for (const p of [...w.people].sort(() => rand(w) - 0.5)) {
    const idleHamal = p.prof === 'hamal' && p.money < 30;
    const own = PRODUCES[p.prof]?.good; const glut = !!own && w.listings.filter((l) => l.good === own).reduce((s, l) => s + l.qty, 0) > w.market.sold[own] * 1.5 + 10;
    if (!fullAI(p) || (!PRODUCES[p.prof] && !idleHamal) || (!idleHamal && (p.unemployedDays < 6 || p.money > 60 || (STAPLE_PROFS.includes(p.prof) && !glut)))) continue;
    const g = PRODUCES[p.prof]?.good;
    const best = (Object.entries(PRODUCES) as [Person['prof'], { good: Good }][])
      .filter(([prof]) => count(prof) < 14 && (!idleHamal || STAPLE_PROFS.includes(prof)))
      .map(([prof, r]) => ({ prof, need: w.market.unmet[r.good] * BASE_PRICE[r.good] * (STAPLE_PROFS.includes(prof) ? 3 : 1) })).sort((a, b) => b.need - a.need)[0];
    if (best && best.prof !== p.prof && best.need > 20 && (!g || w.market.unmet[g] === 0)) {
      const old = PROF_LABEL[p.prof]; p.prof = best.prof; p.work = WORKPLACE[best.prof]; p.xp = 0; p.unemployedDays = 0;
      log(w, `${p.name} ${old} işini bıraktı, ${PROF_LABEL[best.prof]} oldu (orada talep var).`, p.id);
      return; // at most one career change per day keeps the economy stable
    }
  }
  // builders without a project look for work as porters
  const busy = w.projects.some((x) => !x.done && x.paid >= 6);
  for (const p of w.people.filter((x) => x.prof === 'insaatci')) { p.work = busy ? 'santiye' : 'pazar'; if (!busy) p.lastAction = 'iş arıyor (hamallık)'; }
}

// ---------------- crime ----------------
export const isProtected = (w: World, p: Person): boolean => p.protectedUntil >= w.day || p.id === w.kayzerId || p.prof === 'naip';
function catcher(w: World, night: boolean): Person | undefined {
  const pool = w.people.filter((x) => (x.prof === 'bekci' || (night && x.prof === 'asker')) && active(x));
  const power = Math.min(0.85, 0.1 + pool.filter((x) => x.prof === 'bekci').length * 0.08 + (night ? 0.05 : 0.15));
  return pool.length && chance(w, power) ? pick(w, pool) : undefined;
}
/** Caught! A pending arrest: until the next morning/evening window the criminal may offer the catcher a bribe. */
export function arrest(w: World, criminal: Person, crime: CrimeKind, victimId: string | null, amount: number, by?: Person): Arrest | null {
  const c = by ?? catcher(w, w.hour >= 21 || w.hour < 6) ?? w.people.find((x) => x.prof === 'bekci' && active(x));
  if (!c) return null;
  const a: Arrest = { id: nextId(w, 'A'), criminalId: criminal.id, catcherId: c.id, crime, victimId, amount, day: w.day, hour: w.hour, offer: 0, status: 'bekliyor' };
  w.arrests.push(a); criminal.jailedDays = Math.max(criminal.jailedDays, 1);
  log(w, `${c.name}, ${criminal.name}'ı yakaladı (${CRIME_TEXT[crime]}). Sabah/akşam ya hâkime gidecek ya da…`, criminal.id);
  if (criminal.playerId) personal(w, criminal.playerId, 'Yakalandınız! Bekçiye rüşvet teklif edebilirsiniz (Zindan → Tutuklama).');
  return a;
}
export const CRIME_TEXT: Record<CrimeKind, string> = { hirsizlik: 'hırsızlık', rusvet: 'rüşvet', zimmet: 'zimmet', isyan: 'isyan', saldiri: 'saldırı', cinayet: 'cinayet', kacakcilik: 'kaçakçılık' };
export function bribeAcceptChance(catcher: Person, offer: number): number {
  return clamp((100 - catcher.loyalty) * 0.6 + (60 - catcher.honesty) * 0.4 + Math.min(40, offer), 0, 95) / 100;
}
export function decideBribe(w: World, a: Arrest, accept: boolean): string {
  const cr = findPerson(w, a.criminalId); const ca = findPerson(w, a.catcherId);
  if (!cr || !ca) { a.status = 'ret'; return 'Kişi yok.'; }
  if (accept && a.offer > 0 && transfer(w, cr.id, ca.id, a.offer, 'rüşvet')) {
    a.status = 'kabul'; cr.jailedDays = 0; ca.incomeToday += a.offer; rel(cr, ca, 10, 'rüşvetimi aldı, beni saldı');
    if (chance(w, 0.2)) rumor(w, `${ca.name} yakaladığı ${cr.name}'ı rüşvetle salmış!`, ca.id, -10);
    return `${ca.name} ${a.offer} Dinar'ı aldı ve ${cr.name}'ı saldı.`;
  }
  a.status = 'ret'; openCase(w, cr.id, a.crime, a.victimId, a.amount, a.crime === 'cinayet' ? 90 : 70); rel(cr, ca, -15, 'beni tutukladı');
  if (a.offer > 0) { openCase(w, cr.id, 'rusvet', null, a.offer, 80); ca.rep = clamp(ca.rep + 3, -100, 100); rumor(w, `${ca.name} rüşveti reddetti, ${cr.name}'ı kadıya teslim etti.`, ca.id, 5); }
  return `${ca.name} rüşveti reddetti; ${cr.name} kadının önüne çıkacak.`;
}
function resolveArrests(w: World): void {
  for (const a of w.arrests.filter((x) => x.status === 'bekliyor')) {
    const cr = findPerson(w, a.criminalId); const ca = findPerson(w, a.catcherId); if (!cr || !ca) { a.status = 'ret'; continue; }
    if (cr.playerId && !cr.npc && a.offer === 0 && w.day === a.day && w.hour <= a.hour + 13) continue; // player criminal gets one window to offer
    if (fullAI(cr) && a.offer === 0 && cr.honesty < 65 && cr.money > 12) a.offer = Math.round(Math.min(cr.money * 0.4, 10 + a.amount * 0.5));
    if (!fullAI(ca) && w.day === a.day) continue; // a player catcher decides himself (until the next window)
    decideBribe(w, a, a.offer > 0 && rand(w) < bribeAcceptChance(ca, a.offer));
  }
}
export function steal(w: World, thief: Person, victim: Person): number {
  if (isProtected(w, victim)) return 0;
  const amt = Math.min(Math.round(victim.money * 0.15), 30); if (amt <= 0) return 0;
  transfer(w, victim.id, thief.id, amt, 'hırsızlık');
  victim.mood = clamp(victim.mood - 10); rel(victim, thief, -50, 'beni soydu'); thief.lastAction = 'hırsızlık';
  log(w, `${victim.name} soyuldu (${amt} Dinar).`, victim.id);
  if (catcher(w, w.hour >= 21 || w.hour < 6)) arrest(w, thief, 'hirsizlik', victim.id, amt);
  return amt;
}
export function assault(w: World, a: Person, v: Person): string {
  if (isProtected(w, v)) return `${v.name} şehre yeni geldi; ona dokunulmaz (koruma süresi).`;
  v.health = clamp(v.health - 35); v.wounded = true; v.mood = clamp(v.mood - 10); rel(v, a, -60, 'beni dövdü');
  for (const x of w.people) if (x.relations[v.id] && (x.relations[v.id] ?? 0) > 40) rel(x, a, -20, `${v.name}'ı dövdü`);
  log(w, `${a.name}, ${v.name}'a saldırdı ve yaraladı! Yaralı hekime gitmeli.`, v.id);
  if (catcher(w, w.hour >= 21 || w.hour < 6)) arrest(w, a, 'saldiri', v.id, 0);
  return `${v.name}'ı yaraladınız.`;
}
export function murder(w: World, a: Person, v: Person): string {
  if (isProtected(w, v)) return `${v.name}'a dokunulmaz.`;
  if (v.playerId || v.prof === 'asker' && chance(w, 0.7)) { v.health = 5; v.wounded = true; log(w, `${a.name}, ${v.name}'ı öldürmeye kalktı; ağır yaralı kurtuldu!`, v.id); arrest(w, a, 'cinayet', v.id, 0); return `${v.name} ağır yaralı kurtuldu.`; }
  for (const x of w.people) if ((x.relations[v.id] ?? 0) > 20) rel(x, a, -70, `${v.name}'ı öldürdü`);
  die(w, v, `CİNAYET! ${v.name} öldürüldü. Katil aranıyor…`);
  if (chance(w, 0.75)) arrest(w, a, 'cinayet', null, 0);
  return 'Cinayet işlediniz…';
}
function nightCrime(w: World): void {
  const out = w.people.filter((p) => p.nightOut && fullAI(p) && active(p));
  for (const p of out) {
    const foes = Object.entries(p.relations).filter(([, v]) => v < -60).map(([id]) => findPerson(w, id)).filter((x): x is Person => !!x && active(x));
    if (p.honesty < 30 && p.money < 15 && chance(w, 0.35)) { const vs = w.people.filter((v) => v.money > 60 && v.id !== p.id && !isProtected(w, v)); if (vs.length) steal(w, p, pick(w, vs)); }
    else if (foes.length && p.honesty < 40 && chance(w, 0.15)) { const v = pick(w, foes); if (p.honesty < 12 && (p.relations[v.id] ?? 0) < -90 && chance(w, 0.15)) murder(w, p, v); else assault(w, p, v); }
    else if ((lawOn(w, 'gece') || curfewAt(w, w.hour)) && chance(w, 0.3)) { transfer(w, p.id, 'saray', Math.min(3, p.money), 'gece yasağı cezası'); p.nightOut = false; }
  }
}

// ---------------- reputation & rumours ----------------
export function rumor(w: World, text: string, about: string, delta: number): void {
  w.rumors.push({ day: w.day, text, about });
  const p = findPerson(w, about); if (p) p.rep = clamp(p.rep + delta, -100, 100);
}
function rumorsDay(w: World): void {
  // rumours move opinions: people think worse of the badly-reputed, better of the well-reputed
  for (const r of w.rumors.filter((x) => x.day === w.day)) {
    const about = findPerson(w, r.about); if (!about) continue;
    for (let i = 0; i < 6; i += 1) { const x = pick(w, w.people); if (x.id !== about.id) x.relations[about.id] = clamp((x.relations[about.id] ?? 0) + (about.rep >= 0 ? 2 : -3), -100, 100); }
  }
  // competition: sellers of the same good grow a little cold
  if (w.day % 3 === 0) for (const p of w.people) { const g = PRODUCES[p.prof]?.good; if (!g) continue; const rival = w.people.find((x) => x !== p && x.prof === p.prof && chance(w, 0.3)); if (rival) rel(p, rival, -1, 'aynı işi yapıyoruz, rakibim'); }
}

// ---------------- achievements & quests ----------------
const TITLES: [string, (w: World, p: Person) => boolean][] = [
  ['Zengin', (_w, p) => p.money >= 1000], ['Hayırsever', (_w, p) => p.rep >= 40], ['Dindar', (_w, p) => p.din >= 90], ['Usta', (_w, p) => p.xp >= 60],
  ['Evli', (_w, p) => !!p.spouse], ['Halkın Sevgilisi', (w, p) => w.people.filter((x) => (x.relations[p.id] ?? 0) > 40).length >= 8], ['Meclis Üyesi', (_w, p) => p.meclis],
  ['Kıdemli', (w, p) => w.day - (w.players[p.playerId ?? '']?.lastSeenDay ?? w.day) >= 0 && p.xp >= 30], ['Kötü Şöhretli', (_w, p) => p.rep <= -40],
];
function achievements(w: World): void {
  for (const p of w.people) {
    if (!p.playerId) continue;
    for (const [t, f] of TITLES) if (!p.titles.includes(t) && f(w, p)) { p.titles.push(t); log(w, `🏅 ${p.name} “${t}” unvanını kazandı!`, p.id); }
  }
}
export const QUESTS: { text: string; done: (w: World, p: Person) => boolean }[] = [
  { text: 'Bir öğün yiyin (⚡ Ne yapabilirim → Ye)', done: (_w, p) => p.meals >= 1 },
  { text: 'Su için (günde 5 su gerekir)', done: (_w, p) => p.drinks >= 1 },
  { text: 'Pazardan bir şey alın (Pazar binasına dokunun)', done: (w, p) => w.ledger.some((l) => l.from === p.id && l.reason.endsWith('alımı')) },
  { text: 'Camide namaz kılın ya da meyhanede bir kadeh için', done: (_w, p) => p.lastAction.includes('namaz') || p.lastAction.includes('içti') },
  { text: 'Bir vatandaşla sohbet edin (birine dokunun → Sohbet)', done: (_w, p) => Object.values(p.relNote).some((x) => x.includes('sohbet')) },
  { text: 'Saraya bir dilekçe yazın (Saray binası)', done: (w, p) => w.petitions.some((x) => x.fromId === p.id) },
  { text: 'Meclis seçiminde aday olun ya da oy verin (Meclis binası)', done: (w, p) => w.election.candidates.includes(p.id) || !!w.election.votes[p.id] || p.meclis },
];
export function questReward(w: World, playerId: string): string | null {
  const pl = w.players[playerId]; const p = findPerson(w, pl?.personId); if (!pl || !p) return null;
  const i = pl.quest ?? 0; const q = QUESTS[i]; if (!q || !q.done(w, p)) return null;
  pl.quest = i + 1; p.xp += 2; transfer(w, 'saray', p.id, 3, 'rehber ödülü');
  return `Görev tamam: ${q.text}. Ödül: 3 Dinar.${QUESTS[i + 1] ? ` Sıradaki: ${QUESTS[i + 1]!.text}` : ' Rehber bitti — artık şehir sizin!'}`;
}
void STOCK_LIMIT; void addListing; void marketPrice;

// ---------------- hamal work ----------------
/** Porters earn by hauling: building material to an active site (paid from the project fund) or goods for big sellers at the market. */
export function hamalWork(w: World): void {
  const proj = w.projects.find((x) => !x.done && x.paid >= 3);
  const sellers = w.people.filter((s) => s.id !== 'x' && w.listings.some((l) => l.sellerId === s.id && l.qty >= 15) && s.money > 15);
  for (const h of w.people.filter((x) => x.prof === 'hamal' && active(x))) {
    if (h.playerId && !h.npc) continue; // players haul by hand ("Fazla mesai")
    if (proj && chance(w, 0.6) && transfer(w, `proje:${proj.id}`, h.id, 3, 'yük taşıma (inşaat)')) {
      proj.progress = Math.min(proj.needed, proj.progress + 1); h.incomeToday += 3; h.work = proj.plot ?? proj.site; h.lastAction = `${proj.name} için taş taşıyor`; h.xp += 1; continue;
    }
    h.work = 'pazar';
    const s = sellers.length ? pick(w, sellers) : undefined;
    if (s && transfer(w, s.id, h.id, 2, 'hamaliye (pazar taşıma)')) { h.incomeToday += 2; h.lastAction = `${s.name}'ın mallarını taşıyor`; h.xp += 1; h.relations[s.id] = clamp((h.relations[s.id] ?? 0) + 1, -100, 100); }
  }
}

import { ek } from './tr';
import { startFire } from './events3';
import { rehouse } from './housing';
import { migrateMeclis16 } from './meclis';
import { startIsyanHook } from './hooks';
import { republicShare, REBEL_SHARE, REBEL_MIN } from './isyan';
/**
 * v1.8 "realm": nobility & palace intrigue, secret organizations & detection, seasons, animals & farms,
 * continuous hunger/thirst, and the Tarih Kitabı (chronicle). All server-authoritative, shared with the mock.
 */
import type { CrimeKind, Good, Person, World } from './types';
import { GOODS } from './types';
import { findPerson } from './world';
import { log, personal } from './log';
import { chance, clamp, nextId, pick } from './rng';
import { transfer, buy, addListing, sellerPrice } from './economy';
import { arrest, rumor, relate } from './life';
import { die } from './family';

// ======================= seasons =======================
export type Season = 'ilkbahar' | 'yaz' | 'sonbahar' | 'kis';
export const SEASON_DAYS = 30;
export const SEASON_LABEL: Record<Season, string> = { ilkbahar: '🌸 İlkbahar', yaz: '☀️ Yaz', sonbahar: '🍂 Sonbahar', kis: '❄️ Kış' };
export function season(w: World): Season { return (['ilkbahar', 'yaz', 'sonbahar', 'kis'] as const)[Math.floor(Math.max(0, w.day - 1) / SEASON_DAYS) % 4]!; }

// ======================= continuous hunger / thirst =======================
export const HUNGER_PER_H = 4; export const THIRST_PER_H = 4.5;
/** Hourly: bars drain; NPCs (and offline players' AI) eat/drink when low; empty bars hurt. */
export function needsDrain(w: World, eat: (p: Person) => boolean, drink: (p: Person) => boolean): void {
  const s = season(w); const night = w.hour < 6 || w.hour >= 23;
  for (const p of w.people) {
    if (p.prof === 'naip') { p.hunger = 0; p.thirst = 0; continue; }
    p.hunger = clamp(p.hunger + HUNGER_PER_H * (night ? 0.5 : 1));
    p.thirst = clamp(p.thirst + THIRST_PER_H * (night ? 0.5 : 1) * (s === 'yaz' ? 1.25 : 1));
    const autoT = p.playerId && !p.npc ? 80 : 50;
    if (p.thirst >= autoT) { if (p.inv.sut > 0 && chance(w, 0.4)) { p.inv.sut -= 1; p.thirst = clamp(p.thirst - 30); p.hunger = clamp(p.hunger - 10); p.drinks += 1; } else drink(p); }
    if (p.hunger >= autoT + 5) { if (p.inv.yumurta > 0 && chance(w, 0.4)) { p.inv.yumurta -= 1; p.hunger = clamp(p.hunger - 22); p.meals += 1; } else eat(p); }
    if (p.hunger >= 100) { p.health = clamp(p.health - 2.5); p.mood = clamp(p.mood - 0.5); }
    if (p.thirst >= 100) { p.health = clamp(p.health - 3.5); p.mood = clamp(p.mood - 0.5); }
    if (p.health < 5) p.health = 5;
  }
}
export function drinkMilk(p: Person): string { if (p.inv.sut <= 0) return 'Sütünüz yok.'; p.inv.sut -= 1; p.thirst = clamp(p.thirst - 30); p.hunger = clamp(p.hunger - 10); p.drinks += 1; return 'Süt içtiniz (susuzluk −30, açlık −10).'; }
export function eatEgg(p: Person): string { if (p.inv.yumurta <= 0) return 'Yumurtanız yok.'; p.inv.yumurta -= 1; p.hunger = clamp(p.hunger - 22); p.meals += 1; return 'Yumurta yediniz (açlık −22).'; }

/** Daily seasonal effects: winter needs wood (heating) and brings colds; spring/summer moods. */
export function seasonDay(w: World): void {
  const s = season(w);
  if (w.day % SEASON_DAYS === 1 && w.day > 1) log(w, `${SEASON_LABEL[s]} geldi. ${s === 'kis' ? 'Odun stoklayın; soğuk hastalık getirir.' : s === 'yaz' ? 'Sıcaklar başladı; daha çok su gerekecek.' : s === 'sonbahar' ? 'Yapraklar dökülüyor; kışa hazırlanın.' : 'Çiçekler açtı; tarlalar bereketli.'}`);
  if (s !== 'kis') return;
  for (const p of w.people) {
    if (p.prof === 'naip' || p.jailedDays > 0 || (p.soylu && p.home === 'saray') || p.id === w.kayzerId) continue;
    if (p.inv.odun <= 0 && p.money > 3) buy(w, p.id, 'odun', 1, p.money * 0.3);
    if (p.inv.odun > 0) { p.inv.odun -= 1; continue; }
    p.health = clamp(p.health - 4); p.mood = clamp(p.mood - 2);
    if (chance(w, 0.15)) { p.health = clamp(p.health - 12); if (p.playerId) personal(w, p.playerId, '🤧 Evde odun yok, üşüttünüz! Hekime gidin, odun alın.'); }
  }
}

// ======================= animals & farms =======================
export type Animal = 'inek' | 'koyun' | 'tavuk' | 'at';
export const ANIMALS: Animal[] = ['inek', 'koyun', 'tavuk', 'at'];
export const ANIMAL_LABEL: Record<Animal, string> = { inek: 'İnek', koyun: 'Koyun', tavuk: 'Tavuk', at: 'At' };
export const ANIMAL_PRICE: Record<Animal, number> = { inek: 120, koyun: 45, tavuk: 6, at: 150 };
export const ANIMAL_FEED: Record<Animal, number> = { inek: 2, koyun: 1, tavuk: 0.2, at: 2 }; // buğday per day
export const ANIMAL_MEAT: Record<Animal, number> = { inek: 8, koyun: 4, tavuk: 1, at: 0 };
export const FARM_PRICE = 250;
export const needsFarm = (a: Animal): boolean => a === 'inek' || a === 'koyun';
export const herd = (p: Person): Record<Animal, number> => (p.animals ??= { inek: 0, koyun: 0, tavuk: 0, at: 0 });
export const hasHorse = (p: Person): boolean => (p.animals?.at ?? 0) > 0;

export const BARN: Record<'ahir' | 'kumes', { cost: number; cap: number; label: string; odun: number }> = { ahir: { cost: 120, cap: 6, label: 'Ahır', odun: 6 }, kumes: { cost: 50, cap: 15, label: 'Kümes', odun: 2 } };
export function barnRoom(p: Person, a: Animal): number {
  const b = p.barn ?? { ahir: 0, kumes: 0 }; const hd = herd(p);
  if (a === 'tavuk') return b.kumes * BARN.kumes.cap - hd.tavuk;
  if (a === 'at' && !p.farm) return hd.at > 0 ? 0 : 1; // one horse can be stabled at the han without a farm
  return b.ahir * BARN.ahir.cap - hd.inek - hd.koyun - hd.at;
}
export function buildBarn(w: World, p: Person, kind: 'ahir' | 'kumes'): string {
  if (!p.farm) return 'Önce Hayvan Pazarı’ndan bir çiftlik arsası alın.'; const B = BARN[kind]; if (!B) return 'Böyle yapı yok.';
  const b = (p.barn ??= { ahir: 0, kumes: 0 }); if (b[kind] >= 3) return `En fazla 3 ${B.label}.`;
  if (!transfer(w, p.id, 'saray', B.cost, `${B.label} yapımı`)) return `${B.label} ${B.cost} Dinar.`;
  b[kind] += 1; return `${B.label} yapıldı! (${kind === 'ahir' ? `inek/koyun/at için ${B.cap}` : `${B.cap} tavuk`} yer)`;
}
export function feedAnimals(w: World, p: Person): string {
  const hd = herd(p); const need = Math.ceil(ANIMALS.reduce((s, a) => s + hd[a] * ANIMAL_FEED[a], 0)); if (need <= 0) return 'Hayvanınız yok.';
  if (p.fedDay === w.day) return 'Hayvanlarınız bugün zaten doydu.';
  if (p.inv.bugday < need) buy(w, p.id, 'bugday', need - p.inv.bugday, p.money);
  if (p.inv.bugday < need && (w.granary ?? 0) > 0) { const q = Math.min(need - p.inv.bugday, Math.floor(w.granary)); const cost = Math.round(q * (w.prices.bugday ?? 1) * 1.1 * 100) / 100; if (q > 0 && transfer(w, p.id, 'saray', cost, 'ambardan yem')) { w.granary -= q; p.inv.bugday += q; } }
  if (p.inv.bugday < need) return `${need} buğday yem gerekiyor; alamadınız.`;
  p.inv.bugday -= need; p.fedDay = w.day; return `Hayvanlar ${need} buğdayla beslendi. Yarın süt/yumurta/yün toplayabilirsiniz.`;
}
export function collectFarm(p: Person): string {
  const st = p.farmStock ?? {}; const got = Object.entries(st).filter(([, q]) => (q ?? 0) > 0) as [Good, number][]; if (!got.length) return 'Toplanacak ürün yok. Hayvanları her gün besleyin.';
  for (const [g, q] of got) p.inv[g] += q; p.farmStock = {}; return `Toplandı: ${got.map(([g, q]) => `${q} ${({ sut: 'süt', yumurta: 'yumurta', yun: 'yün' } as Record<string, string>)[g] ?? g}`).join(', ')}.`;
}
export function buyFarm(w: World, p: Person): string {
  if (p.farm) return 'Zaten bir çiftliğiniz var.';
  if (!transfer(w, p.id, 'saray', FARM_PRICE, 'arsa / çiftlik tapusu')) return `Çiftlik arsası ${FARM_PRICE} Dinar.`;
  p.farm = true; p.barn ??= { ahir: 0, kumes: 0 }; log(w, `🏡 ${p.name} bir arsa alıp çiftlik kurdu.`, p.id); return 'Çiftlik arsanız hazır (Buğday Tarlaları’nın yanında). Şimdi ahır ya da kümes yapın, sonra hayvan alın.';
}
export function buyAnimal(w: World, p: Person, a: Animal, n = 1): string {
  if (!ANIMALS.includes(a)) return 'Böyle hayvan yok.';
  if (needsFarm(a) && !p.farm) return `${ANIMAL_LABEL[a]} için önce bir çiftlik arsası almalısınız.`;
  if (p.prof !== 'hayvanci') { const room = barnRoom(p, a); if (room < n) return a === 'tavuk' ? `Kümesinizde yer yok (${room}). Çiftliğinize kümes yapın.` : a === 'at' && !p.farm ? 'Çiftliksiz yalnızca bir at besleyebilirsiniz (handa).' : `Ahırınızda yer yok (${room}). Çiftliğinize ahır yapın.`; }
  const seller = w.people.find((x) => x.prof === 'hayvanci' && x.jailedDays === 0 && x.id !== p.id);
  const cost = ANIMAL_PRICE[a] * n;
  if (!transfer(w, p.id, seller?.id ?? 'saray', cost, `${a} alımı`)) return `${n} ${ANIMAL_LABEL[a]} ${cost} Dinar; paranız yetmiyor.`;
  if (seller) { seller.incomeToday += cost * 0.4; transfer(w, seller.id, 'dis', cost * 0.55, 'hayvan tedariki'); }
  herd(p)[a] += n; return `${n} ${ANIMAL_LABEL[a]} aldınız${seller ? ` (${seller.name})` : ''}. Günlük yem: ${Math.round((ANIMAL_FEED[a] * n) * 10) / 10} buğday.`;
}
export function slaughter(w: World, p: Person, a: Animal): string {
  const hd = herd(p); if (hd[a] <= 0) return 'O hayvandan yok.'; if (!ANIMAL_MEAT[a]) return 'At kesilmez!';
  hd[a] -= 1; p.inv.et += ANIMAL_MEAT[a]; if (a === 'koyun') p.inv.yun += 2; void w; return `${ANIMAL_LABEL[a]} kesildi: ${ANIMAL_MEAT[a]} et${a === 'koyun' ? ' + 2 yün' : ''}.`;
}
/** Daily: feed animals (buğday from stock or market), collect products; hungry animals give nothing and may die. */
export function animalsDay(w: World): void {
  for (const p of w.people) {
    const hd = p.animals; if (!hd) continue;
    const feed = ANIMALS.reduce((s, a) => s + hd[a] * ANIMAL_FEED[a], 0); if (feed <= 0) continue;
    const need = Math.ceil(feed); const human = !!p.playerId && !p.npc;
    let fed: boolean;
    if (human) fed = p.fedDay === w.day; // players feed by hand (or the animals go hungry)
    else { if (p.inv.bugday < need) buy(w, p.id, 'bugday', need - p.inv.bugday, p.money * 0.5); fed = p.inv.bugday >= need; p.inv.bugday = Math.max(0, p.inv.bugday - need); }
    if (!fed) { for (const a of ANIMALS) if (hd[a] > 0 && chance(w, human ? 0.04 : 0.08)) { hd[a] -= 1; if (p.playerId) personal(w, p.playerId, `${ANIMAL_LABEL[a]} açlıktan öldü! Yem (buğday) alın.`); } continue; }
    const out: Partial<Record<Good, number>> = { sut: hd.inek * 3, yun: Math.floor(hd.koyun * 0.5 + (w.day % 2 ? 0.5 : 0)) * 1, yumurta: hd.tavuk };
    for (const [g, q] of Object.entries(out) as [Good, number][]) {
      if (!q) continue;
      if (p.npc || !p.playerId) addListing(w, p, g, q, sellerPrice(w, p, g), 'gida'); else { const st = (p.farmStock ??= {}); st[g] = Math.min(60, (st[g] ?? 0) + q); }
    }
  }
}
/** The animal seller keeps a little herd so the market has milk/eggs; buys stock when cheap. */
export function hayvanciDay(w: World): void {
  for (const p of w.people.filter((x) => x.prof === 'hayvanci' && x.npc !== false && !x.playerId)) { p.farm = true; const hd = herd(p); if (hd.inek < 3) hd.inek += 1; if (hd.tavuk < 10) hd.tavuk += 3; if (hd.koyun < 4) hd.koyun += 1; if (hd.at < 2) hd.at += 1; }
}

// ======================= nobility =======================
export type Rank = 'Vezir' | 'Paşa' | 'Bey' | 'Ağa';
export const RANKS_N: Rank[] = ['Vezir', 'Paşa', 'Bey', 'Ağa'];
export const RANK_INFO: Record<Rank, { stipend: number; duty: string; max: number }> = {
  Vezir: { stipend: 20, duty: 'Divan’ı yönetir: dilekçeler hızlanır, hazine günde %0,5 faiz kazanır.', max: 1 },
  Paşa: { stipend: 15, duty: 'Orduya komuta eder: sadık Paşa askerin moralini yükseltir, sadakatsiz Paşa düşürür.', max: 2 },
  Bey: { stipend: 10, duty: 'Tımarının (dirlik) vergisini toplar: oradaki çalışanların gelirinin %5’i hazineye, %2’si kendine.', max: 4 },
  Ağa: { stipend: 6, duty: 'Mahallede asayişi sağlar: suçlar azalır, bekçiye yardım eder.', max: 6 },
};
export const FIEFS = ['ciftlik', 'liman', 'gida', 'zanaat', 'atolye', 'dokuma', 'mobilyahane', 'kasaphane', 'firin'];

export function grantTitle(w: World, k: Person, p: Person, rank: Rank, fief?: string | null): string {
  if (k.id !== w.kayzerId) return 'Sadece Kayzer unvan verir.';
  if (!RANKS_N.includes(rank)) return 'Böyle unvan yok.'; if (p.id === k.id || p.prof === 'naip') return 'Olmaz.';
  const holders = w.people.filter((x) => x.rank === rank && x.id !== p.id); if (holders.length >= RANK_INFO[rank].max) return `En fazla ${RANK_INFO[rank].max} ${rank} olabilir. Önce birinin unvanını alın.`;
  const old = p.rank; p.rank = rank; p.fief = rank === 'Bey' ? (fief && FIEFS.includes(fief) ? fief : FIEFS.find((f) => !w.people.some((x) => x.fief === f)) ?? 'ciftlik') : null;
  p.favor = clamp((p.favor ?? 50) + 20); p.loyalty = clamp(p.loyalty + 15); relate(p, k, 20, `bana ${rank} unvanı verdi`);
  for (const r of w.people.filter((x) => x.rank && x.id !== p.id)) relate(r, p, -8, `${rank} oldu, gözdeleşti`);
  const t = `👑 ${k.name}, ${ek(p.name, 'a')} ${old ? `${old} iken ` : ''}${rank} unvanı verdi${p.fief ? ` (tımar: ${w.buildings.find((b) => b.id === p.fief)?.name})` : ''}.`;
  log(w, t, p.id); chronicle(w, 'unvan', t); return t;
}
export function stripTitle(w: World, k: Person, p: Person): string {
  if (k.id !== w.kayzerId) return 'Sadece Kayzer.'; if (!p.rank) return 'Unvanı yok.';
  const r = p.rank; p.rank = null; p.fief = null; p.favor = clamp((p.favor ?? 50) - 35); p.loyalty = clamp(p.loyalty - 25); relate(p, k, -40, `${r} unvanımı aldı`);
  if (p.ambition > 60 && chance(w, 0.5)) p.plotting = 'coup';
  const t = `⚔ ${ek(p.name, 'ın')} ${r} unvanı geri alındı.`; log(w, t, p.id); chronicle(w, 'unvan', t); return t;
}
/** Daily: stipends, duties, favor and rivalry. */
export function nobilityDay(w: World): void {
  const k = findPerson(w, w.kayzerId);
  for (const p of w.people.filter((x) => x.rank)) {
    const info = RANK_INFO[p.rank!]; transfer(w, 'saray', p.id, info.stipend, `${p.rank} maaşı`);
    p.favor = clamp((p.favor ?? 50) + (k ? ((k.relations[p.id] ?? 0) - (p.favor ?? 50) + 50) * 0.02 : 0) - 0.3);
    if (p.rank === 'Paşa') for (const s of w.people.filter((x) => x.prof === 'asker')) s.loyalty = clamp(s.loyalty + (p.loyalty >= 50 ? 0.4 : -0.6));
    if (p.rank === 'Bey' && p.fief) { const workers = w.people.filter((x) => x.work === p.fief && x.id !== p.id); for (const x of workers) { const tax = x.incomeToday * 0.07; if (tax > 0.05 && transfer(w, x.id, 'saray', tax * 5 / 7, 'tımar vergisi')) transfer(w, x.id, p.id, tax * 2 / 7, 'bey payı'); } }
    if (p.rank === 'Vezir' && w.treasury > 0 && p.loyalty >= 50) transfer(w, 'dis', 'saray', Math.min(50, w.treasury * 0.005), 'vezirin dış ticaret geliri');
    for (const r of w.people.filter((x) => x.rank && x.id !== p.id && chance(w, 0.3))) relate(p, r, -1, 'saray rekabeti');
  }
}

// ======================= palace intrigue =======================
export interface Plot { id: string; kind: 'zehir' | 'darbe' | 'iftira'; by: string; target: string; day: number; exposed?: boolean; done?: boolean }
export function intrigueDay(w: World): void {
  const plots = (w.plots ??= []);
  const nobles = w.people.filter((x) => x.rank && (x.npc || !x.playerId) && x.jailedDays === 0);
  for (const p of nobles) {
    const rivals = nobles.filter((r) => r.id !== p.id && (p.relations[r.id] ?? 0) < -20);
    if (!(p.ambition > 60 || p.loyalty < 40) || !chance(w, 0.06)) continue;
    const kind: Plot['kind'] = p.loyalty < 30 && p.ambition > 70 && chance(w, 0.35) ? 'darbe' : rivals.length && chance(w, 0.25) ? 'zehir' : 'iftira';
    const target = kind === 'darbe' ? w.kayzerId : rivals.length ? pick(w, rivals).id : nobles.find((r) => r.id !== p.id)?.id;
    if (!target) continue;
    plots.push({ id: nextId(w, 'X'), kind, by: p.id, target, day: w.day });
  }
  // plots ripen after 2 days unless exposed by a spy
  for (const pl of plots.filter((x) => !x.done && !x.exposed && w.day - x.day >= 2)) {
    pl.done = true; const by = findPerson(w, pl.by); const t = findPerson(w, pl.target); if (!by || !t) continue;
    if (pl.kind === 'iftira') { rumor(w, `${t.name} hakkında Saray’da çirkin bir söylenti dolaşıyor…`, t.id, -15); t.favor = clamp((t.favor ?? 50) - 10); const k = findPerson(w, w.kayzerId); if (k) relate(k, t, -10, 'iftiraya inandı'); }
    else if (pl.kind === 'zehir') { t.health = clamp(t.health - 45); if (chance(w, 0.25) && t.id !== w.kayzerId && !t.playerId) { const txt = `☠ ${t.name} zehirlenerek öldü! Saray’da fısıltılar…`; chronicle(w, 'olum', txt); die(w, t, txt); } else log(w, `🤢 ${t.name} ağır hastalandı – zehir mi?`, t.id); }
    else if (pl.kind === 'darbe') { by.plotting = 'coup'; w.coup = w.coup ?? { leaderId: by.id, kind: 'coup', day: w.day, fund: 0 }; log(w, `🗡 Saray’da gizli bir darbe hazırlığı var…`); }
  }
  w.plots = plots.filter((x) => w.day - x.day < 20);
}

// ======================= spies, informants, secret organizations =======================
export type OrgKind = 'hirsiz' | 'cumhuriyet' | 'tarikat';
export const ORG_LABEL: Record<OrgKind, string> = { hirsiz: '🗝 Hırsızlar Loncası', cumhuriyet: '🗽 Cumhuriyet Cemiyeti', tarikat: '📿 Tarikat' };
export type OrgRole = 'lider' | 'yardimci' | 'propagandaci' | 'casus' | 'uye';
export const ROLE_LABEL: Record<OrgRole, string> = { lider: 'Lider', yardimci: 'Yardımcı', propagandaci: 'Propagandacı', casus: 'Gözcü', uye: 'Üye' };
export interface Org { id: string; kind: OrgKind; name: string; leaderId: string; members: string[]; suspicion: number; known: boolean; knownMembers: string[]; meetTonight?: boolean; founded: number; roles?: Record<string, OrgRole>; funds?: number; actedDay?: number }
export const ORG_GOAL: Record<OrgKind, string> = { hirsiz: 'Lonca kasasında 500 Dinar biriktirin', cumhuriyet: 'Halkı kazanıp Cumhuriyet’i ilan edin (cumhuriyet ≥ 60, 8+ üye → ayaklanma)', tarikat: 'Şehrin dindarlığını 70’e çıkarın ve 10 mürit toplayın' };
export function orgGoalProgress(w: World, o: Org): number {
  if (o.kind === 'hirsiz') return clamp((o.funds ?? 0) / 5);
  if (o.kind === 'cumhuriyet') return w.regime === 'cumhuriyet' ? 100 : clamp(Math.min(w.cumhuriyet / 60, o.members.length / 8) * 100);
  const din = w.people.reduce((s, p) => s + p.din, 0) / Math.max(1, w.people.length); return clamp(Math.min(din / 70, o.members.length / 10) * 100);
}
/** Would `p` join `o` when invited by `by` (optionally paid)? Ideology, relation, payment and risk. */
export function joinScore(w: World, p: Person, o: Org, by: Person, pay = 0): number {
  void w; const ideo = o.kind === 'hirsiz' ? (60 - p.honesty) * 0.8 + (p.money < 40 ? 15 : 0) : o.kind === 'cumhuriyet' ? (p.republic - 45) * 0.9 - (p.loyalty - 50) * 0.3 : (p.din - 55) * 0.9;
  const rel = (p.relations[by.id] ?? 0) * 0.4; const money = Math.min(30, pay / 4);
  const risk = o.suspicion * 0.3 + (o.known ? 15 : 0) + (STATE.includes(p.prof) ? 35 : 0) + (p.honesty > 75 && o.kind !== 'tarikat' ? 10 : 0);
  return 40 + ideo + rel + money - risk;
}
export interface Spy { spyId: string; targetId: string; until: number }
const orgOf = (w: World, pid: string): Org | undefined => (w.orgs ?? []).find((o) => o.members.includes(pid));
const CRIME_OF: Record<OrgKind, CrimeKind> = { hirsiz: 'hirsizlik', cumhuriyet: 'isyan', tarikat: 'isyan' };
function reveal(w: World, o: Org, ids: string[], how: string): void {
  const fresh = ids.filter((id) => !o.knownMembers.includes(id)); o.knownMembers.push(...fresh);
  const was = o.known; o.known = true; o.suspicion = clamp(o.suspicion + 10);
  const kp = findPerson(w, w.kayzerId)?.playerId;
  const txt = `🕵 ${how}: “${o.name}” (${ORG_LABEL[o.kind]})${fresh.length ? ` – üyeler: ${fresh.map((id) => findPerson(w, id)?.name).filter(Boolean).join(', ')}` : ''}.`;
  if (kp) personal(w, kp, txt); log(w, was ? txt : `🕵 Gizli bir örgüt ortaya çıktı: ${o.name}!`); if (!was) chronicle(w, 'orgut', `Gizli örgüt “${o.name}” deşifre oldu.`);
}
export function orgFound(w: World, p: Person, kind: OrgKind, name: string): string {
  void 0;
  if (!ORG_LABEL[kind]) return 'Böyle bir örgüt türü yok.'; if (orgOf(w, p.id)) return 'Zaten bir örgüttesiniz.';
  if (p.id === w.kayzerId) return 'Kayzer gizli örgüt kuramaz.';
  const o: Org = { id: nextId(w, 'O'), kind, name: name.trim().slice(0, 30) || ORG_LABEL[kind], leaderId: p.id, members: [p.id], suspicion: 5, known: false, knownMembers: [], founded: w.day, roles: { [p.id]: 'lider' }, funds: 0 };
  (w.orgs ??= []).push(o); return `“${o.name}” kuruldu. Liderisiniz. Gece toplantıları güç verir ama bekçi baskını riski taşır.`;
}
export function orgJoin(w: World, p: Person, id: string): string {
  const o = (w.orgs ?? []).find((x) => x.id === id); if (!o) return 'Örgüt yok.'; if (orgOf(w, p.id)) return 'Zaten bir örgüttesiniz.'; if (p.id === w.kayzerId) return 'Olmaz.';
  o.members.push(p.id); (o.roles ??= {})[p.id] = 'uye'; o.suspicion = clamp(o.suspicion + 1.5); const l = findPerson(w, o.leaderId); if (l) relate(l, p, 10, 'örgütümüze katıldı'); return `“${o.name}” örgütüne katıldınız.`;
}
export function orgLeave(w: World, p: Person): string { const o = orgOf(w, p.id); if (!o) return 'Örgütte değilsiniz.'; o.members = o.members.filter((x) => x !== p.id); if (o.leaderId === p.id) { o.leaderId = o.members.find((x) => o.roles?.[x] === 'yardimci') ?? o.members[0] ?? ''; if (o.roles && o.leaderId) o.roles[o.leaderId] = 'lider'; } if (!o.members.length) w.orgs = w.orgs!.filter((x) => x !== o); return 'Örgütten ayrıldınız.'; }
/** v1.9: invite someone (player → NPC directly). Returns code + reason; joins on success. */
export function orgInvite(w: World, by: Person, p: Person, pay = 0): { ok: boolean; code: string; text: string } {
  const o = orgOf(w, by.id); if (!o) return { ok: false, code: 'yok', text: 'Önce bir cemiyet kurun ya da birine katılın.' };
  if (orgOf(w, p.id)) return { ok: false, code: 'zaten', text: `${p.name} zaten bir örgütte.` };
  if (p.id === w.kayzerId || p.prof === 'naip') return { ok: false, code: 'kayzer', text: 'Saray’dan birini davet etmek intihar olur.' };
  if (p.playerId && !p.npc) return { ok: false, code: 'oyuncu', text: 'Oyunculara mesajla teklif edin; kendileri katılır.' };
  if (pay > 0 && by.money < pay) return { ok: false, code: 'para', text: 'O kadar paranız yok.' };
  const s = joinScore(w, p, o, by, pay);
  if (s >= 50) { if (pay > 0) transfer(w, by.id, p.id, pay, 'cemiyet daveti'); orgJoin(w, p, o.id); relate(p, by, 6, 'beni cemiyete aldı'); return { ok: true, code: 'ok', text: `${p.name} “${o.name}” cemiyetine katıldı.` }; }
  // a refusal can be dangerous: an honest/loyal NPC may report you
  if ((p.honesty > 65 || p.loyalty > 75) && chance(w, 0.25)) { reveal(w, o, [by.id], `${p.name} davet edildiği cemiyeti bekçilere bildirdi`); return { ok: false, code: 'ihbar', text: `${p.name} reddetti ve sizi ihbar etti!` }; }
  relate(p, by, -3, 'beni gizli bir işe çağırdı');
  return { ok: false, code: s < 25 ? 'asla' : 'istemem', text: `${p.name} teklifi reddetti.` };
}
export function orgRole(w: World, by: Person, pid: string, role: OrgRole): string {
  const o = orgOf(w, by.id); if (!o || o.leaderId !== by.id) return 'Rolleri lider dağıtır.'; if (!o.members.includes(pid) || pid === by.id || role === 'lider') return 'Geçersiz.';
  (o.roles ??= {})[pid] = role; return `${findPerson(w, pid)?.name} artık ${ROLE_LABEL[role]}.`;
}
export type OrgDeed = 'propaganda' | 'hirsizlik' | 'sabotaj' | 'ayaklanma';
export const DEED_LABEL: Record<OrgDeed, string> = { propaganda: 'Propaganda', hirsizlik: 'Soygun', sabotaj: 'Sabotaj', ayaklanma: 'Ayaklanma' };
export function orgAct(w: World, by: Person, deed: OrgDeed): string {
  const o = orgOf(w, by.id); if (!o) return 'Örgütte değilsiniz.'; const role = o.roles?.[by.id] ?? (o.leaderId === by.id ? 'lider' : 'uye');
  if (deed !== 'propaganda' && role !== 'lider' && role !== 'yardimci') return 'Bunu lider ya da yardımcı emreder.';
  if (o.actedDay === w.day && deed !== 'propaganda') return 'Bugün zaten bir eylem yaptınız; dikkat çekmeyin.';
  const helpers = o.members.map((id) => findPerson(w, id)!).filter((p) => p && p.jailedDays === 0);
  const prop = helpers.filter((p) => o.roles?.[p.id] === 'propagandaci').length;
  if (deed === 'propaganda') {
    if (!transfer(w, by.id, 'saray', 5, 'bildiri basımı')) return 'Bildiri için 5 Dinar gerekir.';
    const reach = 6 + prop * 4 + (role === 'propagandaci' ? 4 : 0);
    const ppl = w.people.filter((p) => !STATE.includes(p.prof)).sort(() => Math.random() - 0.5).slice(0, reach);
    for (const p of ppl) { if (o.kind === 'cumhuriyet') p.republic = clamp(p.republic + 3); else if (o.kind === 'tarikat') p.din = clamp(p.din + 3); else p.honesty = clamp(p.honesty - 1); }
    if (o.kind === 'cumhuriyet') w.cumhuriyet = clamp(w.cumhuriyet + 0.8);
    o.suspicion = clamp(o.suspicion + 4); return `Gece duvarlara bildiriler asıldı (${ppl.length} kişi okudu). Şüphe arttı.`;
  }
  if (deed !== 'ayaklanma') o.actedDay = w.day; // a refused rising call does not use up the day
  if (deed === 'hirsizlik') {
    if (o.kind !== 'hirsiz') return 'Soygun hırsızlar loncasının işidir.';
    const v = [...w.people].filter((p) => p.money > 120 && !o.members.includes(p.id)).sort((a, b) => b.money - a.money)[0]; if (!v) return 'Soyacak zengin yok.';
    const amt = Math.round(Math.min(v.money * 0.15, 25 + helpers.length * 8)); transfer(w, v.id, by.id, amt, 'lonca soygunu'); o.funds = (o.funds ?? 0) + amt; o.suspicion = clamp(o.suspicion + 8);
    rumor(w, `${ek(v.name, 'ın')} evi soyuldu! Gölgeler mi?`, v.id, 0);
    if (chance(w, 0.12 + o.suspicion / 300)) { const c = pick(w, helpers); if (c) arrest(w, c, 'hirsizlik', v.id, amt); return `Soygun yapıldı (${amt} Dinar) ama ${c?.name ?? 'biri'} yakalandı!`; }
    return `${v.name} soyuldu: ${amt} Dinar lonca kasasına.`;
  }
  if (deed === 'sabotaj') {
    if (o.kind === 'hirsiz') return 'Lonca siyasete karışmaz.';
    for (const p of w.people) if (p.prof === 'asker') p.loyalty = clamp(p.loyalty - 3);
    w.treasury = Math.max(0, w.treasury); const proj = (w.projects ?? []).find((x) => !x.done); if (proj) proj.progress = Math.max(0, proj.progress - 2);
    o.suspicion = clamp(o.suspicion + 12); { const kb = w.buildings.find((b) => b.id === 'kisla'); if (kb) startFire(w, kb, 'sabotaj: ateşe verildi'); }
    if (chance(w, 0.2 + o.suspicion / 250)) reveal(w, o, [by.id], 'Sabotajcılar görüldü');
    return 'Sabotaj başarılı: askerlerin morali düştü' + (proj ? ', şantiye gecikti.' : '.');
  }
  // ayaklanma
  if (o.kind === 'hirsiz') return 'Lonca ayaklanmaz.';
  const claimant = by.id === w.exKayzerId && w.regime === 'imparatorluk';
  if (w.regime !== 'imparatorluk' || !w.kayzerId) return 'Ayaklanacak bir taht yok.';
  const sh = republicShare(w); if (sh < REBEL_SHARE) return `Halk henüz hazır değil: halkın %${Math.round(sh * 100)}'i cumhuriyetçilikte 70+ (en az %50 gerekir).`;
  if (w.isyan) return 'Zaten isyan var.';
  void claimant;
  if (claimant && by.jailedDays > 0) { by.jailedDays = 0; log(w, `⛓ Asiler zindanı bastı ve ${ek(by.name, 'ı')} kurtardı!`, by.id); }
  startIsyanHook.fn(w); const iz = w.isyan as World['isyan']; if (iz) { o.actedDay = w.day; iz.leaderId = by.id; if (!iz.rebels.includes(by.id)) iz.rebels.push(by.id); for (const id of o.members) { const p = findPerson(w, id); if (p && p.republic >= REBEL_MIN && p.jailedDays === 0 && !iz.rebels.includes(id)) iz.rebels.push(id); } chronicle(w, 'isyan', `“${o.name}” ayaklanmayı başlattı.`); return '🔥 AYAKLANMA BAŞLADI! Saray’a yürüyün.'; }
  return 'Ayaklanma başlatılamadı.';
}
export function orgMeet(w: World, p: Person): string { const o = orgOf(w, p.id); if (!o) return 'Örgütte değilsiniz.'; if (o.leaderId !== p.id) return 'Toplantıyı lider çağırır.'; o.meetTonight = true; return 'Bu gece gizli toplantı var. Dikkat: bekçiler baskın yapabilir.'; }
export function assignSpy(w: World, k: Person, spy: Person, target: Person): string {
  if (k.id !== w.kayzerId) return 'Sadece Kayzer casus atar.'; if (spy.playerId && !spy.npc) return 'Oyunculara casusluk emri DM ile verilir.';
  if (!transfer(w, 'saray', spy.id, 15, 'casus ücreti')) return 'Hazine yetmiyor.';
  (w.spies ??= []).push({ spyId: spy.id, targetId: target.id, until: w.day + 5 }); return `${spy.name}, 5 gün boyunca ${ek(target.name, 'ı')} gizlice izleyecek (15 Dinar).`;
}
export function issueWarrant(w: World, by: Person, target: Person): string {
  if (by.id !== w.kayzerId && by.prof !== 'hakim') return 'Arama emrini Kayzer ya da Kadı verir.';
  const ws = (w.warrants ??= []); if (!ws.includes(target.id)) ws.push(target.id); return `${target.name} için arama emri çıkarıldı. Bekçiler evini arayabilir.`;
}
export function searchHouse(w: World, by: Person, target: Person): string {
  if (!['bekci', 'asker'].includes(by.prof) && by.id !== w.kayzerId) return 'Evi bekçi arar.';
  if (!(w.warrants ?? []).includes(target.id)) return 'Arama emri (Kayzer ya da Kadı) olmadan ev aranamaz!';
  w.warrants = w.warrants!.filter((x) => x !== target.id);
  const o = orgOf(w, target.id); const pl = (w.plots ?? []).find((x) => x.by === target.id && !x.done);
  if (!o && !pl) { relate(target, by, -15, 'evimi aradı, bir şey bulamadı'); return `${ek(target.name, 'ın')} evi arandı: hiçbir şey bulunamadı.`; }
  if (pl) { pl.exposed = true; arrest(w, target, pl.kind === 'darbe' ? 'isyan' : 'saldiri', pl.target, 0); }
  if (o) { reveal(w, o, [target.id, ...(chance(w, 0.6) ? o.members.filter((x) => x !== target.id).slice(0, 2) : [])], `${ek(target.name, 'ın')} evinde mektuplar bulundu`); arrest(w, target, CRIME_OF[o.kind], null, 0); }
  return `${ek(target.name, 'ın')} evinde ${o ? 'gizli örgüt mektupları' : ''}${o && pl ? ' ve ' : ''}${pl ? 'bir komplo planı' : ''} bulundu! Tutuklandı.`;
}
export function raidOrg(w: World, k: Person, id: string): string {
  if (k.id !== w.kayzerId) return 'Sadece Kayzer baskın emreder.'; const o = (w.orgs ?? []).find((x) => x.id === id); if (!o?.known) return 'Bilinen bir örgüt değil.';
  const caught = o.knownMembers.map((x) => findPerson(w, x)).filter((p): p is Person => !!p && p.jailedDays === 0);
  for (const p of caught) arrest(w, p, CRIME_OF[o.kind], null, 0); o.suspicion = clamp(o.suspicion + 15);
  if (o.kind === 'cumhuriyet') for (const p of w.people) if (p.republic > 50) p.republic = clamp(p.republic + 2); // martyrs
  const t = `⚔ Askerler Kayzer’in emriyle “${o.name}” üyelerine baskın yaptı: ${caught.length} kişi tutuklandı.`; log(w, t); chronicle(w, 'orgut', t); return t;
}
/** An arrested member may talk under interrogation. Called from arrest(). */
export function interrogate(w: World, p: Person): void {
  const o = orgOf(w, p.id); if (!o || !chance(w, p.honesty > 60 ? 0.6 : 0.4)) return;
  const others = o.members.filter((x) => x !== p.id && !o.knownMembers.includes(x)); reveal(w, o, [p.id, ...others.slice(0, 2)], `Sorguda ${p.name} konuştu`);
}
export function orgsDay(w: World): void {
  const orgs = (w.orgs ??= []);
  // NPCs found and join
  const fits = (p: Person, k: OrgKind): boolean => k === 'hirsiz' ? p.honesty < 30 : k === 'cumhuriyet' ? p.republic > 65 : p.din > 78;
  for (const k of ['hirsiz', 'cumhuriyet', 'tarikat'] as OrgKind[]) if (!orgs.some((o) => o.kind === k)) { const f = w.people.find((p) => !p.playerId && fits(p, k) && !orgOf(w, p.id) && p.ambition > 55 && p.jailedDays === 0); if (f && chance(w, 0.15)) orgFound(w, f, k, { hirsiz: 'Gölgeler', cumhuriyet: 'Hürriyet Ocağı', tarikat: 'Nur Halkası' }[k]); }
  // NPC members recruit friends (one try per org per day, harder as the org grows)
  for (const o of orgs) {
    const rec = findPerson(w, pick(w, o.members) ?? ''); if (!rec || rec.playerId || !chance(w, 0.35 / (1 + o.members.length / 5))) continue;
    const cand = w.people.filter((p) => !p.playerId && !orgOf(w, p.id) && p.jailedDays === 0 && p.id !== w.kayzerId && !STATE.includes(p.prof) && (rec.relations[p.id] ?? 0) > 5);
    const t = [...cand].sort((a, b) => joinScore(w, b, o, rec) - joinScore(w, a, o, rec))[0];
    if (t && joinScore(w, t, o, rec) >= 55) { orgJoin(w, t, o.id); const lp = findPerson(w, o.leaderId)?.playerId; if (lp) personal(w, lp, `🕯 ${rec.name}, ${ek(t.name, 'ı')} “${o.name}” cemiyetine kazandı.`); }
  }
  for (const o of orgs) {
    o.members = o.members.filter((id) => findPerson(w, id)); if (!findPerson(w, o.leaderId)) o.leaderId = o.members[0] ?? '';
    // effects
    for (const id of o.members) { const p = findPerson(w, id)!; if (o.kind === 'cumhuriyet') p.republic = clamp(p.republic + 0.25); if (o.kind === 'tarikat') p.din = clamp(p.din + 0.5); if (o.kind === 'hirsiz' && p.money < 30 && chance(w, 0.05)) { const v = pick(w, w.people.filter((x) => x.money > 80 && x.id !== p.id)); if (v) transfer(w, v.id, p.id, Math.min(15, v.money * 0.1), 'lonca hırsızlığı'); o.suspicion += 2; } }
    if (!w.people.some((p) => p.playerId && o.members.includes(p.id)) && chance(w, 0.25)) o.meetTonight = true; // NPC orgs meet now and then
    const look = o.members.filter((id) => o.roles?.[id] === 'casus').length; // gözcüler cover tracks
    o.suspicion = clamp(o.suspicion + o.members.length * 0.35 + (o.meetTonight ? 4 : 0) - 1 - look * 0.8);
    if (o.suspicion >= 60 && !o.known) reveal(w, o, [], 'Söylentiler yayıldı');
    // informants: paid, scared or conscience-driven
    for (const id of o.members) { const p = findPerson(w, id); if (!p || p.playerId) continue; const why = p.honesty > 70 && chance(w, 0.04) ? 'vicdanı rahat etmeyen bir muhbir' : o.known && chance(w, 0.04) ? 'korkan bir üye' : (w.informantPay ?? 0) > 0 && p.honesty < 45 && chance(w, 0.03) ? 'parayla konuşan bir muhbir' : null; if (why) { if (why.startsWith('parayla')) transfer(w, 'saray', p.id, w.informantPay ?? 10, 'muhbir ödülü'); reveal(w, o, [o.leaderId, ...o.members.filter((x) => x !== p.id).slice(0, 2)], `Muhbir (${why})`); break; } }
    // night meeting: bekçi raid?
    if (o.meetTonight) {
      o.meetTonight = false; const bekcis = w.people.filter((x) => x.prof === 'bekci' && x.jailedDays === 0).length;
      if (chance(w, Math.min(0.7, o.suspicion / 160 + bekcis * 0.03))) {
        const caught = o.members.map((x) => findPerson(w, x)).filter((p): p is Person => !!p && chance(w, 0.6)).slice(0, 5);
        reveal(w, o, caught.map((p) => p.id), 'Bekçiler gece toplantısını bastı');
        for (const p of caught) arrest(w, p, CRIME_OF[o.kind], null, 0);
      } else for (const id of o.members) { const p = findPerson(w, id); if (p) { p.mood = clamp(p.mood + 1); if (o.kind === 'cumhuriyet') p.republic = clamp(p.republic + 1.5); } }
    }
  }
  w.orgs = orgs.filter((o) => o.members.length);
  // spies tail suspects
  for (const s of (w.spies ??= [])) {
    const spy = findPerson(w, s.spyId); const t = findPerson(w, s.targetId); if (!spy || !t || spy.jailedDays > 0) continue;
    const o = orgOf(w, t.id); const pl = (w.plots ?? []).find((x) => x.by === t.id && !x.done && !x.exposed);
    if (pl && chance(w, 0.55)) { pl.exposed = true; const kp = findPerson(w, w.kayzerId)?.playerId; const txt = `🕵 Casus ${spy.name}: ${t.name} bir ${pl.kind === 'zehir' ? 'zehirleme' : pl.kind === 'darbe' ? 'DARBE' : 'iftira'} planı yapıyor! (hedef: ${findPerson(w, pl.target)?.name ?? '?'})`; if (kp) personal(w, kp, txt); log(w, `🕵 Saray’da bir komplo açığa çıktı!`); chronicle(w, 'entrika', txt); }
    if (o && chance(w, 0.45)) reveal(w, o, [t.id], `Casus ${spy.name} gece ${ek(t.name, 'ı')} izledi`);
    if (chance(w, 0.08)) { relate(t, spy, -40, 'beni gizlice izliyordu'); s.until = w.day; log(w, `👀 ${t.name}, ${ek(spy.name, 'ın')} kendisini izlediğini fark etti!`, t.id); }
  }
  w.spies = w.spies.filter((s) => s.until > w.day);
}
const STATE = ['asker', 'bekci', 'memur', 'tahsildar', 'savci', 'hakim', 'naip', 'kayzer'];

// ======================= Tarih Kitabı =======================
export interface Chronicle { day: number; reign: string; kind: string; text: string }
export function reignName(w: World): string { const k = findPerson(w, w.kayzerId); return w.regime === 'cumhuriyet' ? `Cumhuriyet${k ? ` (Başkan ${k.name})` : ''}` : k ? `${k.name} saltanatı` : 'Naiplik dönemi'; }
export function chronicle(w: World, kind: string, text: string): void {
  const h = (w.history ??= []); const t = text.replace(/^[^\p{L}\d“"]+/u, '').slice(0, 220);
  const last = h[h.length - 1]; if (last && (last.text === t || (last.day === w.day && last.text.slice(0, 14) === t.slice(0, 14)))) { if (last.day === w.day) last.text = t; return; }
  h.push({ day: w.day, reign: reignName(w), kind, text: t }); if (h.length > 600) h.splice(0, h.length - 600);
}
const MAJOR: [RegExp, string][] = [[/kanun|ferman|yasa(k|sı)|tasarı.*kabul/i, 'kanun'], [/İSYAN|ayaklandı|isyan (bastırıldı|kazandı)|CUMHURİYET/i, 'isyan'], [/evlendi/i, 'evlilik'], [/öldü|öldürüldü|CİNAYET|vefat/i, 'olum'], [/seçim|seçildi|Meclis’e girdi/i, 'secim'], [/savaş|sınırda|sınır baskını|darbe|tahta (çıktı|geçti)|tahtı/i, 'savas'], [/doğdu|bebek/i, 'dogum'], [/KURAKLIK|SALGIN|SEL|BEREKET/, 'doga'], [/unvan|Vezir|Paşa|Bey\b|Ağa\b/, 'unvan']];
/** Hooked into log(): major events go into the chronicle automatically. */
export function maybeChronicle(w: World, text: string): void { if (/oylamaya açıldı|teklif verdi|→ RET|günlük bütçe|propaganda|protesto/.test(text)) return; for (const [r, k] of MAJOR) if (r.test(text)) { chronicle(w, k, text); return; } }

// ======================= migration (schema 5) =======================
/** v1.9.1: make sure the town really has animals: a stocked seller and a few NPC farmers with herds. */
export function seedAnimals(w: World): void {
  let sel = w.people.find((p) => p.prof === 'hayvanci');
  if (!sel) { sel = w.people.find((p) => !p.playerId && p.prof === 'hamal') ?? w.people.find((p) => !p.playerId && p.prof === 'ciftci'); if (sel) { sel.prof = 'hayvanci'; log(w, `${sel.name} artık hayvan tüccarı: Hayvan Pazarı'nda inek, koyun, tavuk ve at satıyor.`, sel.id); } }
  if (sel) { sel.work = 'hayvan'; sel.farm = true; const hd = herd(sel); hd.inek = Math.max(hd.inek, 3); hd.koyun = Math.max(hd.koyun, 4); hd.tavuk = Math.max(hd.tavuk, 8); hd.at = Math.max(hd.at, 2); }
  const farmers = w.people.filter((p) => !p.playerId && p.prof === 'ciftci');
  const herds: Record<Animal, number>[] = [{ inek: 2, koyun: 3, tavuk: 6, at: 0 }, { inek: 1, koyun: 4, tavuk: 0, at: 1 }, { inek: 3, koyun: 0, tavuk: 8, at: 0 }, { inek: 0, koyun: 3, tavuk: 5, at: 0 }];
  farmers.slice(0, 4).forEach((p, i) => { const hd = herd(p); if (ANIMALS.some((a) => hd[a] > 0)) return; Object.assign(hd, herds[i]); p.farm = true; p.barn = { ahir: Math.ceil((hd.inek + hd.koyun + hd.at) / 6), kumes: hd.tavuk ? 1 : 0 }; p.inv.bugday = Math.max(p.inv.bugday, 20); });
}
export function placeHayvan(w: World): void {
  if (!w.buildings.some((b) => b.id === 'hayvan')) {
    const free = (x: number, y: number): boolean => x >= 1 && y >= 1 && x + 8 < 99 && y + 7 <= 48 && !w.buildings.some((o) => o.id !== 'hayvan' && x < o.x + o.w + 1 && x + 9 > o.x && y < o.y + o.h + 2 && y + 7 > o.y) && ![13, 20, 29, 35, 44].some((ry) => ry >= y && ry < y + 6) && ![6, 17, 29, 44, 56, 68, 80, 92].some((rx) => rx >= x && rx < x + 8);
    let spot: [number, number] | null = null;
    for (let r = 0; r < 40 && !spot; r++) for (let dx = -r; dx <= r && !spot; dx++) for (const dy of [-r, r, ...Array.from({ length: 2 * r - 1 }, (_, i) => i - r + 1)]) { if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; if (free(70 + dx, 37 + dy)) { spot = [70 + dx, 37 + dy]; break; } }
    const [x, y] = spot ?? [70, 37];
    w.buildings.push({ id: 'hayvan', name: 'Hayvan Pazarı', kind: 'hayvan', x, y, w: 8, h: 5, door: { x: x + 4, y: y + 5 }, market: false });
  }
}
/** v1.9.3: the pen sat on the houses at y=40; it now fits the empty strip between the road (y=35) and the houses (y=40), gate on the road side. */
export const PEN = { x: 70, y: 36, w: 8, h: 4 };
export function fixPen(w: World): void {
  const hv = w.buildings.find((b) => b.id === 'hayvan'); if (!hv) return;
  if (hv.x === PEN.x && hv.y === PEN.y && hv.h === PEN.h) hv.door = { x: PEN.x + 4, y: PEN.y };
  const clash = (x: number, y: number, ww: number, hh: number): boolean => w.buildings.some((o) => o !== hv && x < o.x + o.w && x + ww > o.x && y < o.y + o.h && y + hh > o.y);
  if (!clash(hv.x, hv.y, hv.w, hv.h) && hv.y + hv.h + 1 <= 48) return;
  if (!clash(PEN.x, PEN.y, PEN.w, PEN.h)) { Object.assign(hv, PEN); hv.door = { x: PEN.x + 4, y: PEN.y }; return; }
  for (let y = 1; y < 44; y++) for (let x = 1; x < 92; x++) if (!clash(x, y, 8, 4) && ![13, 20, 29, 35, 44].some((r) => r >= y && r < y + 4) && ![6, 17, 29, 44, 56, 68, 80, 92].some((r) => r >= x && r < x + 8)) { Object.assign(hv, { x, y, w: 8, h: 4 }); hv.door = { x: x + 4, y }; return; }
}
export function migrate10(w: World): World {
  w = migrate9(w); if ((w.schema ?? 1) >= 10) return w;
  fixPen(w); w.election.seats = w.meclis.seats.length; // the sign said “5 sandalye”
  for (const p of w.people) if (p.prof === 'hayvanci' && /^(Hamal|Çiftçi) /.test(p.name)) p.name = p.name.replace(/^\S+ /, 'Hayvancı '); // the seller kept his old job title
  for (const p of w.people) p.name = p.name.replace(/^(Kayzer )(Kayzer )+/, 'Kayzer '); // "Kayzer Kayzer Enes"
  w.schema = 10; return w;
}
export function migrate9(w: World): World {
  w = migrate8(w); if ((w.schema ?? 1) >= 9) return w;
  const hv = w.buildings.find((b) => b.id === 'hayvan');
  if (hv && hv.y + hv.h + 2 > 48) { w.buildings = w.buildings.filter((b) => b !== hv); placeHayvan(w); } // v1.9 placed it in the sea
  w.schema = 9; return w;
}
export function migrate8(w: World): World {
  w = migrate7(w); if ((w.schema ?? 1) >= 8) return w;
  seedAnimals(w); w.schema = 8; return w;
}
export function migrate7(w: World): World {
  w = migrate6(w); if ((w.schema ?? 1) >= 7) return w;
  migrateMeclis16(w); rehouse(w); for (const p of w.people) if (p.playerId && p.energy === undefined) p.energy = 80;
  w.schema = 7; return w;
}
export function migrate6(w: World): World {
  w = migrate5(w); if ((w.schema ?? 1) >= 6) return w;
  placeHayvan(w);
  for (const p of w.people) { if (p.prof === 'hayvanci') p.work = 'hayvan'; if (p.farm && !p.barn) { const hd = herd(p); p.barn = { ahir: Math.ceil((hd.inek + hd.koyun + hd.at) / BARN.ahir.cap), kumes: Math.ceil(hd.tavuk / BARN.kumes.cap) }; } }
  w.schema = 6; return w;
}
export function migrate5(w: World): World {
  if ((w.schema ?? 1) >= 5) return w;
  for (const g of GOODS) { if (w.prices[g] === undefined) w.prices[g] = ({ sut: 1, yumurta: 0.6 } as Partial<Record<Good, number>>)[g] ?? 1; if (w.market.sold[g] === undefined) w.market.sold[g] = 0; if (w.market.unmet[g] === undefined) w.market.unmet[g] = 0; }
  for (const p of w.people) { for (const g of GOODS) if (p.inv[g] === undefined) p.inv[g] = 0; p.hunger = Math.min(p.hunger ?? 0, 40); p.thirst = Math.min(p.thirst ?? 0, 40); }
  w.orgs ??= []; w.spies ??= []; w.plots ??= []; w.warrants ??= []; w.history ??= [];
  // an animal seller arrives in town (side job: farmhand)
  if (!w.people.some((p) => p.prof === 'hayvanci')) { const h = w.people.find((p) => !p.playerId && p.prof === 'hamal'); if (h) { h.prof = 'hayvanci'; h.work = 'ciftlik'; h.farm = true; h.animals = { inek: 3, koyun: 4, tavuk: 10, at: 1 }; log(w, `🐄 ${h.name} artık hayvan tüccarı: inek, koyun, tavuk ve at satıyor (Buğday Tarlaları).`); } }
  chronicle(w, 'baslangic', `Gün ${w.day}: Tarih Kitabı yazılmaya başlandı (${reignName(w)}).`);
  w.schema = 5; return w;
}

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
export const ANIMAL_LABEL: Record<Animal, string> = { inek: '🐄 İnek', koyun: '🐑 Koyun', tavuk: '🐔 Tavuk', at: '🐎 At' };
export const ANIMAL_PRICE: Record<Animal, number> = { inek: 120, koyun: 45, tavuk: 6, at: 150 };
export const ANIMAL_FEED: Record<Animal, number> = { inek: 2, koyun: 1, tavuk: 0.2, at: 2 }; // buğday per day
export const ANIMAL_MEAT: Record<Animal, number> = { inek: 8, koyun: 4, tavuk: 1, at: 0 };
export const FARM_PRICE = 250;
export const needsFarm = (a: Animal): boolean => a === 'inek' || a === 'koyun';
export const herd = (p: Person): Record<Animal, number> => (p.animals ??= { inek: 0, koyun: 0, tavuk: 0, at: 0 });
export const hasHorse = (p: Person): boolean => (p.animals?.at ?? 0) > 0;

export function buyFarm(w: World, p: Person): string {
  if (p.farm) return 'Zaten bir çiftliğiniz var.';
  if (!transfer(w, p.id, 'saray', FARM_PRICE, 'arsa / çiftlik tapusu')) return `Çiftlik arsası ${FARM_PRICE} Dinar.`;
  p.farm = true; log(w, `🏡 ${p.name} bir arsa alıp çiftlik kurdu.`, p.id); return 'Çiftlik kurdunuz! Artık inek ve koyun besleyebilirsiniz.';
}
export function buyAnimal(w: World, p: Person, a: Animal, n = 1): string {
  if (!ANIMALS.includes(a)) return 'Böyle hayvan yok.';
  if (needsFarm(a) && !p.farm) return `${ANIMAL_LABEL[a]} için önce bir çiftlik (arsa) almalısınız.`;
  const seller = w.people.find((x) => x.prof === 'hayvanci' && x.jailedDays === 0 && x.id !== p.id);
  const cost = ANIMAL_PRICE[a] * n;
  if (!transfer(w, p.id, seller?.id ?? 'saray', cost, `${a} alımı`)) return `${n} ${ANIMAL_LABEL[a]} ${cost} Dinar; paranız yetmiyor.`;
  if (seller) { seller.incomeToday += cost * 0.4; transfer(w, seller.id, 'dis', cost * 0.55, 'hayvan tedariki'); }
  herd(p)[a] += n; return `${n} ${ANIMAL_LABEL[a]} aldınız${seller ? ` (${seller.name})` : ''}. Günlük yem: ${ANIMAL_FEED[a] * n} buğday.`;
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
    const need = Math.ceil(feed);
    if (p.inv.bugday < need) buy(w, p.id, 'bugday', need - p.inv.bugday, p.money * 0.5);
    const fed = p.inv.bugday >= need; p.inv.bugday = Math.max(0, p.inv.bugday - need);
    if (!fed) { for (const a of ANIMALS) if (hd[a] > 0 && chance(w, 0.08)) { hd[a] -= 1; if (p.playerId) personal(w, p.playerId, `${ANIMAL_LABEL[a]} açlıktan öldü! Yem (buğday) alın.`); } continue; }
    const out: Partial<Record<Good, number>> = { sut: hd.inek * 3, yun: Math.floor(hd.koyun * 0.5 + (w.day % 2 ? 0.5 : 0)) * 1, yumurta: hd.tavuk };
    for (const [g, q] of Object.entries(out) as [Good, number][]) {
      if (!q) continue;
      if (p.npc || !p.playerId) addListing(w, p, g, q, sellerPrice(w, p, g), 'gida'); else p.inv[g] += q;
    }
  }
}
/** The animal seller keeps a little herd so the market has milk/eggs; buys stock when cheap. */
export function hayvanciDay(w: World): void {
  for (const p of w.people.filter((x) => x.prof === 'hayvanci' && x.npc !== false && !x.playerId)) { p.farm = true; const hd = herd(p); if (hd.inek < 3) hd.inek += 1; if (hd.tavuk < 10) hd.tavuk += 3; if (hd.koyun < 4) hd.koyun += 1; }
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
  const t = `👑 ${k.name}, ${p.name}'a ${old ? `${old} iken ` : ''}${rank} unvanı verdi${p.fief ? ` (tımar: ${w.buildings.find((b) => b.id === p.fief)?.name})` : ''}.`;
  log(w, t, p.id); chronicle(w, 'unvan', t); return t;
}
export function stripTitle(w: World, k: Person, p: Person): string {
  if (k.id !== w.kayzerId) return 'Sadece Kayzer.'; if (!p.rank) return 'Unvanı yok.';
  const r = p.rank; p.rank = null; p.fief = null; p.favor = clamp((p.favor ?? 50) - 35); p.loyalty = clamp(p.loyalty - 25); relate(p, k, -40, `${r} unvanımı aldı`);
  if (p.ambition > 60 && chance(w, 0.5)) p.plotting = 'coup';
  const t = `⚔ ${p.name}'ın ${r} unvanı geri alındı.`; log(w, t, p.id); chronicle(w, 'unvan', t); return t;
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
export interface Org { id: string; kind: OrgKind; name: string; leaderId: string; members: string[]; suspicion: number; known: boolean; knownMembers: string[]; meetTonight?: boolean; founded: number }
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
  if (!ORG_LABEL[kind]) return 'Böyle bir örgüt türü yok.'; if (orgOf(w, p.id)) return 'Zaten bir örgüttesiniz.';
  if (p.id === w.kayzerId) return 'Kayzer gizli örgüt kuramaz.';
  const o: Org = { id: nextId(w, 'O'), kind, name: name.trim().slice(0, 30) || ORG_LABEL[kind], leaderId: p.id, members: [p.id], suspicion: 5, known: false, knownMembers: [], founded: w.day };
  (w.orgs ??= []).push(o); return `“${o.name}” kuruldu. Liderisiniz. Gece toplantıları güç verir ama bekçi baskını riski taşır.`;
}
export function orgJoin(w: World, p: Person, id: string): string {
  const o = (w.orgs ?? []).find((x) => x.id === id); if (!o) return 'Örgüt yok.'; if (orgOf(w, p.id)) return 'Zaten bir örgüttesiniz.'; if (p.id === w.kayzerId) return 'Olmaz.';
  o.members.push(p.id); o.suspicion = clamp(o.suspicion + 1.5); const l = findPerson(w, o.leaderId); if (l) relate(l, p, 10, 'örgütümüze katıldı'); return `“${o.name}” örgütüne katıldınız.`;
}
export function orgLeave(w: World, p: Person): string { const o = orgOf(w, p.id); if (!o) return 'Örgütte değilsiniz.'; o.members = o.members.filter((x) => x !== p.id); if (o.leaderId === p.id) o.leaderId = o.members[0] ?? ''; if (!o.members.length) w.orgs = w.orgs!.filter((x) => x !== o); return 'Örgütten ayrıldınız.'; }
export function orgMeet(w: World, p: Person): string { const o = orgOf(w, p.id); if (!o) return 'Örgütte değilsiniz.'; if (o.leaderId !== p.id) return 'Toplantıyı lider çağırır.'; o.meetTonight = true; return 'Bu gece gizli toplantı var. Dikkat: bekçiler baskın yapabilir.'; }
export function assignSpy(w: World, k: Person, spy: Person, target: Person): string {
  if (k.id !== w.kayzerId) return 'Sadece Kayzer casus atar.'; if (spy.playerId && !spy.npc) return 'Oyunculara casusluk emri DM ile verilir.';
  if (!transfer(w, 'saray', spy.id, 15, 'casus ücreti')) return 'Hazine yetmiyor.';
  (w.spies ??= []).push({ spyId: spy.id, targetId: target.id, until: w.day + 5 }); return `${spy.name}, 5 gün boyunca ${target.name}'ı gizlice izleyecek (15 Dinar).`;
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
  if (!o && !pl) { relate(target, by, -15, 'evimi aradı, bir şey bulamadı'); return `${target.name}'ın evi arandı: hiçbir şey bulunamadı.`; }
  if (pl) { pl.exposed = true; arrest(w, target, pl.kind === 'darbe' ? 'isyan' : 'saldiri', pl.target, 0); }
  if (o) { reveal(w, o, [target.id, ...(chance(w, 0.6) ? o.members.filter((x) => x !== target.id).slice(0, 2) : [])], `${target.name}'ın evinde mektuplar bulundu`); arrest(w, target, CRIME_OF[o.kind], null, 0); }
  return `${target.name}'ın evinde ${o ? 'gizli örgüt mektupları' : ''}${o && pl ? ' ve ' : ''}${pl ? 'bir komplo planı' : ''} bulundu! Tutuklandı.`;
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
  for (const p of w.people) if (!p.playerId && !orgOf(w, p.id) && p.jailedDays === 0 && p.id !== w.kayzerId && !STATE.includes(p.prof)) { const o = orgs.find((x) => fits(p, x.kind)); if (o && chance(w, 0.008 / (1 + o.members.length / 6))) orgJoin(w, p, o.id); }
  for (const o of orgs) {
    o.members = o.members.filter((id) => findPerson(w, id)); if (!findPerson(w, o.leaderId)) o.leaderId = o.members[0] ?? '';
    // effects
    for (const id of o.members) { const p = findPerson(w, id)!; if (o.kind === 'cumhuriyet') p.republic = clamp(p.republic + 0.25); if (o.kind === 'tarikat') p.din = clamp(p.din + 0.5); if (o.kind === 'hirsiz' && p.money < 30 && chance(w, 0.05)) { const v = pick(w, w.people.filter((x) => x.money > 80 && x.id !== p.id)); if (v) transfer(w, v.id, p.id, Math.min(15, v.money * 0.1), 'lonca hırsızlığı'); o.suspicion += 2; } }
    if (!w.people.some((p) => p.playerId && o.members.includes(p.id)) && chance(w, 0.25)) o.meetTonight = true; // NPC orgs meet now and then
    o.suspicion = clamp(o.suspicion + o.members.length * 0.35 + (o.meetTonight ? 4 : 0) - 1);
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
    if (o && chance(w, 0.45)) reveal(w, o, [t.id], `Casus ${spy.name} gece ${t.name}'ı izledi`);
    if (chance(w, 0.08)) { relate(t, spy, -40, 'beni gizlice izliyordu'); s.until = w.day; log(w, `👀 ${t.name}, ${spy.name}'ın kendisini izlediğini fark etti!`, t.id); }
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

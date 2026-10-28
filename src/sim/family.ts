import { ek } from './tr';
import { freeSpots, houses } from './housing';
/**
 * Marriage & family: proposals, weddings, shared household, children (only above a prosperity threshold),
 * ageing bebek → çocuk → genç → yetişkin, schooling, illness, orphans, inheritance and dynastic succession.
 */
import type { Child, Person, Profession, World } from './types';
import { BASE_PRICE, PROF_LABEL } from './constants';
import { transfer } from './economy';
import { chance, clamp, nextId, pick, rand, randInt } from './rng';
import { findPerson, makePerson, makeNewcomer, WORKPLACE } from './world';
import { log, isOnline, personal } from './log';
import { chronicle } from './realm';
import { ADULT_YEARS, yearsOf, fertility, deathChance, isBirthday } from './age';
import { DAYS_PER_YEAR } from './constants';

export const ADULT_AGE = ADULT_YEARS * DAYS_PER_YEAR; // game days (16 years)
export const CHILD_UPKEEP = 3; // Dinar per child per day
export const SCHOOL_FEE = 1;
export const CURE_FEE = 8;
export const PREGNANCY_DAYS = Math.max(1, Math.round(DAYS_PER_YEAR * 0.75)); // ~9 months
export const WEDDING_COST = 20;
export const PROSPERITY_MONEY = 300; // household savings needed for a child
const MAX_CHILDREN = 4;

export type Stage = 'bebek' | 'cocuk' | 'genc' | 'yetiskin';
export const STAGE_LABEL: Record<Stage, string> = { bebek: 'Bebek/Çocuk', cocuk: 'Çocuk', genc: 'Genç', yetiskin: 'Yetişkin' };
/** Age in YEARS (v2.0.1). */
export function age(w: World, x: { born: number }): number { return yearsOf(w, x); }
export function stage(w: World, x: { born: number }): Stage {
  const y = yearsOf(w, x); return y < 7 ? 'bebek' : y < ADULT_YEARS ? 'genc' : 'yetiskin';
}
export const findChild = (w: World, id: string | null | undefined): Child | undefined => (id ? w.children.find((c) => c.id === id) : undefined);
export const nameOf = (w: World, id: string | null | undefined): string => findPerson(w, id)?.name ?? findChild(w, id)?.name ?? '?';

/** Adult persons and minors whose parents include `id`, eldest first. */
export function childrenOf(w: World, id: string): { id: string; born: number; adult: boolean }[] {
  return [
    ...w.people.filter((p) => p.parents.includes(id)).map((p) => ({ id: p.id, born: p.born, adult: true })),
    ...w.children.filter((c) => c.parents.includes(id)).map((c) => ({ id: c.id, born: c.born, adult: false })),
  ].sort((a, b) => a.born - b.born);
}
export function ancestorsOf(w: World, id: string, depth = 6): string[] {
  const out: string[] = []; let frontier = [id];
  for (let d = 0; d < depth && frontier.length; d += 1) {
    const next: string[] = [];
    for (const f of frontier) { const par = findPerson(w, f)?.parents ?? findChild(w, f)?.parents ?? []; for (const p of par) if (!out.includes(p)) { out.push(p); next.push(p); } }
    frontier = next;
  }
  return out;
}
/** Hanedan hakkı: the founder and every descendant of the dynasty seat. */
export function isHanedan(w: World, id: string): boolean {
  const roots = [w.founderPersonId, w.hanedanId].filter(Boolean) as string[];
  return roots.includes(id) || ancestorsOf(w, id).some((a) => roots.includes(a));
}

const adultFree = (w: World, p: Person | undefined): boolean => !!p && !p.spouse && p.prof !== 'naip' && stage(w, p) === 'yetiskin';

export function proposeMarriage(w: World, from: Person, to: Person, playerDecides: (p: Person) => boolean): string {
  if (from.id === to.id) return 'Kendinizle evlenemezsiniz.';
  if (from.female === to.female) return 'Evlilik sadece bir erkek ile bir kadın arasında olur.';
  if (!adultFree(w, from)) return 'Zaten evlisiniz.';
  if (!adultFree(w, to)) return `${to.name} evli ya da evlenemez.`;
  if (from.parents.some((x) => to.parents.includes(x)) || from.parents.includes(to.id) || to.parents.includes(from.id)) return 'Akrabalar evlenemez.';
  if (w.proposals.some((x) => x.kind === 'evlilik' && x.from === from.id)) return 'Bekleyen bir teklifiniz var.';
  if (playerDecides(to)) {
    w.proposals.push({ id: nextId(w, 'E'), kind: 'evlilik', from: from.id, to: to.id, day: w.day });
    log(w, `${from.name}, ${ek(to.name, 'a')} evlenme teklif etti.`, to.id);
    return `Teklif ${ek(to.name, 'a')} iletildi; cevabını bekleyin.`;
  }
  const s = (to.relations[from.id] ?? 0) + to.mood / 2 + (from.money > 150 ? 10 : 0) + (from.soylu || from.id === w.kayzerId ? 25 : 0) + rand(w) * 30;
  if (s < 45) { to.relations[from.id] = clamp((to.relations[from.id] ?? 0) - 3, -100, 100); return `${to.name} teklifi nazikçe reddetti.`; }
  wed(w, from, to); return `${to.name} “evet” dedi! Düğün yapıldı.`;
}

export function answerProposal(w: World, me: Person, id: string, accept: boolean): string {
  const pr = w.proposals.find((x) => x.id === id && x.to === me.id); if (!pr) return 'Teklif yok.';
  w.proposals = w.proposals.filter((x) => x !== pr);
  const from = findPerson(w, pr.from);
  if (pr.kind === 'evlilik') {
    if (!accept || !from) { if (from) log(w, `${me.name}, ${ek(from.name, 'ın')} evlenme teklifini reddetti.`, from.id); return 'Teklif reddedildi.'; }
    if (!adultFree(w, from) || !adultFree(w, me)) return 'Artık evlenemezsiniz.';
    if (from.female === me.female) return 'Evlilik sadece bir erkek ile bir kadın arasında olur.';
    wed(w, from, me); return 'Evlendiniz! Mutluluklar.';
  }
  if (!accept || !from || from.spouse !== me.id) return 'Çocuk teklifi reddedildi.';
  return conceive(w, from, me);
}

/** Wedding: shared home (the Saray if one is the Kayzer: the spouse becomes soylu), festivities paid to the imam. */
export function wed(w: World, a: Person, b: Person): void {
  if (a.female === b.female) return;
  a.spouse = b.id; b.spouse = a.id;
  { const hus = a.female ? b : a, wife = a.female ? a : b; const sn = hus.profile?.surname; if (sn) setSurname(w, wife, sn); }
  const imam = w.people.find((p) => p.prof === 'imam' && p.jailedDays === 0);
  for (const x of [a, b]) { const c = Math.min(WEDDING_COST / 2, x.money); if (c > 0) transfer(w, x.id, imam?.id ?? 'saray', c, 'düğün'); x.mood = clamp(x.mood + 15); }
  a.relations[b.id] = 80; b.relations[a.id] = 80;
  const royal = [a, b].find((x) => x.id === w.kayzerId && w.regime === 'imparatorluk');
  if (royal) { const sp = royal === a ? b : a; sp.soylu = true; sp.home = 'saray'; royal.home = 'saray'; }
  else { const host = a.home.startsWith('ev') || b.home === 'kisla' ? a : b; const other = host === a ? b : a; if (other.home !== 'saray') { if (host.home.startsWith('ev') && freeSpots(w, host.home) <= 0) { const to = houses(w).find((x) => freeSpots(w, x.id) >= 2); if (to) { host.home = to.id; other.home = to.id; } } else other.home = host.home; } }
  log(w, `${a.name} ile ${b.name} evlendi! ${royal ? 'Saray düğünü: yeni eş artık soylu ve sarayda yaşıyor.' : 'Bütün mahalle düğüne geldi.'}`, a.id);
  for (const x of w.people) if (x.home === a.home && x !== a && x !== b) x.mood = clamp(x.mood + 1);
}

export function divorce(w: World, me: Person): string {
  const sp = findPerson(w, me.spouse); if (!sp) return 'Evli değilsiniz.';
  me.spouse = null; sp.spouse = null;
  const total = me.money + sp.money; const half = total / 2; // property split: equalise savings
  if (me.money > half) transfer(w, me.id, sp.id, me.money - half, 'boşanma payı'); else if (sp.money > half) transfer(w, sp.id, me.id, sp.money - half, 'boşanma payı');
  for (const g of Object.keys(me.inv) as (keyof Person['inv'])[]) { const t = me.inv[g] + sp.inv[g]; me.inv[g] = Math.ceil(t / 2); sp.inv[g] = Math.floor(t / 2); }
  me.relations[sp.id] = -30; sp.relations[me.id] = -30; me.mood = clamp(me.mood - 10); sp.mood = clamp(sp.mood - 15);
  // the one who isn't head of state / doesn't own the home leaves
  const leaver = sp.id === w.kayzerId ? me : sp; if (leaver.soylu && leaver.home === 'saray') { leaver.soylu = false; }
  if (leaver.home === 'saray' || leaver.home === (leaver === me ? sp.home : me.home)) leaver.home = emptiestHouse(w);
  if (w.regentId === leaver.id) { w.regentId = null; w.regentFor = null; }
  log(w, `${me.name} ile ${sp.name} boşandı; mallar paylaşıldı.`, me.id);
  return 'Boşandınız; mallar ikiye bölündü.';
}
export function emptiestHouse(w: World): string {
  const houses = w.buildings.filter((b) => b.kind === 'ev'); const counts = new Map<string, number>();
  for (const x of w.people) counts.set(x.home, (counts.get(x.home) ?? 0) + 1);
  return [...houses].sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0))[0]?.id ?? 'ev1';
}

/** Prosperity threshold for a child: household savings + income, both fed, city food secure, not too crowded. */
export function canHaveChild(w: World, a: Person, b: Person, npc = false): string | null {
  const kids = childrenOf(w, a.id).filter((k) => !k.adult).length;
  if (kids >= MAX_CHILDREN) return 'Bu evde yeterince çocuk var.';
  if (fertility(w, a, b) <= 0) return 'Bu yaşta çocuk olmaz (kadınlar 16–45 yaş arası; erkeklerde 60’tan sonra azalır).';
  const need = npc ? 100 + kids * 40 : PROSPERITY_MONEY + kids * 100; /* NPC households have smaller savings; the city must renew itself */
  if (a.money + b.money < need) return `Çocuk için hanede en az ${need} Dinar birikim gerekir.`;
  if (a.hunger > 45 || b.hunger > 45) return 'Hane tok değil; önce karnınızı doyurun.';
  if (a.jailedDays > 0 || b.jailedDays > 0) return 'Zindandayken olmaz.';
  if (!foodSecure(w)) return 'Şehirde ekmek kıtlığı var; şimdi çocuk zor beslenir.';
  if (w.pregnancies.some((p) => p.parents.includes(a.id))) return 'Zaten bir bebek yolda.';
  return null;
}
export function foodSecure(w: World): boolean {
  const pop = w.people.length + w.children.length;
  return w.market.unmet.ekmek <= 2 && pop < 140 && w.prices.ekmek < 2.5;
}

export function requestChild(w: World, me: Person, playerDecides: (p: Person) => boolean): string {
  const sp = findPerson(w, me.spouse); if (!sp) return 'Önce evlenmelisiniz.';
  const err = canHaveChild(w, me, sp); if (err) return err;
  if (playerDecides(sp)) {
    if (w.proposals.some((x) => x.kind === 'cocuk' && x.from === me.id)) return 'Eşinizin cevabını bekleyin.';
    w.proposals.push({ id: nextId(w, 'E'), kind: 'cocuk', from: me.id, to: sp.id, day: w.day }); return 'Eşinize soruldu.';
  }
  if (sp.mood < 35) return `${sp.name} şimdi hazır değil.`;
  return conceive(w, me, sp);
}
function conceive(w: World, a: Person, b: Person): string {
  const err = canHaveChild(w, a, b); if (err) return err;
  if (rand(w) > fertility(w, a, b)) return 'Bu sefer olmadı; bir süre sonra yeniden deneyin.';
  w.pregnancies.push({ parents: [a.id, b.id], due: w.day + PREGNANCY_DAYS });
  log(w, `${a.name} ile ${b.name} bir bebek bekliyor!`, a.id);
  return `Müjde! ${PREGNANCY_DAYS} gün sonra bebeğiniz doğacak.`;
}

const ERKEK = ['Kerem', 'Emir', 'Yiğit', 'Alp', 'Aras', 'Batu', 'Deniz', 'Efe', 'Mert', 'Kaan', 'Tuna', 'Oğuz'];
const KIZ = ['Defne', 'Elif', 'Ece', 'Asya', 'Nehir', 'Zeynep', 'Lale', 'Su', 'Ada', 'Selin', 'Duru', 'İpek'];
function birth(w: World, parents: string[]): Child | null {
  const [a, b] = parents.map((id) => findPerson(w, id)); if (!a) return null;
  const female = rand(w) < 0.5; const mix = (x: number, y: number): number => Math.round(clamp((x + y) / 2 + (rand(w) - 0.5) * 30));
  const royal = parents.includes(w.kayzerId ?? '-') || !!a.soylu || !!b?.soylu || parents.some((x) => isHanedan(w, x));
  const father = [a, b].find((x) => x && !x.female); const last = father?.profile?.surname ?? a.profile?.surname ?? a.name.replace(/\(.*?\)/g, '').trim().split(' ').filter((x) => !['Kayzer', 'Usta', 'Efendi', 'Hanım', 'Ağa', 'Kalfa', 'Asker', 'Bekçi', 'Hekim', 'Tüccar', 'Hamal', 'Fırıncı', 'Kalemşör', 'Öğretmen', 'Savcı', 'Hâkim'].includes(x)).pop() ?? 'Ana';
  const sur = father?.profile?.surname; /* v2.0.1: children carry the father's soyadı */
  const c: Child = {
    id: nextId(w, 'c'), name: `${pick(w, female ? KIZ : ERKEK)}${royal ? ' Şehzade'.replace('Şehzade', female ? 'Sultan' : 'Şehzade') : ''} ${royal ? '' : sur ? sur : `(${last})`}`.replace(/\s+/g, ' ').trim(), ...(sur ? { surname: sur } : {}),
    female, born: w.day, parents, honesty: mix(a.honesty, b?.honesty ?? a.honesty), ambition: mix(a.ambition, b?.ambition ?? a.ambition),
    hairColor: rand(w) < 0.5 ? a.hairColor : b?.hairColor ?? a.hairColor, skin: rand(w) < 0.5 ? a.skin : b?.skin ?? a.skin, shirt: randInt(w, 0, 7),
    school: 0, inSchool: false, sick: 0, hunger: 0, orphan: false, soylu: royal,
  };
  w.children.push(c); for (const p of [a, b]) if (p) p.mood = clamp(p.mood + 12);
  log(w, `${a.name}${b ? ` ile ${b.name}` : ''} ailesine bir ${female ? 'kız' : 'erkek'} bebek doğdu: ${c.name}.`, a.id);
  return c;
}

/** Daily family life (end of day). */
export function familyDay(w: World, npcDecides: (p: Person) => boolean, now: number): void {
  settleEstates(w);
  // births
  for (const pg of w.pregnancies.filter((x) => x.due <= w.day)) birth(w, pg.parents);
  w.pregnancies = w.pregnancies.filter((x) => x.due > w.day);
  w.proposals = w.proposals.filter((x) => w.day - x.day <= 3);
  // NPC romance & family planning
  const singles = w.people.filter((p) => npcDecides(p) && adultFree(w, p) && p.jailedDays === 0 && p.home !== 'kisla' && p.id !== w.kayzerId);
  // v2.0.1 demography: generations turn over (1 year = 5 days), so newcomers arrive with the caravans when the city shrinks
  w.popTarget ??= Math.max(100, w.people.length);
  { const dear = w.prices.ekmek > BASE_PRICE.ekmek * 1.6; /* nobody moves to a city with dear bread */ const deficit = dear ? 0 : w.popTarget - w.people.length; const n = deficit > 0 ? Math.min(2, Math.ceil(deficit / 15)) : 0;
    for (let i = 0; i < n; i++) if (chance(w, 0.6)) { const home = emptiestHouse(w); const p = makeNewcomer(w, 18 + rand(w) * 17, home); w.people.push(p); if (w.treasury > 500) transfer(w, 'saray', p.id, 10, 'göçmen yardımı'); log(w, `🧳 ${p.name} kervanla şehre göç etti (${PROF_LABEL[p.prof]}).`, p.id); } }
  for (const p of singles) if (!p.spouse && chance(w, 0.03)) {
    const o = singles.find((x) => x !== p && !x.spouse && x.female !== p.female && (x.relations[p.id] ?? 0) > -10);
    if (o) wed(w, p, o);
  }
  for (const p of w.people) {
    const sp = findPerson(w, p.spouse);
    if (!sp || p.id > sp.id || !npcDecides(p) || !npcDecides(sp)) continue;
    if (!canHaveChild(w, p, sp, true) && chance(w, 0.04)) conceive(w, p, sp);
  }
  // children: upkeep, school, illness, growing up
  for (const c of [...w.children]) {
    const parents = c.parents.map((id) => findPerson(w, id)).filter((x): x is Person => !!x);
    c.orphan = parents.length === 0;
    const payer = [...parents].sort((a, b) => b.money - a.money)[0];
    const fee = CHILD_UPKEEP + (c.inSchool ? SCHOOL_FEE : 0);
    let fed = false;
    if (payer && payer.money >= fee) { fed = buyFood(w, payer, c, fee); }
    else if (c.orphan) { const baker = w.people.find((p) => p.prof === 'firinci' && p.jailedDays === 0); fed = !!baker && transfer(w, 'saray', baker.id, fee, 'yetim bakımı (devlet)'); }
    c.hunger = fed ? 0 : clamp(c.hunger + 30);
    if (!fed && payer) payer.mood = clamp(payer.mood - 4);
    const st = stage(w, c);
    if (c.inSchool && st === 'genc' && fed) c.school += 1;
    if (st !== 'genc') c.inSchool = false;
    // NPC parents send kids to school if they can afford it
    if (!c.inSchool && st === 'genc' && (c.orphan || (payer && npcDecides(payer) && payer.money > 120))) c.inSchool = true;
    // v2.0.1: a genç not at school works as an apprentice (çırak) for half a hamal's pay, paid by a master to the household
    if (st === 'genc' && !c.inSchool && fed && payer) { const master = w.people.find((p) => ['demirci', 'marangoz', 'terzi', 'firinci'].includes(p.prof) && p.money > 30 && p.jailedDays === 0 && !p.parents.includes(c.id)); if (master && transfer(w, master.id, payer.id, 3, `çırak ücreti (${c.name})`)) c.apprentice = (c.apprentice ?? 0) + 1; }
    // illness
    if (c.sick > 0) {
      c.sick += 1;
      const healer = w.people.find((p) => p.prof === 'hekim' && p.jailedDays === 0);
      const auto = payer && npcDecides(payer) && payer.money > CURE_FEE + 10;
      if (healer && (auto || (c.orphan && w.treasury > CURE_FEE))) { cureChild(w, c, auto ? payer! : null); }
      else if (c.sick > 6) { removeChild(w, c, `${c.name} hastalıktan kurtulamadı. Şehir yasta.`); continue; }
    } else if (chance(w, (c.hunger > 40 ? 0.15 : 0.02) * (w.nature?.kind === 'salgin' ? (st === 'bebek' ? 6 : 3) : 1))) { c.sick = 1; for (const p of parents) if (p.playerId) log(w, `${c.name} hastalandı! Hekime götürün.`, p.id); }
    if (st === 'yetiskin') growUp(w, c);
  }
  // natural deaths of very old NPCs (players never die of age)
  // v2.0.1 natural death: rolled once per year of age, at each birthday (NPCs and players alike; Maecenas excepted)
  for (const p of [...w.people]) if (p.prof !== 'naip' && isBirthday(w, p) && rand(w) < deathChance(yearsOf(w, p))) die(w, p, `${p.name} ${yearsOf(w, p)} yaşında, ihtiyarlıktan hayata gözlerini yumdu.`);
  // a minor heir comes of age → the regency ends
  if (w.regentFor && !findChild(w, w.regentFor) && findPerson(w, w.regentFor)) {
    const heir = findPerson(w, w.regentFor)!; const reg = findPerson(w, w.regentId);
    w.kayzerId = heir.id; heir.prof = 'kayzer'; heir.work = 'saray'; heir.home = 'saray'; heir.soylu = true;
    if (reg && reg.prof === 'kayzer') { reg.prof = 'memur'; reg.work = 'saray'; }
    log(w, `${heir.name} reşit oldu ve tahta çıktı! ${reg?.name ?? ''} naipliği sona erdi.`, heir.id);
    w.regentId = null; w.regentFor = null;
  }
  void now; void isOnline;
}
function buyFood(w: World, payer: Person, c: Child, fee: number): boolean {
  // upkeep is spent at the market (bakkal), keeping money circulating to bakers
  const baker = w.people.find((p) => p.prof === 'firinci' && p.jailedDays === 0);
  const ok = transfer(w, payer.id, baker?.id ?? 'saray', CHILD_UPKEEP, 'çocuk bakımı');
  if (ok && c.inSchool) { const hoca = w.people.find((p) => p.prof === 'hoca' && p.jailedDays === 0); transfer(w, payer.id, hoca?.id ?? 'saray', fee - CHILD_UPKEEP, 'okul ücreti'); }
  return ok;
}

export function cureChild(w: World, c: Child, payer: Person | null): string {
  if (c.sick <= 0) return 'Çocuk hasta değil.';
  const healer = w.people.find((p) => p.prof === 'hekim' && p.jailedDays === 0); if (!healer) return 'Şehirde hekim yok!';
  if (!transfer(w, payer?.id ?? 'saray', healer.id, CURE_FEE, 'çocuk tedavisi')) return 'Hekim parası yetmiyor.';
  c.sick = 0; healer.incomeToday += CURE_FEE; log(w, `${healer.name}, ${ek(c.name, 'ı')} iyileştirdi.`, payer?.id);
  return `${c.name} iyileşti.`;
}

function removeChild(w: World, c: Child, text: string): void {
  w.children = w.children.filter((x) => x !== c); if (w.veliaht === c.id) w.veliaht = null;
  for (const id of c.parents) { const p = findPerson(w, id); if (p) p.mood = clamp(p.mood - 30); }
  log(w, text, c.parents[0]);
}

/** Coming of age: a new adult NPC (same id), inheriting traits; school opens better professions. Claimable by new players. */
export function growUp(w: World, c: Child): Person {
  const par = c.parents.map((id) => findPerson(w, id)).filter((x): x is Person => !!x);
  const good: Profession[] = ['memur', 'hoca', 'hekim', 'kalemsor', 'tuccar'];
  const prof: Profession = c.school >= 25 && chance(w, 0.5) ? pick(w, good) : c.school >= 25 ? pick(w, ['terzi', 'demirci', 'marangoz', 'firinci', 'balikci'] as Profession[]) : c.school >= 10 ? pick(w, ['terzi', 'demirci', 'marangoz', 'firinci'] as Profession[]) : (par[0] && par[0].prof !== 'kayzer' && par[0].prof !== 'naip' && par[0].prof !== 'asker' ? par[0].prof : 'hamal');
  const home = c.soylu && c.parents.includes(w.kayzerId ?? '-') ? 'saray' : par[0]?.home && par[0].home !== 'saray' && par[0].home !== 'kisla' ? par[0].home : emptiestHouse(w);
  const p = makePerson(w, { name: c.name, prof, female: c.female, honesty: c.honesty, ambition: c.ambition, money: 0, loyalty: Math.round(par.reduce((s, x) => s + x.loyalty, 60) / (par.length + 1)) }, home);
  w.idSeq -= 1; p.id = c.id; p.born = c.born; p.parents = c.parents; p.school = c.school; p.soylu = c.soylu;
  if (c.surname) p.profile = { surname: c.surname }; p.hairColor = c.hairColor; p.skin = c.skin; p.shirt = c.shirt; p.republic = Math.round(par.reduce((s, x) => s + x.republic, 0) / Math.max(1, par.length) * 0.7);
  p.work = WORKPLACE[prof];
  w.children = w.children.filter((x) => x !== c); w.people.push(p);
  for (const x of par) { const gift = Math.min(40, x.money * 0.1); if (gift > 1) transfer(w, x.id, p.id, gift, 'harçlık'); p.relations[x.id] = 60; x.relations[p.id] = 60; }
  log(w, `${p.name} büyüdü, artık yetişkin: ${PROF_LABEL[prof]}${c.school >= 25 ? ' (okul sayesinde)' : ''}.`, p.id);
  return p;
}

/**
 * v2.0.1 death with inheritance (NPCs and players, any cause):
 * adult children (16+) split the money equally; the heir (a player's chosen child, else the eldest) gets the house,
 * the house sandık, the Çanta and the weapons. No adult child → the spouse gets everything; nobody → the hazine.
 * A Kayzer's throne passes to the heir (minor → regent), or to Maecenas. A player's account is never deleted:
 * w.players[id].dead holds the funeral/vasiyet state until he continues as a child or creates a new character.
 */
export function die(w: World, p: Person, text: string): void {
  const sp = findPerson(w, p.spouse); const years = yearsOf(w, p);
  const adults = w.people.filter((x) => x.parents.includes(p.id) && x !== p && yearsOf(w, x) >= ADULT_YEARS).sort((a, b) => a.born - b.born);
  const heir = adults[0] ?? sp ?? null; // receives house, sandık, Çanta, weapons (a player may later pick another child)
  if (p.money > 20) transfer(w, p.id, 'saray', Math.round(p.money * 0.1 * 100) / 100, 'miras vergisi (%10)');
  if (p.money > 0) {
    if (adults.length) { const share = Math.floor((p.money / adults.length) * 100) / 100; for (const a of adults) transfer(w, p.id, a.id, share, 'miras'); }
    else if (sp) transfer(w, p.id, sp.id, p.money, 'miras (eşe)');
  }
  if (p.money > 0) transfer(w, p.id, 'saray', p.money, adults.length || sp ? 'miras kırıntısı hazineye' : 'mirassız mal hazineye');
  const houses = w.buildings.filter((b) => b.ownerId === p.id).map((b) => b.id);
  const estate = { houses, inv: { ...p.inv }, arms: { ...(p.arms ?? {}) } };
  for (const g of Object.keys(p.inv) as (keyof Person['inv'])[]) p.inv[g] = 0; p.arms = {}; p.drawn = null;
  const pl = p.playerId && !p.npc ? w.players[p.playerId] : undefined;
  const free = adults.filter((a) => !a.playerId || a.npc);
  if (pl && free.length) { // the player chooses which child inherits house/sandık/Çanta → park the estate (goods only; money is already shared)
    pl.dead = { day: w.day, name: p.name, years, text, heirs: free.map((a) => a.id), estate };
    for (const b of w.buildings) if (b.ownerId === p.id) b.ownerId = undefined;
  } else {
    giveEstate(w, p.id, estate, heir);
    if (pl) pl.dead = { day: w.day, name: p.name, years, text, heirs: [] };
  }
  w.armsReg = (w.armsReg ?? []).filter((r) => r.ownerId !== p.id);
  for (const l of w.listings) if (l.sellerId === p.id) l.sellerId = heir?.id ?? 'saray';
  if (sp) { sp.spouse = null; sp.mood = clamp(sp.mood - 25); }
  // throne
  let throne = '';
  if (w.kayzerId === p.id) throne = succeedOnDeath(w, p) ?? '';
  w.people = w.people.filter((x) => x !== p);
  if (w.regentId === p.id) { w.regentId = null; }
  for (const s of w.meclis.seats) if (s.holder === p.id) s.holder = null;
  if (w.isyan) w.isyan.rebels = w.isyan.rebels.filter((id) => id !== p.id);
  if (p.playerId) { p.playerId = null; }
  log(w, text, sp?.id ?? adults[0]?.id);
  const funeral = `🕯 Cenaze: ${p.name} (${years} yaşında) toprağa verildi.${adults.length ? ` Mirasçıları: ${adults.map((a) => a.name).join(', ')}.` : sp ? ` Malları eşi ${sp.name}’e kaldı.` : ' Mirasçısı olmadığından malları hazineye kaldı.'}${throne ? ' ' + throne : ''}`;
  log(w, funeral, sp?.id ?? adults[0]?.id);
  for (const x of [sp, ...adults]) if (x?.playerId && !x.npc) personal(w, x.playerId, funeral);
  if (pl || p.soylu || p.meclis || throne || p.prof === 'kayzer') chronicle(w, 'olum', `${p.name} ${years} yaşında öldü. ${text}${throne ? ' ' + throne : ''}`);
}
type Estate = { houses: string[]; inv: Person['inv']; arms: NonNullable<Person['arms']> };
/** Hand a dead person's house(s), the house sandık, Çanta and weapons to an heir (or the state). */
export function giveEstate(w: World, deadId: string, e: Estate, heir: Person | null): void {
  for (const b of w.buildings) if (e.houses.includes(b.id) || b.ownerId === deadId) b.ownerId = heir?.id;
  if (!heir) return; // goods of a man without heirs are lost to the state (house becomes city property)
  for (const g of Object.keys(e.inv) as (keyof Person['inv'])[]) heir.inv[g] = (heir.inv[g] ?? 0) + (e.inv[g] ?? 0);
  const ha = (heir.arms ??= {}); for (const [k, n] of Object.entries(e.arms) as [keyof typeof ha, number][]) if (n) { ha[k] = (ha[k] ?? 0) + n; if (k === 'kilic' || k === 'hancer' || k === 'yay') (w.armsReg ??= []).push({ ownerId: heir.id, kind: k, day: w.day, by: 'demirci' }); }
  if (e.houses[0] && heir.home !== 'saray' && heir.home !== 'kisla' && freeSpots(w, e.houses[0]) > 0) heir.home = e.houses[0];
}
/** The Kayzer died: adult heir → Kayzer; minor heir → regent (spouse, else Maecenas); no heir → Maecenas. */
export function succeedOnDeath(w: World, k: Person): string | null {
  if (w.regime !== 'imparatorluk') { w.kayzerId = null; return 'Devlet başkanlığı boşaldı; seçim yapılacak.'; }
  const heir = heirOf(w, k); const sp = findPerson(w, k.spouse); const mae = w.people.find((p) => p.prof === 'naip');
  if (heir?.adult && findPerson(w, heir.id)) { const h = findPerson(w, heir.id)!; w.kayzerId = h.id; h.prof = 'kayzer'; h.work = 'saray'; h.home = 'saray'; h.soylu = true; w.veliaht = null; const t = `Tahta varisi ${h.name} çıktı.`; chronicle(w, 'taht', `${k.name} öldü. ${t}`); return t; }
  if (heir && (sp ?? mae)) { const reg = (sp ?? mae)!; w.kayzerId = reg.id; if (reg.prof !== 'naip') { reg.prof = 'kayzer'; reg.work = 'saray'; } w.regentId = reg.id; w.regentFor = heir.id; const t = `Veliaht ${nameOf(w, heir.id)} reşit olana dek ${reg.name} naip.`; chronicle(w, 'taht', `${k.name} öldü. ${t}`); return t; }
  if (mae) { w.kayzerId = mae.id; const t = `Varisi olmadığından tahta ${mae.name} çıktı.`; chronicle(w, 'taht', `${k.name} öldü. ${t}`); return t; }
  return null;
}
/** A dead player continues as one of his adult children (who inherits house/sandık/Çanta). */
export function continueAsChild(w: World, playerId: string, childId: string): string | null {
  const pl = w.players[playerId]; const d = pl?.dead; if (!pl || !d) return 'Karakteriniz yaşıyor.';
  if (!d.heirs.includes(childId)) return 'Bu çocuk seçilemez.';
  const c = findPerson(w, childId); if (!c || (c.playerId && !c.npc) || yearsOf(w, c) < ADULT_YEARS) return 'Bu çocuk artık seçilemez.';
  if (d.estate) giveEstate(w, '-', d.estate, c);
  c.playerId = playerId; c.npc = false; c.genderSet = true; c.lookSet = true; (c.profile ??= {}).set = true;
  pl.personId = c.id; pl.name = c.name; pl.dead = undefined; pl.lastSeenDay = w.day; pl.awayMoney = c.money;
  log(w, `${c.name}, ${d.name} ailesinin yeni reisi oldu.`, c.id);
  return null;
}
/** Estates nobody claimed within 3 game days go to the eldest child. */
export function settleEstates(w: World): void {
  for (const pl of Object.values(w.players)) { const d = pl.dead; if (!d?.estate || w.day - d.day < 3) continue; const c = d.heirs.map((id) => findPerson(w, id)).find(Boolean) ?? null; giveEstate(w, '-', d.estate, c ?? null); d.estate = undefined; }
}

/** Who inherits the throne: designated veliaht, else the eldest adult child, else the eldest minor (with a regent). */
export function heirOf(w: World, k: Person): { id: string; adult: boolean } | null {
  const kids = childrenOf(w, k.id);
  const v = kids.find((x) => x.id === w.veliaht); if (v) return v;
  return kids.find((x) => x.adult) ?? kids[0] ?? null;
}

/** v1.9.6: a Kayzer sent to the zindan loses the throne. Heir (adult) → Kayzer; minor heir → regent (spouse, else
 *  Maecenas); no heir → Maecenas. The former Kayzer becomes a plain citizen (“Eski Kayzer”); the admin panel stays
 *  with his account. No automatic return: only an isyan he leads, or (in a republic) a Başkan election. */
export function dethroneForJail(w: World, k: Person): string | null {
  if (w.kayzerId !== k.id || w.regime !== 'imparatorluk') return null;
  const heir = heirOf(w, k); const sp = findPerson(w, k.spouse); const mae = w.people.find((p) => p.prof === 'naip');
  let text: string;
  if (heir?.adult && findPerson(w, heir.id)) {
    const h = findPerson(w, heir.id)!; w.kayzerId = h.id; h.prof = 'kayzer'; h.work = 'saray'; h.home = 'saray'; h.soylu = true; h.jailedDays = 0; w.veliaht = null;
    text = `${k.name} zindana girdiği için tahtı kaybetti. Varisi ${h.name} yeni Kayzer!`;
  } else if (heir && (sp?.jailedDays === 0 ? sp : mae)) {
    const reg = (sp && sp.jailedDays === 0 ? sp : mae)!; w.kayzerId = reg.id; if (reg.prof !== 'naip') { reg.prof = 'kayzer'; reg.work = 'saray'; }
    w.regentId = reg.id; w.regentFor = heir.id;
    text = `${k.name} zindana girdiği için tahtı kaybetti. Veliaht ${nameOf(w, heir.id)} reşit olana dek ${reg.name} naip olarak tahtta.`;
  } else if (mae) { w.kayzerId = mae.id; text = `${k.name} zindana girdiği için tahtı kaybetti. Varisi olmadığından tahta ${mae.name} çıktı.`; }
  else return null;
  // stays prof 'kayzer' (shown as “Eski Kayzer”), but no longer lives in the Saray or counts as a soylu
  k.soylu = false; k.home = emptiestHouse(w); k.work = 'pazar'; k.sidedWith = null; w.exKayzerId = k.id; w.coup = null;
  log(w, `👑 ${text}`, k.id); chronicle(w, 'taht', text);
  if (k.playerId) personal(w, k.playerId, 'Zindana girdiğiniz için Kayzerlikten düştünüz. Tahtı ancak bir isyana önderlik edip kazanarak ya da (cumhuriyette) Başkan seçilerek geri alabilirsiniz. Kurucu paneli sizde kalır.');
  return text;
}

/** Succession on abdication. Returns a message or null if there is no one to take the throne. */
export function succeed(w: World, k: Person): string | null {
  const heir = heirOf(w, k); const sp = findPerson(w, k.spouse);
  const step = (): void => { k.prof = 'memur'; k.work = 'saray'; };
  if (heir?.adult) {
    const h = findPerson(w, heir.id)!; step(); w.kayzerId = h.id; h.prof = 'kayzer'; h.work = 'saray'; h.home = 'saray'; h.soylu = true; w.veliaht = null;
    return `${k.name} tahttan feragat etti. Yeni Kayzer: ${h.name}!`;
  }
  if (heir && sp) {
    step(); w.kayzerId = sp.id; sp.prof = 'kayzer'; sp.work = 'saray'; w.regentId = sp.id; w.regentFor = heir.id;
    return `${k.name} tahttan feragat etti. Veliaht ${nameOf(w, heir.id)} reşit olana dek ${sp.name} naip olarak tahtta.`;
  }
  if (sp) { step(); w.kayzerId = sp.id; sp.prof = 'kayzer'; sp.work = 'saray'; return `${k.name} tahttan feragat etti. Tahta eşi ${sp.name} çıktı.`; }
  return null;
}

/** The person ruling day to day: the head, or the Kayzer's spouse while the Kayzer is away or passive. */
export function actingHead(w: World, now: number, windowMs: number): Person | undefined {
  const k = findPerson(w, w.kayzerId); if (!k) return undefined;
  const present = k.playerId && !k.npc && isOnline(w, k.playerId, now, windowMs);
  if (present || w.regime !== 'imparatorluk') return k;
  const sp = findPerson(w, k.spouse);
  return sp && sp.jailedDays === 0 ? sp : k;
}
export function canRule(w: World, p: Person, now: number, windowMs: number): boolean {
  if (p.id === w.kayzerId) return true;
  return w.regime === 'imparatorluk' && actingHead(w, now, windowMs)?.id === p.id;
}

/** v2.0.1: replace (or add) a person's soyadı – a wife takes her husband's at the wedding. */
export function setSurname(w: World, p: Person, sn: string): void {
  const old = p.profile?.surname; let base = p.name;
  if (old && base.endsWith(` ${old}`)) base = base.slice(0, -old.length - 1);
  (p.profile ??= {}).surname = sn; if (!base.endsWith(` ${sn}`)) p.name = `${base} ${sn}`.slice(0, 40);
  const pl = p.playerId ? w.players[p.playerId] : undefined; if (pl) pl.name = p.name;
}

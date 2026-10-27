import { BASE_PRICE } from './constants';
import type { CrimeKind, Person, Petition, PetitionKind, World } from './types';
import { STATE_PROFS } from './constants';
import { buy, lawOn, transfer, marketPrice } from './economy';
import { chance, clamp, nextId, pick, rand } from './rng';
import { findPerson } from './world';
import { log } from './log';

/** Is this person fully AI-driven (risky choices allowed)? Players' characters never are – offline they get the conservative layer only. */
export const fullAI = (p: Person): boolean => p.playerId === null || p.npc;

export function isState(p: Person): boolean { return STATE_PROFS.includes(p.prof); }

/** Legacy daily consumption hook: needs are now handled hourly in life.ts (3 meals, 5 water). */
export function consume(w: World, p: Person): void {
  if (p.prof === 'naip') { p.hunger = 0; p.thirst = 0; return; }
  // askıda ekmek: hungry & broke takes a hung bread
  if (p.meals < 2 && p.inv.ekmek === 0 && lawOn(w, 'askida')) {
    const sponsor = w.people.find((x) => x.inv.ekmek > 3 && x.money > 200 && x.id !== p.id && x.prof !== 'firinci');
    if (sponsor) { sponsor.inv.ekmek -= 1; p.inv.ekmek += 1; }
  }
  void buy; void chance;
}

/** Wealthy citizens spend part of their surplus: extra goods, services, alms – keeps money circulating. */
export function spendSurplus(w: World, p: Person): void {
  if (p.prof === 'naip' || p.id === w.kayzerId || p.jailedDays > 0 || p.money <= 120) return;
  let budget = (p.money - 120) * 0.12;
  for (const g of ['et', 'balik', 'icki'] as const) { if (budget <= 0) break; const pr = w.prices[g]; if (pr <= budget * 0.5 && pr < BASE_PRICE[g] * 2) { buy(w, p.id, g, 1, budget); budget -= pr; } }
  const services = w.people.filter((x) => ['hamal', 'hekim', 'hoca', 'kalemsor', 'insaatci', 'imam', 'terzi', 'marangoz'].includes(x.prof) && x.jailedDays === 0 && x.id !== p.id);
  const poor = w.people.filter((x) => x.money < 10 && x.id !== p.id && x.prof !== 'naip');
  if (poor.length && budget > 2) { const r = pick(w, poor); const amt = Math.round(budget * 0.25 * 100) / 100; if (transfer(w, p.id, r.id, amt, 'sadaka')) { budget -= amt; r.relations[p.id] = clamp((r.relations[p.id] ?? 0) + 5, -100, 100); } }
  for (let i = 0; i < 3 && budget > 1 && services.length; i += 1) {
    const s = pick(w, services); const amt = Math.round(budget / (3 - i) * 100) / 100;
    if (transfer(w, p.id, s.id, amt, 'hizmet')) { s.incomeToday += amt; budget -= amt; }
  }
}

export function isPoor(w: World, p: Person, avgMoney?: number): boolean {
  const avg = avgMoney ?? w.people.reduce((s, x) => s + x.money, 0) / w.people.length;
  return p.money < Math.max(25, avg * 0.3) && p.incomeToday < 12;
}

/** Daily mood/loyalty/republic drift from material conditions and policy. */
export function feel(w: World, p: Person): void {
  if (p.prof === 'naip' || p.id === w.kayzerId) return;
  const hungry = p.meals < 3 || p.drinks < 5 || p.hunger > 60;
  if (hungry) { p.mood -= 3; p.republic += 1.2; p.loyalty -= 1; } else { p.mood += 0.6; }
  // religiosity colours politics: the devout lean to the throne, the secular to the republic
  if (p.din > 70 && w.regime === 'imparatorluk') { p.loyalty += 0.2; p.republic -= 0.2; }
  if (p.din < 25) p.republic += 0.15;
  if (w.bans.includes('icki') && p.din < 35) p.loyalty -= 0.4;
  const avgMoney = w.people.reduce((s, x) => s + x.money, 0) / w.people.length;
  const poor = isPoor(w, p, avgMoney);
  if (poor) { p.mood -= 1.2; p.republic += 0.9; }
  if (chance(w, 0.02)) { p.health -= 25; p.mood -= 5; } // illness / bad luck
  const breadPrice = marketPrice(w, 'ekmek');
  if (breadPrice > 5) p.mood -= 1.5;
  // state policy affects memnuniyet (loyalty); personal life affects mutluluk (mood)
  if (w.taxRate > 10) { p.loyalty -= (w.taxRate - 10) * 0.12; p.mood -= (w.taxRate - 10) * 0.05; }
  if (w.taxRate > 18) p.loyalty -= 0.4;
  if (p.loyalty < 30 && (poor || hungry || p.money < 15)) p.republic += (30 - p.loyalty) * 0.05; // an unloved throne that also starves you breeds republicans
  if (w.taxRate < 10) { p.loyalty += 0.3; }
  if (p.money < 5) p.mood -= 2;
  if (p.money > 300) p.mood += 0.5;
  if (p.unemployedDays > 2) p.mood -= 3;
  if (p.spouse) p.mood += 0.7;
  // drift toward neutral
  p.mood += (60 - p.mood) * 0.05;
  p.loyalty += (p.mood - 50) * 0.01 + (55 - p.loyalty) * 0.02; // happiness helps, but memnuniyet drifts to neutral
  // Good rule lets republican feeling fade – except for committed republicans, who keep their personal leaning.
  if (!poor && !hungry && p.plotting !== 'revolution') p.republic -= 0.5;
  if (p.loyalty > 75 && p.plotting !== 'revolution') p.republic -= 0.4;
  // an absent ruler (only the naip governs): loyalty erodes, unanswered grievances pile up
  if (w.headAwayDays > 3 && w.regime === 'imparatorluk') { p.loyalty -= 1.2; p.mood -= 0.3; p.republic += 0.8; }
  p.mood = clamp(p.mood); p.loyalty = clamp(p.loyalty); p.republic = clamp(p.republic); p.health = clamp(p.health);
  p.thought = think(w, p);
}

export function think(w: World, p: Person): string {
  if (p.jailedDays > 0) return 'Zindandayım… Hâkim insaf etsin.';
  if (p.hunger > 60) return marketPrice(w, 'ekmek') > 4.5 ? 'Ekmek pahalı, saraya dilekçe yazayım.' : 'Karnım aç, bir lokma ekmek…';
  if (p.thirst > 60) return 'Su lazım, kuyuya gideyim.';
  if (p.money < 5) return 'Cebimde metelik yok.';
  if (p.unemployedDays > 2) return 'İş yok, şantiyede iş arayayım.';
  if (p.plotting !== 'none') return p.plotting === 'coup' ? 'Askerlerle konuşmak lazım…' : 'Halk uyanmalı, cumhuriyet!';
  if (p.republic > 60) return w.regime === 'cumhuriyet' ? 'Yaşasın cumhuriyet!' : 'Bu saltanat böyle gitmez.';
  if (w.taxRate > 18) return 'Vergiler belimizi büküyor.';
  if (p.mood > 75) return pick(w, ['Ne güzel bir gün!', 'Allah devletimize zeval vermesin.', 'İşler yolunda.']);
  if (p.prof === 'tuccar') return 'Ucuz al, pahalı sat.';
  if (p.prof === 'kalemsor') return 'Yarınki manşet ne olsun?';
  if (p.prof === 'asker') return p.loyalty > 60 ? 'Kayzer için nöbetteyim.' : 'Maaş da az, nöbet de uzun.';
  return pick(w, ['Bugün pazara uğramalı.', 'Komşuyla biraz sohbet edeyim.', 'İşe gidiyorum.', 'Akşama ne pişirsek?']);
}

export function openPetition(w: World, p: Person, kind: PetitionKind, text: string, amount = 0, payload?: string): Petition | null {
  if (w.petitions.some((x) => x.fromId === p.id && x.status === 'bekliyor')) return null;
  const pet: Petition = { id: nextId(w, 'D'), fromId: p.id, kind, text, day: w.day, expires: w.day + (kind === 'kanun' || kind === 'gorev' ? 5 : 2), status: 'bekliyor', amount, payload };
  w.petitions.push(pet);
  log(w, `${p.name} saraya dilekçe verdi: “${text}”`, p.id);
  return pet;
}

/** Night-time free will of fully AI citizens. */
export function decide(w: World, p: Person): void {
  if (!fullAI(p) || p.jailedDays > 0 || p.prof === 'naip' || p.id === w.kayzerId) return;
  // petitions – sensible, need-based
  if (chance(w, 0.18)) {
    if (p.hunger > 55 && p.money < 10) openPetition(w, p, 'yardim', `Efendim, ${p.money < 2 ? 'evde ekmek yok' : 'çocuklar aç'}, ${Math.round(15)} Dinar yardım rica ederim.`, 15);
    else if (p.unemployedDays > 2) openPetition(w, p, 'is', 'Efendim, iş bulamıyorum. Şantiyede ya da limanda bir iş verilsin.');
    else if (w.taxRate > 16 && p.mood < 45) openPetition(w, p, 'vergi', `Vergi %${w.taxRate} çok ağır, indirilmesini rica ederiz.`);
    else if (marketPrice(w, 'ekmek') > 5 && p.mood < 50) openPetition(w, p, 'sikayet', 'Ekmek fiyatı çok yükseldi, fırınlar denetlensin.');
  }
  // theft: desperate & dishonest
  if (p.money < 8 && p.meals < 3 && p.honesty < 55 && chance(w, (60 - p.honesty) / 200)) {
    const victims = w.people.filter((v) => v.money > 80 && v.id !== p.id && v.prof !== 'kayzer' && v.prof !== 'naip');
    if (victims.length) steal(w, p, pick(w, victims));
  }
  // greedy bribery (Cemal style): pays a tahsildar to look away → tax dodge, a crime under the law
  if (p.prof === 'tuccar' && p.honesty < 30 && p.money > 200 && chance(w, 0.12)) {
    const t = w.people.find((x) => x.prof === 'tahsildar' && x.honesty < 50 && x.jailedDays === 0);
    if (t) { transfer(w, p.id, t.id, 20, 'rüşvet'); log(w, `${p.name}, ${t.name}'a rüşvet verdi diye fısıldanıyor.`, p.id); if (lawOn(w, 'rusvet') && chance(w, bekciPower(w) * 0.6)) openCase(w, p.id, 'rusvet', t.id, 20, 55); }
  }
  // protest
  if (p.mood < 28 && lawOn(w, 'toplanti') && chance(w, 0.25)) { p.republic = clamp(p.republic + 2); log(w, `${p.name} Pazar meydanında protesto yaptı.`, p.id); }
  // republican agitation
  if (p.republic > 65 && p.ambition > 55 && p.plotting === 'none' && chance(w, 0.1)) { p.plotting = 'revolution'; log(w, `${p.name} gizlice cumhuriyetçilere katıldı.`, p.id); }
  if (p.plotting === 'revolution' && p.republic < 40) p.plotting = 'none';
  // committed republicans agitate: propaganda works mostly on the poor and hungry
  if (p.plotting === 'revolution' && w.regime === 'imparatorluk') {
    const avgMoney = w.people.reduce((s, x) => s + x.money, 0) / w.people.length;
    for (let i = 0; i < 2; i += 1) {
      const t = pick(w, w.people);
      if (t.id === p.id || t.prof === 'naip' || t.id === w.kayzerId) continue;
      const receptive = isPoor(w, t, avgMoney) || t.hunger > 60 || t.loyalty < 50;
      t.republic = clamp(t.republic + (receptive ? 4 : 0.8));
      if (receptive && chance(w, 0.3)) log(w, `${p.name}, ${t.name}'a cumhuriyet propagandası yaptı.`, p.id);
    }
  }
  // gossip – contagion of opinions
  const other = pick(w, w.people);
  if (other && other.id !== p.id && other.prof !== 'naip') {
    const rel = (p.relations[other.id] ?? 0) + (rand(w) < 0.7 ? 4 : -6);
    p.relations[other.id] = clamp(rel, -100, 100);
    // gossip: a republican talks the other one up; a loyal citizen talks the other one down
    if (p.republic > 60 && other.republic < p.republic) other.republic = clamp(other.republic + (other.hunger > 60 || other.money < 10 ? 2 : 0.3));
    else if (p.loyalty > 70 && other.republic > 10) other.republic = clamp(other.republic - 0.3);
    // marriage
    // (marriages happen in family.ts, man & woman only)
    trimRelations(p);
  }
}

function trimRelations(p: Person): void {
  const keys = Object.keys(p.relations);
  if (keys.length > 12) { keys.sort((a, b) => Math.abs(p.relations[a] ?? 0) - Math.abs(p.relations[b] ?? 0)); for (const k of keys.slice(0, keys.length - 12)) delete p.relations[k]; }
}

export function bekciPower(w: World): number {
  const b = w.people.filter((x) => x.prof === 'bekci' && x.jailedDays === 0).length; return Math.min(0.85, 0.12 + b * 0.09);
}

export function openCase(w: World, accusedId: string, crime: CrimeKind, victimId: string | null, amount: number, evidence: number): void {
  if (w.cases.some((c) => c.accusedId === accusedId && c.stage !== 'kapandi' && c.crime === crime)) return;
  const acc = findPerson(w, accusedId);
  if (acc?.meclis && acc.immune) { log(w, `${acc.name} yakalandı ama Meclis dokunulmazlığı var; dava açılamadı.`, acc.id); return; }
  w.cases.push({ id: nextId(w, 'C'), accusedId, crime, victimId, amount, evidence, stage: 'savci', day: w.day, deadline: w.day + 1 });
  const a = findPerson(w, accusedId); if (a) a.jailedDays = Math.max(a.jailedDays, 1);
}

export const CRIME_LABEL: Record<CrimeKind, string> = { hirsizlik: 'Hırsızlık', rusvet: 'Rüşvet', zimmet: 'Zimmet', isyan: 'İsyan', saldiri: 'Saldırı', cinayet: 'Cinayet', kacakcilik: 'Kaçakçılık' };
export { steal } from './life';
import { steal } from './life';

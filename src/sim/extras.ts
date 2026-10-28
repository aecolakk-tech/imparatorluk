import { ek } from './tr';
import { migrate4 } from './v16';
import { migrate10 } from './realm';
/**
 * Sarraf (moneylender) loans with interest and haciz; world migration for saved worlds; law previews.
 */
import type { Good, Person, World } from './types';
import { GOODS } from './types';
import { DEFAULT_SALARY, OLD_DEFAULT_SALARY, PROF_LABEL } from './constants';
import { transfer } from './economy';
import { chance, clamp, nextId, randInt } from './rng';
import { emptyInv, findPerson, genderOfName, makeBuildings, WORKPLACE, defaultLaws } from './world';
import { log } from './log';
import { openCase } from './ai';

export const LOAN_RATE = 0.15; export const LOAN_DAYS = 7;
export function sarraf(w: World): Person | undefined {
  return w.people.filter((p) => p.prof === 'tuccar' && p.jailedDays === 0 && !p.playerId).sort((a, b) => b.money - a.money)[0];
}
export function borrow(w: World, p: Person, amount: number): string {
  const s = sarraf(w); if (!s) return 'Sarraf yok.';
  if (w.loans.some((l) => l.debtor === p.id)) return 'Önce eski borcunuzu ödeyin.';
  const max = Math.min(150, Math.max(20, s.money * 0.3));
  if (amount > max) return `Sarraf ${s.name} size en fazla ${Math.round(max)} Dinar verir.`;
  if (!transfer(w, s.id, p.id, amount, 'sarraf borcu')) return 'Sarrafın kasası boş.';
  const owed = Math.round(amount * (1 + LOAN_RATE) * 100) / 100;
  w.loans.push({ id: nextId(w, 'K'), debtor: p.id, lender: s.id, amount: owed, due: w.day + LOAN_DAYS, day: w.day });
  return `${s.name} ${amount} Dinar verdi. ${w.day + LOAN_DAYS}. güne kadar ${owed} Dinar ödemelisiniz (%${LOAN_RATE * 100} faiz).`;
}
export function repay(w: World, p: Person, id: string): string {
  const l = w.loans.find((x) => x.id === id && x.debtor === p.id); if (!l) return 'Borç yok.';
  const pay = Math.min(p.money, l.amount); if (pay <= 0) return 'Kesede para yok.';
  transfer(w, p.id, l.lender, pay, 'borç ödemesi'); l.amount = Math.round((l.amount - pay) * 100) / 100;
  if (l.amount <= 0.01) w.loans = w.loans.filter((x) => x !== l);
  return l.amount > 0.01 ? `${pay} ödendi; kalan ${l.amount}.` : 'Borç kapandı.';
}
/** Due loans: NPC debtors pay; defaulters get haciz (goods seized and sold to the lender), then zindan. */
export function loansDay(w: World): void {
  for (const l of [...w.loans]) {
    const d = findPerson(w, l.debtor); const s = findPerson(w, l.lender);
    if (!d || !s) { w.loans = w.loans.filter((x) => x !== l); continue; }
    if ((!d.playerId || d.npc) && d.money > l.amount + 10) repay(w, d, l.id);
    if (w.day < l.due || !w.loans.includes(l)) continue;
    const pay = Math.min(d.money, l.amount); if (pay > 0) { transfer(w, d.id, s.id, pay, 'borç ödemesi'); l.amount -= pay; }
    if (l.amount > 0.5) {
      // haciz: seize goods at half price
      let seized = 0;
      for (const g of GOODS) while (d.inv[g] > 0 && l.amount > 0.5) { d.inv[g] -= 1; s.inv[g] += 1; l.amount -= w.prices[g] * 0.5; seized += 1; }
      log(w, `HACİZ: ${s.name}, borcunu ödemeyen ${ek(d.name, 'ın')} ${seized} eşyasına el koydu.`, d.id);
      if (l.amount > 0.5) { openCase(w, d.id, 'zimmet', s.id, Math.round(l.amount), 70); d.jailedDays = Math.max(d.jailedDays, 3); log(w, `${d.name} borç yüzünden zindana atıldı.`, d.id); }
    }
    w.loans = w.loans.filter((x) => x !== l);
  }
}

/** One-sentence prediction shown before a law/tax change is enacted. */
export function lawPreview(w: World, kind: string, value?: number): string {
  const sales = Object.values(w.market.sold).reduce((a, b) => a + b, 0);
  switch (kind) {
    case 'tax': { const v = value ?? w.taxRate; const d = v - w.taxRate; return `Tahmin: günlük vergi geliri ${d >= 0 ? '+' : ''}${Math.round(d * sales * 0.02)} Dinar; memnuniyet ${d > 0 ? 'düşer' : 'artar'} (${v > 15 ? 'esnaf ve fakirler kızar' : 'halk rahatlar'}).`; }
    case 'ickiyasak': return 'Tahmin: meyhane kapanır, barcılar işsiz kalır; dindarlar memnun (+), seküler halk kızgın (−), karaborsa içki artar.';
    case 'gece': return 'Tahmin: gece suçları azalır (~%70), geceleyin çıkanlara ceza; mutluluk biraz düşer.';
    case 'servet': return 'Tahmin: 500 Dinar üstü servetten günde %2 hazineye; eşitsizlik azalır, zenginler ve tüccarlar memnuniyetsiz.';
    case 'devletekmegi': return 'Tahmin: en açlara her gün bedava ekmek; hazineye maliyet ~ekmek fiyatı × adet.';
    case 'devletsuyu': return 'Tahmin: su fiyatı sabitlenir, fark hazineden sucuya ödenir; susuzluk azalır.';
    case 'saraykor': return 'Tahmin: darbe zorlaşır, asker maaşları %20 artar.';
    case 'toplanti': return 'Tahmin: protestolar serbest; kaldırılırsa memnuniyetsizlik birikir, isyan riski artar.';
    default: return 'Tahmin: etkisi orta düzeyde olacak.';
  }
}

/** Bring an older saved world up to the current schema without losing people, money or history. */
export function migrateWorld(w: World): World {
  const any = w as unknown as Record<string, unknown>;
  if ((w.schema ?? 1) >= 2) return migrate3(w);
  const def: Record<string, unknown> = { speed: 1, nature: null, nextDrought: w.day + 60, festivalUntil: 0, granary: 400, priceCaps: {}, arrests: [], chatOut: [], talks: [], offers: [], rumors: [], caravan: null, threat: null, bans: [], loans: [] };
  for (const [k, v] of Object.entries(def)) if (any[k] === undefined) any[k] = v;
  for (const g of GOODS) { if (w.prices[g] === undefined) w.prices[g] = 1; if (w.market.sold[g] === undefined) { w.market.sold[g] = 0; w.market.unmet[g] = 0; } }
  // new, cheaper price scale (more is consumed now: 3 meals + 5 water a day)
  const fresh: Partial<Record<Good, number>> = { ekmek: 1.2, su: 0.5, et: 6, balik: 4, kumas: 8, alet: 20, odun: 2.5, bugday: 0.5, yun: 2, elbise: 18, mobilya: 40, icki: 3 };
  for (const g of GOODS) w.prices[g] = fresh[g] ?? w.prices[g];
  w.listings = []; // old-scale listings would be mispriced; sellers relist tomorrow
  // bigger map: new buildings; keep homes that still exist
  const old = new Set(w.buildings.map((b) => b.id));
  w.buildings = makeBuildings(); void old;
  const ids = new Set(w.buildings.map((b) => b.id));
  const houses = w.buildings.filter((b) => b.kind === 'ev');
  for (const l of defaultLaws()) if (!w.laws.some((x) => x.id === l.id)) w.laws.push(l);
  for (const [k, v] of Object.entries(DEFAULT_SALARY)) {
    const cur = (w.salaries as Record<string, number>)[k];
    if (cur === undefined || cur === (OLD_DEFAULT_SALARY as Record<string, number>)[k]) (w.salaries as Record<string, number>)[k] = v as number;
  }
  if (w.meclis.salary === 10) w.meclis.salary = 6;
  if (w.headTax === 1) w.headTax = 1.75;
  let i = 0;
  for (const p of w.people) {
    const pa = p as unknown as Record<string, unknown>;
    const d: Record<string, unknown> = { din: 50, meals: 3, drinks: 5, wounded: false, protectedUntil: 0, xp: 30, rep: 0, relNote: {}, titles: [], taxDue: 0, smuggle: false, nightOut: false, born: w.day - 100, parents: [], soylu: false, school: 0, exiledDays: 0 };
    for (const [k, v] of Object.entries(d)) if (pa[k] === undefined) pa[k] = v;
    p.din = p.prof === 'imam' || p.prof === 'hoca' ? 85 : 20 + ((p.id.charCodeAt(p.id.length - 1) * 37) % 65);
    for (const g of GOODS) if (p.inv[g] === undefined) p.inv[g] = 0;
    const gn = genderOfName(p.name); if (gn !== undefined && p.prof !== 'kayzer') p.female = gn;
    if (!ids.has(p.home)) p.home = houses[i++ % houses.length]!.id;
    if (!ids.has(p.work)) p.work = WORKPLACE[p.prof];
    p.inv.su = Math.max(p.inv.su, 3); p.inv.ekmek = Math.max(p.inv.ekmek, 2);
  }
  // diversify old professions into the new production chain: move surplus workers to where the new chain needs hands
  const TARGET: Partial<Record<Person['prof'], number>> = { ciftci: 5, firinci: 5, sucu: 8, dokumaci: 3, mobilyaci: 2, barci: 2, kasap: 4, balikci: 6, terzi: 3, demirci: 3, marangoz: 4, hamal: 6, insaatci: 8 };
  const count = (pr: string): number => w.people.filter((x) => x.prof === pr).length;
  const titled = (p: Person): boolean => / /.test(p.name) && Object.values(PROF_LABEL).some((l) => p.name.startsWith(l + ' '));
  for (const [need, n] of Object.entries(TARGET) as [Person['prof'], number][]) {
    while (count(need) < n) {
      const donor = w.people.find((x) => !x.playerId && !x.meclis && !titled(x) && TARGET[x.prof] !== undefined && count(x.prof) > (TARGET[x.prof] ?? 0) && x.prof !== need)
        ?? w.people.find((x) => !x.playerId && !x.meclis && TARGET[x.prof] !== undefined && count(x.prof) > (TARGET[x.prof] ?? 0) && x.prof !== need);
      if (!donor) break;
      donor.prof = need; donor.work = WORKPLACE[need]; donor.xp = 0;
    }
  }
  // fix same-sex marriages: separate them
  for (const p of w.people) { const s = findPerson(w, p.spouse); if (s && s.female === p.female) { p.spouse = null; s.spouse = null; if (s.home === p.home && s.home !== 'saray') s.home = houses[randInt(w, 0, houses.length - 1)]!.id; log(w, `${p.name} ile ${ek(s.name, 'ın')} evliliği geçersiz sayıldı (evlilik bir kadın ile bir erkek arasında olur).`); } }
  w.people = w.people.filter(Boolean);
  w.market = { sold: emptyInv(), unmet: emptyInv() };
  w.schema = 2;
  void clamp; void chance;
  return migrate3(w);
}

/** Schema 3: custom laws, hoarding suspicion, treasury book, price history, bigger granary. */
function migrate3(w: World): World {
  if ((w.schema ?? 1) >= 3) return migrate10(migrate4(w));
  const any = w as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries({ customLaws: [], suspicion: {}, treasuryBook: [], priceHist: {}, serving: [] })) if (any[k] === undefined) any[k] = v;
  if (w.granary < 800) w.granary = 800;
  w.schema = 3; return migrate10(migrate4(w));
}

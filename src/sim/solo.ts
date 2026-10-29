/**
 * v2.0.1 tek oyunculu (single-player) parity: rule-based NPC use of the v2.0.1 features (no LLM).
 * NPCs don't only react – they canvass, run jobs, climb the ladder, pray, give sadaka, donate to parties, found parties,
 * and the AI naip runs vergi / ambar / narh / ithalat when no human Kayzer is online. Every use is counted in w.usage.
 */
import type { Person, World } from './types';
import { BASE_PRICE, PRODUCES } from './constants';
import { transfer } from './economy';
import { chance, clamp, pick } from './rng';
import { log } from './log';
import { use } from './usage';
import { yearsOf } from './age';
import { hire, askJob, postJob, promote, talim, becomeTalebe, readLesson, rankOf, MAIN, itibar } from './career';
import { canvass, ikram, smear, endorse, partyPoster } from './propaganda';
import { donate, foundParty, facOf, closest, personAxes, axisDist, axesOf, PROGRAMS } from './party';
import { sadaka, din, isRamazan } from './piety';
import { electionPhase } from './tick';
import { granaryDistribute, fulfillOrder } from './market2';
import { granaryBuy } from './life';
import { hazineReserve, hazineTrend, members } from './meclis';
import { rulerTraitDay, traitPolicy } from './solostart';

const isNpc = (p: Person): boolean => !p.playerId || !!p.npc;
const adult = (w: World, p: Person): boolean => yearsOf(w, p) >= 16 && p.jailedDays <= 0 && p.prof !== 'naip' && p.prof !== 'kayzer';
const cs = (p: Person): NonNullable<Person['cs']> => (p.cs ??= {});
const idx = (r: string): number => MAIN.indexOf(r as never);

/** Daily NPC careers: job board, 'Bir iş var mı?', NPC notices, the ladder, asker talim, din-ilim. */
export function npcCareerDay(w: World): void {
  const npcs = w.people.filter((p) => isNpc(p) && adult(w, p));
  for (const p of npcs) {
    const c = cs(p);
    // work record for the ladder (NPCs work by their trade every day)
    if (p.incomeToday > 0) { c.jobDays = (c.jobDays ?? 0) + 1; if (chance(w, 0.25) && (p.itibar ?? 10) < 60) itibar(w, p, 1, 'iş günü'); if (p.prof === 'tuccar' || PRODUCES[p.prof]) c.trades = (c.trades ?? 0) + 1; if (rankOf(p) === 'cirak' && chance(w, 0.35)) { c.flawless = (c.flawless ?? 0) + 1; use(w, 'lonca_sinavi', p); } }
    c.notHungry = p.hunger < 85 ? (c.notHungry ?? 0) + 1 : 0;
    if (c.ustaId) c.ustaDays = (c.ustaDays ?? 0) + 1;
    if (p.prof === 'asker') { c.service = (c.service ?? 0) + 1; if (chance(w, 0.4) && !talim(w, p)) use(w, 'talim', p);
      // NPC soldiers also see action: raid nights they fought in, plus the odd devriye skirmish with eşkıya on the roads
      if (w.raid?.fought?.includes(p.id) && c.raidDay !== w.raid.day) { c.raidDay = w.raid.day; c.raids = (c.raids ?? 0) + 1; }
      else if (chance(w, 0.03)) { c.raids = (c.raids ?? 0) + 1; if (chance(w, 0.5)) c.kills = (c.kills ?? 0) + 1; if (chance(w, 0.4)) itibar(w, p, 2, 'devriyede eşkıya kovaladı'); } }
    // NPC worker on another NPC's notice is paid by the employer (money conserved)
    if (p.job && p.job.kind === 'oyuncu' && p.job.wage > 0 && p.job.employerId !== '-') { if (!transfer(w, p.job.employerId, p.id, p.job.wage, `ücret (${p.job.title})`)) p.job = undefined; }
    const before = rankOf(p); const ar = p.askerRank; const il = p.ilimRank;
    promote(w, p);
    if (rankOf(p) !== before && idx(rankOf(p)) > idx(before)) use(w, 'terfi', p);
    if (ar !== undefined && (p.askerRank ?? 0) > ar) use(w, 'asker_terfi', p);
    if (il !== undefined && (p.ilimRank ?? 0) > il) use(w, 'ilim_terfi', p);
  }
  // looking for work
  // only the trade-less look for work: a self-employed miller/baker keeps his trade (else the flour chain empties into one craft)
  const idle = npcs.filter((p) => !p.job && !p.meclis && (p.prof === 'hamal' || (p.unemployedDays > 3 && !PRODUCES[p.prof] && !['asker', 'memur', 'tahsildar', 'bekci', 'savci', 'hakim', 'hoca', 'imam', 'tuccar'].includes(p.prof))));
  for (const p of idle.slice(0, 6)) {
    if (chance(w, 0.5)) {
      const ustas = w.people.filter((t) => t.id !== p.id && PRODUCES[t.prof] && t.xp >= 60 && t.money >= 20 && isNpc(t));
      // apprentices go where hands are fewest (scarce trades first)
      const n = (pr: string): number => w.people.filter((x) => x.prof === pr).length; const minN = Math.min(...ustas.map((t) => n(t.prof)));
      const scarce = ustas.filter((t) => n(t.prof) <= minN + 1); const t = scarce.length ? pick(w, scarce) : undefined; if (t && idx(rankOf(p)) < idx('usta')) { use(w, 'is_sor', p); if (askJob(w, p, t).ok) use(w, 'cirak_oldu', p); continue; }
    }
    const board = (w.jobs ?? []).filter((j) => (j.kind === 'gundelik' || j.kind === 'oyuncu') && j.employerId !== p.id);
    const j = board.length ? pick(w, board) : undefined; if (j && !hire(w, p, j)) use(w, j.kind === 'oyuncu' ? 'ilan_isi_alindi' : 'is_al', p);
  }
  // NPC ustas/tüccars post notices when they have money and nobody to help
  for (const p of npcs) if (idx(rankOf(p)) >= idx('usta') && p.money > 250 && chance(w, 0.03) && !(w.jobs ?? []).some((j) => j.employerId === p.id)) {
    if (!postJob(w, p, `${p.prof === 'tuccar' ? 'Kervan yükleme' : 'Tezgâh yardımı'}`, Math.round(3 * (w.wageIdx ?? 1) * 10) / 10, 7, 13)) use(w, 'is_ilani', p);
  }
  // sipariş ilanları: an NPC who holds the goods delivers (money from the orderer, conserved)
  for (const o of [...(w.orders ?? [])]) { const by = w.people.find((p) => isNpc(p) && adult(w, p) && p.id !== o.byId && (p.inv[o.good] ?? 0) >= o.qty); if (by && chance(w, 0.5)) fulfillOrder(w, by, o.id); }
  // din-ilim: a few pious young NPCs become talebe and read every day
  const hocas = w.people.filter((p) => p.prof === 'hoca').length;
  for (const p of npcs) {
    if (p.ilimRank === undefined && p.din >= 65 && yearsOf(w, p) < 35 && hocas < 6 && p.prof !== 'asker' && chance(w, 0.01) && !becomeTalebe(w, p)) use(w, 'talebe', p);
    if (p.ilimRank === 0 && !readLesson(w, p)) use(w, 'ders', p);
  }
}

/** Daily NPC piety and charity: namaz, sadaka, oruç (Cuma and aşevi run in pietyHour). */
export function npcPietyDay(w: World): void {
  for (const p of w.people) {
    if (!isNpc(p) || !adult(w, p)) continue;
    if (p.din >= 45 && chance(w, 0.6)) { const c = cs(p); if (c.namazDay !== w.day) { c.namazDay = w.day; if (chance(w, 0.3)) din(w, p, 0.3, 'namaz'); use(w, 'namaz', p); } }
    if (p.din >= 55 && p.money > 150 && chance(w, 0.08)) { sadaka(w, p, Math.min(10, Math.round(p.money * 0.02))); use(w, 'sadaka', p); }
    else if (p.din >= 30 && p.money > 400 && chance(w, 0.25)) { sadaka(w, p, Math.min(20, Math.round(p.money * 0.02))); use(w, 'sadaka', p); } // zekât: the rich give more
    if (isRamazan(w.day) && p.din >= 50 && p.health > 40) { const c = cs(p); if (c.orucDay !== w.day) { c.orucDay = w.day; din(w, p, 1, 'Ramazan orucu'); use(w, 'oruc', p); } }
  }
}

/** Daily NPC campaigning beyond miting: kapı kapı, ikram, rare seçim rüşveti, kara propaganda, endorsements, party posters. */
export function npcCampaignDay(w: World, now: number): void {
  const ph = electionPhase(w).phase; if (ph !== 'aday' && ph !== 'propaganda') return; void now;
  const e = w.election; const voters = w.people.filter((v) => isNpc(v) && adult(w, v));
  for (const id of e.candidates) {
    const c = w.people.find((p) => p.id === id); if (!c || !isNpc(c) || !voters.length) continue;
    for (let i = 0; i < 3; i++) { const v = pick(w, voters); if (v.id !== c.id) { canvass(w, c, v); use(w, 'kapi_kapi', c); } }
    if (c.money > 30 && chance(w, 0.4)) { const v = pick(w, voters); if (ikram(w, c, v, chance(w, 0.5) ? 'pilav' : 'serbet').ok) use(w, 'ikram', c); }
    if (c.honesty < 40 && c.money > 60 && chance(w, 0.08)) { const v = pick(w, voters); ikram(w, c, v, 'para', 10); use(w, 'secim_rusveti', c); }
    if (c.honesty < 55 && chance(w, 0.08)) { const rivals = e.candidates.filter((x) => x !== c.id); const t = rivals.length ? w.people.find((p) => p.id === pick(w, rivals)) : undefined; if (t) { smear(w, c, t); use(w, 'kara_propaganda', c); } }
    if (c.faction && chance(w, 0.2) && !partyPoster(w, c)) use(w, 'parti_afisi', c);
    const mate = e.candidates.map((x) => w.people.find((p) => p.id === x)).find((p) => p && p.id !== c.id && p.faction && p.faction === c.faction);
    if (mate && chance(w, 0.1) && !endorse(w, c, mate)) use(w, 'destek', c);
  }
}

/** Daily NPC party life beyond dues/switching: donations and (rarely) founding a new party. */
export function npcPartyDay(w: World): void {
  for (const p of w.people) {
    if (!isNpc(p) || !p.faction) continue;
    if (p.money > 300 && chance(w, 0.03) && !donate(w, p, Math.round(p.money * 0.03))) use(w, 'bagis', p);
  }
  // a founder: an ambitious, well-off NPC far from every existing party
  if (w.meclis.factions.length < 6 && w.day % 5 === 2 && chance(w, 0.15)) {
    const f = w.people.find((p) => isNpc(p) && adult(w, p) && p.ambition > 60 && p.money > 250 && (p.itibar ?? 10) >= 30 && w.meclis.factions.every((x) => axisDist(personAxes(p), axesOf(x)) > 25));
    if (f) { const ax = personAxes(f); const ideo = ax[0] > 60 ? 'cumhuriyetci' : ax[1] > 60 ? 'halkci' : ax[1] < 40 ? 'esnaf' : 'saltanatci';
      const name = `${f.name.split(' ').pop()} ${ideo === 'cumhuriyetci' ? 'Hür Fırkası' : ideo === 'halkci' ? 'Ahali Fırkası' : ideo === 'esnaf' ? 'Tüccar Fırkası' : 'Devlet Fırkası'}`;
      if (!foundParty(w, f, name, ideo, ax)) { use(w, 'parti_kur', f); log(w, `🎉 ${f.name} yeni bir parti kurdu: ${name}.`, f.id); } }
  }
  void closest; void PROGRAMS; void facOf; void members;
}

/** v2.0.1 AI naip/Kayzer economic policy (runs only when no human ruler is online): vergi, ambar, narh, ithalat. */
export function naipPolicy(w: World): string[] {
  const done: string[] = []; const R = hazineReserve(w); const bread = w.prices.ekmek ?? BASE_PRICE.ekmek; const b0 = BASE_PRICE.ekmek;
  const mood = w.people.reduce((a, p) => a + p.mood, 0) / Math.max(1, w.people.length);
  const tp = traitPolicy(w);
  const vergiG = (w.genelgeler ?? []).some((g) => g.until >= w.day && (g.kind === 'vergiArtirim' || g.kind === 'vergiIndirim'));
  const passive = w.meclis.bills.some((b) => b.kind === 'vergi' && ['tartisma', 'oylama', 'onay'].includes(b.status));
  if (!vergiG && !passive) {
    const tr = hazineTrend(w); // a sensible ruler steers by the daily balance, gently, between %8 and %16
    if (w.rulerTrait && w.taxRate < tp.taxMin) { w.taxRate += 1; done.push(`vergi %${w.taxRate}`); use(w, 'naip_vergi'); }
    else if (w.rulerTrait && w.taxRate > tp.taxMax) { w.taxRate -= 1; done.push(`vergi %${w.taxRate}`); use(w, 'naip_vergi'); }
    else if (w.taxRate < tp.taxMax && (w.treasury < R * 1.5 || (tr < -15 && w.treasury < R * 6) || (w.rulerTrait === 'zalim' && w.taxRate < tp.taxMax))) { w.taxRate += 1; done.push(`vergi %${w.taxRate} (hazine günde ${Math.round(tr)} D)`); use(w, 'naip_vergi'); }
    else if (w.taxRate > tp.taxMin && tr > 40 && w.treasury > R * 4 && mood < 85) { w.taxRate -= 1; done.push(`vergi %${w.taxRate} (hazine dolu)`); use(w, 'naip_vergi'); }
  }
  if (bread > b0 * tp.distAt && w.granary >= 20) { const n = granaryDistribute(w, 40); if (n) { done.push(`ambardan ${n} buğday dağıtıldı`); use(w, 'naip_ambar'); } }
  else if (tp.buyGranary && bread < b0 * 1.05 && w.granary < 150 && w.treasury > R * 3) { const n = granaryBuy(w, 20); if (n) { done.push(`ambara ${n} buğday alındı`); use(w, 'naip_ambar'); } }
  if (bread > b0 * 3 && !w.priceCaps.ekmek) { w.priceCaps.ekmek = Math.round(b0 * 2.2 * 100) / 100; done.push(`ekmeğe narh ${w.priceCaps.ekmek} D`); use(w, 'naip_narh'); }
  else if (w.priceCaps.ekmek && bread < b0 * 2 && !(w.genelgeler ?? []).some((g) => g.kind === 'fiyatTavani' && g.until >= w.day)) { delete w.priceCaps.ekmek; done.push('ekmek narhı kaldırıldı'); use(w, 'naip_narh'); }
  if (w.imports === false && bread > b0 * 2 && !w.raid) { w.imports = true; done.push('ithalat izni verildi'); use(w, 'naip_ithalat'); }
  { const t = rulerTraitDay(w); if (t) done.push(t); }
  for (const p of w.people) if (p.prof === 'naip') p.mood = clamp(p.mood);
  if (done.length) log(w, `🏛 Naip: ${done.join('; ')}.`);
  return done;
}

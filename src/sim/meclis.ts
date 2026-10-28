import { tidy } from './tr';
import { ek } from './tr';
import { enactLaw, lawTitle, validateLaw, type LawSpec } from './laws';
/**
 * Meclis: seats by district and profession, factions, bills with debate → vote → (Kayzer sanction) → effect.
 * The Kayzer's veto is final – there is no override of any kind.
 */
import type { Bill, BillKind, Dilekce, Faction, Person, Profession, Seat, VoteChoice, World } from './types';
import { GOODS } from './types';
import { BASE_PRICE, PROF_LABEL, STATE_PROFS, PRODUCES, GOOD_LABEL } from './constants';
import { transfer } from './economy';
import { chance, clamp, nextId, pick, rand } from './rng';
import { findPerson, WORKPLACE } from './world';
import { log } from './log';
import { emptiestHouse } from './family';
import { use } from './usage';
import { repealLaw } from './laws';
import { personal } from './log';
import { openCase } from './ai';
import { GENELGE, enactG, cancelG, gBlock, isGKind, suggestG, type GKind } from './genelge';
import { closest, partyLines, disciplinedVote, recordVote, partyDay, formGovt, dhondt, migrateParty, reelectLeaders, programFit, facOf, partyName, axesOf } from './party';
import { yearsOf } from './age';
import { personAxes as personAxesM } from './party';
import { itibar } from './career';

export const FACTIONS: Faction[] = [
  { id: 'saltanat', name: 'Saltanat Partisi', ideology: 'saltanatci', leaderId: null, color: '#7b2d8b' },
  { id: 'cumhuriyet', name: 'Cumhuriyet Hareketi', ideology: 'cumhuriyetci', leaderId: null, color: '#3a6ad0' },
  { id: 'esnaf', name: 'Esnaf Birliği', ideology: 'esnaf', leaderId: null, color: '#c9a227' },
  { id: 'halk', name: 'Halk Fırkası', ideology: 'halkci', leaderId: null, color: '#c8483a' },
];
export const SEAT_COUNT = 16;
const hashId = (id: string): number => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
export const SEATS: Omit<Seat, 'holder'>[] = Array.from({ length: SEAT_COUNT }, (_, i) => ({ id: `mv${i + 1}`, label: `Milletvekili ${i + 1}`, kind: 'genel' as const, key: 'genel' }));
export const BILL_LABEL: Record<BillKind, string> = {
  ozel: 'Özel kanun (serbest)',
  vergi: 'Vergi', fiyat: 'Narh (fiyat)', maas: 'Maaş', butce: 'Bütçe', kanun: 'Kanun', insaat: 'İnşaat', af: 'Genel af',
  gensoru: 'Gensoru', genelge: 'Genelge (katalogdan, gerçek etkili)', sorusturma: 'Soruşturma komisyonu', dokunulmazlik: 'Dokunulmazlığın kaldırılması', azil: 'Başkan’ın azli', cumhuriyet: 'Cumhuriyet İlanı (Anayasa değişikliği)', kaldir: 'Kanunu/genelgeyi kaldır',
};
export const MP_ALLOWANCE = 4; // Dinar/day on top of the Meclis salary (wages are ~7)
export const ANAYASA_YES = 14; export const ANAYASA_DEBATE = 2; export const ANAYASA_COOLDOWN = 10;
const DEBATE_DAYS = 1; const VOTE_DAYS = 1; const SANCTION_DAYS = 3;
export const KOMISYON_MIN = 200; export const HAZINE_FLOOR = 300; export const QUORUM_SHARE = 0.5;
export const PROPOSE_FEE = 4; // Dinar, teklif harcı (to the hazine)
export const CAND_FEE = 30; export const CAND_ITIBAR = 20; export const CAND_AGE = 16;
export const COUNT_HOUR = 11; // the daily Meclis session (counting, speeches) runs at 11:00
/** Construction catalogue for insaat bills: a named building on a named arsa. */
export const BUILD: Record<string, [string, number]> = { cesme: ['Çeşme', 800], hamam: ['Hamam', 1500], kutuphane: ['Kütüphane', 1200], han: ['Kervansaray', 2000] };
export const DEFAULT_BUDGET = 600; // discretionary spending per 20-day term without an approved budget

export function initMeclis(): World['meclis'] {
  return { seats: SEATS.map((s) => ({ ...s, holder: null })), factions: FACTIONS.map((f) => ({ ...f })), bills: [], log: [], bribes: [], salary: 6 };
}

export function districtOf(w: World, p: Person): string {
  const b = w.buildings.find((x) => x.id === p.home); const x = b?.x ?? 36; const y = b?.y ?? 20;
  if (y >= 38) return 'liman'; if (x < 24) return 'bati'; if (x < 48) return 'merkez'; return 'dogu';
}
export function profGroup(p: Person): 'esnaf' | 'devlet' | 'emekci' | null {
  if (PRODUCES[p.prof] || p.prof === 'tuccar' || p.prof === 'hekim') return 'esnaf';
  if (STATE_PROFS.includes(p.prof)) return 'devlet';
  if (p.prof === 'hamal' || p.prof === 'insaatci' || p.prof === 'kalemsor') return 'emekci';
  return null;
}
export const inSeat = (w: World, p: Person, s: Seat): boolean => (s.kind === 'genel' ? true : s.kind === 'bolge' ? districtOf(w, p) === s.key : profGroup(p) === s.key);

export function naturalFaction(p: Person): string {
  if (p.republic > 55 || p.plotting === 'revolution') return 'cumhuriyet';
  if (p.loyalty > 72) return 'saltanat';
  if (profGroup(p) === 'esnaf') return 'esnaf';
  return 'halk';
}
export const members = (w: World): Person[] => w.people.filter((p) => p.meclis);
const mlog = (w: World, text0: string, personId?: string): void => {
  const text = tidy(text0); w.meclis.log.push({ day: w.day, text }); if (w.meclis.log.length > 150) w.meclis.log.shift();
  log(w, `Meclis: ${text}`, personId);
};

/** Seat-by-seat election: district voters elect district seats, profession groups elect profession seats. */
export const canRun = (w: World, p: Person): boolean => p.jailedDays === 0 && p.prof !== 'naip' && p.prof !== 'kayzer' && p.prof !== 'asker' && p.prof !== 'bekci' && p.id !== w.kayzerId;
/**
 * v2.0.1 proportional election (D'Hondt, 16 seats): every adult votes for a candidate; the vote counts for the candidate's party list
 * (independents form a one-person list). Seats are split by party votes; inside a party they go to the candidates with the most personal votes.
 */
export function meclisElection(w: World, playerCandidates: string[], playerVotes: Record<string, string>, npcAI: (p: Person) => boolean): string[] {
  migrateParty(w);
  const e = w.election;
  let cands = [...new Set(playerCandidates)].filter((id) => { const p = findPerson(w, id); return p && canRun(w, p); });
  if (cands.length < SEAT_COUNT + 4) { // too few runners: ambitious NPCs step in so every seat can be filled
    const extra = w.people.filter((p) => npcAI(p) && canRun(w, p) && !cands.includes(p.id) && yearsOf(w, p) >= CAND_AGE).sort((a, b) => (b.ambition + b.money / 20) - (a.ambition + a.money / 20)).slice(0, SEAT_COUNT + 4 - cands.length);
    cands.push(...extra.map((p) => p.id));
  }
  // v2.0.1 party lists: most NPC runners stand on the list of the party closest to them (some run independent)
  for (const c of cands) { const p = findPerson(w, c)!; if (!p.faction && npcAI(p) && (hashId(p.id) % 7) !== 0) { const f = closest(w, p); if (f) { p.faction = f.id; f.standing![p.id] ??= 50; } } }
  const tally: Record<string, number> = {}; for (const c of cands) tally[c] = 0;
  const electorate = w.people.filter((p) => p.prof !== 'naip' && p.jailedDays === 0 && yearsOf(w, p) >= 16);
  let voters = 0;
  for (const v of electorate) {
    const pv = playerVotes[v.id]; if (pv === '') continue; /* went home without voting */ if (pv === '✓') { voters++; continue; } /* counted from the secret ballot box */ if (pv && tally[pv] !== undefined) { tally[pv] += 1; voters++; continue; }
    if (v.playerId && !v.npc) continue; // players who didn't vote abstain
    if (cands.includes(v.id)) { tally[v.id] = (tally[v.id] ?? 0) + 1; voters++; continue; } // NPC candidates vote for themselves
    const pl = e.pledges?.[v.id]; if (pl && tally[pl] !== undefined && chance(w, 0.8)) { tally[pl] += 1; voters++; continue; }
    if (chance(w, 0.12)) continue; // some stay home
    let best = ''; let bs = -Infinity;
    for (const c of cands) { const sc = voterScore(w, v, findPerson(w, c)!) + (rand(w) - 0.5) * 12; if (sc > bs) { bs = sc; best = c; } }
    if (best) { tally[best] = (tally[best] ?? 0) + 1; voters++; }
  }
  for (const c of e.ballots ?? []) if (tally[c] !== undefined) tally[c] += 1; e.ballots = [];
  // party lists
  const listOf = (id: string): string => { const f = findPerson(w, id)?.faction; return f && facOf(w, f) ? f : `ind:${id}`; };
  const lv: Record<string, number> = {}; const caps: Record<string, number> = {};
  for (const c of cands) { const l = listOf(c); lv[l] = (lv[l] ?? 0) + (tally[c] ?? 0); caps[l] = (caps[l] ?? 0) + 1; }
  const alloc = dhondt(lv, caps, SEAT_COUNT);
  const winners: string[] = [];
  for (const [l, n] of Object.entries(alloc).sort((a, b) => b[1] - a[1])) { const inList = cands.filter((c) => listOf(c) === l).sort((a, b) => (tally[b] ?? 0) - (tally[a] ?? 0) || (findPerson(w, b)?.ambition ?? 0) - (findPerson(w, a)?.ambition ?? 0)); winners.push(...inList.slice(0, n)); }
  // promise keeping of the outgoing MPs (vaat → was it proposed?)
  for (const p of w.people) if (p.meclis && p.vaatler?.length) { const kept = p.vaatler.filter((k) => (p.proposedG ?? []).includes(k)).length; const broke = p.vaatler.length - kept; p.promiseScore = (p.promiseScore ?? 0) + kept - broke * 2; if (broke) { itibar(w, p, -5 * broke, 'seçim vaadini Meclis’e getirmedi'); mlog(w, `💔 ${p.name} ${broke} vaadini Meclis’e getirmedi; seçmen bunu unutmayacak.`, p.id); } }
  w.meclis.seats = SEATS.map((s, i) => ({ ...s, holder: winners[i] ?? null }));
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  e.last = { day: w.day, results: ranked.slice(0, 40).map(([id, n]) => ({ id, votes: n, won: winners.includes(id), name: findPerson(w, id)?.name ?? '', party: findPerson(w, id)?.faction ?? null })), voters, electorate: electorate.length,
    parties: Object.entries(lv).map(([id, votes]) => ({ id, votes, seats: alloc[id] ?? 0 })).sort((a, b) => b.votes - a.votes), method: `D’Hondt: ${SEAT_COUNT} sandalye parti oylarına göre bölünür; parti içinde en çok kişisel oy alan adaylar girer. Bağımsızlar baraj (≈%${Math.round(100 / (SEAT_COUNT + 1))}) üstünde kalırsa girer.` };
  for (const p of w.people) {
    const was = p.meclis; p.meclis = winners.includes(p.id);
    if (p.meclis) { p.vaatler = [...(e.vaat?.[p.id] ?? [])]; p.proposedG = []; }
    if (p.meclis && !was) { p.immune = true; if (p.playerId) log(w, `🗳 ${p.name} milletvekili seçildi! Meclis bölümü açıldı.`, p.id); }
    if (!p.meclis) { p.immune = false; if (was) p.vaatler = []; }
  }
  electLeaders(w); reelectLeaders(w); formGovt(w); use(w, 'secim'); if ((w.meclis.govt ?? []).length > 1) use(w, 'koalisyon'); if (Object.keys(e.vaat ?? {}).length || Object.keys(e.symp ?? {}).length) use(w, 'kampanyali_secim');
  const turnout = Math.round(voters / Math.max(1, electorate.length) * 100);
  mlog(w, `Seçim sonuçları (${SEAT_COUNT} sandalye, katılım %${turnout}, ${voters}/${electorate.length} seçmen): ${Object.entries(alloc).filter(([, n]) => n > 0).map(([l, n]) => `${l.startsWith('ind:') ? `${findPerson(w, l.slice(4))?.name ?? '?'} (bağımsız)` : partyName(w, l)} ${n}`).join(', ')}. Seçilenler: ${winners.map((id) => findPerson(w, id)?.name).join(', ')}.`);
  return winners;
}
/** How much an NPC voter likes a candidate (personal ties + party closeness + campaign). */
export function voterScore(w: World, v: Person, cp: Person): number {
  const e = w.election; const f = facOf(w, cp.faction);
  let sc = (v.relations[cp.id] ?? 0) * 0.5 + (e.posters?.[cp.id] ?? 0) * 3 + (e.symp?.[`${cp.id}|${v.id}`] ?? 0) + (e.symp?.[cp.id] ?? 0) - (e.smear?.[cp.id] ?? 0) - Math.abs(v.din - cp.din) * 0.1;
  if (f) { sc += 20 - axisDistance(v, f) / 4 + (v.faction === f.id ? 10 : 0) + (e.partyPosters?.[f.id] ?? 0) * 1.5 + (f.support?.[districtOf(w, v)] ?? 25) / 8; if ((e.endorse?.[cp.id] ?? []).length) sc += 2; }
  else sc += 6 - Math.abs(v.republic - cp.republic) * 0.2;
  for (const k of e.vaat?.[cp.id] ?? []) sc += vaatFit(w, v, k) * 6;
  if ((cp.promiseScore ?? 0) < 0) sc -= 6;
  return sc;
}
const axisDistance = (v: Person, f: Faction): number => { const a = personAxesM(v); const b = f.axes ?? [50, 50, 50]; return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };
/** How well a vaat fits a voter's needs (-1..1): the hungry care about bread, tradesmen about taxes … */
export function vaatFit(w: World, v: Person, k: GKind): number { return Math.max(-1, Math.min(1, genelgeStance(w, v, k))); }

export function electLeaders(w: World): void {
  for (const f of w.meclis.factions) {
    const m = w.people.filter((p) => p.faction === f.id && p.meclis);
    const pool = m.length ? m : w.people.filter((p) => p.faction === f.id);
    const cur = findPerson(w, f.leaderId);
    if (cur && cur.faction === f.id && (cur.meclis || !m.length)) continue;
    f.leaderId = pool.sort((a, b) => (b.playerId ? 1000 : 0) + b.ambition - ((a.playerId ? 1000 : 0) + a.ambition))[0]?.id ?? null;
  }
}

export function validateBill(w: World, kind: BillKind, value: number, target: string, law?: LawSpec, borc = false): string | null {
  switch (kind) {
    case 'ozel': return law ? validateLaw(law) : 'Kanun metni yok.';
    case 'vergi': return value >= 0 && value <= 40 ? null : 'Vergi 0–40 arası olmalı.';
    case 'fiyat': return GOODS.includes(target as never) && value > 0 && value <= 100 ? null : 'Geçersiz narh.';
    case 'maas': return (STATE_PROFS.includes(target as Profession) || target === 'meclis') && value >= 0 && value <= 60 ? null : 'Geçersiz maaş.';
    case 'butce': return value >= 0 && value <= 50000 ? null : 'Bütçe 0–50000.';
    case 'kanun': return w.laws.some((l) => l.id === target) ? null : 'Kanun yok.';
    case 'insaat': { const [kind, plot] = target.split('@'); const k = BUILD[kind ?? '']; if (!k) return 'Hangi yapı? (Çeşme, Hamam, Kütüphane, Kervansaray)'; if (!w.buildings.some((b) => b.id === plot && b.kind === 'arsa')) return 'Boş bir arsa seçin.'; if (w.projects.some((x) => !x.done)) return 'Süren bir inşaat var; önce o bitmeli.'; if (w.projects.some((x) => x.done && x.kind === kind && (x.doneDay ?? 0) > w.day - 10)) return `${k[0]} yakın zamanda yapıldı.`; if (!borc && w.treasury - k[1] < 300) return `Hazine yetersiz: ${k[0]} ${k[1]} D, hazinede ${Math.round(w.treasury)} D.`; return null; }
    case 'af': return null;
    case 'gensoru': { const p = findPerson(w, target); return p && (STATE_PROFS.includes(p.prof) || !!p.rank) && p.id !== w.kayzerId ? null : 'Gensoru devlet görevlileri ve vezir/paşa gibi unvanlılar için.'; }
    case 'sorusturma': return findPerson(w, target) && target !== w.kayzerId ? null : 'Geçersiz kişi.';
    case 'dokunulmazlik': { const p = findPerson(w, target); return p?.meclis && p.immune ? null : 'Bu kişinin dokunulmazlığı yok.'; }
    case 'azil': return w.regime === 'cumhuriyet' && w.kayzerId ? null : 'Azil sadece cumhuriyette, Başkan için.';
    case 'genelge': return isGKind(target) ? gBlock(w, target, borc) : 'Genelge katalogdan seçilmeli.';
    case 'kaldir': return repealTarget(w, target) ? null : 'Kaldırılacak yürürlükte bir kanun ya da genelge seçin.';
    case 'cumhuriyet': return w.regime !== 'imparatorluk' ? 'Zaten cumhuriyet.' : w.isyan ? 'İsyan sürerken anayasa değişmez.' : w.day < (w.meclis.anayasaCooldown ?? 0) ? `Cumhuriyet İlanı reddedildi; ${w.meclis.anayasaCooldown}. güne kadar yeniden önerilemez.` : w.meclis.bills.some((b) => b.kind === 'cumhuriyet' && ['tartisma', 'oylama', 'onay'].includes(b.status)) ? 'Cumhuriyet İlanı zaten gündemde.' : null;
  }
}

export function billTitle(w: World, kind: BillKind, value: number, target: string, law?: LawSpec): string {
  const who = findPerson(w, target)?.name ?? '';
  switch (kind) {
    case 'ozel': return law ? (law.name?.trim() || lawTitle(law)) : 'Özel kanun';
    case 'vergi': return `Satış vergisi %${value} olsun`;
    case 'fiyat': return `${GOOD_LABEL[target as keyof typeof GOOD_LABEL] ?? target} narhı ${value} Dinar`;
    case 'maas': return `${target === 'meclis' ? 'Meclis üyesi' : PROF_LABEL[target as Profession]} maaşı ${value} Dinar`;
    case 'butce': return `20 günlük bütçe: ${value} Dinar harcama sınırı`;
    case 'kanun': { const l = w.laws.find((x) => x.id === target); return `${l?.name ?? target} ${l?.active ? 'kaldırılsın' : 'yürürlüğe girsin'}`; }
    case 'insaat': { const [kind, plot] = target.split('@'); const k = BUILD[kind ?? '']; return k ? `Yeni inşaat: ${k[0]} (${plot}, ${k[1]} D)` : `Yeni inşaat (${value} Dinar)`; }
    case 'af': return 'Genel af: zindan boşaltılsın';
    case 'gensoru': return `Gensoru: ${who} görevden alınsın`;
    case 'sorusturma': return `Soruşturma komisyonu: ${who}`;
    case 'dokunulmazlik': return `${who}'ın dokunulmazlığı kaldırılsın`;
    case 'azil': return `Başkan ${who} azledilsin`;
    case 'genelge': return isGKind(target) ? `Genelge: ${GENELGE[target].label}` : 'Meclis bildirisi';
    case 'cumhuriyet': return 'Anayasa değişikliği: Cumhuriyet ilan edilsin';
    case 'kaldir': return `Kaldırılsın: ${repealTarget(w, target)?.name ?? target}`;
  }
}

export function propose(w: World, proposer: Person, kind: BillKind, value: number, target: string, title?: string, law?: LawSpec, priority = false, opt: { borc?: boolean; dilekce?: string } = {}): Bill | string {
  if (!proposer.meclis && !opt.dilekce) return 'Sadece Meclis üyeleri kanun teklif edebilir.';
  if (!Object.prototype.hasOwnProperty.call(BILL_LABEL, kind)) return 'Geçersiz teklif türü.';
  if (kind === 'azil') target = w.kayzerId ?? '';
  const err = validateBill(w, kind, value, target, law, !!opt.borc); if (err) return err;
  const open = w.meclis.bills.filter((b) => b.status === 'tartisma' || b.status === 'oylama' || b.status === 'onay');
  if (!priority && open.filter((b) => b.status !== 'onay').length >= 6) return 'Meclis gündemi dolu.';
  if (!priority && !opt.dilekce && open.some((b) => b.proposerId === proposer.id && b.status !== 'onay')) return 'Görüşülen bir teklifiniz zaten var.';
  // v2.0.1: no duplicates – the same kind+target on the agenda, or passed/rejected in the last 7 days
  const key = (b: Bill): string => `${b.kind}|${b.kind === 'insaat' ? b.target.split('@')[0] : b.target}|${b.kind === 'vergi' || b.kind === 'maas' || b.kind === 'fiyat' ? b.value : ''}`;
  const me = key({ kind, target, value } as Bill);
  if (open.some((b) => key(b) === me)) return 'Aynı teklif zaten gündemde.';
  if (w.meclis.bills.some((b) => key(b) === me && w.day - b.day < 7)) return 'Aynı teklif son 7 günde görüşüldü.';
  const cost = kind === 'insaat' ? BUILD[target.split('@')[0] ?? '']?.[1] ?? value : kind === 'genelge' && isGKind(target) ? GENELGE[target].cost : 0;
  // v2.0.1 hazine kilidi: spending the hazine can't cover needs the BORÇLANMA label
  if (cost > 0 && w.treasury - cost < HAZINE_FLOOR && !opt.borc) return `Hazine karşılamaz: ${cost} D gerekiyor, hazinede ${Math.round(w.treasury)} D var (${HAZINE_FLOOR} D yedek kalmalı). Ancak “Borçlanma” etiketiyle önerilebilir.`;
  if (!opt.dilekce && !transfer(w, proposer.id, 'saray', PROPOSE_FEE, 'teklif harcı') && !proposer.npc && proposer.playerId) return `Teklif harcı ${PROPOSE_FEE} D; kesenizde yok.`;
  const costly = cost >= KOMISYON_MIN;
  const debate = kind === 'cumhuriyet' ? ANAYASA_DEBATE : priority ? (costly ? 1 : 0) : DEBATE_DAYS + (costly ? 1 : 0);
  const bill: Bill = { id: nextId(w, 'B'), kind, value: kind === 'insaat' ? cost : value, target, title: (kind === 'genelge' || kind === 'insaat' || kind === 'cumhuriyet' ? billTitle(w, kind, value, target, law) : (title?.slice(0, 60) || billTitle(w, kind, value, target, law))), law, proposerId: proposer.id, day: w.day,
    debateUntil: w.day + debate, voteUntil: w.day + debate + VOTE_DAYS, status: debate === 0 ? 'oylama' : 'tartisma', votes: {}, speeches: [], cost, priority, borc: opt.borc && cost > 0 && w.treasury - cost < HAZINE_FLOOR ? true : undefined, dilekce: opt.dilekce };
  if (bill.borc) bill.title = `[BORÇLANMA] ${bill.title}`.slice(0, 70);
  if (opt.dilekce) bill.title = `Halk dilekçesi: ${bill.title}`.slice(0, 70);
  w.meclis.bills.push(bill);
  if (costly) komisyonReview(w, bill);
  use(w, opt.dilekce ? 'dilekce_gundem' : `teklif_${kind}`, proposer);
  if (bill.status === 'oylama') notifyVote(w, bill);
  if (kind === 'genelge' && isGKind(target)) (proposer.proposedG ??= []).push(target);
  bill.lines = partyLines(w, bill, (p) => stance(w, p, bill));
  mlog(w, `${priority ? '⭐ Hükümet öncelikli teklifi: ' : ''}${proposer.name} (${partyName(w, proposer.faction)}) teklif verdi: “${bill.title}”.`, proposer.id);
  return bill;
}

/** NPC stance on a bill, -1..1 (positive = yes). Faction ideology + personal interest + bribes. */
export function stance(w: World, p: Person, b: Bill): number {
  if (b.kind === 'cumhuriyet') return anayasaStance(w, p, b);
  const kom = b.komisyon ? (b.komisyon.ok ? 0.25 : -0.9) : 0; // the Bütçe Komisyonu report sways the floor
  return kom + stance0(w, p, b);
}
function stance0(w: World, p: Person, b: Bill): number {
  const f = w.meclis.factions.find((x) => x.id === p.faction)?.ideology ?? 'halkci';
  let s = 0;
  const target = findPerson(w, b.target);
  switch (b.kind) {
    case 'ozel': s = lawStance(w, p, f, b.law); break;
    case 'vergi': s = b.value < w.taxRate ? (f === 'esnaf' ? 0.8 : f === 'saltanatci' ? -0.2 : 0.4) : (f === 'saltanatci' ? 0.3 : -0.6); if (b.value > 20) s -= 0.6; break;
    case 'fiyat': s = f === 'esnaf' ? -0.7 : f === 'halkci' ? 0.6 : 0; break;
    case 'maas': s = (b.target === p.prof || b.target === 'meclis' ? 0.8 : f === 'halkci' ? 0.4 : f === 'esnaf' ? -0.4 : 0) + (w.treasury < 1500 ? -0.6 : 0); break;
    case 'butce': s = f === 'saltanatci' ? 0.7 : f === 'esnaf' ? (b.value < 1500 ? 0.4 : -0.5) : b.value > 3000 ? -0.3 : 0.3; break;
    case 'kanun': { const l = w.laws.find((x) => x.id === b.target); s = l?.id === 'saraykor' ? (f === 'saltanatci' ? 0.6 : -0.7) : l?.id === 'toplanti' ? (f === 'cumhuriyetci' ? (l.active ? -0.9 : 0.9) : 0) : f === 'halkci' ? 0.3 : 0; break; }
    case 'insaat': s = (f === 'halkci' ? 0.7 : f === 'esnaf' ? 0.2 : 0.1) + (w.treasury - b.value < 1000 ? -1.2 : 0); break;
    case 'af': s = f === 'cumhuriyetci' || f === 'halkci' ? 0.5 : -0.6; break;
    case 'gensoru': s = f === 'cumhuriyetci' ? 0.6 : f === 'saltanatci' ? -0.7 : 0; if (target) s += (50 - target.honesty) / 80; break;
    case 'sorusturma': s = f === 'cumhuriyetci' ? 0.6 : f === 'saltanatci' ? -0.3 : 0.2; if (target && target.honesty < 40) s += 0.3; if (target?.id === p.id) s = -1; break;
    case 'dokunulmazlik': s = target?.id === p.id ? -1 : target?.faction === p.faction ? -0.6 : 0.3; break;
    case 'kaldir': { const g = b.target.slice(2); s = b.target.startsWith('g:') && isGKind(g) ? -(genelgeStance(w, p, g) + programFit(facOf(w, p.faction), g) * 0.8) : b.target.startsWith('l:') ? -lawStance(w, p, f, (w.customLaws ?? []).find((x) => x.id === g)) * 0.8 : -0.1; break; }
    case 'genelge': s = isGKind(b.target) ? genelgeStance(w, p, b.target) + programFit(facOf(w, p.faction), b.target) * 0.8 : 0.05 + (p.relations[b.proposerId] ?? 0) / 150; break;
    case 'azil': { const avgMood = w.people.reduce((a, x) => a + x.mood, 0) / w.people.length; s = (50 - avgMood) / 40 + (target?.faction === p.faction ? -0.8 : 0.2); break; }
  }
  // faction discipline: follow the leader if he already voted
  const leader = findPerson(w, w.meclis.factions.find((x) => x.id === p.faction)?.leaderId);
  const lv = leader && leader.id !== p.id ? b.votes[leader.id] : undefined;
  if (lv) s += lv === 'evet' ? 0.5 : lv === 'hayir' ? -0.5 : 0;
  // proposer friendship and bribes from the proposer (or anyone who asked for this bill)
  s += (p.relations[b.proposerId] ?? 0) / 200;
  const bribe = w.meclis.bribes.filter((x) => x.to === p.id && w.day - x.day <= 10 && (x.from === b.proposerId)).reduce((a, x) => a + x.amount, 0);
  if (bribe > 0 && p.honesty < 70) s += Math.min(1.2, bribe / 60);
  return Math.max(-1.5, Math.min(1.5, s + (rand(w) - 0.5) * 0.5));
}

export function npcVote(w: World, p: Person, b: Bill): VoteChoice { const s = stance(w, p, b); return s > 0.15 ? 'evet' : s < -0.15 ? 'hayir' : 'cekimser'; }

/** v2.0.1: a speech built from the member's actual vote, the bill's catalogue effect, his party line and his own situation. */
export function npcSpeech(w: World, p: Person, b: Bill, v: string): string {
  const f = facOf(w, p.faction); const g = b.kind === 'genelge' && isGKind(b.target) ? GENELGE[b.target] : null;
  const open = pick(w, ['Sayın Meclis,', 'Değerli arkadaşlar,', 'Muhterem üyeler,', 'Kürsüden açıkça söylüyorum:', 'Halkımız adına konuşuyorum:']);
  const bread = (w.prices.ekmek ?? 1.2).toFixed(2).replace('.', ',');
  const why: Record<string, string[]> = {
    evet: g ? [`${g.desc.split(':')[0]} – bu ${g.days} gün şehre iyi gelecek.`, `${g.what} için bu adım şart.`, `Ekmek ${bread} D iken halk bir çare bekliyor.`, `Bedeli ${g.cost ? g.cost + ' D' : 'hazineye yük değil'}; değer.`] : [`Bu teklif ${b.title.toLowerCase()} demek; destekliyorum.`, 'Şehrin buna ihtiyacı var.'],
    hayir: g ? [`${g.cost ? `Hazineden ${g.cost} D çıkacak, hazinede ${Math.round(w.treasury)} D var` : 'Bunun bedelini halk öder'}; karşıyım.`, `${g.label} şimdi yanlış zamanda.`, `Bu, ${f ? f.name + ' programına' : 'vicdanıma'} aykırı.`] : [`Hazinede ${Math.round(w.treasury)} D var; bu israf.`, 'Aceleye getirilmiş bir teklif.'],
    cekimser: ['Faydası da zararı da var; çekimser kalacağım.', 'Daha çok görüşmeliydik; oyum çekimser.'],
  };
  const me = p.prof === 'firinci' && g?.what === 'ekmek' ? ' Bir fırıncı olarak söylüyorum.' : p.prof === 'tuccar' && b.target.startsWith('vergi') ? ' Tüccarın sırtındaki yükü biliyorum.' : p.din > 70 && b.target.startsWith('icki') ? ' İnancım bunu gerektiriyor.' : '';
  const line = f && b.lines?.[f.id] ? (b.lines[f.id] === v ? ` ${f.name} olarak ${v === 'evet' ? 'evet' : v === 'hayir' ? 'hayır' : 'çekimser'} diyoruz.` : ` Partimin çizgisinden ayrılıyorum.`) : ' Bağımsız olarak oyumu veriyorum.';
  return `${open} ${pick(w, why[v] ?? why.cekimser!)}${me}${line}`.replace(/\s+/g, ' ').trim();
}
/** How much a genelge serves this person's own needs (-1..1). */
export function genelgeStance(w: World, p: Person, k: GKind): number {
  const poor = p.money < 15 || (p.cantAfford ?? -9) >= w.day - 2; const trader = ['tuccar', 'firinci', 'kasap', 'marangoz', 'demirci', 'dokumaci', 'terzi', 'barci', 'degirmenci'].includes(p.prof);
  const cost = GENELGE[k].cost; let s = cost > 0 && w.treasury - cost < 800 ? -0.6 : 0;
  switch (k) {
    case 'ambar': case 'asevi': case 'fiyatTavani': s += poor ? 0.8 : 0.2; if (k === 'fiyatTavani' && p.prof === 'firinci') s -= 1.2; break;
    case 'vergiIndirim': s += trader ? 0.8 : 0.1; break; case 'vergiArtirim': s += trader ? -0.9 : -0.3; break;
    case 'ickiYasak': s += (p.din - 50) / 40 - (p.prof === 'barci' ? 1 : 0); break; case 'ickiSerbest': s += (50 - p.din) / 40 + (p.prof === 'barci' ? 1 : 0); break;
    case 'saglik': case 'kuyu': s += p.infected || p.health < 50 ? 0.9 : 0.3; break; case 'bekci': s += p.money > 80 ? 0.6 : 0.2; break;
    case 'okul': s += 0.3; break; case 'yol': case 'ithalat': s += trader ? 0.6 : 0.2; break; case 'senlik': s += p.mood < 50 ? 0.6 : 0.2; break;
    case 'asker': s += p.loyalty > 60 ? 0.4 : -0.2; break; case 'liman': s += 0.3; break;
  }
  return s;
}

function enactable(b: Bill): boolean { return b.status === 'kabul'; }

/** Apply a bill that has become law. */
export function enact(w: World, b: Bill): void {
  b.status = 'kabul'; use(w, `kabul_${b.kind}`);
  switch (b.kind) {
    case 'ozel': if (b.law) enactLaw(w, b.law, findPerson(w, b.proposerId) ?? null, 'meclis'); break;
    case 'vergi': w.taxRate = b.value; break;
    case 'fiyat': { const g = b.target as keyof typeof BASE_PRICE; w.prices[g] = b.value; for (const l of w.listings) if (l.good === g && l.price > b.value) l.price = b.value; break; }
    case 'maas': if (b.target === 'meclis') w.meclis.salary = b.value; else w.salaries[b.target as Profession] = b.value; break;
    case 'butce': w.budget = { limit: b.value, spent: 0, until: w.day + 20, approved: true }; break;
    case 'kanun': { const l = w.laws.find((x) => x.id === b.target); if (l) l.active = !l.active; break; }
    case 'insaat': {
      if (b.borc) borrowFor(w, b.cost ?? 0);
      const [kind, plotId] = b.target.split('@'); const k = BUILD[kind ?? '']; const plot = w.buildings.find((x) => x.id === plotId && x.kind === 'arsa');
      if (!k || !plot) { b.status = 'ret'; b.result = 'Arsa artık boş değil; uygulanamadı'; return; }
      if (w.projects.some((x) => !x.done)) { b.status = 'ret'; b.result = 'Süren bir inşaat var; uygulanamadı'; return; }
      if (w.treasury - k[1] < 300) { b.status = 'ret'; b.result = 'Hazine yetersiz'; mlog(w, `“${b.title}” kabul edildi ama hazine yetersiz; uygulanamadı.`); return; }
      const pr = { id: `pr${++w.idSeq}`, name: `${k[0]} inşaatı`, site: plot.id, plot: plot.id, kind, cost: k[1], paid: 0, progress: 0, needed: Math.round(k[1] / 10), done: false };
      w.projects.push(pr); plot.name = `${k[0]} (inşaatta)`; transfer(w, 'saray', `proje:${pr.id}`, k[1], 'Meclis inşaat ödeneği');
      break;
    }
    case 'af': for (const p of w.people) p.jailedDays = 0; for (const c of w.cases) if (c.stage !== 'kapandi') { c.stage = 'kapandi'; c.verdict = 'af'; } break;
    case 'gensoru': { const t = findPerson(w, b.target); if (t) { const old = t.rank ? `${t.rank} unvanı ve ${PROF_LABEL[t.prof]}` : PROF_LABEL[t.prof]; t.rank = null; t.fief = null; t.prof = STATE_PROFS.includes(t.prof) ? 'hamal' : t.prof; t.work = WORKPLACE.hamal; t.mood = clamp(t.mood - 20); mlog(w, `Gensoru kabul edildi: ${t.name} ${old} görevinden alındı.`, t.id); } break; }
    case 'sorusturma': investigate(w, b.target); break;
    case 'dokunulmazlik': { const t = findPerson(w, b.target); if (t) { t.immune = false; mlog(w, `${ek(t.name, 'ın')} dokunulmazlığı kaldırıldı.`, t.id); } break; }
    case 'genelge': {
      if (b.borc) borrowFor(w, b.cost ?? 0);
      if (isGKind(b.target)) { const r = enactG(w, b.target, b.id, b.proposerId); if (!r.startsWith('yürürlükte')) { b.status = 'ret'; b.result = r; mlog(w, `“${b.title}” uygulanamadı: ${r}`); return; } b.result = r; return; }
      log(w, `📜 Meclis bildirisi yayımlandı: “${b.title}” (somut bir etkisi yoktur).`); b.result = 'bildiri yayımlandı (somut etkisi yok)'; return;
    }
    case 'cumhuriyet': peacefulRepublic(w, b); break;
    case 'kaldir': { const t = repealTarget(w, b.target); if (!t) { b.status = 'ret'; b.result = 'Zaten yürürlükte değil'; return; }
      if (t.type === 'g') cancelG(w, t.id as GKind); else if (t.type === 'l') repealLaw(w, t.id); else { const l = w.laws.find((x) => x.id === t.id); if (l) l.active = false; }
      mlog(w, `🗑 Meclis kararıyla kaldırıldı: ${t.name}.`); break; }
    case 'azil': { const t = findPerson(w, w.kayzerId); w.kayzerId = null; w.election.baskanNextDay = w.day + 1; mlog(w, `Başkan ${t?.name ?? ''} azledildi! Yarın yeni Başkanlık seçimi var.`); break; }
  }
  b.result = 'yürürlüğe girdi';
}

/** Commission: digs into the ledger, exposes bribes, sends evidence to the court (immunity blocks members). */
export function investigate(w: World, targetId: string): string {
  const t = findPerson(w, targetId); if (!t) return 'kimse yok';
  const dirty = w.ledger.filter((l) => (l.to === t.id || l.from === t.id) && ['rüşvet', 'zimmet', 'hırsızlık'].includes(l.reason) && w.day - l.day <= 30);
  const bribes = w.meclis.bribes.filter((x) => (x.to === t.id || x.from === t.id) && w.day - x.day <= 30);
  for (const x of bribes) x.exposed = true;
  const amount = dirty.reduce((a, l) => a + l.amount, 0) + bribes.reduce((a, x) => a + x.amount, 0);
  if (!dirty.length && !bribes.length) { mlog(w, `Soruşturma komisyonu ${t.name} hakkında suç bulamadı.`); return 'temiz'; }
  const crime = dirty.some((l) => l.reason === 'zimmet') ? 'zimmet' : dirty.some((l) => l.reason === 'hırsızlık') ? 'hirsizlik' : 'rusvet';
  if (t.meclis && t.immune) { mlog(w, `Komisyon ${t.name} hakkında ${Math.round(amount)} Dinar'lık delil buldu, ama dokunulmazlığı var.`, t.id); return 'dokunulmazlık'; }
  openCase(w, t.id, crime, null, Math.round(amount), Math.min(95, 50 + dirty.length * 10 + bribes.length * 15));
  mlog(w, `Soruşturma komisyonu ${t.name} hakkındaki delilleri mahkemeye gönderdi (${Math.round(amount)} Dinar).`, t.id);
  return 'mahkemeye';
}

/** Kayzer's sanction. Veto is FINAL – there is no override; it costs a little goodwill. */
export function sanction(w: World, b: Bill, approve: boolean): string {
  if (b.status !== 'onay') return 'Bu karar onay beklemiyor.';
  if (approve) { enact(w, b); mlog(w, `Kayzer “${b.title}” kararını onayladı.`); return 'Onaylandı, yürürlükte.'; }
  b.status = 'veto'; b.result = 'Kayzer veto etti (kesin)';
  for (const x of w.people) if (x.prof !== 'naip' && x.id !== w.kayzerId) { x.republic = clamp(x.republic + 0.7); x.loyalty = clamp(x.loyalty - 1.5); }
  mlog(w, `Kayzer “${b.title}” kararını veto etti. Veto kesindir.`);
  return 'Veto edildi. Veto kesindir.';
}

/** v2.0.1 AI naip/Kayzer sanction rules: hazine first, then the people's mood, then ideology and the Meclis margin. */
export function aiApprove(w: World, b: Bill): boolean {
  if ((b.cost ?? 0) > 0 && !affordable(w, b.cost ?? 0) && !b.borc) return false;
  if (b.borc && (w.meclis.borc ?? 0) > 1500) return false;
  const mood = w.people.reduce((a, p) => a + p.mood, 0) / Math.max(1, w.people.length); const t = tally(b);
  const pf = facOf(w, findPerson(w, b.proposerId)?.faction); const yon = pf ? axesOf(pf)[0] : 50;
  switch (b.kind) {
    case 'vergi': { const R = hazineReserve(w), tr = hazineTrend(w); // a cut only from a growing, well-stocked hazine (or a truly angry city with some reserve)
      return b.value <= w.taxRate ? (w.treasury > R * 3 && tr >= 0) || (mood < 45 && w.treasury > R) : (w.treasury < R * 3 || tr < -15) && b.value <= 20; }
    case 'af': return mood < 40 || t.evet >= 12;
    case 'gensoru': case 'azil': return t.evet >= 11;
    case 'maas': { const cur = b.target === 'meclis' ? w.meclis.salary : w.salaries[b.target as Profession] ?? 0; const n = b.target === 'meclis' ? members(w).length : w.people.filter((p) => p.prof === b.target).length; return b.value <= cur || (hazineTrend(w) >= (b.value - cur) * n && affordable(w, (b.value - cur) * n * 60)); }
    case 'genelge': if (b.target === 'vergiIndirim' && !(w.treasury > hazineReserve(w) * 3 && hazineTrend(w) >= 0) && mood >= 40) return false; break;
    default: break;
  }
  if (t.evet >= 12 || mood < 40) return true; // a broad majority or an unhappy city: don't defy the Meclis
  return yon <= 70 || t.evet >= 10;
}
export function tally(b: Bill): { evet: number; hayir: number; cekimser: number } {
  const t = { evet: 0, hayir: 0, cekimser: 0 }; for (const v of Object.values(b.votes)) t[v] += 1; return t;
}

const headIsPlayer = (w: World): boolean => { const k = findPerson(w, w.kayzerId); return !!k?.playerId && !k.npc; };
/** Daily Meclis business. `playerControlled(p)` = a player who decides himself (NPCs/offline-conservative vote by AI). */
export function meclisDay(w: World, playerDecides: (p: Person) => boolean, headOnline: boolean): void {
  const ms = members(w);
  // salaries for members
  for (const p of ms) if (w.meclis.salary > 0 && p.jailedDays === 0) transfer(w, 'saray', p.id, w.meclis.salary, 'meclis maaşı');
  // v1.9.6: extra daily allowance for every sitting MP, paid from the treasury (shows in the ledger)
  for (const p of ms) if (p.jailedDays === 0 && w.treasury >= MP_ALLOWANCE) transfer(w, 'saray', p.id, MP_ALLOWANCE, 'milletvekili ödeneği');
  // v2.0.1 parties: dues, help, ranks, support, weekly hükümet priority bill and opposition audit
  partyDay(w, (p, k, pr) => { if (npcFitG(w, k)) propose(w, p, 'genelge', 0, k, undefined, undefined, pr); });
  byElection(w); repayDebt(w); komisyonMembers(w); dilekceDay(w);
  // NPC proposals (sensible, from city conditions and the party program)
  for (const p of ms) if (!playerDecides(p) && chance(w, 0.12)) npcPropose(w, p);
  for (const b of w.meclis.bills) {
    if (!['tartisma', 'oylama', 'onay'].includes(b.status)) continue;
    b.lines = partyLines(w, b, (p) => stance(w, p, b)); // the line follows the hazine and the leader day by day
    b.lean ??= {};
    if (b.status === 'tartisma' || b.status === 'oylama') {
      // NPC members decide once (party line unless they defect) and speak in line with that decision
      for (const p of ms) if (!playerDecides(p) && !b.lean[p.id]) { const d = b.kind === 'cumhuriyet' ? conscienceVote(w, p, b) : disciplinedVote(w, p, b, stance(w, p, b)); b.lean[p.id] = d.v; if (b.speeches.length < 10 && chance(w, d.defect ? 0.9 : 0.45)) b.speeches.push({ personId: p.id, text: npcSpeech(w, p, b, d.v), day: w.day }); }
    }
    if (b.status === 'tartisma') {
      if (w.day >= b.debateUntil) { b.status = 'oylama'; mlog(w, `“${b.title}” oylamaya açıldı (sayım ${b.voteUntil}. gün ${String(COUNT_HOUR).padStart(2, '0')}:00).`); notifyVote(w, b); }
    } else if (b.status === 'oylama' && w.day >= b.voteUntil) {
      for (const p of ms) if (!b.votes[p.id] && !playerDecides(p)) { b.votes[p.id] = b.lean[p.id] ?? npcVote(w, p, b); recordVote(w, p, b, b.votes[p.id]!); }
      const t = tally(b);
      const need = b.kind === 'cumhuriyet' ? ANAYASA_YES : b.kind === 'azil' ? Math.ceil(ms.length * 2 / 3) : Math.floor(ms.length / 2) + 1;
      const quorum = Math.floor(w.meclis.seats.length * QUORUM_SHARE) + 1; const present = t.evet + t.hayir + t.cekimser;
      if (present < quorum) { b.status = 'ret'; b.result = `Yeter sayı yok (${present}/${quorum})`; mlog(w, `“${b.title}”: yeter sayı sağlanamadı (${present} oy, en az ${quorum} gerekir) → geçersiz.`); continue; }
      const passed = t.evet >= need && t.evet > t.hayir;
      mlog(w, `“${b.title}”: ${t.evet} evet · ${t.hayir} hayır · ${t.cekimser} çekimser${b.kind === 'cumhuriyet' ? ` (gereken ${ANAYASA_YES})` : ''} → ${passed ? 'KABUL' : 'RET'}.`);
      if (!passed) { b.status = 'ret'; b.result = b.kind === 'cumhuriyet' ? `Anayasa çoğunluğu (${ANAYASA_YES}) sağlanamadı` : 'Meclis reddetti'; if (b.kind === 'cumhuriyet') anayasaFailed(w, b, t.evet); continue; }
      const needsSanction = w.regime === 'imparatorluk' && b.kind !== 'sorusturma' && b.kind !== 'dokunulmazlik' && b.kind !== 'genelge' && b.kind !== 'cumhuriyet' && !!w.kayzerId && !b.fromKayzer;
      if (needsSanction) { b.status = 'onay'; b.voteUntil = w.day + SANCTION_DAYS; b.onayDay = w.day; mlog(w, `“${b.title}” Kayzer'in onayını bekliyor.`); }
      else enact(w, b);
    } else if (b.status === 'onay' && (!headIsPlayer(w) || !headOnline || w.day >= b.voteUntil)) {
      // v2.0.1: an NPC ruler, or the naip for an absent/undecided player ruler, answers by the next session (nothing waits forever)
      const approve = aiApprove(w, b); sanction(w, b, approve); use(w, approve ? 'naip_onay' : 'naip_veto');
      b.result = `${b.result ?? ''}${headIsPlayer(w) ? ' (Naip karar verdi)' : ''}`.trim();
    }
  }
  void headOnline; void enactable;
  // bribery exposure by the press
  for (const x of w.meclis.bribes) if (!x.exposed && chance(w, 0.06)) {
    x.exposed = true; const a = findPerson(w, x.from), m = findPerson(w, x.to);
    mlog(w, `SKANDAL! Kalemşörler ${a?.name ?? '?'}'ın ${m?.name ?? '?'}'a ${x.amount} Dinar rüşvet verdiğini yazdı.`, x.to);
    if (m) { m.loyalty = clamp(m.loyalty - 5); for (const p of w.people) p.relations[x.to] = clamp((p.relations[x.to] ?? 0) - 5, -100, 100); if (!(m.meclis && m.immune)) openCase(w, m.id, 'rusvet', null, x.amount, 60); }
    if (a) openCase(w, a.id, 'rusvet', null, x.amount, 55);
  }
  w.meclis.bribes = w.meclis.bribes.filter((x) => w.day - x.day <= 30);
  w.meclis.bills = w.meclis.bills.filter((b) => ['tartisma', 'oylama', 'onay'].includes(b.status) || w.day - b.day < 25);
  if (w.day % 5 === 0) electLeaders(w);
}

/** v2.0.1 anayasa vote: no party discipline – each MP votes by his own republic value, mood and loyalty to the Kayzer. */
export function anayasaStance(w: World, p: Person, b: Bill): number {
  let s = (p.republic - 50) / 18 + (50 - p.mood) / 45 + (50 - p.loyalty) / 35;
  if (p.id === w.kayzerId || p.soylu) s -= 3; // the dynasty never votes itself out
  s += (p.relations[b.proposerId] ?? 0) / 300;
  return s + (rand(w) - 0.5) * 0.4;
}
export function conscienceVote(w: World, p: Person, b: Bill): { v: VoteChoice; defect: boolean } {
  const s = anayasaStance(w, p, b); const v: VoteChoice = s > 0.2 ? 'evet' : s < -0.2 ? 'hayir' : 'cekimser';
  const f = facOf(w, p.faction); const line = f ? b.lines?.[f.id] : undefined;
  return { v, defect: !!line && v !== line && v !== 'cekimser' };
}
/** Failed Cumhuriyet İlanı: the proposer falls out with the Kayzer and the bill can't return for a while. */
function anayasaFailed(w: World, b: Bill, yes: number): void {
  w.meclis.anayasaCooldown = w.day + ANAYASA_COOLDOWN;
  const pr = findPerson(w, b.proposerId); const k = findPerson(w, w.kayzerId);
  if (pr && k) { pr.relations[k.id] = clamp((pr.relations[k.id] ?? 0) - 25, -100, 100); k.relations[pr.id] = clamp((k.relations[pr.id] ?? 0) - 30, -100, 100); }
  log(w, `📜 Cumhuriyet İlanı Meclis'te reddedildi (${yes}/${ANAYASA_YES} evet). ${pr?.name ?? 'Teklif sahibi'} Kayzer'in gözünden düştü; teklif ${ANAYASA_COOLDOWN} gün yeniden verilemez.`, b.proposerId);
}
/** v2.0.1: the peaceful path – the Meclis amends the anayasa; the Kayzer steps down as a citizen, a Başkan is elected. */
export function peacefulRepublic(w: World, b: Bill): void {
  const old = findPerson(w, w.kayzerId);
  w.regime = 'cumhuriyet'; w.kayzerId = null; w.taxRate = Math.min(w.taxRate, 12); w.coup = null; w.regentId = null; w.regentFor = null; w.cumhuriyetDays = 0;
  w.election.baskanNextDay = w.day + 1; w.election.baskanCandidates = []; w.election.baskanVotes = {};
  for (const p of w.people) { p.republic = clamp(p.republic - 30); p.mood = clamp(p.mood + 8); if (p.prof === 'asker') p.loyalty = 60; }
  for (const p of w.people) if (p.soylu && p.home === 'saray') { p.soylu = false; p.home = emptiestHouse(w); }
  if (old) { old.prof = 'memur'; old.work = 'saray'; old.soylu = false; if (old.home === 'saray') old.home = emptiestHouse(w); old.mood = clamp(old.mood - 15); }
  w.exKayzerId = null; // a peaceful abdication leaves no claimant
  w.cumhuriyet = Math.round(w.people.reduce((s, p) => s + p.republic, 0) / Math.max(1, w.people.length));
  b.result = 'CUMHURİYET İLAN EDİLDİ';
  log(w, `🏛 Meclis anayasayı değiştirdi: CUMHURİYET İLAN EDİLDİ! ${old?.name ?? 'Kayzer'} tahtı barışla bıraktı ve artık bir yurttaş. Yarın Başkanlık seçimi var.`, old?.id);
}


/** v2.0.1 Bütçe Komisyonu: 2 MPs from the majority bloc + 1 from the opposition (refreshed when a member leaves). */
export function komisyonMembers(w: World): string[] {
  const ms = members(w); const cur = (w.meclis.komisyon ?? []).filter((id) => ms.some((m) => m.id === id));
  if (cur.length === 3) return cur;
  const govt = new Set(w.meclis.govt ?? []); const score = (p: Person): number => (p.itibar ?? 10) + p.ambition / 5 + (p.honesty ?? 50) / 5;
  const bloc = ms.filter((p) => p.faction && govt.has(p.faction)).sort((a, b) => score(b) - score(a));
  const opp = ms.filter((p) => !p.faction || !govt.has(p.faction)).sort((a, b) => score(b) - score(a));
  const pick3 = [...bloc.slice(0, 2), ...opp.slice(0, 1)]; for (const p of [...bloc, ...opp]) if (pick3.length < 3 && !pick3.includes(p)) pick3.push(p);
  w.meclis.komisyon = pick3.slice(0, 3).map((p) => p.id); return w.meclis.komisyon;
}
/** How much the hazine should keep: 3 days of the recent average spending, at least 1000 D. */
export function hazineReserve(w: World): number {
  const book = (w.treasuryBook ?? []).slice(-6, -1); if (!book.length) return 1000;
  const out = book.reduce((a, d) => a + Object.entries(d.items).filter(([k]) => k.startsWith('-')).reduce((x, [, v]) => x + v, 0), 0) / book.length;
  return Math.max(1000, Math.round(out * 3));
}
/** Would the hazine cover this spending? (used by the komisyon, by NPC proposers and by the AI naip) */
export function affordable(w: World, cost: number, strict = 1): boolean { const after = w.treasury - cost; return after >= hazineReserve(w) * strict && (hazineTrend(w) >= -cost / 20 || after >= hazineReserve(w) * 2 * strict); }
/** NPC proposers are careful with the hazine: they spend only from a comfortable surplus. */
/** NPCs (and the AI naip) only push a genelge the hazine can carry; a tax cut needs a well-stocked, growing hazine. */
export function npcFitG(w: World, k: GKind): boolean { return npcCanSpend(w, GENELGE[k].cost) && (k !== 'vergiIndirim' || (w.treasury > hazineReserve(w) * 3 && hazineTrend(w) >= 0)); }
export function npcCanSpend(w: World, cost: number): boolean { if (!cost) return true; const after = w.treasury - cost; return affordable(w, cost) && after >= 2500 && hazineTrend(w) >= cost / 40; }
export function komisyonReview(w: World, b: Bill): void {
  const mem = komisyonMembers(w); const govt = new Set(w.meclis.govt ?? []); const votes: Record<string, boolean> = {};
  for (const id of mem) { const p = findPerson(w, id); const opp = !p?.faction || !govt.has(p.faction); votes[id] = affordable(w, b.cost ?? 0, opp ? 1.3 : 1); }
  const yes = Object.values(votes).filter(Boolean).length; const ok = yes >= 2 && !b.borc;
  const after = Math.round(w.treasury - (b.cost ?? 0)); const tr = Math.round(hazineTrend(w));
  const text = `Bütçe Komisyonu raporu (${yes}/${mem.length} olumlu): ${ok ? 'HAZİNE KARŞILAR' : b.borc ? 'BORÇLANMA GEREKİR' : 'HAZİNE KARŞILAMAZ'} – ${b.cost} D harcama sonrası hazinede ${after} D kalır (yedek ${hazineReserve(w)} D, günlük eğilim ${tr >= 0 ? '+' : ''}${tr} D).`;
  b.komisyon = { members: mem, votes, ok, text, day: w.day }; mlog(w, `📊 “${b.title}”: ${text}`); use(w, 'komisyon_raporu');
}
/** 'Oylama başladı' notice to every MP who is a player. */
export function notifyVote(w: World, b: Bill): void {
  if (b.notified) return; b.notified = true; const hrs = Math.max(1, (b.voteUntil - w.day) * 24 + COUNT_HOUR - w.hour);
  for (const p of members(w)) if (p.playerId) personal(w, p.playerId, `🗳 Oylama başladı: “${b.title}” – sayıma ${hrs} saat kaldı (${b.voteUntil}. gün ${String(COUNT_HOUR).padStart(2, '0')}:00). Meclis’ten oyunuzu verin.`);
}
export function hoursToCount(w: World, b: Bill): number { return Math.max(0, (b.voteUntil - w.day) * 24 + COUNT_HOUR - w.hour); }
/** What a 'kaldır' target names: g:<genelge>, l:<custom law id>, k:<built-in law id>. */
export function repealTarget(w: World, t: string): { type: 'g' | 'l' | 'k'; id: string; name: string; until?: number } | null {
  const [ty, id] = [t.slice(0, 1), t.slice(2)];
  if (ty === 'g' && isGKind(id)) { const g = (w.genelgeler ?? []).find((x) => x.kind === id && x.until >= w.day); return g ? { type: 'g', id, name: `Genelge: ${GENELGE[id].label}`, until: g.until } : null; }
  if (ty === 'l') { const l = (w.customLaws ?? []).find((x) => x.id === id); return l ? { type: 'l', id, name: `Kanun: ${l.name}` } : null; }
  if (ty === 'k') { const l = w.laws.find((x) => x.id === id && x.active); return l ? { type: 'k', id, name: `Kanun: ${l.name}` } : null; }
  return null;
}
/** Everything that can be repealed now (for the UI and NPCs). */
export function repealables(w: World): { target: string; name: string; until?: number }[] {
  const out: { target: string; name: string; until?: number }[] = [];
  for (const g of w.genelgeler ?? []) if (g.until >= w.day) out.push({ target: `g:${g.kind}`, name: `Genelge: ${GENELGE[g.kind].label}`, until: g.until });
  for (const l of w.customLaws ?? []) out.push({ target: `l:${l.id}`, name: `Kanun: ${l.name}` });
  for (const l of w.laws) if (l.active) out.push({ target: `k:${l.id}`, name: `Kanun: ${l.name}` });
  return out;
}
/** Dış borç: spending a BORÇLANMA bill borrows the shortfall (+10% faiz); repaid in daily taksit when the hazine has room. */
function borrowFor(w: World, cost: number): void {
  const need = Math.ceil(cost + HAZINE_FLOOR - w.treasury); if (need <= 0) return;
  transfer(w, 'dis', 'saray', need, 'dış borç'); w.meclis.borc = Math.round(((w.meclis.borc ?? 0) + need * 1.1) * 100) / 100;
  mlog(w, `💳 Hazine ${need} D borçlandı (geri ödeme ${Math.round(need * 1.1)} D).`); use(w, 'borclanma');
}
function repayDebt(w: World): void {
  const d = w.meclis.borc ?? 0; if (d <= 0 || w.treasury < hazineReserve(w)) return;
  const pay = Math.min(d, 25); if (transfer(w, 'saray', 'dis', pay, 'borç taksiti')) w.meclis.borc = Math.round((d - pay) * 100) / 100;
}

// ---------------- v2.0.1 halk dilekçesi ----------------
export const DILEKCE_IMZA = 20; export const DILEKCE_DAYS = 10;
const canSign = (w: World, p: Person): boolean => yearsOf(w, p) >= CAND_AGE && p.jailedDays <= 0 && p.prof !== 'naip';
export function openDilekce(w: World, p: Person, kind: BillKind, value: number, target: string, title = ''): Dilekce | string {
  if (!canSign(w, p)) return 'Dilekçe vermek için 16 yaşında olmalı ve zindanda olmamalısınız.';
  if (!Object.prototype.hasOwnProperty.call(BILL_LABEL, kind) || kind === 'ozel' || kind === 'cumhuriyet' || kind === 'azil') return 'Bu konu dilekçeyle gündeme alınamaz.';
  const err = validateBill(w, kind, value, target); if (err) return err;
  const list = (w.meclis.dilekceler ??= []);
  if (list.some((d) => d.status === 'acik' && d.by === p.id)) return 'Açık bir dilekçeniz zaten var.';
  if (list.some((d) => d.status === 'acik' && d.kind === kind && d.target === target)) return 'Aynı konuda açık bir dilekçe var; onu imzalayın.';
  const d: Dilekce = { id: nextId(w, 'H'), kind, value, target, title: (title.trim() || billTitle(w, kind, value, target)).slice(0, 60), by: p.id, day: w.day, signers: [p.id], status: 'acik' };
  list.push(d); log(w, `✍️ ${p.name} halk dilekçesi başlattı: “${d.title}” (${DILEKCE_IMZA} imza gerekir).`, p.id); use(w, 'dilekce_baslat', p); return d;
}
export function signDilekce(w: World, p: Person, id: string): string | null {
  const d = (w.meclis.dilekceler ?? []).find((x) => x.id === id && x.status === 'acik'); if (!d) return 'Dilekçe yok ya da kapandı.';
  if (!canSign(w, p)) return 'İmza için 16 yaşında olmalı ve zindanda olmamalısınız.';
  if (d.signers.includes(p.id)) return 'Bu dilekçeyi zaten imzaladınız.';
  d.signers.push(p.id); use(w, 'dilekce_imza', p); if (d.signers.length >= DILEKCE_IMZA) toAgenda(w, d); return null;
}
function toAgenda(w: World, d: Dilekce): void {
  const by = findPerson(w, d.by); if (!by) { d.status = 'dustu'; return; }
  const r = propose(w, by, d.kind, d.value, d.target, d.title, undefined, false, { dilekce: d.id, borc: false });
  if (typeof r === 'string') { d.status = 'dustu'; log(w, `✍️ “${d.title}” dilekçesi ${d.signers.length} imzaya ulaştı ama gündeme alınamadı: ${r}`); return; }
  d.status = 'gundem'; d.billId = r.id; log(w, `📥 Halk dilekçesi ${d.signers.length} imzayla Meclis gündeminde: “${r.title}”.`, d.by);
}
/** NPC asked (Etkileşim) to sign: he signs if the item serves him. */
export function askSign(w: World, me: Person, t: Person, id: string): { ok: boolean; msg: string } {
  const d = (w.meclis.dilekceler ?? []).find((x) => x.id === id && x.status === 'acik'); if (!d) return { ok: false, msg: 'Dilekçe kapandı.' };
  if (d.signers.includes(t.id)) return { ok: false, msg: `${t.name}: “Ben zaten imzaladım.”` };
  const s = stance0(w, t, { ...d, proposerId: me.id, votes: {}, speeches: [], status: 'tartisma', debateUntil: 0, voteUntil: 0 } as unknown as Bill) + (t.relations[me.id] ?? 0) / 100;
  if (s < 0.1) return { ok: false, msg: `${t.name}: “Bu dilekçeye imza atmam.”` };
  const e = signDilekce(w, t, id); return e ? { ok: false, msg: e } : { ok: true, msg: `${t.name} dilekçeyi imzaladı (${d.signers.length}/${DILEKCE_IMZA}).` };
}
/** Daily: NPCs start dilekçeler on what bothers them and sign the ones that serve them; old ones expire. */
export function dilekceDay(w: World): void {
  const list = (w.meclis.dilekceler ??= []);
  for (const d of list) if (d.status === 'acik' && w.day - d.day >= DILEKCE_DAYS) { d.status = 'dustu'; log(w, `✍️ “${d.title}” dilekçesi ${d.signers.length}/${DILEKCE_IMZA} imzada kaldı ve düştü.`); }
  const npcs = w.people.filter((p) => fullAiLike(p) && canSign(w, p) && !p.meclis);
  if (npcs.length && list.filter((d) => d.status === 'acik').length < 2 && chance(w, 0.25)) {
    const p = pick(w, npcs); const f = facOf(w, p.faction)?.ideology ?? 'halkci';
    const hate = (w.genelgeler ?? []).find((g) => g.until >= w.day && genelgeStance(w, p, g.kind) < -0.5);
    if (hate) openDilekce(w, p, 'kaldir', 0, `g:${hate.kind}`);
    else if (w.people.filter((x) => x.jailedDays > 0).length > 5 && p.mood < 45) openDilekce(w, p, 'af', 0, '');
    else { const k = suggestG(w, f); if (k && npcFitG(w, k)) openDilekce(w, p, 'genelge', 0, k); }
  }
  for (const d of list.filter((x) => x.status === 'acik')) {
    const fake = { ...d, proposerId: d.by, votes: {}, speeches: [], status: 'tartisma', debateUntil: 0, voteUntil: 0 } as unknown as Bill;
    for (let i = 0; i < 8 && d.status === 'acik'; i++) { const v = pick(w, npcs.length ? npcs : w.people); if (!v || d.signers.includes(v.id)) continue; if (stance0(w, v, fake) + (v.relations[d.by] ?? 0) / 100 > 0.1) signDilekce(w, v, d.id); }
  }
  w.meclis.dilekceler = list.filter((d) => d.status === 'acik' || w.day - d.day < 20);
}

// ---------------- v2.0.1 gerçek sandık ----------------
export const voterOk = (w: World, p: Person): boolean => p.prof !== 'naip' && p.jailedDays === 0 && yearsOf(w, p) >= 16; // dilenciler de oy verir
/** Secret ballot: the voter is marked as having voted; the ballot goes into a shuffled box with no name on it. */
export function castBallot(w: World, voterId: string, cand: string): void {
  const e = w.election; e.votes[voterId] = '✓'; const box = (e.ballots ??= []); box.splice(Math.floor(rand(w) * (box.length + 1)), 0, cand);
}
export function turnout(w: World): { voted: number; electorate: number; pct: number } {
  const el = w.people.filter((p) => voterOk(w, p)); const v = el.filter((p) => w.election.votes[p.id]).length;
  return { voted: v, electorate: el.length, pct: Math.round(v / Math.max(1, el.length) * 100) };
}
/** Election day, 08–20: NPC voters walk to the sandık during the day (secret ballot, counted at day end). */
export function sandikHour(w: World, isElectionDay: boolean): void {
  if (!isElectionDay || w.hour < 8 || w.hour > 20) return; const e = w.election; const cands = e.candidates.filter((id) => findPerson(w, id));
  if (!cands.length) return;
  for (const v of w.people) {
    if (!fullAiLike(v) || !voterOk(w, v) || v.id in e.votes || !chance(w, 0.1)) continue;
    if (chance(w, 0.12)) { e.votes[v.id] = ''; continue; } // stays home (counted as not voted)
    const pl = e.pledges?.[v.id]; let best = pl && cands.includes(pl) && chance(w, 0.8) ? pl : cands.includes(v.id) ? v.id : '';
    if (!best) { let bs = -Infinity; for (const c of cands) { const sc = voterScore(w, v, findPerson(w, c)!) + (rand(w) - 0.5) * 12; if (sc > bs) { bs = sc; best = c; } } }
    if (best) { castBallot(w, v.id, best); use(w, 'sandik_oy', v); }
  }
}
/** Average daily hazine change over the last 5 days. */
export function hazineTrend(w: World): number { const st = w.stats.slice(-6); if (st.length < 2) return 0; return (st[st.length - 1]!.treasury - st[0]!.treasury) / (st.length - 1); }
/** Ara seçim: an empty seat goes to the next runner-up of the last election (else an ambitious NPC). */
export function byElection(w: World): void {
  for (const s of w.meclis.seats) {
    if (s.holder && findPerson(w, s.holder)?.meclis) continue; if (s.kind === 'atama') { s.holder = null; continue; }
    const res = (w.election.last?.results ?? []).filter((r) => !r.won && findPerson(w, r.id) && !findPerson(w, r.id)!.meclis && canRun(w, findPerson(w, r.id)!));
    const next = res.sort((a, b) => b.votes - a.votes)[0]; const p = next ? findPerson(w, next.id)! : w.people.filter((x) => fullAiLike(x) && canRun(w, x) && !x.meclis && yearsOf(w, x) >= CAND_AGE).sort((a, b) => b.ambition - a.ambition)[0];
    if (!p) continue; s.holder = p.id; p.meclis = true; p.immune = true; if (next) next.won = true;
    use(w, 'ara_secim'); mlog(w, `🗳 Ara seçim: ${s.label} boşalmıştı; ${p.name} (${partyName(w, p.faction)}) Meclis’e girdi.`, p.id);
  }
}
const fullAiLike = (p: Person): boolean => p.playerId === null || !!p.npc;
function npcPropose(w: World, p: Person): void {
  const f = w.meclis.factions.find((x) => x.id === p.faction)?.ideology ?? 'halkci';
  const avgMood = w.people.reduce((a, x) => a + x.mood, 0) / w.people.length;
  const corrupt = w.ledger.filter((l) => (l.reason === 'zimmet' || l.reason === 'rüşvet') && w.day - l.day < 15).map((l) => l.to);
  const off = w.people.filter((x) => STATE_PROFS.includes(x.prof) && x.honesty < 40);
  let r: Bill | string = '';
  // v1.9.6: no duplicate agenda – skip a kind that is already on the agenda or was voted on in the last 5 days
  const recent = (k: BillKind): boolean => w.meclis.bills.some((b) => b.kind === k && (['tartisma', 'oylama', 'onay'].includes(b.status) || w.day - b.day < 5 || (b.status === 'veto' && w.day - b.day < 20))); // v2.0.2: a vetoed item is not re-proposed every week
  const budgetRejected = w.meclis.bills.filter((b) => b.kind === 'butce' && b.status === 'ret').length;
  // v2.0.1: a Cumhuriyetçi MP brings the anayasa change only when he counts (close to) 14 conscience votes
  if (f === 'cumhuriyetci' && w.regime === 'imparatorluk' && !validateBill(w, 'cumhuriyet', 0, '') && members(w).filter((m) => anayasaStance(w, m, { proposerId: p.id } as Bill) > 0.2).length >= ANAYASA_YES - 1) { propose(w, p, 'cumhuriyet', 0, ''); return; }
  // v2.0.1: repeal what the party program opposes (or a genelge that hurts the hazine)
  { const fac = facOf(w, p.faction); const bad = (w.genelgeler ?? []).find((g) => g.until > w.day + 1 && isGKind(g.kind) && ((fac?.oppose ?? []).includes(g.kind) || genelgeStance(w, p, g.kind) < -0.6)); if (bad && !recent('kaldir') && chance(w, 0.5)) { propose(w, p, 'kaldir', 0, `g:${bad.kind}`); return; } }
  if (!w.budget.approved && f !== 'cumhuriyetci' && !recent('butce')) r = propose(w, p, 'butce', Math.round(Math.min(budgetRejected ? 1400 : 3000, Math.max(800, w.treasury * 0.2)) / 100) * 100, '');
  else if (!recent('vergi') && f === 'esnaf' && w.taxRate > 12) r = propose(w, p, 'vergi', w.taxRate - 2, '');
  else if (!recent('sorusturma') && f === 'cumhuriyetci' && corrupt[0] && findPerson(w, corrupt[0])?.id !== w.kayzerId) r = propose(w, p, 'sorusturma', 0, corrupt[0]);
  else if (!recent('azil') && f === 'cumhuriyetci' && w.regime === 'cumhuriyet' && avgMood < 35 && w.kayzerId && findPerson(w, w.kayzerId)?.faction !== p.faction) r = propose(w, p, 'azil', 0, '');
  else if (!recent('gensoru') && f === 'cumhuriyetci' && off[0]) r = propose(w, p, 'gensoru', 0, off[0].id);
  else if (!recent('af') && f === 'halkci' && w.people.filter((x) => x.jailedDays > 0).length > 4) r = propose(w, p, 'af', 0, '');
  else if (!recent('insaat') && f === 'halkci' && !w.projects.some((x) => !x.done) && w.treasury > 2500 && hazineTrend(w) >= 0) { const plot = w.buildings.find((b) => b.kind === 'arsa'); const kind = Object.keys(BUILD).find((k) => !w.projects.some((x) => x.kind === k)) ?? 'cesme'; if (plot && w.treasury - BUILD[kind]![1] > 1500) r = propose(w, p, 'insaat', 0, `${kind}@${plot.id}`); }
  else if (!recent('fiyat') && f === 'halkci' && w.prices.ekmek > 4.5) r = propose(w, p, 'fiyat', Math.round(BASE_PRICE.ekmek * 1.2 * 10) / 10, 'ekmek');
  else if (!recent('maas') && f === 'saltanatci' && (w.salaries.asker ?? 0) < 12 && w.treasury > 3000 && hazineTrend(w) >= 0) r = propose(w, p, 'maas', 12, 'asker');
  else { const fac = facOf(w, p.faction); const want = (p.vaatler ?? []).find((k) => !(p.proposedG ?? []).includes(k) && !gBlock(w, k)) ?? (chance(w, 0.5) ? (fac?.program ?? []).find((k) => !gBlock(w, k)) : undefined) ?? suggestG(w, f); if (want && npcFitG(w, want) && !w.meclis.bills.some((b) => b.target === want && w.day - b.day < 7)) r = propose(w, p, 'genelge', 0, want); }
  void r;
}

/** Discretionary spending by the head of state is limited by the approved budget. */
export function budgetLeft(w: World): number {
  if (w.day > w.budget.until) w.budget = { limit: DEFAULT_BUDGET, spent: 0, until: w.day + 20, approved: false };
  return Math.max(0, w.budget.limit - w.budget.spent);
}
export function spend(w: World, amount: number): boolean { if (budgetLeft(w) < amount) return false; w.budget.spent += amount; return true; }

/** NPC stance on a custom law: ideology, religion, own trade and wallet. */
function lawStance(w: World, p: Person, f: string, l?: LawSpec): number {
  if (!l) return -1;
  const PRODUCER: Record<string, string> = { ciftci: 'bugday', degirmenci: 'un', firinci: 'ekmek', sucu: 'su', kasap: 'et', balikci: 'balik', dokumaci: 'kumas', terzi: 'elbise', marangoz: 'odun', mobilyaci: 'mobilya', demirci: 'alet', barci: 'icki' };
  const mine = l.good && PRODUCER[p.prof] === l.good;
  switch (l.kind) {
    case 'satisVergisi': return (w.taxRate - l.value) / 8 + (f === 'saltanatci' ? 0.2 : f === 'esnaf' ? -0.3 : 0);
    case 'basVergisi': return (w.headTax - l.value) / 2 + (f === 'halkci' ? -0.3 : 0);
    case 'malVergisi': return (mine ? -1 : -0.2) + (f === 'saltanatci' ? 0.3 : 0);
    case 'narh': return mine ? -0.9 : f === 'halkci' ? 0.6 : f === 'esnaf' ? -0.6 : 0.1;
    case 'yasak': return l.good === 'icki' ? (p.din - 50) / 40 : ['ekmek', 'su', 'bugday'].includes(l.good ?? '') ? -1 : mine ? -1 : -0.2;
    case 'sokak': return f === 'saltanatci' ? 0.4 : f === 'cumhuriyetci' ? -0.7 : -0.1;
    case 'hizmet': return f === 'saltanatci' ? 0.3 : f === 'halkci' ? -0.6 : -0.2;
    case 'destek': return mine ? 1 : f === 'halkci' ? 0.4 : f === 'esnaf' ? 0.3 : 0;
    case 'servetEsigi': return p.money > l.value ? -0.8 : f === 'halkci' ? 0.6 : 0;
    case 'sertCeza': return f === 'saltanatci' ? 0.6 : f === 'cumhuriyetci' ? -0.6 : p.honesty < 35 ? -0.8 : 0.1;
  }
  return 0;
}

/** The Kayzer sends a tax change to the Meclis (when one sits): it takes effect only if the Meclis passes it. */
export function kayzerBill(w: World, k: Person, kind: BillKind, value: number, target: string): Bill | string {
  const err = validateBill(w, kind, value, target); if (err) return err;
  if (w.meclis.bills.some((b) => b.fromKayzer && b.kind === kind && (b.status === 'tartisma' || b.status === 'oylama'))) return 'Bu konuda Meclis’te bekleyen bir teklifiniz var.';
  const bill: Bill = { id: nextId(w, 'B'), kind, value, target, title: `Saray teklifi: ${billTitle(w, kind, value, target)}`, proposerId: k.id, day: w.day, debateUntil: w.day + DEBATE_DAYS, voteUntil: w.day + DEBATE_DAYS + VOTE_DAYS, status: 'tartisma', votes: {}, speeches: [], fromKayzer: true };
  w.meclis.bills.push(bill); mlog(w, `Saray “${bill.title}” teklifini Meclis’e sevk etti.`, k.id); return bill;
}
export function foundFaction(w: World, p: Person, name: string): string {
  if (!p.meclis) return 'Parti kurmak için milletvekili olmalısınız.'; const n = name.trim().slice(0, 30); if (n.length < 3) return 'Parti adı en az 3 harf.';
  if (w.meclis.factions.length >= 8) return 'Çok fazla parti var.';
  const id = `f${w.idSeq++}`; w.meclis.factions.push({ id, name: n, ideology: (p.republic > 55 ? 'cumhuriyetci' : p.loyalty > 70 ? 'saltanatci' : profGroup(p) === 'esnaf' ? 'esnaf' : 'halkci'), leaderId: p.id, color: ['#2a9d8f', '#e76f51', '#8ab17d', '#b56576'][w.meclis.factions.length % 4]! });
  p.faction = id; mlog(w, `${p.name} yeni bir parti kurdu: ${n}.`, p.id); return `${n} kuruldu; lideri sizsiniz.`;
}
export function migrateMeclis16(w: World): void {
  migrateParty(w);
  // v2.0.1: 16 elected seats, optionally followed by Kayzer-appointed extra seats (kind 'atama', kept until the next election)
  if (w.meclis.seats.length >= SEAT_COUNT && w.meclis.seats.slice(0, SEAT_COUNT).every((s) => s.kind === 'genel') && w.meclis.seats.slice(SEAT_COUNT).every((s) => s.kind === 'atama')) return;
  const holders = w.meclis.seats.map((s) => s.holder).filter((x): x is string => !!x);
  // A world that never held a real election still has the old appointed members: vacate them and open the first election.
  const never = !w.election.last && w.day < 10;
  w.meclis.seats = SEATS.map((s, i) => ({ ...s, holder: never ? null : holders[i] ?? null }));
  if (never) {
    for (const p of w.people) if (p.meclis) { p.meclis = false; p.immune = false; }
    w.election.nextDay = w.day + 10; w.election.candidates = []; w.election.votes = {}; w.election.ballots = [];
    w.meclis.log.push({ day: w.day, text: `Atanmış Meclis dağıtıldı. İlk Meclis seçimi ${w.election.nextDay}. gün: adaylık şimdi açık.` });
  }
}

export const MAX_APPOINTED = 4;
/** Kayzer appoints an extra milletvekili (seat kind 'atama', lasts until the next general election). */
export function appointMp(w: World, p: Person): string | null {
  if (p.meclis) return 'Zaten milletvekili.'; if (!canRun(w, p)) return 'Bu kişi milletvekili olamaz.';
  if (w.meclis.seats.filter((s) => s.kind === 'atama').length >= MAX_APPOINTED) return `En fazla ${MAX_APPOINTED} atanmış sandalye olabilir.`;
  const n = w.meclis.seats.length + 1; w.meclis.seats.push({ id: `mv${n}`, label: `Atanmış milletvekili ${n - SEAT_COUNT}`, kind: 'atama', key: 'atama', holder: p.id });
  p.meclis = true; p.immune = true; mlog(w, `👑 Kayzer'in emriyle ${p.name} Meclis'e atandı (atanmış sandalye, seçime kadar).`, p.id); return null;
}

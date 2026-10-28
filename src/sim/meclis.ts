import { ek } from './tr';
import { enactLaw, lawTitle, validateLaw, type LawSpec } from './laws';
/**
 * Meclis: seats by district and profession, factions, bills with debate → vote → (Kayzer sanction) → effect.
 * The Kayzer's veto is final – there is no override of any kind.
 */
import type { Bill, BillKind, Faction, Person, Profession, Seat, VoteChoice, World } from './types';
import { GOODS } from './types';
import { BASE_PRICE, PROF_LABEL, STATE_PROFS, PRODUCES, GOOD_LABEL } from './constants';
import { transfer } from './economy';
import { chance, clamp, nextId, pick, rand } from './rng';
import { findPerson, WORKPLACE } from './world';
import { log } from './log';
import { openCase } from './ai';

export const FACTIONS: Faction[] = [
  { id: 'saltanat', name: 'Saltanat Partisi', ideology: 'saltanatci', leaderId: null, color: '#7b2d8b' },
  { id: 'cumhuriyet', name: 'Cumhuriyet Hareketi', ideology: 'cumhuriyetci', leaderId: null, color: '#3a6ad0' },
  { id: 'esnaf', name: 'Esnaf Birliği', ideology: 'esnaf', leaderId: null, color: '#c9a227' },
  { id: 'halk', name: 'Halk Fırkası', ideology: 'halkci', leaderId: null, color: '#c8483a' },
];
export const SEAT_COUNT = 16;
export const SEATS: Omit<Seat, 'holder'>[] = Array.from({ length: SEAT_COUNT }, (_, i) => ({ id: `mv${i + 1}`, label: `Milletvekili ${i + 1}`, kind: 'genel' as const, key: 'genel' }));
export const BILL_LABEL: Record<BillKind, string> = {
  ozel: 'Özel kanun (serbest)',
  vergi: 'Vergi', fiyat: 'Narh (fiyat)', maas: 'Maaş', butce: 'Bütçe', kanun: 'Kanun', insaat: 'İnşaat', af: 'Genel af',
  gensoru: 'Gensoru', genelge: 'Genelge (Meclis bildirisi)', sorusturma: 'Soruşturma komisyonu', dokunulmazlik: 'Dokunulmazlığın kaldırılması', azil: 'Başkan’ın azli',
};
export const MP_ALLOWANCE = 4; // Dinar/day on top of the Meclis salary (wages are ~7)
const DEBATE_DAYS = 1; const VOTE_DAYS = 1; const SANCTION_DAYS = 3;
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
const mlog = (w: World, text: string, personId?: string): void => {
  w.meclis.log.push({ day: w.day, text }); if (w.meclis.log.length > 150) w.meclis.log.shift();
  log(w, `Meclis: ${text}`, personId);
};

/** Seat-by-seat election: district voters elect district seats, profession groups elect profession seats. */
export const canRun = (w: World, p: Person): boolean => p.jailedDays === 0 && p.prof !== 'naip' && p.prof !== 'kayzer' && p.prof !== 'asker' && p.prof !== 'bekci' && p.id !== w.kayzerId;
/** v1.9 at-large election for 16 seats: declared candidates (players + NPCs); every adult votes once; top 16 win. */
export function meclisElection(w: World, playerCandidates: string[], playerVotes: Record<string, string>, npcAI: (p: Person) => boolean): string[] {
  let cands = [...new Set(playerCandidates)].filter((id) => { const p = findPerson(w, id); return p && canRun(w, p); });
  if (cands.length < SEAT_COUNT + 4) { // too few runners: ambitious NPCs step in so the seats get filled
    const extra = w.people.filter((p) => npcAI(p) && canRun(w, p) && !cands.includes(p.id)).sort((a, b) => (b.ambition + b.money / 20) - (a.ambition + a.money / 20)).slice(0, SEAT_COUNT + 4 - cands.length);
    cands.push(...extra.map((p) => p.id));
  }
  const tally: Record<string, number> = {}; for (const c of cands) tally[c] = 0;
  for (const v of w.people.filter((p) => p.prof !== 'naip' && p.jailedDays === 0)) {
    const pv = playerVotes[v.id]; if (pv && tally[pv] !== undefined) { tally[pv] += 1; continue; }
    if (cands.includes(v.id) && !v.playerId) { tally[v.id] = (tally[v.id] ?? 0) + 1; continue; } // NPC candidates vote for themselves
    if (v.playerId && !v.npc) continue; // players who didn't vote abstain
    let best = ''; let bs = -Infinity;
    for (const c of cands) { const cp = findPerson(w, c)!; const sc = (v.relations[c] ?? 0) * 0.6 - Math.abs(v.republic - cp.republic) * 0.5 - Math.abs(v.loyalty - cp.loyalty) * 0.25 - Math.abs(v.din - cp.din) * 0.15 + (w.election.posters?.[c] ?? 0) * 3 + (v.faction && v.faction === cp.faction ? 8 : 0) + (rand(w) - 0.5) * 12; if (sc > bs) { bs = sc; best = c; } }
    if (best) tally[best] = (tally[best] ?? 0) + 1;
  }
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1] || ((findPerson(w, b[0])?.ambition ?? 0) - (findPerson(w, a[0])?.ambition ?? 0)));
  const winners = ranked.slice(0, SEAT_COUNT).filter(([, n]) => n > 0).map(([id]) => id);
  w.meclis.seats = SEATS.map((s, i) => ({ ...s, holder: winners[i] ?? null }));
  w.election.last = { day: w.day, results: ranked.slice(0, 40).map(([id, n]) => ({ id, votes: n, won: winners.includes(id) })) };
  for (const p of w.people) {
    const was = p.meclis; p.meclis = winners.includes(p.id);
    if (p.meclis && !was) { p.immune = true; if (!p.faction) p.faction = naturalFaction(p); if (p.playerId) log(w, `🗳 ${p.name} milletvekili seçildi! Meclis bölümü açıldı.`, p.id); }
    if (!p.meclis) p.immune = false;
  }
  electLeaders(w);
  mlog(w, `Seçim sonuçları (${SEAT_COUNT} sandalye): ${winners.map((id) => `${findPerson(w, id)?.name} (${tally[id]})`).join(', ')}.`);
  return winners;
}

export function electLeaders(w: World): void {
  for (const f of w.meclis.factions) {
    const m = w.people.filter((p) => p.faction === f.id && p.meclis);
    const pool = m.length ? m : w.people.filter((p) => p.faction === f.id);
    const cur = findPerson(w, f.leaderId);
    if (cur && cur.faction === f.id && (cur.meclis || !m.length)) continue;
    f.leaderId = pool.sort((a, b) => (b.playerId ? 1000 : 0) + b.ambition - ((a.playerId ? 1000 : 0) + a.ambition))[0]?.id ?? null;
  }
}

export function validateBill(w: World, kind: BillKind, value: number, target: string, law?: LawSpec): string | null {
  switch (kind) {
    case 'ozel': return law ? validateLaw(law) : 'Kanun metni yok.';
    case 'vergi': return value >= 0 && value <= 40 ? null : 'Vergi 0–40 arası olmalı.';
    case 'fiyat': return GOODS.includes(target as never) && value > 0 && value <= 100 ? null : 'Geçersiz narh.';
    case 'maas': return (STATE_PROFS.includes(target as Profession) || target === 'meclis') && value >= 0 && value <= 60 ? null : 'Geçersiz maaş.';
    case 'butce': return value >= 0 && value <= 50000 ? null : 'Bütçe 0–50000.';
    case 'kanun': return w.laws.some((l) => l.id === target) ? null : 'Kanun yok.';
    case 'insaat': return value >= 100 && value <= 20000 ? null : 'İnşaat 100–20000 Dinar.';
    case 'af': return null;
    case 'gensoru': { const p = findPerson(w, target); return p && (STATE_PROFS.includes(p.prof) || !!p.rank) && p.id !== w.kayzerId ? null : 'Gensoru devlet görevlileri ve vezir/paşa gibi unvanlılar için.'; }
    case 'sorusturma': return findPerson(w, target) && target !== w.kayzerId ? null : 'Geçersiz kişi.';
    case 'dokunulmazlik': { const p = findPerson(w, target); return p?.meclis && p.immune ? null : 'Bu kişinin dokunulmazlığı yok.'; }
    case 'azil': return w.regime === 'cumhuriyet' && w.kayzerId ? null : 'Azil sadece cumhuriyette, Başkan için.';
    case 'genelge': return null;
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
    case 'insaat': return `Yeni inşaat (${value} Dinar)`;
    case 'af': return 'Genel af: zindan boşaltılsın';
    case 'gensoru': return `Gensoru: ${who} görevden alınsın`;
    case 'sorusturma': return `Soruşturma komisyonu: ${who}`;
    case 'dokunulmazlik': return `${who}'ın dokunulmazlığı kaldırılsın`;
    case 'azil': return `Başkan ${who} azledilsin`;
    case 'genelge': return 'Meclis genelgesi';
  }
}

export function propose(w: World, proposer: Person, kind: BillKind, value: number, target: string, title?: string, law?: LawSpec): Bill | string {
  if (!proposer.meclis) return 'Sadece Meclis üyeleri kanun teklif edebilir.';
  if (kind === 'azil') target = w.kayzerId ?? '';
  const err = validateBill(w, kind, value, target, law); if (err) return err;
  if (w.meclis.bills.filter((b) => b.status === 'tartisma' || b.status === 'oylama').length >= 6) return 'Meclis gündemi dolu.';
  if (w.meclis.bills.some((b) => b.proposerId === proposer.id && (b.status === 'tartisma' || b.status === 'oylama'))) return 'Görüşülen bir teklifiniz zaten var.';
  const bill: Bill = { id: nextId(w, 'B'), kind, value, target, title: (title?.slice(0, 60) || billTitle(w, kind, value, target, law)), law, proposerId: proposer.id, day: w.day,
    debateUntil: w.day + DEBATE_DAYS, voteUntil: w.day + DEBATE_DAYS + VOTE_DAYS, status: 'tartisma', votes: {}, speeches: [] };
  w.meclis.bills.push(bill);
  mlog(w, `${proposer.name} teklif verdi: “${bill.title}”.`, proposer.id);
  return bill;
}

/** NPC stance on a bill, -1..1 (positive = yes). Faction ideology + personal interest + bribes. */
export function stance(w: World, p: Person, b: Bill): number {
  const f = w.meclis.factions.find((x) => x.id === p.faction)?.ideology ?? 'halkci';
  let s = 0;
  const target = findPerson(w, b.target);
  switch (b.kind) {
    case 'ozel': s = lawStance(w, p, f, b.law); break;
    case 'vergi': s = b.value < w.taxRate ? (f === 'esnaf' ? 0.8 : f === 'saltanatci' ? -0.2 : 0.4) : (f === 'saltanatci' ? 0.3 : -0.6); if (b.value > 20) s -= 0.6; break;
    case 'fiyat': s = f === 'esnaf' ? -0.7 : f === 'halkci' ? 0.6 : 0; break;
    case 'maas': s = b.target === p.prof || b.target === 'meclis' ? 0.8 : f === 'halkci' ? 0.4 : f === 'esnaf' ? -0.4 : 0; break;
    case 'butce': s = f === 'saltanatci' ? 0.7 : f === 'esnaf' ? (b.value < 1500 ? 0.4 : -0.5) : b.value > 3000 ? -0.3 : 0.3; break;
    case 'kanun': { const l = w.laws.find((x) => x.id === b.target); s = l?.id === 'saraykor' ? (f === 'saltanatci' ? 0.6 : -0.7) : l?.id === 'toplanti' ? (f === 'cumhuriyetci' ? (l.active ? -0.9 : 0.9) : 0) : f === 'halkci' ? 0.3 : 0; break; }
    case 'insaat': s = f === 'halkci' ? 0.7 : f === 'esnaf' ? 0.2 : 0.1; break;
    case 'af': s = f === 'cumhuriyetci' || f === 'halkci' ? 0.5 : -0.6; break;
    case 'gensoru': s = f === 'cumhuriyetci' ? 0.6 : f === 'saltanatci' ? -0.7 : 0; if (target) s += (50 - target.honesty) / 80; break;
    case 'sorusturma': s = f === 'cumhuriyetci' ? 0.6 : f === 'saltanatci' ? -0.3 : 0.2; if (target && target.honesty < 40) s += 0.3; if (target?.id === p.id) s = -1; break;
    case 'dokunulmazlik': s = target?.id === p.id ? -1 : target?.faction === p.faction ? -0.6 : 0.3; break;
    case 'genelge': s = (f === 'halkci' ? 0.3 : 0.1) + (p.relations[b.proposerId] ?? 0) / 150; break;
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

const SPEECH: Record<string, string[]> = {
  evet: ['Bu teklif halkın yararınadır, destekliyoruz!', 'Şehir bunu bekliyor; evet diyeceğiz.', 'Pazarda, limanda konuştuğum herkes bunu istiyor.', 'Bu adımı atmazsak tarih bizi affetmez.'],
  hayir: ['Bu teklif hazineyi de halkı da yorar, karşıyız!', 'Böyle bir karar şehre zarar verir.', 'Bunun bedelini yine esnaf öder; hayır!', 'Aceleye getirilmiş bir teklif, reddediyoruz.'],
  cekimser: ['Teklifin bazı yönleri iyi, bazıları değil; düşünmeliyiz.', 'Daha fazla görüşme gerekiyor.', 'Ne tam karşıyım ne tam destekçi.'],
};
const IDEO_LINE: Record<string, string> = { saltanatci: 'Kayzer’e ve düzene sadakat önce gelir.', cumhuriyetci: 'Halkın iradesi her şeyin üstündedir.', esnaf: 'Çarşının bereketi şehrin bereketidir.', halkci: 'Fakir fukaranın sofrasını düşünmeliyiz.' };
export function npcSpeech(w: World, p: Person, b: Bill, v: string): string { const f = w.meclis.factions.find((x) => x.id === p.faction)?.ideology ?? 'halkci'; return `“${b.title}” hakkında: ${pick(w, SPEECH[v]!)} ${IDEO_LINE[f] ?? ''}`.trim(); }

function enactable(b: Bill): boolean { return b.status === 'kabul'; }

/** Apply a bill that has become law. */
export function enact(w: World, b: Bill): void {
  b.status = 'kabul';
  switch (b.kind) {
    case 'ozel': if (b.law) enactLaw(w, b.law, findPerson(w, b.proposerId) ?? null, 'meclis'); break;
    case 'vergi': w.taxRate = b.value; break;
    case 'fiyat': { const g = b.target as keyof typeof BASE_PRICE; w.prices[g] = b.value; for (const l of w.listings) if (l.good === g && l.price > b.value) l.price = b.value; break; }
    case 'maas': if (b.target === 'meclis') w.meclis.salary = b.value; else w.salaries[b.target as Profession] = b.value; break;
    case 'butce': w.budget = { limit: b.value, spent: 0, until: w.day + 20, approved: true }; break;
    case 'kanun': { const l = w.laws.find((x) => x.id === b.target); if (l) l.active = !l.active; break; }
    case 'insaat': {
      if (!w.projects.some((p) => !p.done)) w.projects.push({ id: `pr${++w.idSeq}`, name: b.title.replace(/^Yeni inşaat/, 'Meclis inşaatı'), site: 'santiye', cost: b.value, paid: 0, progress: 0, needed: Math.round(b.value / 10), done: false });
      const pr = w.projects.find((p) => !p.done); if (pr) transfer(w, 'saray', `proje:${pr.id}`, Math.min(b.value, Math.max(0, w.treasury)), 'Meclis inşaat ödeneği');
      break;
    }
    case 'af': for (const p of w.people) p.jailedDays = 0; for (const c of w.cases) if (c.stage !== 'kapandi') { c.stage = 'kapandi'; c.verdict = 'af'; } break;
    case 'gensoru': { const t = findPerson(w, b.target); if (t) { const old = t.rank ? `${t.rank} unvanı ve ${PROF_LABEL[t.prof]}` : PROF_LABEL[t.prof]; t.rank = null; t.fief = null; t.prof = STATE_PROFS.includes(t.prof) ? 'hamal' : t.prof; t.work = WORKPLACE.hamal; t.mood = clamp(t.mood - 20); mlog(w, `Gensoru kabul edildi: ${t.name} ${old} görevinden alındı.`, t.id); } break; }
    case 'sorusturma': investigate(w, b.target); break;
    case 'dokunulmazlik': { const t = findPerson(w, b.target); if (t) { t.immune = false; mlog(w, `${ek(t.name, 'ın')} dokunulmazlığı kaldırıldı.`, t.id); } break; }
    case 'genelge': { for (const x of w.people) x.mood = clamp(x.mood + 1); log(w, `📜 Meclis genelgesi yayımlandı: “${b.title}”.`); break; }
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
  // NPC proposals
  for (const p of ms) if (!playerDecides(p) && chance(w, 0.12)) npcPropose(w, p);
  for (const b of w.meclis.bills) {
    if (b.status === 'tartisma') {
      for (const p of ms) if (!playerDecides(p) && !b.speeches.some((s) => s.personId === p.id) && chance(w, 0.5)) {
        const v = npcVote(w, p, b); b.speeches.push({ personId: p.id, text: npcSpeech(w, p, b, v), day: w.day });
      }
      if (w.day >= b.debateUntil) { b.status = 'oylama'; mlog(w, `“${b.title}” oylamaya açıldı.`); }
    } else if (b.status === 'oylama' && w.day >= b.voteUntil) {
      for (const p of ms) if (!b.votes[p.id] && !playerDecides(p)) b.votes[p.id] = npcVote(w, p, b);
      const t = tally(b);
      const need = b.kind === 'azil' ? Math.ceil(ms.length * 2 / 3) : Math.floor(ms.length / 2) + 1;
      const passed = t.evet >= need && t.evet > t.hayir;
      mlog(w, `“${b.title}”: ${t.evet} evet, ${t.hayir} hayır, ${t.cekimser} çekimser → ${passed ? 'KABUL' : 'RET'}.`);
      if (!passed) { b.status = 'ret'; b.result = 'Meclis reddetti'; continue; }
      const needsSanction = w.regime === 'imparatorluk' && b.kind !== 'sorusturma' && b.kind !== 'dokunulmazlik' && b.kind !== 'genelge' && !!w.kayzerId && !b.fromKayzer;
      if (needsSanction) { b.status = 'onay'; b.voteUntil = w.day + SANCTION_DAYS; mlog(w, `“${b.title}” Kayzer'in onayını bekliyor.`); }
      else enact(w, b);
    } else if (b.status === 'onay' && (!headIsPlayer(w) || (!headOnline && w.day >= b.voteUntil))) {
      // v1.9.6: an NPC ruler (Maecenas, an NPC heir) or an absent player ruler still answers the Meclis
      const approve = b.kind === 'af' ? chance(w, 0.3) : b.kind === 'vergi' ? b.value >= w.taxRate - 4 || w.treasury > 1500 : true;
      sanction(w, b, approve);
    } else if (b.status === 'onay' && w.day > b.voteUntil) {
      b.status = 'zamanasimi'; b.result = 'Kayzer onaylamadı, karar düştü'; mlog(w, `“${b.title}” Kayzer onaylamadığı için düştü.`);
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

function npcPropose(w: World, p: Person): void {
  const f = w.meclis.factions.find((x) => x.id === p.faction)?.ideology ?? 'halkci';
  const avgMood = w.people.reduce((a, x) => a + x.mood, 0) / w.people.length;
  const corrupt = w.ledger.filter((l) => (l.reason === 'zimmet' || l.reason === 'rüşvet') && w.day - l.day < 15).map((l) => l.to);
  const off = w.people.filter((x) => STATE_PROFS.includes(x.prof) && x.honesty < 40);
  let r: Bill | string = '';
  // v1.9.6: no duplicate agenda – skip a kind that is already on the agenda or was voted on in the last 5 days
  const recent = (k: BillKind): boolean => w.meclis.bills.some((b) => b.kind === k && (['tartisma', 'oylama', 'onay'].includes(b.status) || w.day - b.day < 5));
  const budgetRejected = w.meclis.bills.filter((b) => b.kind === 'butce' && b.status === 'ret').length;
  if (!w.budget.approved && f !== 'cumhuriyetci' && !recent('butce')) r = propose(w, p, 'butce', Math.round(Math.min(budgetRejected ? 1400 : 3000, Math.max(800, w.treasury * 0.2)) / 100) * 100, '');
  else if (!recent('vergi') && f === 'esnaf' && w.taxRate > 12) r = propose(w, p, 'vergi', w.taxRate - 2, '');
  else if (!recent('sorusturma') && f === 'cumhuriyetci' && corrupt[0] && findPerson(w, corrupt[0])?.id !== w.kayzerId) r = propose(w, p, 'sorusturma', 0, corrupt[0]);
  else if (!recent('azil') && f === 'cumhuriyetci' && w.regime === 'cumhuriyet' && avgMood < 35 && w.kayzerId && findPerson(w, w.kayzerId)?.faction !== p.faction) r = propose(w, p, 'azil', 0, '');
  else if (!recent('gensoru') && f === 'cumhuriyetci' && off[0]) r = propose(w, p, 'gensoru', 0, off[0].id);
  else if (!recent('af') && f === 'halkci' && w.people.filter((x) => x.jailedDays > 0).length > 4) r = propose(w, p, 'af', 0, '');
  else if (!recent('insaat') && f === 'halkci' && !w.projects.some((x) => !x.done) && w.treasury > 1500) r = propose(w, p, 'insaat', 800, '');
  else if (!recent('fiyat') && f === 'halkci' && w.prices.ekmek > 4.5) r = propose(w, p, 'fiyat', Math.round(BASE_PRICE.ekmek * 1.2 * 10) / 10, 'ekmek');
  else if (!recent('maas') && f === 'saltanatci' && (w.salaries.asker ?? 0) < 12) r = propose(w, p, 'maas', 12, 'asker');
  else if (!recent('genelge') && chance(w, 0.3)) r = propose(w, p, 'genelge', 0, '', pick(w, ['Kuyuların temizliği için çağrı', 'Pazarda dürüst tartı çağrısı', 'Yetimlere yardım çağrısı', 'Gece asayişi için bekçilere teşekkür', 'Kıtlığa karşı ambar çağrısı']));
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
  if (w.meclis.seats.length === SEAT_COUNT && w.meclis.seats[0]?.kind === 'genel') return;
  const holders = w.meclis.seats.map((s) => s.holder).filter((x): x is string => !!x);
  // A world that never held a real election still has the old appointed members: vacate them and open the first election.
  const never = !w.election.last && w.day < 10;
  w.meclis.seats = SEATS.map((s, i) => ({ ...s, holder: never ? null : holders[i] ?? null }));
  if (never) {
    for (const p of w.people) if (p.meclis) { p.meclis = false; p.immune = false; }
    w.election.nextDay = w.day + 10; w.election.candidates = []; w.election.votes = {};
    w.meclis.log.push({ day: w.day, text: `Atanmış Meclis dağıtıldı. İlk Meclis seçimi ${w.election.nextDay}. gün: adaylık şimdi açık.` });
  }
}

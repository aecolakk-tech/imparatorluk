import type { Person, World } from './types';
import { GOODS } from './types';
import { HOUR_MS, INACTIVE_TO_NPC_MS, MAX_CATCHUP_HOURS, ONLINE_WINDOW_MS, PRODUCES } from './constants';
import { addListing, balance, buy, lawOn, lawParam, produce, resetMarketDay, settleMarket, transfer } from './economy';
import { bekciPower, consume, decide, feel, fullAI, isState, openCase, spendSurplus, CRIME_LABEL } from './ai';
import { chance, clamp, pick, rand } from './rng';
import { findPerson } from './world';
import { isOnline, kayzerPlayerId, log, personal } from './log';
import { expirePetitions, naipPetitions, saraykorBonus } from './state';
import { meclisDay, meclisElection } from './meclis';
import { command, isyanHour, settleFate, startIsyan, strength } from './isyan';
import { actingHead, familyDay } from './family';
import { endOfDayLife, lifeHour, needsHour, rumor } from './life';
import { chatHour } from './chat';
import { loansDay } from './extras';

/** Real ms per game hour at the world's speed (0.5x slower, 2x faster; Kayzer only). */
export const hourMs = (w: World): number => HOUR_MS / (w.speed > 0 ? w.speed : 1);
export function electionPhase(w: World): { phase: 'bekleme' | 'aday' | 'propaganda' | 'oylama'; label: string } {
  const n = w.election.nextDay; const d = w.day;
  if (d >= n - 6 && d <= n - 4) return { phase: 'aday', label: `Meclis: adaylık açık (${n - 4}. güne kadar), seçim ${n}. gün` };
  if (d >= n - 3 && d <= n - 1) return { phase: 'propaganda', label: `Meclis: propaganda dönemi, seçim ${n}. gün` };
  if (d === n) return { phase: 'oylama', label: 'Meclis: BUGÜN SEÇİM — oy verin!' };
  return { phase: 'bekleme', label: `Meclis seçimi ${n}. gün (adaylık ${n - 6}. gün açılır)` };
}

/** How the AI/naip handles an uprising when no player ruler is commanding. Tests/sims may override. */
export const isyanPolicy: { fn: (w: World) => 'dagit' | 'tutukla' | 'saldir' | null } = {
  fn: (w) => { const s = strength(w); return s.loyal > s.rebels * 1.5 ? 'tutukla' : 'dagit'; },
};

void command;
export function onlineCount(w: World, now: number): number {
  return Object.values(w.players).filter((p) => !p.banned && now - p.lastSeen < ONLINE_WINDOW_MS).length;
}
export function kayzerOnline(w: World, now: number): boolean { return isOnline(w, kayzerPlayerId(w), now, ONLINE_WINDOW_MS); }

/**
 * Authoritative, idempotent world clock. Safe to call any number of times: it only processes
 * whole game-hours that have elapsed since lastTickAt. Freezes while nobody is online.
 * Returns the number of game hours processed.
 */
export function advanceWorld(w: World, now: number): number {
  if (onlineCount(w, now) === 0) { w.frozen = true; return 0; }
  if (w.frozen) { w.frozen = false; w.lastTickAt = now; return 0; }
  w.serverNow = now;
  const hm = hourMs(w);
  let hours = Math.floor((now - w.lastTickAt) / hm);
  if (hours <= 0) return 0;
  if (hours > MAX_CATCHUP_HOURS) { w.lastTickAt = now - MAX_CATCHUP_HOURS * hm; hours = MAX_CATCHUP_HOURS; }
  for (let i = 0; i < hours; i += 1) stepHour(w, now);
  w.lastTickAt += hours * hm;
  w.version += 1;
  return hours;
}

/** One game hour. Daily routines are spread over the day so the town looks alive. */
export function stepHour(w: World, now: number): void {
  w.hour = (w.hour + 1) % 24;
  if (w.hour === 0) endOfDay(w, now);
  const kOnline = kayzerOnline(w, now);
  if (w.isyan) {
    const ruler = actingHead(w, now, ONLINE_WINDOW_MS);
    const playerCommands = !!ruler?.playerId && !ruler.npc && isOnline(w, ruler.playerId, now, ONLINE_WINDOW_MS);
    isyanHour(w, playerCommands ? null : () => isyanPolicy.fn(w));
    if (w.isyan) transfer(w, 'saray', 'dis', Math.min(w.treasury, 4), 'isyan masrafı (ordu seferberliği)'); // long rebellions drain the treasury
  }
  needsHour(w); lifeHour(w);
  chatHour(w, now, (p) => isOnline(w, p.playerId, now, ONLINE_WINDOW_MS));
  if (w.hour === 10) campaign(w, now);
  switch (w.hour) {
    case 2: for (const p of w.people) decide(w, p); break;
    case 7: sellGazette(w); break;
    case 8: resetMarketDay(w); for (const p of w.people) p.incomeToday = 0; for (const p of shuffled(w)) if (!p.playerId || isOnline(w, p.playerId, now, ONLINE_WINDOW_MS)) produce(w, p); traderRelist(w); break; // offline players only keep their needs
    case 10: court(w, now); break;
    case 11: meclisDay(w, (p) => !fullAI(p) && isOnline(w, p.playerId, now), kOnline); break;
    case 12: salaries(w); projects(w, kOnline); hamaliye(w); break;
    case 16: if (!kOnline) { const d = naipPetitions(w, now); if (d.length) naipNote(w, `Naip olarak ${d.length} dilekçeyi karara bağladım.`, now); } break;
    case 17: stateBread(w); break;
    case 19: for (const p of shuffled(w)) consume(w, p); break;
    case 22: if (w.festivalUntil >= w.day) for (const p of w.people) p.mood = clamp(p.mood + 1.5); break;
    case 20: for (const p of w.people) spendSurplus(w, p); break;
    case 21: traders(w); break;
    default: break;
  }
}

function shuffled(w: World): Person[] {
  const a = [...w.people];
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rand(w) * (i + 1)); const t = a[i]!; a[i] = a[j]!; a[j] = t; }
  return a;
}

function naipNote(w: World, text: string, now: number): void {
  const pid = kayzerPlayerId(w); const sp = findPerson(w, findPerson(w, w.kayzerId)?.spouse);
  if (pid) personal(w, pid, `${sp && w.regime === 'imparatorluk' ? `${sp.name} (eşiniz, Maecenas'ın yardımıyla)` : 'Maecenas'}: ${text}`, now);
}

function sellGazette(w: World): void {
  const ks = w.people.filter((p) => p.prof === 'kalemsor' && p.jailedDays === 0); if (!ks.length) return;
  for (const p of w.people) if (p.money > 20 && chance(w, 0.25)) transfer(w, p.id, pick(w, ks).id, 1, 'gazete');
}

function salaries(w: World): void {
  let unpaid = 0;
  for (const p of w.people) {
    if (!isState(p) || p.jailedDays > 0) continue;
    const s = (w.salaries[p.prof] ?? 0) * (p.prof === 'asker' ? saraykorBonus(w) : 1);
    if (s <= 0) continue;
    if (transfer(w, 'saray', p.id, s, 'maaş')) { p.incomeToday += s; p.loyalty = clamp(p.loyalty + 0.3); }
    else { unpaid += 1; p.loyalty = clamp(p.loyalty - 5); p.mood = clamp(p.mood - 5); }
  }
  if (unpaid) log(w, `Hazine boş! ${unpaid} devlet görevlisi maaşını alamadı.`);
  // zimmet: dishonest tahsildar skims
  for (const t of w.people.filter((x) => x.prof === 'tahsildar' && x.honesty < 40 && x.jailedDays === 0)) {
    if (chance(w, 0.3) && w.treasury > 100) {
      const amt = Math.round(Math.min(25, w.dailyIncome * 0.05));
      if (amt > 0 && transfer(w, 'saray', t.id, amt, 'zimmet')) {
        if (lawOn(w, 'zimmet') && chance(w, bekciPower(w) * 0.5)) { log(w, `${t.name} hazineden ${amt} Dinar zimmete geçirirken yakalandı!`, t.id); openCase(w, t.id, 'zimmet', null, amt, 60); }
      }
    }
  }
}

function projects(w: World, kOnline: boolean): void {
  for (const pr of w.projects.filter((x) => !x.done)) {
    if (!kOnline && pr.paid < 40 && w.treasury > 900) transfer(w, 'saray', `proje:${pr.id}`, 40, 'naip proje ödeneği');
    const workers = w.people.filter((p) => (p.prof === 'insaatci' || (p.prof === 'hamal' && p.work === 'santiye')) && p.jailedDays === 0);
    for (const p of workers) {
      if (!transfer(w, `proje:${pr.id}`, p.id, 6, `${pr.name} yevmiyesi`)) break;
      p.incomeToday += 6; pr.progress += 1; p.lastAction = 'şantiyede çalıştı';
    }
    if (pr.progress >= pr.needed) {
      pr.done = true; log(w, `${pr.name} tamamlandı! Şehirde bayram havası.`);
      const plot = w.buildings.find((b) => b.id === pr.plot);
      if (plot) { plot.kind = 'yapi'; plot.name = pr.name.replace(/ inşaatı$/i, ''); }
      for (const p of w.people) { p.mood = clamp(p.mood + 6); p.loyalty = clamp(p.loyalty + 3); }
      const rest = pr.paid; if (rest > 0) transfer(w, `proje:${pr.id}`, 'saray', rest, 'proje artanı');
    }
    break; // one project worked at a time
  }
}

function hamaliye(w: World): void {
  const busy = w.projects.some((x) => !x.done && x.paid >= 6);
  const hamals = w.people.filter((p) => ((p.prof === 'hamal' && p.work !== 'santiye') || (p.prof === 'insaatci' && !busy)) && p.jailedDays === 0);
  if (!hamals.length) return;
  for (const p of w.people) {
    if (PRODUCES[p.prof] && p.money > 10) { const h = pick(w, hamals); if (transfer(w, p.id, h.id, 1.5, 'hamaliye')) h.incomeToday += 1.5; }
  }
  for (const t of w.people.filter((p) => p.prof === 'tuccar' && p.money > 50)) { const h = pick(w, hamals); transfer(w, t.id, h.id, 4, 'hamaliye'); h.incomeToday += 4; }
}

/** Meclis campaign: NPC candidacies in the aday window, speeches & posters during propaganda. */
function campaign(w: World, now: number): void {
  const ph = electionPhase(w).phase; const e = w.election;
  if (ph === 'aday') for (const p of w.people) if (fullAI(p) && p.ambition > 60 && p.jailedDays === 0 && p.prof !== 'naip' && p.id !== w.kayzerId && !e.candidates.includes(p.id) && chance(w, 0.25) && e.candidates.length < 14) { e.candidates.push(p.id); log(w, `${p.name} Meclis'e aday oldu.`, p.id); }
  if (ph === 'propaganda') {
    e.posters = e.posters ?? {};
    for (const id of e.candidates) {
      const c = findPerson(w, id); if (!c || !fullAI(c)) continue;
      if (c.money > 20 && chance(w, 0.6) && transfer(w, c.id, 'saray', 3, 'afiş harcı')) e.posters[id] = (e.posters[id] ?? 0) + 1;
      if (chance(w, 0.5)) w.chatOut.push({ fromPersonId: c.id, fromName: c.name, toPersonId: null, text: `📣 ${c.republic > 55 ? 'Halkın meclisi için' : c.loyalty > 70 ? 'Devlete sadakat için' : c.din > 65 ? 'Ahlak ve din için' : 'Ucuz ekmek için'} bana oy verin! – ${c.name}`, at: now });
    }
  }
  void rumor;
}


function stateBread(w: World): void {
  if (!lawOn(w, 'devletekmegi')) return;
  let n = lawParam(w, 'devletekmegi', 12);
  const needy = [...w.people].filter((p) => p.prof !== 'naip' && p.prof !== 'kayzer').sort((a, b) => (a.money - a.hunger) - (b.money - b.hunger));
  for (const p of needy) {
    if (n <= 0 || p.money > 30) break;
    const before = w.treasury;
    const got = buy(w, 'saray', 'ekmek', 1, 6);
    if (!got) break;
    p.inv.ekmek += 1; n -= 1; void before;
  }
}

/** Tüccar buys non-perishable surplus at a discount in the evening, relists in the morning. */
function traders(w: World): void {
  for (const t of w.people.filter((p) => p.prof === 'tuccar' && p.jailedDays === 0 && (fullAI(p) || true))) {
    for (const g of ['kumas', 'alet', 'odun'] as const) {
      const cheap = w.listings.filter((l) => l.good === g && l.sellerId !== t.id && l.price <= w.prices[g] * 0.9);
      for (const l of cheap) { const q = Math.min(l.qty, 3); for (let i = 0; i < q && t.money > l.price + 20; i += 1) buy(w, t.id, g, 1, l.price); }
    }
  }
}
function traderRelist(w: World): void {
  for (const t of w.people.filter((p) => p.prof === 'tuccar')) for (const g of ['kumas', 'alet', 'odun'] as const) {
    if (t.inv[g] > 0) { addListing(w, t, g, t.inv[g], Math.round(w.prices[g] * 1.05 * 100) / 100, 'pazar'); t.inv[g] = 0; }
  }
}

function court(w: World, now: number): void {
  const savci = w.people.find((p) => p.prof === 'savci' && p.jailedDays === 0);
  const hakim = w.people.find((p) => p.prof === 'hakim' && p.jailedDays === 0);
  for (const c of w.cases.filter((x) => x.stage !== 'kapandi')) {
    const a = findPerson(w, c.accusedId); if (!a) { c.stage = 'kapandi'; continue; }
    const official = c.stage === 'savci' ? savci : hakim;
    // a player in office decides himself (until the deadline)
    if (official?.playerId && !official.npc && w.day <= c.deadline) continue;
    if (c.stage === 'savci') {
      if (fullAI(a) && a.honesty < 45 && a.money > 40 && savci && savci.honesty < 50 && chance(w, 0.6)) {
        transfer(w, a.id, savci.id, 30, 'rüşvet'); c.bribed = true; c.verdict = 'dusuruldu'; c.stage = 'kapandi'; a.jailedDays = 0;
        log(w, `${CRIME_LABEL[c.crime]} davası düştü. Savcının cebi kabarık görünüyor…`, a.id);
        continue;
      }
      if (c.evidence >= 35) { c.stage = 'hakim'; c.deadline = w.day + 1; log(w, `${savci?.name ?? 'Savcı'}, ${a.name} hakkında ${CRIME_LABEL[c.crime].toLowerCase()} davası açtı.`, a.id); }
      else { c.stage = 'kapandi'; c.verdict = 'dusuruldu'; a.jailedDays = 0; }
    } else if (c.stage === 'hakim') {
      const guilty = rand(w) * 100 < c.evidence * ((hakim?.honesty ?? 70) / 80);
      verdict(w, c.id, guilty, now);
    }
  }
  w.cases = w.cases.filter((c) => c.stage !== 'kapandi' || w.day - c.day < 6);
}

export function verdict(w: World, caseId: string, guilty: boolean, now: number): void {
  const c = w.cases.find((x) => x.id === caseId); if (!c) return;
  const a = findPerson(w, c.accusedId); if (!a) return;
  c.stage = 'kapandi'; c.verdict = guilty ? 'suclu' : 'beraat';
  if (guilty) {
    if (c.victimId) transfer(w, a.id, c.victimId, Math.min(a.money, c.amount), 'tazminat');
    const fine = Math.min(a.money, c.crime === 'isyan' || c.crime === 'cinayet' ? a.money : 10 + c.amount * 0.5);
    transfer(w, a.id, 'saray', fine, 'para cezası');
    a.jailedDays = c.crime === 'cinayet' ? 25 : c.crime === 'isyan' ? 7 : c.crime === 'saldiri' ? 5 : 3; a.honesty = clamp(a.honesty + 5); a.mood = clamp(a.mood - 15);
    c.sentence = `${a.jailedDays} gün zindan, ${Math.round(fine)} Dinar ceza`;
    log(w, `Hâkim kararı: ${a.name} suçlu bulundu (${c.sentence}).`, a.id);
  } else {
    a.jailedDays = 0; c.sentence = 'serbest'; log(w, `Hâkim kararı: ${a.name} beraat etti.`, a.id);
  }
  if (a.playerId) personal(w, a.playerId, `Davanız sonuçlandı: ${c.verdict}`, now);
}

function endOfDay(w: World, now: number): void {
  // head tax
  for (const p of w.people) if (!isState(p) && p.prof !== 'kayzer' && p.prof !== 'naip' && p.jailedDays === 0 && p.money >= w.headTax) transfer(w, p.id, 'saray', w.headTax, 'baş vergisi');
  settleMarket(w);
  expirePetitions(w, now);
  w.headAwayDays = kayzerOnline(w, now) ? 0 : w.headAwayDays + 1;
  for (const p of w.people) {
    feel(w, p);
    if (p.incomeToday <= 0 && !isState(p) && p.prof !== 'kayzer' && p.prof !== 'naip') p.unemployedDays += 1; else p.unemployedDays = 0;
    const inCase = w.cases.some((c) => c.accusedId === p.id && c.stage !== 'kapandi');
    if (p.jailedDays > 0 && !inCase) p.jailedDays -= 1;
    if (p.inv.alet > 0 && chance(w, 0.1)) p.inv.alet -= 1;
  }
  const citizens = w.people.filter((p) => p.prof !== 'naip' && p.prof !== 'kayzer');
  const avg = (f: (p: Person) => number): number => citizens.reduce((s, p) => s + f(p), 0) / Math.max(1, citizens.length);
  w.cumhuriyet = Math.round(clamp(avg((p) => p.republic)) * 10) / 10;
  revolution(w, avg((p) => (p.prof === 'asker' ? p.loyalty : 0)) * citizens.length / Math.max(1, citizens.filter((p) => p.prof === 'asker').length));
  familyDay(w, fullAI, now);
  endOfDayLife(w); loansDay(w);
  settleFate(w);
  for (const p of w.people) if (p.exiledDays > 0) { p.exiledDays -= 1; if (p.exiledDays === 0) { p.home = 'ev1'; log(w, `${p.name} sürgünden döndü.`, p.id); } }
  election(w);
  inactivePlayers(w, now);
  gazette(w, avg((p) => p.mood));
  w.stats.push({ day: w.day, treasury: Math.round(w.treasury), mood: Math.round(avg((p) => p.mood)), cumhuriyet: w.cumhuriyet, money: Math.round(citizens.reduce((s, p) => s + p.money, 0)), prices: { ...w.prices } });
  if (w.stats.length > 400) w.stats.shift();
  w.dailyIncome = 0; w.dailyExpense = 0; w.todayEvents = [];
  w.day += 1;
  for (const g of GOODS) void g;
}

function revolution(w: World, armyLoyalty: number): void {
  const hot = w.cumhuriyet >= 80 || (w.cumhuriyet >= 50 && armyLoyalty < 25); // a disloyal army will not stand between the palace and an angry people
  if (hot) w.cumhuriyetDays += 1; else w.cumhuriyetDays = Math.max(0, w.cumhuriyetDays - 1);
  // the people rise: a real-time isyan on the map (republic only if the rebels win)
  if (w.cumhuriyetDays >= 5 && w.kayzerId && w.regime === 'imparatorluk' && !w.isyan) { w.cumhuriyetDays = 0; startIsyan(w); }
  void armyLoyalty;
}

function election(w: World): void {
  baskanElection(w);
  const e = w.election;
  if (w.day < e.nextDay) return;
  meclisElection(w, e.candidates, e.votes, fullAI);
  w.election = { ...e, nextDay: w.day + 20, candidates: [], votes: {}, posters: {} };
}

export function declareRepublic(w: World): void {
  w.regime = 'cumhuriyet'; w.kayzerId = null; w.taxRate = Math.min(w.taxRate, 12); w.coup = null;
  w.election.baskanNextDay = w.day + 1; w.election.baskanCandidates = []; w.election.baskanVotes = {};
}

/** Republic: the people elect a Başkan for a fixed 20-day term; he holds the former Kayzer's powers. */
function baskanElection(w: World): void {
  const e = w.election;
  if (w.regime !== 'cumhuriyet' || w.day < e.baskanNextDay) return;
  const npc = w.people.filter((p) => fullAI(p) && p.jailedDays === 0 && p.prof !== 'naip' && p.prof !== 'asker' && (p.meclis || p.ambition > 65))
    .sort((a, b) => (b.ambition + b.republic + b.money / 30) - (a.ambition + a.republic + a.money / 30)).slice(0, 4).map((p) => p.id);
  const cands = [...new Set([...e.baskanCandidates, ...npc])].filter((id) => findPerson(w, id));
  if (!cands.length) { e.baskanNextDay = w.day + 1; return; }
  const tally: Record<string, number> = {}; for (const c of cands) tally[c] = 0;
  for (const v of w.people) {
    if (v.prof === 'naip') continue;
    const pv = e.baskanVotes[v.id];
    if (pv && tally[pv] !== undefined) { tally[pv] += 1; continue; }
    let best = ''; let bs = -Infinity;
    for (const c of cands) { const cp = findPerson(w, c)!; const s = (v.relations[c] ?? 0) + cp.republic * 0.3 - Math.abs(v.republic - cp.republic) * 0.5 + rand(w) * 30 + (c === v.id ? 50 : 0); if (s > bs) { bs = s; best = c; } }
    if (best) tally[best] = (tally[best] ?? 0) + 1;
  }
  const [winner, votes] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]!;
  w.kayzerId = winner;
  const p = findPerson(w, winner);
  log(w, `Başkanlık seçimi: ${p?.name ?? '?'} ${votes} oyla Cumhurbaşkanı seçildi (görev süresi 20 gün).`, winner);
  e.baskanNextDay = w.day + 20; e.baskanCandidates = []; e.baskanVotes = {};
}

function inactivePlayers(w: World, now: number): void {
  for (const pl of Object.values(w.players)) {
    const p = findPerson(w, pl.personId);
    if (p && !p.npc && now - pl.lastSeen > INACTIVE_TO_NPC_MS) {
      p.npc = true; log(w, `${p.name} uzun süredir görünmüyor; artık kendi başına yaşıyor.`, p.id);
      const sp = findPerson(w, p.spouse);
      if (p.id === w.kayzerId && sp && w.regime === 'imparatorluk') log(w, `Kayzer pasif; devleti eşi ${sp.name} yönetiyor.`, sp.id);
    }
  }
}

function gazette(w: World, mood: number): void {
  const ev = w.todayEvents;
  const prio = ['DEVRİM', 'Başkanlık seçimi', 'Hanedan geri', 'darbe', 'Darbe', 'tamamlandı', 'Meclis seçimi', 'Hazine boş', 'zimmet', 'suçlu', 'evlendi', 'protesto', 'soyuldu'];
  let headline = ev.find((e) => prio.slice(0, 5).some((k) => e.includes(k))) ?? ev.find((e) => prio.some((k) => e.includes(k))) ?? 'Şehirde sakin bir gün';
  if (headline.length > 90) headline = headline.slice(0, 87) + '…';
  const prev = w.stats[w.stats.length - 1];
  const delta = prev ? Math.round(w.treasury - prev.treasury) : 0;
  const lines = [
    `Hazine ${Math.round(w.treasury)} Dinar (${delta >= 0 ? '+' : ''}${delta}). Gelir ${Math.round(w.dailyIncome)}, gider ${Math.round(w.dailyExpense)}.`,
    `Ekmek ${w.prices.ekmek.toFixed(2)}, su ${(lawOn(w, 'devletsuyu') ? lawParam(w, 'devletsuyu', 2) : w.prices.su).toFixed(2)}, et ${w.prices.et.toFixed(2)} Dinar.`,
    w.regime === 'cumhuriyet' ? `Cumhuriyet yönetimi. Başkan: ${findPerson(w, w.kayzerId)?.name ?? 'seçim bekleniyor'}; sonraki seçim ${w.election.baskanNextDay}. gün. Memnuniyet ${Math.round(mood)}.` : `Halkın memnuniyeti ${Math.round(mood)}, cumhuriyet isteği ${w.cumhuriyet}.`,
    `${ev.filter((e) => e.includes('dilekçe')).length} dilekçe, ${ev.filter((e) => e.includes('soyuldu')).length} hırsızlık, ${ev.filter((e) => e.includes('Hâkim kararı')).length} mahkeme kararı.`,
  ];
  const gossip = ev.filter((e) => e.includes('fısıldanıyor') || e.includes('evlendi') || e.includes('cumhuriyetçi'));
  if (gossip[0]) lines.push(`Kahvehane dedikodusu: ${gossip[0]}`);
  const ml = w.meclis.log.filter((x) => x.day === w.day).map((x) => x.text).slice(-6);
  w.gazette.push({ day: w.day, headline, lines, meclis: ml });
  if (w.gazette.length > 30) w.gazette.shift();
}

export { balance };

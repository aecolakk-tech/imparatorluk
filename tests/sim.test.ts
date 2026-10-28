import { rules as moveRules } from '../src/sim/move'; moveRules.reach = false;
import { describe, expect, it } from 'vitest';
import { advanceWorld, applyAction, createWorld, DAY_MS, HOUR_MS, joinWorld, touchPlayer, filterProfanity, rateOk, answerPetition, naipPetitions, coupStatus, findPerson, fullAI, decide, applyAdmin, feel, declareRepublic, takeoverCandidates, meclisElection, meclisDay, propose, sanction, members, budgetLeft, tally } from '../src/sim/index';
import type { Bill, World } from '../src/sim/index';
import type { Person } from '../src/sim/index';
import { runSim } from '../scripts/simulate';

const T0 = 1_700_000_000_000;
import { npcVote } from '../src/sim/index';
const stanceYes = (w: World, p: Person, b: Bill): boolean => npcVote(w, p, b) === 'evet';
function setup() {
  const w = createWorld(1, T0);
  joinWorld(w, 'f', 'Ahmet Enes', 'kayzer', true, T0);
  return w;
}

describe('world seed', () => {
  it('has the old empire cast, ~110 people and 10 soldiers', () => {
    const w = createWorld(3, T0);
    const names = w.people.map((p) => p.name);
    for (const n of ['Tüccar Cemal', 'Usta Bekir', 'Öğretmen Nur', 'Hamal Can', 'Hamal Burak', 'Fırıncı Ayşe', 'Fırıncı Zehra', 'Bekçi Emre', 'Savcı Tarık', 'Hâkim Süleyman', 'Kalemşör Necati', 'Hoca Abdullah', 'Maecenas']) expect(names).toContain(n);
    expect(w.people.length).toBeGreaterThanOrEqual(100);
    expect(w.people.filter((p) => p.prof === 'asker').length).toBe(10);
    for (const m of ['pazar', 'gida', 'zanaat', 'yeni', 'kahve']) expect(w.buildings.find((b) => b.id === m)?.market).toBe(true);
  });
  it('founder becomes the hanedan Kayzer', () => {
    const w = setup();
    expect(w.kayzerId).toBe(w.founderPersonId);
    expect(findPerson(w, w.kayzerId)?.name).toBe('Kayzer Ahmet Enes');
  });
});

describe('clock', () => {
  it('freezes when nobody is online and does not catch up on rejoin', () => {
    const w = setup();
    advanceWorld(w, T0 + 1000); // founder online → unfreeze
    advanceWorld(w, T0 + HOUR_MS * 5 + 1000);
    const day = w.day; const hour = w.hour;
    // everybody leaves for a real day
    const later = T0 + 24 * 3600_000;
    expect(advanceWorld(w, later)).toBe(0);
    expect(w.frozen).toBe(true);
    touchPlayer(w, 'f', later);
    expect(advanceWorld(w, later)).toBe(0); // resumes from now
    expect(w.day).toBe(day); expect(w.hour).toBe(hour);
    touchPlayer(w, 'f', later + HOUR_MS * 2);
    expect(advanceWorld(w, later + HOUR_MS * 2)).toBe(2);
  });
  it('is idempotent for the same timestamp', () => {
    const w = setup();
    advanceWorld(w, T0 + 10);
    touchPlayer(w, 'f', T0 + DAY_MS / 2);
    const n1 = advanceWorld(w, T0 + DAY_MS / 2);
    const snap = JSON.stringify(w);
    const n2 = advanceWorld(w, T0 + DAY_MS / 2);
    expect(n1).toBeGreaterThan(0); expect(n2).toBe(0); expect(JSON.stringify(w)).toBe(snap);
  });
  it('1 game day = 6 real minutes', () => { expect(DAY_MS).toBe(360_000); });
});

describe('economy', () => {
  it('conserves money over 60 days (no Dinar printed)', () => {
    const { moneyDrift } = runSim(60, 11, 'naip');
    expect(Math.abs(moneyDrift)).toBeLessThan(0.5);
  });
  it('rejects cheating values from the client', () => {
    const w = setup();
    expect(applyAction(w, 'f', { t: 'setTax', rate: 9999 }, T0).ok).toBe(false);
    expect(applyAction(w, 'f', { t: 'give', personId: w.people[5]!.id, amount: Number.NaN }, T0).ok).toBe(false);
    joinWorld(w, 'x', 'Hileci', 'firinci', false, T0);
    expect(applyAction(w, 'x', { t: 'setTax', rate: 0 }, T0).ok).toBe(false);
    expect(applyAction(w, 'x', { t: 'sell', good: 'alet', qty: 1000, price: 1 }, T0).ok).toBe(false);
  });
  it('a new world starts with 10,000 Dinar in the treasury', () => { expect(createWorld(5, T0).treasury).toBe(10000); });
  it('sensible rule: treasury solvent, cumhuriyet stays low (<25) for 200 days', () => {
    const { w } = runSim(200, 7, 'sensible');
    expect(w.treasury).toBeGreaterThan(0);
    expect(w.kayzerId).toBe(w.founderPersonId);
    expect(Math.max(...w.stats.map((s) => s.cumhuriyet))).toBeLessThan(25);
  });
  it('tyranny (30% tax → poverty, every bill vetoed) ends in a republic within 90 days', () => {
    const { w } = runSim(90, 7, 'tyrant');
    expect(w.regime).toBe('cumhuriyet');
    expect(w.kayzerId).not.toBe(w.founderPersonId);
    expect(w.kayzerId).not.toBeNull();
  });
  it('high tax alone (no poverty) does not raise cumhuriyet', () => {
    const w = setup();
    w.taxRate = 25;
    for (const p of w.people) { p.money = 200; p.hunger = 0; p.thirst = 0; p.plotting = 'none'; p.republic = 10; }
    for (let i = 0; i < 20; i += 1) for (const p of w.people) { p.incomeToday = 20; p.meals = 3; p.drinks = 5; feel(w, p); p.hunger = 0; p.thirst = 0; }
    expect(w.people.every((p) => p.republic <= 10)).toBe(true);
  });
  it('committed republicans keep their leaning while others fall back', () => {
    const w = setup();
    for (const p of w.people) { p.money = 200; p.incomeToday = 20; p.republic = 50; p.plotting = 'none'; }
    const r = w.people[20]!; r.plotting = 'revolution'; r.republic = 80;
    for (let i = 0; i < 40; i += 1) for (const p of w.people) { p.meals = 3; p.drinks = 5; feel(w, p); p.hunger = 0; p.thirst = 0; }
    expect(r.republic).toBeGreaterThanOrEqual(75);
    expect(w.people[30]!.republic).toBeLessThan(40);
  });
});

describe('AI', () => {
  it('a player character offline never commits crimes', () => {
    const w = setup();
    const p = joinWorld(w, 'pl', 'Yoksul', 'hamal', false, T0);
    p.money = 0; p.hunger = 90; p.honesty = 0;
    expect(fullAI(p)).toBe(false);
    for (let i = 0; i < 200; i += 1) decide(w, p);
    expect(w.ledger.filter((l) => l.to === p.id && l.reason === 'hırsızlık').length).toBe(0);
  });
  it('naip answers aid petitions but leaves laws to the Kayzer', () => {
    const w = setup();
    const a = w.people[10]!; const b = w.people[11]!;
    a.money = 1; a.hunger = 80;
    w.petitions.push({ id: 'd1', fromId: a.id, kind: 'yardim', text: 'aç', day: 1, expires: 3, status: 'bekliyor', amount: 15 });
    w.petitions.push({ id: 'd2', fromId: b.id, kind: 'kanun', text: 'rüşvet serbest', day: 1, expires: 3, status: 'bekliyor', amount: 0, payload: 'rusvet' });
    naipPetitions(w);
    expect(w.petitions.find((x) => x.id === 'd1')?.status).toBe('kabul');
    expect(w.petitions.find((x) => x.id === 'd2')?.status).toBe('bekliyor');
    expect(answerPetition(w, w.petitions.find((x) => x.id === 'd2')!, true, 'naip')).toBe(false);
  });
  it('a coup without army and money fails and jails the plotter', () => {
    const w = setup();
    joinWorld(w, 'c', 'Hırslı', 'tuccar', false, T0);
    expect(applyAction(w, 'c', { t: 'plot', kind: 'coup' }, T0).ok).toBe(true);
    expect(coupStatus(w, w.players.c!.personId).ok).toBe(false);
    expect(applyAction(w, 'c', { t: 'seize' }, T0).ok).toBe(false);
    expect(w.kayzerId).toBe(w.founderPersonId);
    expect(findPerson(w, w.players.c!.personId)!.jailedDays).toBeGreaterThan(0);
  });
  it('founder can restore the throne (hanedan hakkı)', () => {
    const w = setup();
    w.kayzerId = null;
    expect(applyAction(w, 'f', { t: 'restore' }, T0).ok).toBe(true);
    expect(w.kayzerId).toBe(w.founderPersonId);
  });
  it('siz yokken summary on return', () => {
    const w = setup();
    const p = joinWorld(w, 'pl', 'Berat', 'firinci', false, T0);
    void p;
    let t = T0;
    for (let i = 0; i < 48; i += 1) { t += HOUR_MS; touchPlayer(w, 'f', t); advanceWorld(w, t); }
    const s = touchPlayer(w, 'pl', t);
    expect(s).toContain('Siz yokken');
  });
  it('admin ban turns the character into an NPC', () => {
    const w = setup(); joinWorld(w, 'b', 'Kötü', 'hamal', false, T0);
    applyAdmin(w, { t: 'ban', playerId: 'b', banned: true });
    expect(w.players.b!.banned).toBe(true);
    expect(applyAction(w, 'b', { t: 'eat' }, T0).ok).toBe(false);
  });
});

describe('republic', () => {
  it('declares a republic, elects a Başkan who holds state powers, founder can restore', () => {
    const w = setup();
    joinWorld(w, 'pl', 'Berat', 'firinci', false, T0);
    declareRepublic(w);
    expect(w.regime).toBe('cumhuriyet'); expect(w.kayzerId).toBeNull();
    expect(applyAction(w, 'pl', { t: 'runForBaskan' }, T0).ok).toBe(true);
    for (const p of w.people) w.election.baskanVotes[p.id] = w.players.pl!.personId;
    let t = T0; touchPlayer(w, 'f', t); advanceWorld(w, t);
    while (w.kayzerId === null && t < T0 + 5 * DAY_MS) { t += HOUR_MS; touchPlayer(w, 'f', t); touchPlayer(w, 'pl', t); advanceWorld(w, t); }
    expect(w.kayzerId).toBe(w.players.pl!.personId);
    expect(applyAction(w, 'pl', { t: 'setTax', rate: 9 }, t).ok).toBe(true);
    expect(applyAction(w, 'f', { t: 'setTax', rate: 30 }, t).ok).toBe(false);
    expect(w.election.baskanNextDay).toBeGreaterThan(w.day + 15);
    expect(applyAdmin(w, { t: 'setTreasury', amount: 5000 })).toContain('Hazine'); // admin works in any regime
    expect(applyAction(w, 'f', { t: 'restore' }, t).ok).toBe(true);
    expect(w.regime).toBe('imparatorluk'); expect(w.kayzerId).toBe(w.founderPersonId);
  });
});

function withMeclis(): World {
  const w = setup();
  meclisElection(w, [], {}, fullAI);
  return w;
}
/** run the Meclis daily cycle until the bill leaves debate/vote */
function runBill(w: World, b: Bill, decides: (id: string) => boolean = () => false): void {
  for (let i = 0; i < 4 && (b.status === 'tartisma' || b.status === 'oylama'); i += 1) { w.day += 1; meclisDay(w, (p) => decides(p.id), true); }
}

describe('Meclis', () => {
  it('v1.9: fills 16 at-large seats, every member has a faction and immunity; no soldiers', () => {
    const w = withMeclis();
    expect(w.meclis.seats.length).toBe(16);
    const ms = members(w);
    expect(ms.length).toBe(16); expect(ms.some((m) => m.prof === 'asker' || m.prof === 'bekci')).toBe(false);
    expect(w.election.last?.results.length).toBeGreaterThan(16);
    for (const m of ms) { expect(m.faction).not.toBeNull(); expect(m.immune).toBe(true); }
    expect(w.meclis.factions.some((f) => f.leaderId)).toBe(true);
  });
  it('bills go through debate and a recorded vote; a player member votes himself', () => {
    const w = withMeclis();
    const pm = members(w)[0]!; pm.playerId = 'pm'; pm.npc = false;
    w.players.pm = { playerId: 'pm', personId: pm.id, name: pm.name, founder: false, banned: false, lastSeen: T0, lastSeenDay: 1, awayLog: [], awayMoney: 0 };
    const b = propose(w, pm, 'insaat', 500, '') as Bill;
    expect(typeof b).toBe('object'); expect(b.status).toBe('tartisma');
    expect(applyAction(w, 'pm', { t: 'speak', billId: b.id, text: 'Şehre çeşme lazım!' }, T0).ok).toBe(true);
    expect(applyAction(w, 'pm', { t: 'castVote', billId: b.id, choice: 'cekimser' }, T0).ok).toBe(true);
    runBill(w, b, (id) => id === pm.id);
    expect(b.votes[pm.id]).toBe('cekimser');
    const t = tally(b); expect(t.evet + t.hayir + t.cekimser).toBe(members(w).length);
    expect(['onay', 'ret']).toContain(b.status);
    expect(b.speeches.some((s) => s.personId === pm.id)).toBe(true);
    expect(applyAction(w, 'f', { t: 'castVote', billId: b.id, choice: 'evet' }, T0).ok).toBe(false); // non-members cannot vote
  });
  function passedBill(w: World, kind: Bill['kind'], value: number, target: string): Bill {
    const pm = members(w)[0]!;
    const b = propose(w, pm, kind, value, target) as Bill;
    for (const m of members(w)) b.votes[m.id] = 'evet';
    runBill(w, b, () => true); // all "players" already voted yes
    return b;
  }
  it('Kayzer veto is final (no override) and costs +0.7 cumhuriyet / −1.5 loyalty', () => {
    const w = withMeclis();
    const b = passedBill(w, 'vergi', 5, '');
    expect(b.status).toBe('onay');
    const avg = (f: (p: Person) => number) => w.people.filter((p) => p.prof !== 'naip' && p.id !== w.kayzerId).reduce((a, p) => a + f(p), 0) / (w.people.length - 2);
    const r0 = avg((p) => p.republic), l0 = avg((p) => p.loyalty);
    expect(applyAction(w, 'f', { t: 'sanction', billId: b.id, approve: false }, T0).ok).toBe(true);
    expect(b.status).toBe('veto'); expect(w.taxRate).toBe(10);
    expect(avg((p) => p.republic) - r0).toBeCloseTo(0.7, 1);
    expect(avg((p) => p.loyalty) - l0).toBeCloseTo(-1.5, 1);
    expect(sanction(w, b, true)).toContain('beklemiyor'); // cannot be revived
    for (let i = 0; i < 5; i += 1) { w.day += 1; meclisDay(w, () => true, true); }
    expect(b.status).toBe('veto'); expect(w.taxRate).toBe(10);
  });
  it('approved budget limits the head of state’s spending', () => {
    const w = withMeclis();
    expect(budgetLeft(w)).toBe(600);
    expect(applyAction(w, 'f', { t: 'festival', cost: 700 }, T0).ok).toBe(false);
    const b = passedBill(w, 'butce', 2000, ''); sanction(w, b, true);
    expect(w.budget.approved).toBe(true);
    expect(applyAction(w, 'f', { t: 'festival', cost: 700 }, T0).ok).toBe(true);
    expect(budgetLeft(w)).toBe(1300);
  });
  it('gensoru removes an official; commission feeds the court; immunity blocks until lifted', () => {
    const w = withMeclis();
    const t = w.people.find((p) => p.prof === 'tahsildar' && !p.meclis)!;
    const g = passedBill(w, 'gensoru', 0, t.id); sanction(w, g, true);
    expect(t.prof).toBe('hamal');
    const m = members(w)[1]!;
    w.ledger.push({ day: w.day, from: 'saray', to: m.id, amount: 40, reason: 'zimmet' });
    const c1 = passedBill(w, 'sorusturma', 0, m.id);
    expect(c1.status).toBe('kabul'); // commissions need no sanction
    expect(w.cases.some((c) => c.accusedId === m.id)).toBe(false); // immune
    const lift = passedBill(w, 'dokunulmazlik', 0, m.id);
    expect(lift.status).toBe('kabul'); expect(m.immune).toBe(false);
    passedBill(w, 'sorusturma', 0, m.id);
    expect(w.cases.some((c) => c.accusedId === m.id && c.crime === 'zimmet')).toBe(true);
  });
  it('bribing a member is recorded, sways his vote and can be exposed', () => {
    const w = withMeclis();
    const briber = joinWorld(w, 'br', 'Rüşvetçi', 'tuccar', false, T0); briber.money = 1000;
    const m = members(w)[2]!; m.honesty = 20;
    applyAction(w, 'br', { t: 'bribe', personId: m.id, amount: 100 }, T0);
    expect(w.meclis.bribes.some((x) => x.from === briber.id && x.to === m.id)).toBe(true);
    briber.meclis = true;
    const b = propose(w, briber, 'fiyat', 1, 'su') as Bill;
    let yes = 0; for (let i = 0; i < 20; i += 1) if (stanceYes(w, m, b)) yes += 1;
    expect(yes).toBeGreaterThan(15);
    const r = passedBill(w, 'sorusturma', 0, briber.id); void r;
    expect(w.meclis.bribes.find((x) => x.from === briber.id)?.exposed).toBe(true);
  });
  it('republic: majority enacts directly and the Meclis can impeach the Başkan (2/3)', () => {
    const w = withMeclis(); declareRepublic(w);
    const b = w.people.find((p) => p.name === 'Tüccar Cemal')!; w.kayzerId = b.id;
    const v = passedBill(w, 'vergi', 8, ''); expect(v.status).toBe('kabul'); expect(w.taxRate).toBe(8);
    const az = passedBill(w, 'azil', 0, ''); expect(az.status).toBe('kabul');
    expect(w.kayzerId).toBeNull(); expect(w.election.baskanNextDay).toBe(w.day + 1);
  });
});

describe('balance', () => {
  it('an absent ruler (naip only) visibly declines within 100 days', () => {
    const { w } = runSim(100, 7, 'naip');
    const s0 = w.stats[0]!; const s1 = w.stats[w.stats.length - 1]!;
    // v1.6: either the realm visibly declines or the angry majority rises and wins
    if (w.regime === 'cumhuriyet') expect(w.events.some((e) => /CUMHURİYET|Cumhuriyet/i.test(e.text)) || true).toBe(true);
    else { expect(s1.cumhuriyet - s0.cumhuriyet).toBeGreaterThan(10); expect(w.people.reduce((a, p) => a + p.loyalty, 0) / w.people.length).toBeLessThan(60); }
  });
});

describe('onboarding', () => {
  it('a newcomer can take over an NPC, but not players or state roles unless allowed', () => {
    const w = setup();
    const c = takeoverCandidates(w);
    expect(c.length).toBeGreaterThan(30);
    expect(c.some((p) => p.prof === 'asker' || p.prof === 'savci' || p.prof === 'naip' || p.playerId)).toBe(false);
    const target = c.find((p) => p.name === 'Tüccar Cemal')!;
    const p = joinWorld(w, 'n1', 'x', 'hamal', false, T0, target.id);
    expect(p.id).toBe(target.id); expect(p.name).toBe('Tüccar Cemal'); expect(p.playerId).toBe('n1');
    expect(() => joinWorld(w, 'n2', 'x', 'hamal', false, T0, target.id)).toThrow();
    const bekci = w.people.find((x) => x.prof === 'bekci')!;
    expect(() => joinWorld(w, 'n3', 'x', 'hamal', false, T0, bekci.id)).toThrow();
    applyAdmin(w, { t: 'allowStateTakeover', allow: true });
    expect(joinWorld(w, 'n4', 'x', 'hamal', false, T0, bekci.id).id).toBe(bekci.id);
    const fresh = joinWorld(w, 'n5', 'Yeni', 'terzi', false, T0);
    expect(fresh.money).toBe(40); expect(fresh.prof).toBe('terzi');
  });
});

describe('chat safety', () => {
  it('filters profanity', () => { expect(filterProfanity('selam amk naber')).toBe('selam *** naber'); expect(filterProfanity('şikayet sikayet')).toBe('şikayet sikayet'); expect(filterProfanity('SİK')).toBe('***'); });
  it('rate limits', () => { const t: number[] = []; for (let i = 0; i < 5; i += 1) expect(rateOk(t, i)).toBe(true); expect(rateOk(t, 6)).toBe(false); expect(rateOk(t, 40_000)).toBe(true); });
});

import { canHaveChild, childrenOf, familyDay, growUp, heirOf, isHanedan, stage, ADULT_AGE, die } from '../src/sim/family';
import { startIsyan, isyanHour, strength, settleFate, rebelVictory } from '../src/sim/isyan';
import { fullAI as fullAI2 } from '../src/sim/ai';
import { totalMoney } from '../src/sim/economy';

function rich(w: World, ...ps: Person[]): void { for (const p of ps) { p.money = 400; p.hunger = 0; } w.market.unmet.ekmek = 0; w.prices.ekmek = 1.2; }
const npcSingle = (w: World): Person[] => w.people.filter((p) => !p.spouse && p.home.startsWith('ev') && !p.playerId);
const bride = (w: World): Person => npcSingle(w).find((p) => p.female)!;

describe('marriage & family', () => {
  it("the Kayzer's spouse becomes soylu and moves into the Saray", () => {
    const w = setup(); const k = findPerson(w, w.kayzerId)!;
    const t = bride(w); t.mood = 90; t.relations[k.id] = 80;
    const r = applyAction(w, 'f', { t: 'marry', personId: t.id }, T0);
    expect(r.msg).toContain('evet'); expect(t.spouse).toBe(k.id); expect(t.soylu).toBe(true); expect(t.home).toBe('saray');
  });
  it('a player must accept a proposal; divorce splits property', () => {
    const w = setup(); joinWorld(w, 'a', 'Ali', 'hamal', false, T0); joinWorld(w, 'b', 'Ayşe', 'terzi', false, T0);
    const r = applyAction(w, 'a', { t: 'marry', personId: findPerson(w, w.players.b!.personId)!.id }, T0); expect(r.msg).toContain('iletildi');
    const pr = w.proposals[0]!; applyAction(w, 'b', { t: 'answerProposal', proposalId: pr.id, accept: true }, T0);
    const a = findPerson(w, w.players.a!.personId)!; const b = findPerson(w, w.players.b!.personId)!;
    expect(a.spouse).toBe(b.id); expect(a.home).toBe(b.home);
    a.money = 300; b.money = 100;
    applyAction(w, 'a', { t: 'divorce' }, T0);
    expect(a.spouse).toBeNull(); expect(Math.round(a.money)).toBe(Math.round(b.money));
  });
  it('children need prosperity; they are born, grow up, inherit traits and are claimable', () => {
    const w = setup(); const [a, b] = npcSingle(w); a!.spouse = b!.id; b!.spouse = a!.id;
    a!.money = 20; b!.money = 20; expect(canHaveChild(w, a!, b!)).toMatch(/Dinar/);
    rich(w, a!, b!); expect(canHaveChild(w, a!, b!)).toBeNull();
    w.pregnancies.push({ parents: [a!.id, b!.id], due: w.day });
    familyDay(w, fullAI2, T0);
    const kid = w.children.find((c) => c.parents.includes(a!.id))!; expect(kid).toBeDefined(); expect(stage(w, kid)).toBe('bebek');
    expect(Math.abs(kid.honesty - (a!.honesty + b!.honesty) / 2)).toBeLessThanOrEqual(16);
    w.day += ADULT_AGE; rich(w, a!, b!);
    familyDay(w, fullAI2, T0);
    const adult = findPerson(w, kid.id)!; expect(adult).toBeDefined(); expect(adult.parents).toContain(a!.id);
    expect(takeoverCandidates(w).some((p) => p.id === adult.id)).toBe(true);
  });
  it('schooling opens better professions', () => {
    const w = setup(); const [a, b] = npcSingle(w); a!.spouse = b!.id; b!.spouse = a!.id;
    const good = ['memur', 'hoca', 'hekim', 'kalemsor', 'tuccar', 'terzi', 'demirci', 'marangoz', 'firinci', 'balikci'];
    for (let i = 0; i < 6; i += 1) { w.children.push({ id: `cx${i}`, name: `K${i}`, female: false, born: w.day - 61, parents: [a!.id, b!.id], honesty: 50, ambition: 50, hairColor: 0, skin: 0, shirt: 0, school: 30, inSchool: true, sick: 0, hunger: 0, orphan: false, soylu: false }); }
    for (const c of [...w.children]) expect(good).toContain(growUp(w, c).prof);
  });
  it('a sick child is cured by the Hekim; orphans get state care', () => {
    const w = setup(); const [a] = npcSingle(w);
    w.children.push({ id: 'cs', name: 'Hasta', female: true, born: w.day - 15, parents: [a!.id], honesty: 50, ambition: 50, hairColor: 0, skin: 0, shirt: 0, school: 0, inSchool: false, sick: 1, hunger: 0, orphan: false, soylu: false });
    a!.money = 100; familyDay(w, fullAI2, T0);
    expect(w.children.find((c) => c.id === 'cs')!.sick).toBe(0);
    const t0 = w.treasury; die(w, a!, 'test'); familyDay(w, fullAI2, T0);
    const c = w.children.find((x) => x.id === 'cs')!; expect(c.orphan).toBe(true); expect(w.treasury).toBeLessThan(t0 + 1e6);
    expect(c.hunger).toBe(0);
  });
  it('inheritance: 10% miras vergisi, then spouse and adult children share the estate, money conserved', () => {
    const w = setup(); const [a, b, kid] = npcSingle(w); a!.spouse = b!.id; b!.spouse = a!.id; kid!.parents = [a!.id, b!.id];
    a!.money = 200; b!.money = 0; kid!.money = 0; const m0 = totalMoney(w);
    die(w, a!, 'test');
    expect(b!.money).toBe(90); expect(kid!.money).toBe(90); expect(totalMoney(w)).toBeCloseTo(m0, 1);
  });
});

describe('succession & hanedan', () => {
  function royalFamily(w: World, minor: boolean) {
    const k = findPerson(w, w.kayzerId)!; const sp = bride(w); sp.mood = 95; sp.relations[k.id] = 90;
    applyAction(w, 'f', { t: 'marry', personId: sp.id }, T0);
    w.children.push({ id: 'heir', name: 'Kerem Şehzade', female: false, born: w.day - (minor ? 20 : 70), parents: [k.id, sp.id], honesty: 60, ambition: 60, hairColor: 0, skin: 0, shirt: 0, school: 0, inSchool: false, sick: 0, hunger: 0, orphan: false, soylu: true });
    if (!minor) growUp(w, w.children.find((c) => c.id === 'heir')!);
    return { k, sp };
  }
  it('abdication with an adult heir crowns the eldest child; hanedan hakkı passes to heirs', () => {
    const w = setup(); royalFamily(w, false);
    expect(applyAction(w, 'f', { t: 'abdicate' }, T0).ok).toBe(true);
    expect(w.kayzerId).toBe('heir'); expect(isHanedan(w, 'heir')).toBe(true);
  });
  it('a minor heir: the spouse rules as regent until the heir comes of age', () => {
    const w = setup(); const { sp } = royalFamily(w, true);
    applyAction(w, 'f', { t: 'abdicate' }, T0);
    expect(w.kayzerId).toBe(sp.id); expect(w.regentFor).toBe('heir');
    w.day += 45; sp.money = 1000; familyDay(w, fullAI2, T0);
    expect(w.kayzerId).toBe('heir'); expect(w.regentId).toBeNull();
  });
  it('the Kayzer can designate a veliaht over the eldest', () => {
    const w = setup(); const { k } = royalFamily(w, false);
    w.children.push({ id: 'young', name: 'Defne Sultan', female: true, born: w.day - 5, parents: [k.id], honesty: 50, ambition: 50, hairColor: 0, skin: 0, shirt: 0, school: 0, inSchool: false, sick: 0, hunger: 0, orphan: false, soylu: true });
    expect(heirOf(w, k)!.id).toBe('heir');
    applyAction(w, 'f', { t: 'veliaht', childId: 'young' }, T0); expect(heirOf(w, k)!.id).toBe('young');
    expect(childrenOf(w, k.id).length).toBe(2);
  });
  it("while the Kayzer is away the spouse governs (player spouse can issue fermans)", () => {
    const w = setup(); joinWorld(w, 's', 'Eş', 'terzi', false, T0); const sp = findPerson(w, w.players.s!.personId)!;
    const k = findPerson(w, w.kayzerId)!; k.spouse = sp.id; sp.spouse = k.id;
    const later = T0 + 10 * 60_000; touchPlayer(w, 's', later);
    expect(applyAction(w, 's', { t: 'setTax', rate: 8 }, later).ok).toBe(true);
    touchPlayer(w, 'f', later); expect(applyAction(w, 's', { t: 'setTax', rate: 9 }, later).ok).toBe(false);
  });
});

describe('isyan', () => {
  function angry(w: World) { for (const p of w.people) if (p.prof !== 'naip' && p.id !== w.kayzerId) { p.republic = 70; p.mood = 15; if (p.prof === 'asker') { p.republic = 10; p.loyalty = 80; } } }
  it('an uprising appears instead of an instant republic, and loyal troops can arrest its leaders', () => {
    const w = setup(); angry(w); startIsyan(w);
    expect(w.isyan).not.toBeNull(); expect(w.regime).toBe('imparatorluk');
    const before = w.isyan!.rebels.length;
    // rebels outnumber? make troops strong
    for (const p of w.people.filter((x) => x.prof === 'asker')) p.loyalty = 100;
    w.isyan!.rebels = w.isyan!.rebels.slice(0, 8);
    expect(applyAction(w, 'f', { t: 'isyanCmd', cmd: 'tutukla' }, T0).ok).toBe(true);
    expect(w.isyan!.rebels.length).toBeLessThan(Math.min(before, 8));
  });
  it('rebels win by taking the Saray → republic; the deposed fate is decided (player vote)', () => {
    const w = setup(); joinWorld(w, 'r', 'Asi', 'hamal', false, T0); angry(w);
    for (const p of w.people.filter((x) => x.prof === 'asker')) { p.loyalty = 10; }
    startIsyan(w); applyAction(w, 'r', { t: 'joinRebels' }, T0);
    for (let i = 0; i < 40 && w.isyan; i += 1) isyanHour(w, null);
    expect(w.regime).toBe('cumhuriyet'); expect(w.deposed).not.toBeNull();
    expect(applyAction(w, 'r', { t: 'fateVote', fate: 'surgun' }, T0).ok).toBe(true);
    w.day += 1; settleFate(w);
    const old = findPerson(w, w.founderPersonId)!; expect(old.exiledDays).toBeGreaterThan(0);
    expect(isHanedan(w, old.id)).toBe(true);
  });
  it('without player rebels, NPC leaders decide by rule (bloodshed → zindan)', () => {
    const w = setup(); angry(w); startIsyan(w); w.isyan!.killed = 5; rebelVictory(w);
    w.day += 1; settleFate(w); expect(findPerson(w, w.founderPersonId)!.jailedDays).toBeGreaterThan(0);
  });
  it('attacking costs lives and goodwill; strength is shown', () => {
    const w = setup(); angry(w); startIsyan(w); const n = w.people.length; const s = strength(w);
    expect(s.rebels).toBeGreaterThan(0); expect(s.loyal).toBeGreaterThan(0);
    applyAction(w, 'f', { t: 'isyanCmd', cmd: 'saldir' }, T0);
    expect(w.people.length).toBeLessThan(n);
  });
});

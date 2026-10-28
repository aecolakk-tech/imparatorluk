import type { Action, ActionResult, Person, Profession, World } from './types';
import { GOODS } from './types';
import { GOOD_LABEL, ONLINE_WINDOW_MS, PLAYER_PROFS, PROF_LABEL, PRODUCES, STATE_PROFS } from './constants';
import { addListing, buy, lawOn, transfer } from './economy';
import { openCase, openPetition, steal, bekciPower } from './ai';
import { answerPetition } from './state';
import { verdict, kayzerOnline } from './tick';
import { chance, clamp } from './rng';
import { findPerson, makePerson, WORKPLACE } from './world';
import { headTitle, log } from './log';
import { propose, sanction, spend, budgetLeft } from './meclis';
import { answerProposal, canRule, childrenOf, cureChild, divorce, findChild, isHanedan, proposeMarriage, requestChild, stage, succeed } from './family';
import { command, voteFate } from './isyan';
import { fullAI } from './ai';
import { eatMeal, assault, bribeAcceptChance, decideBribe, directive, drinkAlcohol, drinkWater, granaryBuy, granaryRelease, murder, payTribute, pray, relate, seeDoctor, sermon } from './life';
import { opinion } from './chat';
import { borrow, repay } from './extras';
import { enactLaw, repealLaw, validateLaw } from './laws';
import { inspectPerson } from './hoard';
import { electionPhase, hourMs } from './tick';
import { produce } from './economy';
import { actionNeed, distToBuilding, PERSON_REACH, REACH, rules } from './move';
import { placeOf } from './place';
import { addDefense, finishTrial, myPos, reportCorpse, startWalk } from './v16';
import { MAP_H, MAP_W } from './constants';

const ok = (msg: string): ActionResult => ({ ok: true, msg });
const no = (msg: string): ActionResult => ({ ok: false, msg });

export function personOf(w: World, playerId: string): Person | undefined {
  const pl = w.players[playerId]; return pl ? findPerson(w, pl.personId) : undefined;
}

/** Create the character for a new account. The founder takes over the Kayzer seat (hanedan). */
/** NPC citizens a newcomer may take over: no player characters, no naip/head of state; state roles only if the founder allows. */
export function takeoverCandidates(w: World): Person[] {
  const taken = new Set(Object.values(w.players).map((p) => p.personId));
  return w.people.filter((p) => p.playerId === null && !taken.has(p.id) && p.prof !== 'naip' && p.prof !== 'kayzer' && p.id !== w.kayzerId && p.id !== w.hanedanId
    && p.jailedDays === 0 && (w.allowStateTakeover || (!STATE_PROFS.includes(p.prof) && !p.meclis)));
}

export function joinWorld(w: World, playerId: string, name: string, prof: Profession, founder: boolean, now: number, takeOverId?: string | null): Person {
  const existing = personOf(w, playerId); if (existing) return existing;
  let p: Person;
  const target = !founder && takeOverId ? takeoverCandidates(w).find((x) => x.id === takeOverId) : undefined;
  if (!founder && takeOverId && !target) throw new Error('Bu vatandaş seçilemez.');
  if (target) {
    p = target;
  } else if (founder) {
    p = findPerson(w, w.hanedanId) ?? makePerson(w, { name, prof: 'kayzer' }, 'saray');
    p.name = `Kayzer ${clean(name)}`; w.founderPersonId = p.id;
  } else {
    const safeProf = PLAYER_PROFS.includes(prof) ? prof : 'hamal';
    const houses = w.buildings.filter((b) => b.kind === 'ev');
    const counts = new Map<string, number>(); for (const x of w.people) counts.set(x.home, (counts.get(x.home) ?? 0) + 1);
    const home = [...houses].sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0))[0]?.id ?? 'ev1';
    p = makePerson(w, { name: clean(name), prof: safeProf, money: 40, honesty: 60, ambition: 50, loyalty: 60 }, home);
    w.people.push(p);
  }
  p.playerId = playerId; p.npc = false; p.protectedUntil = w.day + 5;
  w.players[playerId] = { playerId, personId: p.id, name: p.name, founder, banned: false, lastSeen: now, lastSeenDay: w.day, awayLog: [], awayMoney: p.money };
  log(w, `${p.name} şehre geldi.`, p.id);
  return p;
}

export function clean(s: string): string { return s.replace(/[<>]/g, '').trim().slice(0, 24) || 'Yolcu'; }

/** Heartbeat: marks presence; returns a 'siz yokken' summary when the player comes back. */
export function touchPlayer(w: World, playerId: string, now: number): string | null {
  const pl = w.players[playerId]; if (!pl || pl.banned) return null;
  const p = findPerson(w, pl.personId);
  const wasAway = now - pl.lastSeen > ONLINE_WINDOW_MS;
  let summary: string | null = null;
  if (wasAway && p) {
    const days = w.day - pl.lastSeenDay;
    const dm = Math.round(p.money - pl.awayMoney);
    const lines = [`Hoş geldiniz${pl.founder ? ' efendim' : ''}. Siz yokken ${days} gün geçti. Keseniz ${dm >= 0 ? '+' : ''}${dm} Dinar değişti (${Math.round(p.money)}).`];
    if (p.id === w.kayzerId) lines.push(`Hazine ${Math.round(w.treasury)} Dinar, cumhuriyet isteği ${w.cumhuriyet}. Bekleyen dilekçe: ${w.petitions.filter((x) => x.status === 'bekliyor').length}.`);
    if (pl.founder && p.id !== w.kayzerId) lines.push(w.regime === 'cumhuriyet' ? `Efendim, cumhuriyet ilan edildi; devleti Başkan ${findPerson(w, w.kayzerId)?.name ?? '(seçim bekleniyor)'} yönetiyor. Hanedan hakkıyla “Tahtı geri al” diyebilirsiniz.` : 'Taht elinizden gitmiş efendim. Hanedan hakkıyla “Tahtı geri al” diyebilirsiniz.');
    summary = [...lines, ...pl.awayLog.slice(-15)].join('\n');
    pl.awayLog = [];
    if (p.npc) { p.npc = false; }
  }
  pl.lastSeen = now;
  if (p) { pl.lastSeenDay = w.day; pl.awayMoney = p.money; }
  return summary;
}



export function applyAction(w: World, playerId: string, a: Action, now: number): ActionResult {
  const pl = w.players[playerId]; if (!pl || pl.banned) return no('Hesap bulunamadı.');
  const me = findPerson(w, pl.personId); if (!me) return no('Karakter bulunamadı.');
  const isKayzer = (ww: World, p: Person): boolean => canRule(ww, p, now, ONLINE_WINDOW_MS);
  const jailedOk: Action['t'][] = ['petition', 'eat', 'divorce', 'answerProposal', 'defense', 'restCase'];
  if (me.jailedDays > 0 && !jailedOk.includes(a.t)) return no('Zindandasınız; şimdilik sadece dilekçe yazabilirsiniz.');
  const exileOk: Action['t'][] = [...jailedOk, 'restore', 'buy', 'sell', 'marry', 'haveChild', 'school', 'cure'];
  if (me.exiledDays > 0 && !exileOk.includes(a.t)) return no(`Sürgündesiniz (${me.exiledDays} gün kaldı).`);
  const need = rules.reach ? actionNeed(w, me, a) : null;
  if (need) {
    const pos = myPos(w, me, now);
    if (need.kind === 'building' && need.ids.length && !need.ids.some((id) => { const b = w.buildings.find((x) => x.id === id); return b && distToBuilding(b, pos) <= REACH + 0.6; })) return no(`Bunun için önce ${need.label} yürümelisiniz.`);
    if (need.kind === 'person') {
      const tp = need.id.startsWith('corpse:') ? w.corpses?.find((c) => `corpse:${c.id}` === need.id) : placeOf(w, need.id, now);
      if (tp && Math.hypot(tp.x - pos.x, tp.y - pos.y) > PERSON_REACH + 0.8) return no('Önce yanına yürümelisiniz (çok uzaktasınız).');
    }
  }
  const decides = (p: Person): boolean => !fullAI(p);
  const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
  switch (a.t) {
    case 'buy': {
      const q = num(a.qty, 1, 20); if (q === null || !GOODS.includes(a.good)) return no('Geçersiz miktar.');
      const got = buy(w, me.id, a.good, Math.floor(q)); if (got) { me.bought = me.bought ?? {}; me.bought[a.good] = (me.bought[a.good] ?? 0) + got; } return got ? ok(`${got} ${GOOD_LABEL[a.good]} aldınız.`) : no('Pazarda yok ya da paranız yetmiyor.');
    }
    case 'sell': {
      const q = num(a.qty, 1, 500); const pr = num(a.price, 0.1, 1000);
      if (q === null || pr === null || !GOODS.includes(a.good) || me.inv[a.good] < q) return no('Elinizde o kadar mal yok.');
      if (me.inv[a.good] - (me.bought?.[a.good] ?? 0) < q) return no('Bugün aldığınız malı aynı gün yeniden satamazsınız (karaborsa önlemi).');
      me.inv[a.good] -= Math.floor(q); addListing(w, me, a.good, Math.floor(q), pr, 'pazar'); return ok('Tezgâha koydunuz.');
    }
    case 'eat': {
      if (me.meals >= 3) return no('Bugünkü 3 öğününüzü yediniz; toksunuz.');
      return eatMeal(w, me) ? ok(`Yemek yediniz (bugün ${me.meals}/3).`) : no('Yiyecek alacak paranız yok ya da pazarda yemek kalmadı.');
    }
    case 'askida': {
      const q = num(a.qty, 1, 20); if (q === null) return no('Geçersiz.');
      const got = buy(w, me.id, 'ekmek', Math.floor(q)); me.inv.ekmek -= got;
      const poor = [...w.people].sort((x, y) => x.money - y.money).slice(0, got);
      for (const p of poor) { p.inv.ekmek += 1; p.relations[me.id] = clamp((p.relations[me.id] ?? 0) + 15, -100, 100); }
      me.mood = clamp(me.mood + 3); log(w, `${me.name} fırına ${got} askıda ekmek bıraktı.`, me.id);
      return ok(`${got} ekmek askıya kondu.`);
    }
    case 'petition': {
      const text = filterProfanity(String(a.text ?? '')).slice(0, 200);
      if (text.length < 4) return no('Dilekçe çok kısa.');
      const pet = openPetition(w, me, a.kind, text, Math.min(num(a.amount, 0, 500) ?? 0, 500), a.payload);
      return pet ? ok('Dilekçeniz saraya ulaştı.') : no('Zaten bekleyen bir dilekçeniz var.');
    }
    case 'answer': {
      if (!isKayzer(w, me)) return no(`Sadece ${headTitle(w)} cevaplayabilir.`);
      const pet = w.petitions.find((x) => x.id === a.petitionId); if (!pet) return no('Dilekçe yok.');
      return answerPetition(w, pet, a.accept, 'kayzer', now) ? ok('Ferman yazıldı.') : no('Bu dilekçe uygulanamadı (hazine yetmiyor olabilir).');
    }
    case 'setTax': { if (!isKayzer(w, me)) return no('Yetkiniz yok.'); const r = num(a.rate, 0, 40); if (r === null) return no('0–40 arası.'); w.taxRate = Math.round(r); log(w, `Ferman: satış vergisi %${w.taxRate}.`); return ok('Vergi değişti.'); }
    case 'setHeadTax': { if (!isKayzer(w, me)) return no('Yetkiniz yok.'); const r = num(a.amount, 0, 10); if (r === null) return no('0–10 arası.'); w.headTax = r; log(w, `Ferman: baş vergisi ${r} Dinar.`); return ok('Baş vergisi değişti.'); }
    case 'setSalary': { if (!isKayzer(w, me)) return no('Yetkiniz yok.'); const r = num(a.amount, 0, 60); if (r === null || !STATE_PROFS.includes(a.prof)) return no('Geçersiz.'); w.salaries[a.prof] = r; log(w, `Ferman: ${PROF_LABEL[a.prof]} maaşı ${r} Dinar.`); return ok('Maaş değişti.'); }
    case 'toggleLaw': {
      if (!isKayzer(w, me)) return no(`Kanunları sadece ${headTitle(w)} değiştirir.`);
      const law = w.laws.find((l) => l.id === a.lawId); if (!law) return no('Kanun yok.');
      if (w.regime === 'cumhuriyet' && a.active !== law.active) {
        const m = meclisVote(w);
        if (!m.pass) { log(w, `Meclis, ${law.name} teklifini reddetti (${m.yes}/${m.total}).`); return no(`Meclis reddetti (${m.yes}/${m.total} evet).`); }
        log(w, `Meclis, ${law.name} teklifini kabul etti (${m.yes}/${m.total}).`);
      }
      law.active = a.active; if (a.param !== undefined && law.param !== undefined) { const v = num(a.param, 0, 100); if (v !== null) law.param = v; }
      log(w, `Ferman: ${law.name} ${law.active ? 'yürürlükte' : 'kaldırıldı'}.`); return ok('Kanun güncellendi.');
    }
    case 'startProject': {
      if (!isKayzer(w, me)) return no('Yetkiniz yok.'); const c = num(a.cost, 100, 20000); if (c === null) return no('Maliyet 100–20000.');
      if (w.projects.some((p) => !p.done)) return no('Önce süren inşaat bitmeli.');
      w.projects.push({ id: `pr${++w.idSeq}`, name: a.name.slice(0, 40) || 'Yeni inşaat', site: 'santiye', cost: c, paid: 0, progress: 0, needed: Math.round(c / 10), done: false });
      log(w, `Ferman: ${a.name} inşaatı başlıyor.`); return ok('İnşaat başladı; ödenek ayırın.');
    }
    case 'fundProject': {
      const pr = w.projects.find((p) => p.id === a.projectId && !p.done); const amt = num(a.amount, 1, 50000); if (!pr || amt === null) return no('Geçersiz.');
      const from = isKayzer(w, me) ? 'saray' : me.id;
      if (from === 'saray' && !spend(w, amt)) return no(`Meclis bütçesi yetmiyor (kalan ${Math.round(budgetLeft(w))} Dinar).`);
      return transfer(w, from, `proje:${pr.id}`, amt, 'proje ödeneği') ? ok(`${amt} Dinar ödenek ayrıldı.`) : no('Para yetmiyor.');
    }
    case 'appoint': {
      if (!isKayzer(w, me)) return no('Yetkiniz yok.'); const t = findPerson(w, a.personId);
      if (!t || t.prof === 'naip' || t.id === me.id || !PROF_LABEL[a.prof] || a.prof === 'kayzer' || a.prof === 'naip') return no('Geçersiz atama.');
      t.prof = a.prof; t.work = WORKPLACE[a.prof]; t.loyalty = clamp(t.loyalty + 10); log(w, `Ferman: ${t.name} ${PROF_LABEL[a.prof]} oldu.`, t.id); return ok('Atandı.');
    }
    case 'pardon': {
      if (!isKayzer(w, me)) return no(`Sadece ${headTitle(w)} affeder.`); const c = w.cases.find((x) => x.id === a.caseId); if (!c) return no('Dava yok.');
      const acc = findPerson(w, c.accusedId); c.stage = 'kapandi'; c.verdict = 'af'; if (acc) { acc.jailedDays = 0; acc.loyalty = clamp(acc.loyalty + 20); }
      const v = findPerson(w, c.victimId); if (v) v.loyalty = clamp(v.loyalty - 10);
      log(w, `${headTitle(w)} ${acc?.name ?? ''} için af çıkardı.`); return ok('Affedildi.');
    }
    case 'caseDecision': {
      const c = w.cases.find((x) => x.id === a.caseId && x.stage !== 'kapandi'); if (!c) return no('Dava yok.');
      if (c.stage === 'savci') {
        if (me.prof !== 'savci') return no('Bu dava savcıda.');
        const acc = findPerson(w, c.accusedId);
        if (a.decision === 'kovustur') { c.stage = 'hakim'; c.deadline = w.day + 1; return ok('Dava hâkime gönderildi.'); }
        if (a.decision === 'dusur') { c.stage = 'kapandi'; c.verdict = 'dusuruldu'; if (acc) acc.jailedDays = 0; return ok('Dava düşürüldü.'); }
      } else if (c.stage === 'hakim') {
        if (me.prof !== 'hakim') return no('Bu dava hâkimde.');
        if (a.decision === 'suclu' || a.decision === 'beraat') { verdict(w, c.id, a.decision === 'suclu', now); return ok('Karar verildi.'); }
      }
      return no('Geçersiz karar.');
    }
    case 'arrest': {
      if (me.prof !== 'bekci') return no('Sadece bekçiler tutuklar.'); const t = findPerson(w, a.personId); if (!t || t.id === w.kayzerId || t.prof === 'naip') return no('Geçersiz.');
      const recent = w.ledger.some((l) => l.from !== t.id && l.to === t.id && (l.reason === 'hırsızlık' || l.reason === 'rüşvet' || l.reason === 'zimmet') && w.day - l.day <= 3);
      openCase(w, t.id, 'hirsizlik', null, 0, recent ? 70 : 15); log(w, `${me.name}, ${t.name}'ı tutukladı.`, t.id); return ok(recent ? 'Tutuklandı, deliller güçlü.' : 'Tutuklandı ama delil zayıf.');
    }
    case 'steal': {
      const t = findPerson(w, a.personId); if (!t || t.id === me.id || t.prof === 'naip' || t.id === w.kayzerId) return no('Geçersiz.');
      me.honesty = clamp(me.honesty - 10); const got = steal(w, me, t); return got ? ok(`${got} Dinar çaldınız…`) : no('Kesesi boş çıktı.');
    }
    case 'bribe': {
      const t = findPerson(w, a.personId); const amt = num(a.amount, 1, 10000); if (!t || amt === null || t.id === me.id) return no('Geçersiz.');
      if (isKayzer(w, me) || me.soylu) return no('Hükümdarın rüşvete ihtiyacı yoktur; ferman yazın.');
      if (!STATE_PROFS.includes(t.prof) && !t.meclis) return no('Rüşvet sadece memur, asker, bekçi, kadı ya da Meclis üyesine, bir şey karşılığında verilir.');
      if (!transfer(w, me.id, t.id, amt, 'rüşvet')) return no('Paranız yetmiyor.');
      if (t.meclis) w.meclis.bribes.push({ from: me.id, to: t.id, amount: amt, day: w.day, exposed: false });
      t.loyalty = clamp(t.loyalty - amt / 5); t.relations[me.id] = clamp((t.relations[me.id] ?? 0) + amt / 2, -100, 100);
      if (t.prof === 'asker' && amt >= 40 && chance(w, (100 - t.loyalty) / 100 + 0.1)) t.sidedWith = me.id;
      if (lawOn(w, 'rusvet') && chance(w, bekciPower(w) * 0.35)) { openCase(w, me.id, 'rusvet', null, amt, 60); log(w, `${me.name}, ${t.name}'a rüşvet verirken yakalandı!`, me.id); return ok('Rüşveti verdiniz… ama bekçi gördü!'); }
      return ok(t.sidedWith === me.id ? `${t.name} artık sizin yanınızda.` : 'Rüşveti aldı; ne düşündüğü belli değil.');
    }
    case 'give': {
      const t = findPerson(w, a.personId); const amt = num(a.amount, 1, 100000); if (!t || amt === null) return no('Geçersiz.');
      const from = isKayzer(w, me) && a.personId !== me.id ? 'saray' : me.id;
      if (from === 'saray' && !spend(w, amt)) return no(`Meclis bütçesi yetmiyor (kalan ${Math.round(budgetLeft(w))} Dinar).`);
      if (!transfer(w, from, t.id, amt, from === 'saray' ? 'saray bağışı' : 'bağış')) return no('Para yetmiyor.');
      t.loyalty = clamp(t.loyalty + Math.min(15, amt / 4)); t.mood = clamp(t.mood + 5); t.relations[me.id] = clamp((t.relations[me.id] ?? 0) + 10, -100, 100); return ok(`${t.name}'a ${amt} Dinar verildi.`);
    }
    case 'propose': {
      const law = a.law ? { ...a.law, name: a.law.name ? filterProfanity(String(a.law.name)).slice(0, 50) : undefined } : undefined;
      const r = propose(w, me, a.kind, num(a.value, 0, 50000) ?? 0, String(a.target ?? ''), a.title ? filterProfanity(a.title) : undefined, law);
      return typeof r === 'string' ? no(r) : ok('Teklifiniz Meclis gündeminde. 1 gün görüşme, 1 gün oylama.');
    }
    case 'enactLaw': {
      if (!isKayzer(w, me)) return no('Kanunu sadece hükümdar ferman ile çıkarır; siz Meclis’e teklif verin.');
      if (w.regime === 'cumhuriyet' && ['yasak', 'sokak', 'hizmet', 'sertCeza'].includes(a.law?.kind)) return no('Cumhuriyette yasak, sokağa çıkma, zorunlu hizmet ve ağır ceza kanunlarını sadece Meclis çıkarır.');
      const law = { ...a.law, name: a.law?.name ? filterProfanity(String(a.law.name)).slice(0, 50) : undefined };
      const err = validateLaw(law); if (err) return no(err);
      return ok(enactLaw(w, law, me, 'ferman'));
    }
    case 'repealLaw': { if (!isKayzer(w, me)) return no('Kanunu hükümdar kaldırır.'); const r = repealLaw(w, a.lawId); return { ok: r.endsWith('kaldırıldı.'), msg: r }; }
    case 'inspect': {
      if (me.prof !== 'bekci' && me.prof !== 'asker') return no('Arama yapmayı bekçi ya da asker yapar.');
      const t = findPerson(w, a.personId); if (!t || t.id === me.id) return no('Kişi yok.');
      return ok(inspectPerson(w, me, t));
    }
    case 'castVote': {
      const b = w.meclis.bills.find((x) => x.id === a.billId);
      if (!me.meclis) return no('Sadece Meclis üyeleri oy verir.');
      if (!b || (b.status !== 'oylama' && b.status !== 'tartisma')) return no('Bu teklif oylamada değil.');
      if (!['evet', 'hayir', 'cekimser'].includes(a.choice)) return no('Geçersiz oy.');
      b.votes[me.id] = a.choice; return ok(`Oyunuz kaydedildi: ${a.choice}.`);
    }
    case 'speak': {
      const b = w.meclis.bills.find((x) => x.id === a.billId); if (!me.meclis || !b) return no('Sadece Meclis üyeleri konuşur.');
      const text = filterProfanity(String(a.text ?? '')).slice(0, 200); if (text.length < 3) return no('Konuşma çok kısa.');
      if (b.speeches.filter((s) => s.personId === me.id).length >= 3) return no('Bu teklif için söz hakkınız bitti.');
      b.speeches.push({ personId: me.id, text, day: w.day }); return ok('Kürsüden konuştunuz.');
    }
    case 'sanction': {
      if (!isKayzer(w, me) || w.regime !== 'imparatorluk') return no('Sadece Kayzer onaylar ya da veto eder.');
      const b = w.meclis.bills.find((x) => x.id === a.billId); if (!b) return no('Karar yok.');
      const r = sanction(w, b, a.approve); return { ok: r.startsWith('Onay') || r.startsWith('Veto'), msg: r };
    }
    case 'joinFaction': {
      if (!w.meclis.factions.some((f) => f.id === a.factionId)) return no('Böyle bir parti yok.');
      me.faction = a.factionId; return ok(`${w.meclis.factions.find((f) => f.id === a.factionId)!.name} üyesisiniz.`);
    }
    case 'runForBaskan': {
      if (w.regime !== 'cumhuriyet') return no('Başkanlık seçimi sadece cumhuriyette yapılır.');
      if (!w.election.baskanCandidates.includes(me.id)) w.election.baskanCandidates.push(me.id);
      return ok(`Başkan adayısınız. Seçim ${w.election.baskanNextDay}. gün.`);
    }
    case 'voteBaskan': { if (w.regime !== 'cumhuriyet' || !findPerson(w, a.candidateId)) return no('Geçersiz.'); w.election.baskanVotes[me.id] = a.candidateId; return ok('Oyunuz sandıkta.'); }
    case 'runForMeclis': { if (me.id === w.kayzerId && w.regime === 'imparatorluk') return no('Kayzer aday olamaz.'); if (me.prof === 'asker' || me.prof === 'bekci') return no('Askerler ve bekçiler Meclis’e aday olamaz.'); if (electionPhase(w).phase !== 'aday') return no(`Adaylık dönemi değil. ${electionPhase(w).label}.`); if (!w.election.candidates.includes(me.id)) w.election.candidates.push(me.id); return ok(`Adaysınız. Seçim ${w.election.nextDay}. gün.`); }
    case 'vote': { if (!w.election.candidates.includes(a.candidateId)) return no('Bu kişi aday değil.'); if (electionPhase(w).phase === 'bekleme' || electionPhase(w).phase === 'aday') return no(`Oy verme zamanı değil. ${electionPhase(w).label}.`); w.election.votes[me.id] = a.candidateId; return ok('Oyunuz sandıkta.'); }
    case 'plot': {
      if (me.id === w.kayzerId) return no(`Zaten ${headTitle(w)}siniz.`);
      if (a.kind === 'none') { me.plotting = 'none'; return ok('Komplodan vazgeçtiniz.'); }
      if (w.coup && w.coup.leaderId !== me.id) return no('Başka bir komplo sürüyor.');
      me.plotting = a.kind; w.coup = w.coup ?? { leaderId: me.id, kind: a.kind, day: w.day, fund: 0 }; w.coup.kind = a.kind;
      return ok(a.kind === 'coup' ? 'Darbe hazırlığı başladı. Kurallar: en az 6 asker (Saray Koruması varsa 8), 1500 Dinar fon, halk desteği (memnuniyet < 40 ya da cumhuriyet ≥ 50).' : 'Devrim hazırlığı başladı. Kurallar: cumhuriyet ≥ 70, en az 4 asker, 800 Dinar fon.');
    }
    case 'fundPlot': {
      if (!w.coup || w.coup.leaderId !== me.id) return no('Önce komplo başlatın.'); const amt = num(a.amount, 1, 100000); if (amt === null) return no('Geçersiz.');
      return transfer(w, me.id, 'fon', amt, 'komplo fonu') ? ok(`Fon: ${w.coup.fund} Dinar`) : no('Para yetmiyor.');
    }
    case 'seize': return seize(w, me, now);
    case 'restore': return restore(w, me, pl.founder || isHanedan(w, me.id));
    case 'marry': { const t = findPerson(w, a.personId); if (!t) return no('Kişi yok.'); const r = proposeMarriage(w, me, t, decides); return { ok: !/olamaz|evli|bekleyen|reddetti|Akraba/i.test(r) || r.includes('evet'), msg: r }; }
    case 'answerProposal': { const r = answerProposal(w, me, a.proposalId, a.accept); return ok(r); }
    case 'divorce': { const r = divorce(w, me); return me.spouse ? no(r) : ok(r); }
    case 'haveChild': { const r = requestChild(w, me, decides); return { ok: r.startsWith('Müjde') || r.startsWith('Eşinize'), msg: r }; }
    case 'school': {
      const c = findChild(w, a.childId); if (!c || !c.parents.includes(me.id)) return no('Bu sizin çocuğunuz değil.');
      const st = stage(w, c); if (a.on && st !== 'cocuk' && st !== 'genc') return no('Okul çocuk ve gençler içindir.');
      c.inSchool = a.on; return ok(a.on ? `${c.name} okula başladı (günde 1 Dinar).` : `${c.name} okuldan alındı.`);
    }
    case 'cure': { const c = findChild(w, a.childId); if (!c || !c.parents.includes(me.id)) return no('Bu sizin çocuğunuz değil.'); const r = cureChild(w, c, me); return { ok: r.endsWith('iyileşti.'), msg: r }; }
    case 'veliaht': {
      if (w.kayzerId !== me.id || w.regime !== 'imparatorluk') return no('Veliahdı sadece Kayzer belirler.');
      if (a.childId && !childrenOf(w, me.id).some((k) => k.id === a.childId)) return no('Veliaht sizin çocuğunuz olmalı.');
      w.veliaht = a.childId; log(w, a.childId ? `Ferman: veliaht ${findPerson(w, a.childId)?.name ?? findChild(w, a.childId)?.name}.` : 'Ferman: veliaht kaldırıldı; en büyük çocuk varis.'); return ok('Veliaht belirlendi.');
    }
    case 'abdicate': {
      if (w.kayzerId !== me.id || w.regime !== 'imparatorluk') return no('Sadece Kayzer feragat edebilir.');
      const r = succeed(w, me); if (!r) return no('Tahtı devredecek eşiniz ya da çocuğunuz yok.');
      log(w, r, w.kayzerId ?? undefined); return ok(r);
    }
    case 'isyanCmd': {
      if (!w.isyan) return no('Ortada isyan yok.');
      const head = isKayzer(w, me); const commander = me.prof === 'asker' && !w.people.some((p) => p.playerId && canRule(w, p, now, ONLINE_WINDOW_MS) && now - (w.players[p.playerId]?.lastSeen ?? 0) < ONLINE_WINDOW_MS);
      if (!head && !commander) return no('Askerlere sadece hükümdar (ya da o yokken bir komutan) emir verir.');
      if (!['dagit', 'tutukla', 'saldir'].includes(a.cmd)) return no('Geçersiz emir.');
      return ok(command(w, a.cmd, me.name));
    }
    case 'joinRebels': {
      if (!w.isyan) return no('Ortada isyan yok.'); if (me.id === w.kayzerId || me.soylu) return no('Siz sarayın tarafındasınız.');
      if (!w.isyan.rebels.includes(me.id)) w.isyan.rebels.push(me.id); me.republic = clamp(me.republic + 20); return ok('Asilere katıldınız!');
    }
    case 'setSpeed': {
      if (w.kayzerId !== me.id) return no('Oyun hızını sadece hükümdar değiştirir.');
      if (![0.5, 1, 2].includes(a.speed)) return no('0.5x, 1x ya da 2x.');
      const f = Math.min(0.999, Math.max(0, (now - w.lastTickAt) / hourMs(w)));
      w.speed = a.speed; w.lastTickAt = now - f * hourMs(w); // keep the clock continuous
      log(w, `Ferman: zaman ${a.speed}x hızla akıyor.`); return ok(`Hız ${a.speed}x.`);
    }
    case 'drinkWater': if (me.drinks >= 5) return no('Bugünkü 5 suyunuzu içtiniz.'); return drinkWater(w, me) ? ok(`Su içtiniz (bugün ${me.drinks}/5).`) : no('Su alacak paranız yok ya da kuyuda su kalmadı.');
    case 'pray': return ok(pray(w, me));
    case 'drink': { const r = drinkAlcohol(w, me); return { ok: r.startsWith('Meyhanede bir'), msg: r }; }
    case 'doctor': { const r = seeDoctor(w, me, false); return { ok: r.includes('iyileştirdi'), msg: r }; }
    case 'work': {
      if (me.lastAction.startsWith('fazla mesai')) return no('Bugün zaten fazla mesai yaptınız.');
      const spec = PRODUCES[me.prof];
      if (spec) { produce(w, me); me.health = clamp(me.health - 4); me.lastAction = `fazla mesai · ${me.lastAction}`; return ok(`Fazla mesai yaptınız: ${me.lastAction}`); }
      const pay = 4; if (transfer(w, 'saray', me.id, pay, 'yevmiye')) { me.incomeToday += pay; me.lastAction = 'fazla mesai'; me.health = clamp(me.health - 3); return ok('Yevmiyeli iş yaptınız (+4 Dinar).'); }
      return no('İş yok.');
    }
    case 'nightOut': { me.nightOut = a.on; return ok(a.on ? 'Gece dışarıdasınız; dikkat, gece suç çok.' : 'Eve girdiniz.'); }
    case 'chatWith': { const t = findPerson(w, a.personId); if (!t) return no('Kişi yok.'); void opinion; return ok(`${t.name} ile konuşmak için ✉️ Mesaj yazın.`); }
    case 'move': {
      const x = num(a.x, -1, MAP_W + 1), y = num(a.y, -1, MAP_H + 1); if (x === null || y === null) return no('Geçersiz yer.');
      if (me.jailedDays > 0) return no('Zindandasınız.');
      startWalk(w, me, { x, y }, now); return { ok: true, msg: '' };
    }
    case 'report': { const co = w.corpses?.find((c) => c.id === a.corpseId); if (!co) return no('Ceset kaldırılmış.'); if (co.killerId === me.id) { me.honesty = clamp(me.honesty + 2); } return ok(reportCorpse(w, co, me, now)); }
    case 'defense': { const c = w.cases.find((x) => x.id === a.caseId); if (!c) return no('Dava yok.'); const text = filterProfanity(String(a.text ?? '')).slice(0, 300); if (text.length < 2) return no('Bir şey yazın.'); const e = addDefense(w, c, me, text, now); return e ? no(e) : ok(''); }
    case 'restCase': { const c = w.cases.find((x) => x.id === a.caseId && x.accusedId === me.id && x.trial && !x.trial.done); if (!c) return no('Görülen davanız yok.'); finishTrial(w, c, now); return ok(c.trial!.verdictText ?? 'Karar verildi.'); }
    case 'insult': { const t = findPerson(w, a.personId); if (!t) return no('Kişi yok.'); relate(t, me, -25, 'bana hakaret etti'); me.rep = clamp(me.rep - 2, -100, 100); return ok(`${t.name} size küstü.`); }
    case 'assault': { const t = findPerson(w, a.personId); if (!t || t.id === me.id || t.prof === 'naip') return no('Geçersiz.'); me.honesty = clamp(me.honesty - 15); return ok(assault(w, me, t)); }
    case 'kill': { const t = findPerson(w, a.personId); if (!t || t.id === me.id || t.prof === 'naip' || t.id === w.kayzerId) return no('Geçersiz.'); me.honesty = clamp(me.honesty - 40); return ok(murder(w, me, t)); }
    case 'offerBribe': {
      const ar = w.arrests.find((x) => x.id === a.arrestId && x.criminalId === me.id && x.status === 'bekliyor'); const amt = num(a.amount, 1, 1000);
      if (!ar || amt === null) return no('Bekleyen bir tutuklamanız yok.'); if (me.money < amt) return no('Paranız yetmiyor.');
      ar.offer = amt; const ca = findPerson(w, ar.catcherId);
      if (ca && fullAI(ca)) { const r = decideBribe(w, ar, chance(w, bribeAcceptChance(ca, amt))); return { ok: r.includes('saldı'), msg: r }; }
      return ok(`${ca?.name ?? 'Bekçi'} teklifinizi düşünüyor…`);
    }
    case 'answerBribe': { const ar = w.arrests.find((x) => x.id === a.arrestId && x.catcherId === me.id && x.status === 'bekliyor'); if (!ar) return no('Teklif yok.'); return ok(decideBribe(w, ar, a.accept)); }
    case 'answerOffer': {
      const o = w.offers.find((x) => x.id === a.offerId && x.to === me.id); if (!o) return no('Teklif yok.'); w.offers = w.offers.filter((x) => x !== o);
      const f = findPerson(w, o.from); if (!f) return no('Kişi gitmiş.');
      if (!a.accept) { relate(f, me, -2, 'teklifimi geri çevirdi'); return ok('Geri çevirdiniz.'); }
      if (o.kind === 'borc' && transfer(w, me.id, f.id, o.amount ?? 10, 'iyilik')) { relate(f, me, 15, 'zor günümde yardım etti'); me.rep = clamp(me.rep + 2, -100, 100); return ok(`${f.name} çok minnettar.`); }
      if (o.kind === 'mal' && o.good && o.price) { const q = o.qty ?? 1; const g = o.good; const have = f.inv[g] + w.listings.filter((l) => l.sellerId === f.id && l.good === g).reduce((s2, l) => s2 + l.qty, 0); if (have < q) return no('Malı kalmamış.'); if (!transfer(w, me.id, f.id, o.price * q, `${g} alımı`)) return no('Paranız yetmiyor.'); let need = q; const take = Math.min(f.inv[g], need); f.inv[g] -= take; need -= take; for (const l of w.listings.filter((l2) => l2.sellerId === f.id && l2.good === g)) { const t2 = Math.min(l.qty, need); l.qty -= t2; need -= t2; } me.inv[g] += q; f.taxDue += o.price * q * w.taxRate / 100; relate(f, me, 4, 'alışveriş yaptık'); return ok('Pazarlık tamam.'); }
      if (o.kind === 'rusvet' && transfer(w, f.id, me.id, o.amount ?? 15, 'rüşvet')) { relate(f, me, 10, 'göz yumdu'); if (chance(w, 0.25)) { openCase(w, me.id, 'rusvet', null, o.amount ?? 15, 55); return ok('Rüşveti aldınız… ama biri gördü!'); } return ok('Rüşveti aldınız.'); }
      return no('Olmadı.');
    }
    case 'poster': {
      if (electionPhase(w).phase !== 'propaganda' && electionPhase(w).phase !== 'aday') return no('Afiş sadece adaylık ve propaganda döneminde asılır.');
      if (!w.election.candidates.includes(me.id)) return no('Önce aday olun.');
      if (!transfer(w, me.id, 'saray', 5, 'afiş harcı')) return no('Afiş 5 Dinar.');
      w.election.posters = w.election.posters ?? {}; w.election.posters[me.id] = (w.election.posters[me.id] ?? 0) + 1; return ok('Afişleriniz asıldı.');
    }
    case 'campaign': {
      if (!w.election.candidates.includes(me.id)) return no('Önce aday olun.');
      const text = filterProfanity(String(a.text ?? '')).slice(0, 160); if (text.length < 4) return no('Konuşma kısa.');
      for (const p of w.people) if (chance(w, 0.25)) relate(p, me, Math.abs(p.republic - me.republic) < 25 ? 3 : -1, 'seçim konuşmasını dinledim');
      w.chatOut.push({ fromPersonId: me.id, fromName: me.name, toPersonId: null, text: `📣 ${text}`, at: now }); return ok('Meydanda konuştunuz.');
    }
    case 'sermon': { if (me.prof !== 'imam' && me.prof !== 'hoca') return no('Vaazı imam ya da hoca verir.'); if (me.lastAction === 'vaaz') return no('Bugün vaaz verdiniz.'); me.lastAction = 'vaaz'; return ok(sermon(w, me, a.topic)); }
    case 'directive': { if (!isKayzer(w, me)) return no('Yönlendirmeyi devlet yapar.'); return ok(directive(w, a.topic)); }
    case 'granary': {
      if (!isKayzer(w, me)) return no('Ambarı devlet yönetir.'); const q = num(a.qty, 1, 500); if (q === null) return no('Geçersiz.');
      return a.op === 'buy' ? ok(`Ambara ${granaryBuy(w, q)} buğday alındı (sadece ucuz buğday).`) : ok(`Ambardan ${granaryRelease(w, q)} buğday sabit fiyatla satışa çıktı.`);
    }
    case 'priceCap': {
      if (!isKayzer(w, me)) return no('Narhı devlet koyar.'); if (!GOODS.includes(a.good)) return no('Mal yok.');
      if (a.price === null) { delete w.priceCaps[a.good]; return ok('Narh kaldırıldı.'); }
      const v = num(a.price, 0.1, 500); if (v === null) return no('Geçersiz.'); w.priceCaps[a.good] = v;
      for (const l of w.listings) if (l.good === a.good && l.price > v) l.price = v;
      log(w, `Ferman: ${GOOD_LABEL[a.good]} için narh (tavan fiyat) ${v} Dinar.`); return ok('Narh kondu. Çok düşük narh kıtlık yaratır!');
    }
    case 'defend': {
      const c = w.cases.find((x) => x.id === a.caseId && x.stage !== 'kapandi'); if (!c || c.accusedId === me.id) return no('Dava yok.');
      c.defenders = c.defenders ?? []; if (c.defenders.includes(me.id)) return no('Zaten avukatsınız.');
      c.defenders.push(me.id); c.evidence = Math.max(0, c.evidence - 12 - me.school / 3); const acc = findPerson(w, c.accusedId);
      if (acc && transfer(w, acc.id, me.id, Math.min(acc.money, 8), 'avukatlık ücreti')) me.incomeToday += 8;
      if (acc) relate(acc, me, 15, 'beni mahkemede savundu'); return ok('Savunmayı üstlendiniz; delil zayıfladı.');
    }
    case 'witness': {
      const c = w.cases.find((x) => x.id === a.caseId && x.stage !== 'kapandi'); if (!c || c.accusedId === me.id) return no('Dava yok.');
      c.witnesses = c.witnesses ?? []; if (c.witnesses.some((x) => x.id === me.id)) return no('Zaten tanıksınız.');
      c.witnesses.push({ id: me.id, against: a.against }); c.evidence = clamp(c.evidence + (a.against ? 15 : -10)); const acc = findPerson(w, c.accusedId);
      if (acc) relate(acc, me, a.against ? -30 : 12, a.against ? 'aleyhime tanıklık etti' : 'lehime tanıklık etti'); return ok('Tanıklığınız tutanağa geçti.');
    }
    case 'smuggle': { me.smuggle = a.on; return ok(a.on ? 'Satışlarınızı vergiden saklıyorsunuz (kaçakçılık suçtur!).' : 'Dürüst ticarete döndünüz.'); }
    case 'tribute': { if (!isKayzer(w, me) || !w.threat) return no('Haraç isteyen yok.'); if (a.pay) return ok(payTribute(w)); log(w, `${headTitle(w)} haracı reddetti! Ordu sınıra yürüyor.`); w.threat.deadline = w.day; return ok('Haraç reddedildi; savaş yakında.'); }
    case 'caravanBuy': { const q = num(a.qty, 1, 50); if (q === null) return no('Geçersiz.'); const got = buy(w, me.id, a.good, q); return got ? ok(`Kervandan/pazardan ${got} ${GOOD_LABEL[a.good]} aldınız.`) : no('Alınamadı.'); }
    case 'borrow': { const v = num(a.amount, 5, 150); if (v === null) return no('5–150 Dinar.'); const r = borrow(w, me, v); return { ok: r.includes('verdi'), msg: r }; }
    case 'repay': return ok(repay(w, me, a.loanId));
    case 'festivalOpen': {
      if (!isKayzer(w, me)) return no('Festivali devlet düzenler.'); const c = num(a.cost, 100, 5000); if (c === null) return no('100–5000.');
      if (!spend(w, c) || !transfer(w, 'saray', 'dis', c, 'festival masrafı')) return no('Bütçe/hazine yetmiyor.');
      w.festivalUntil = w.day + 1; for (const p of w.people) { p.mood = clamp(p.mood + c / 100); p.loyalty = clamp(p.loyalty + c / 200); }
      log(w, `🎪 FESTİVAL! Festival Alanı yarın akşama kadar açık; müzik, oyun, yemek!`); return ok('Festival başladı.');
    }
    case 'buildAt': {
      if (!isKayzer(w, me)) return no('İnşaatı devlet başlatır.'); const plot = w.buildings.find((b) => b.id === a.plotId && b.kind === 'arsa'); if (!plot) return no('Bu arsa boş değil.');
      if (w.projects.some((x) => !x.done)) return no('Önce süren inşaat bitmeli.');
      const K: Record<string, [string, number]> = { cesme: ['Çeşme', 800], hamam: ['Hamam', 1500], kutuphane: ['Kütüphane', 1200], han: ['Kervansaray', 2000] };
      const k = K[a.kind]; if (!k) return no('Bilinmeyen yapı.');
      w.projects.push({ id: `pr${++w.idSeq}`, name: `${k[0]} inşaatı`, site: plot.id, plot: plot.id, kind: a.kind, cost: k[1], paid: 0, progress: 0, needed: Math.round(k[1] / 10), done: false });
      plot.name = `${k[0]} (inşaatta)`; log(w, `Ferman: ${plot.id} arsasına ${k[0]} yapılacak. Ustalar şantiyeden yola çıkıyor.`); return ok('İnşaat başladı; ödenek ayırın.');
    }
    case 'fateVote': { if (!['surgun', 'zindan', 'af'].includes(a.fate)) return no('Geçersiz.'); const r = voteFate(w, me, a.fate); return { ok: r.startsWith('Oyunuz'), msg: r }; }
    case 'festival': {
      if (!isKayzer(w, me)) return no('Yetkiniz yok.'); const c = num(a.cost, 50, 5000); if (c === null || w.treasury < c) return no('Hazine yetmiyor.');
      if (!spend(w, c)) return no(`Meclis bütçesi yetmiyor (kalan ${Math.round(budgetLeft(w))} Dinar).`);
      const perHead = c / w.people.length; for (const p of w.people) if (p.prof !== 'kayzer') transfer(w, 'saray', p.id, perHead, 'bayram harçlığı');
      for (const p of w.people) { p.mood = clamp(p.mood + c / 60); p.loyalty = clamp(p.loyalty + c / 150); p.republic = clamp(p.republic - c / 120); }
      log(w, `${headTitle(w)} bayram ilan etti! Herkese harçlık dağıtıldı.`); return ok('Bayram!');
    }
  }
}

/** NPC meclis members vote at once; player members vote with their loyalty. No meclis yet → passes. */
export function meclisVote(w: World): { yes: number; total: number; pass: boolean } {
  const m = w.people.filter((p) => p.meclis);
  if (!m.length) return { yes: 0, total: 0, pass: true };
  const yes = m.filter((p) => chance(w, 0.35 + p.loyalty / 200 + (p.mood - 50) / 200)).length;
  return { yes, total: m.length, pass: yes * 2 > m.length };
}

export function coupStatus(w: World, leaderId: string): { soldiers: number; need: number; fund: number; fundNeed: number; support: boolean; ok: boolean } {
  const kind = w.coup?.kind ?? 'coup';
  const soldiers = w.people.filter((p) => p.prof === 'asker' && (p.sidedWith === leaderId || (kind === 'revolution' && p.republic > 60))).length;
  const need = kind === 'coup' ? (lawOn(w, 'saraykor') ? 8 : 6) : 4;
  const fundNeed = kind === 'coup' ? 1500 : 800;
  const avgMood = w.people.reduce((s, p) => s + p.mood, 0) / w.people.length;
  const support = kind === 'coup' ? avgMood < 40 || w.cumhuriyet >= 50 : w.cumhuriyet >= 70;
  const fund = w.coup?.leaderId === leaderId ? w.coup.fund : 0;
  return { soldiers, need, fund, fundNeed, support, ok: soldiers >= need && fund >= fundNeed && support };
}

function seize(w: World, me: Person, now: number): ActionResult {
  if (!w.coup || w.coup.leaderId !== me.id) return no('Hazırlanmış bir komplonuz yok.');
  const st = coupStatus(w, me.id);
  const fund = w.coup.fund;
  if (!st.ok) {
    if (fund > 0) transfer(w, 'fon', 'saray', fund, 'komplo fonuna el konuldu');
    w.coup = null; me.plotting = 'none'; openCase(w, me.id, 'isyan', null, 0, 90);
    log(w, `${me.name} ${st.soldiers} askerle sarayı basmaya kalktı; başarısız oldu ve tutuklandı!`, me.id);
    return no('Darbe başarısız! Tutuklandınız, fonunuza el konuldu.');
  }
  if (fund > 0) transfer(w, 'fon', 'saray', fund, 'darbe fonu hazineye');
  const old = findPerson(w, w.kayzerId);
  w.kayzerId = me.id; w.regime = 'imparatorluk'; w.coup = null; me.plotting = 'none';
  for (const p of w.people) { p.sidedWith = null; if (p.prof === 'asker') p.loyalty = 70; }
  for (const p of w.people) p.republic = clamp(p.republic - 20);
  log(w, `${st.soldiers > 0 ? 'DARBE' : 'DEVRİM'}! ${me.name} tahta oturdu.${old ? ` ${old.name} saraydan çıkarıldı.` : ''}`, me.id);
  void now; void kayzerOnline;
  return ok('Taht artık sizin.');
}

function restore(w: World, me: Person, founder: boolean): ActionResult {
  if (!founder) return no('Hanedan hakkı sadece kurucuya ve soyundan gelenlere aittir.');
  if (w.kayzerId === me.id) return no('Zaten tahttasınız efendim.');
  const loyal = w.people.filter((p) => p.prof === 'asker' && p.loyalty >= 45).length;
  if (loyal < 3 && w.cumhuriyet >= 60) return no(`Hanedan hakkı için en az 3 sadık asker ya da cumhuriyet isteğinin 60'ın altına inmesi gerekir (şu an ${loyal} asker, cumhuriyet ${w.cumhuriyet}).`);
  const old = findPerson(w, w.kayzerId); if (old) old.loyalty = 20;
  const wasRep = w.regime === 'cumhuriyet';
  w.kayzerId = me.id; w.regime = 'imparatorluk'; w.election.baskanCandidates = []; w.election.baskanVotes = {};
  me.prof = 'kayzer'; me.work = 'saray'; me.home = 'saray'; me.exiledDays = 0; w.isyan = null; w.deposed = null;
  const sp = findPerson(w, me.spouse); if (sp) { sp.soylu = true; sp.home = 'saray'; }
  log(w, `Hanedan geri döndü! ${wasRep ? 'Cumhuriyet sona erdi, imparatorluk yeniden kuruldu. ' : ''}${me.name} yeniden tahtta.`, me.id); return ok('Tahtınıza geri döndünüz efendim.');
}

// ---------- chat safety ----------
const BAD = ['amk', 'aq', 'mk', 'oç', 'orospu', 'piç', 'sik', 'yarrak', 'göt', 'pezevenk', 'kahpe', 'ibne', 'fuck', 'shit', 'bitch'];
export function filterProfanity(s: string): string {
  return s.replace(/[\p{L}\p{N}]+/gu, (word) => {
    const lw = word.toLocaleLowerCase('tr');
    return BAD.some((b) => lw === b || (b.length >= 4 && lw.startsWith(b))) ? '*'.repeat(word.length) : word;
  });
}
/** sliding window rate limit: max n messages per windowMs */
export function rateOk(times: number[], now: number, n = 5, windowMs = 30_000): boolean {
  while (times.length && now - (times[0] ?? 0) > windowMs) times.shift();
  if (times.length >= n) return false; times.push(now); return true;
}

export function officeOf(w: World, p: Person): string {
  const r: string[] = [];
  if (p.id === w.kayzerId) r.push(w.regime === 'cumhuriyet' ? 'Cumhurbaşkanı' : 'Kayzer'); else r.push(p.prof === 'kayzer' ? 'Eski Kayzer' : PROF_LABEL[p.prof]);
  if (p.meclis) r.push('Meclis üyesi');
  if (p.id === w.founderPersonId || (p.soylu && isHanedan(w, p.id))) r.push('Hanedan');
  else if (p.soylu) r.push('Soylu');
  if (w.regime === 'imparatorluk' && p.spouse === w.kayzerId) r.push(p.female ? 'Kayzeriçe' : 'Kayzer’in eşi');
  if (w.regentId === p.id) r.push('Naip (veliaht reşit olana dek)');
  if (p.exiledDays > 0) r.push('Sürgünde');
  return r.join(' · ');
}
void STATE_PROFS;

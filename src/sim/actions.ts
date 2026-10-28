import { shelf, fulfillOrder, granaryDistribute } from './market2';
import { groupOf } from './economy';
import { cleanLook, lookFromSeeds, TERZI_PRICE, BERBER_PRICE } from './look';
import { attackFoe } from './combat';
import { setVaat, canvass, miting, ikram, partyPoster, endorse, smear, MEYDAN, MITING_R } from './propaganda';
import { joinParty, resignParty, foundParty, donate, meeting } from './party';
import { rebuild, nameEmpire } from './events3';
import { buyArm, kislaKit, draw, stash, searchPerson, armsLine, ARM_LABEL } from './arms';
import { answerForeign, recruit, ransom, RECRUIT_MAX } from './events2';
import { callWitness } from './alibi';
import { ek } from './tr';
import { moveIn, goInside, leaveHome, atHomeSafe } from './housing';
import { kayzerBill, foundFaction, members } from './meclis';
import { buildBarn, feedAnimals, collectFarm, hasHorse, drinkMilk, eatEgg, buyFarm, buyAnimal, slaughter, grantTitle, stripTitle, orgFound, orgJoin, orgLeave, orgMeet, orgRole, orgAct, assignSpy, issueWarrant, searchHouse, raidOrg } from './realm';
import { setGoal, missionCreate, missionClaim, missionPay } from './goals';
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
import { propose, sanction, spend, budgetLeft, openDilekce, signDilekce, askSign, turnout, castBallot, DILEKCE_IMZA, DILEKCE_DAYS } from './meclis';
import { yearsOf } from './age';
import { answerProposal, canRule, childrenOf, cureChild, divorce, findChild, isHanedan, proposeMarriage, requestChild, stage, succeed } from './family';
import { command, voteFate } from './isyan';
import { fullAI } from './ai';
import { eatMeal, assault, bribeAcceptChance, decideBribe, directive, drinkAlcohol, drinkWater, granaryBuy, granaryRelease, murder, payTribute, relate, seeDoctor, sermon } from './life';
import { opinion } from './chat';
import { borrow, repay } from './extras';
import { enactLaw, repealLaw, validateLaw } from './laws';
import { inspectPerson } from './hoard';
import { electionPhase, hourMs } from './tick';
import { applyProfile, bribeMul } from './profile';
import { continueAsChild } from './family';
import { produce } from './economy';
import { nearestOwnAnimal, ANIMAL_REACH } from './herdpos';
import { actionNeed, distToBuilding, PERSON_REACH, REACH, rules } from './move';
import { placeOf } from './place';
import { askJob, becomeTalebe, discharge, enlist, hire, hoursText, itibar, postJob, quitJob, readLesson, seferberlik, setShift, talim, teach } from './career';
import { asevi, ate, din, namaz, sadaka, sifa } from './piety';
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
    p.name = `Kayzer ${clean(name).replace(/^(Kayzer\s+)+/i, '')}`; w.founderPersonId = p.id;
  } else {
    const safeProf = PLAYER_PROFS.includes(prof) ? prof : 'hamal';
    const nm = clean(name).toLocaleLowerCase('tr'); // v2.0.1: no two characters with the same name (case-insensitive)
    if (w.people.some((x) => x.name.toLocaleLowerCase('tr') === nm || (!!x.playerId && x.name.toLocaleLowerCase('tr').replace(/^\S+\s/, '') === nm))) throw new Error('Bu isimde biri zaten var; başka bir isim seçin.');
    const houses = w.buildings.filter((b) => b.kind === 'ev');
    const counts = new Map<string, number>(); for (const x of w.people) counts.set(x.home, (counts.get(x.home) ?? 0) + 1);
    const best = [...houses].sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0))[0]; const home = best && (counts.get(best.id) ?? 0) < 5 ? best.id : ''; // v1.9: full city = homeless until you buy/rent
    p = makePerson(w, { name: clean(name), prof: safeProf, money: 40, honesty: 60, ambition: 50, loyalty: 60 }, home);
    p.profile = { fresh: true }; // the creation screen still sets Köken → meslek and money
    w.people.push(p);
  }
  p.playerId = playerId; p.npc = false; p.protectedUntil = w.day + 5;
  // v2.0.1: a newcomer starts fed, watered and rested, with bread and water in the bag; needs pause during the intro
  p.hunger = 0; p.thirst = 0; p.energy = 100; p.health = Math.max(p.health, 90); p.mood = Math.max(p.mood, 70); p.meals = Math.max(p.meals, 3); p.drinks = Math.max(p.drinks, 5); p.wounded = false;
  if (!target && !founder) { p.inv.ekmek = 2; p.inv.su = 1; } else { p.inv.ekmek = Math.max(p.inv.ekmek ?? 0, 2); p.inv.su = Math.max(p.inv.su ?? 0, 1); } /* v2.0.1 starting kit: 2 Ekmek + 1 Su */ p.onboardUntil = now + ONBOARD_MS;
  w.players[playerId] = { playerId, personId: p.id, name: p.name, founder, banned: false, lastSeen: now, lastSeenDay: w.day, awayLog: [], awayMoney: p.money };
  log(w, `${p.name} şehre geldi.`, p.id);
  return p;
}

export const ONBOARD_MS = 15 * 60_000;
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
  // v2.0.1 death flow: a dead player's account stays; he continues as an adult child or starts a new character
  if (a.t === 'continueAs') { const e = continueAsChild(w, playerId, a.childId); return e ? no(e) : ok('Ailenizin yeni reisi olarak devam ediyorsunuz.'); }
  if (a.t === 'newCharacter') {
    const d = pl.dead; if (!d || findPerson(w, pl.personId)) return no('Karakteriniz yaşıyor.');
    if (d.heirs.some((id) => { const c = findPerson(w, id); return c && (!c.playerId || c.npc); })) return no('Yetişkin bir çocuğunuz var; onunla devam edin.');
    const keep = { ...pl }; delete w.players[playerId];
    try { joinWorld(w, playerId, a.name, 'hamal', false, now); } catch (err) { w.players[playerId] = keep; return no((err as Error).message); }
    const np = w.players[playerId]!; np.founder = keep.founder; np.banned = keep.banned; np.qf = { ctlPause: true }; np.quest = 0;
    return ok('Yeni karakteriniz şehre geldi. Şimdi onu oluşturun.');
  }
  const me = findPerson(w, pl.personId); if (!me) return no(pl.dead ? 'Karakteriniz öldü. Cenaze ekranından bir çocuğunuzla devam edin ya da yeni karakter oluşturun.' : 'Karakter bulunamadı.');
  const isKayzer = (ww: World, p: Person): boolean => canRule(ww, p, now, ONLINE_WINDOW_MS);
  if ((me.homeUntil ?? 0) > now && !['goHome', 'setSpeed', 'setGoal', 'onboardDone', 'onboardPause', 'seenNews', 'customize', 'useItem', 'petition', 'answerProposal', 'defense', 'callWitness', 'restCase'].includes(a.t)) leaveHome(me); // any other action = you step outside
  const jailedOk: Action['t'][] = ['petition', 'eat', 'useItem', 'seenNews', 'onboardDone', 'onboardPause', 'customize', 'nameEmpire', 'divorce', 'answerProposal', 'defense', 'callWitness', 'restCase', 'offerBribe', 'setSpeed', 'setGoal'];
  const cellRising = (a.t === 'orgAct' && a.deed === 'ayaklanma') || (a.t === 'customize' && a.where === 'ilk'); // v1.9.6: a jailed leader can still give the signal
  if (me.jailedDays > 0 && !jailedOk.includes(a.t) && !cellRising) return no('Zindandasınız; şimdilik sadece dilekçe yazabilirsiniz.');
  const exileOk: Action['t'][] = [...jailedOk, 'restore', 'buy', 'sell', 'marry', 'haveChild', 'school', 'cure'];
  if (me.exiledDays > 0 && !exileOk.includes(a.t)) return no(`Sürgündesiniz (${me.exiledDays} gün kaldı).`);
  const need = rules.reach ? actionNeed(w, me, a) : null;
  if (need) {
    const pos = myPos(w, me, now);
    if (need.kind === 'building' && need.ids.length && !need.ids.some((id) => { const b = w.buildings.find((x) => x.id === id); return b && distToBuilding(b, pos) <= REACH + 0.6; })) return no(`Bunun için önce ${need.label} yürümelisiniz.`);
    if (need.kind === 'animal') {
      const an = nearestOwnAnimal(w, me, need.animal, now, pos);
      if (an && Math.hypot(an.x - pos.x, an.y - pos.y) > ANIMAL_REACH + 0.9) return no('Önce hayvanınızın yanına yürümelisiniz.');
    }
    if (need.kind === 'person') {
      const tp = need.id.startsWith('corpse:') ? w.corpses?.find((c) => `corpse:${c.id}` === need.id) : placeOf(w, need.id, now);
      if (tp && Math.hypot(tp.x - pos.x, tp.y - pos.y) > PERSON_REACH + 0.9) return no('Önce yanına yürümelisiniz (çok uzaktasınız).');
    }
  }
  const decides = (p: Person): boolean => !fullAI(p);
  const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
  switch (a.t) {
    case 'buy': {
      const q = num(a.qty, 1, 20); if (q === null || !GOODS.includes(a.good)) return no('Geçersiz miktar.');
      const grp = a.market ? groupOf(a.market) : undefined; /* v2.0.1: buy in the market you stand in; the Liman toptancısı sells wholesale there */
      const got = buy(w, me.id, a.good, Math.floor(q), Infinity, { group: grp, wholesale: grp === 'liman' }); if (got) { me.bought = me.bought ?? {}; me.bought[a.good] = (me.bought[a.good] ?? 0) + got; } return got ? ok(`${got} ${GOOD_LABEL[a.good]} aldınız.`) : no(shelf(w, a.good, grp, grp === 'liman').price === null ? `${GOOD_LABEL[a.good]} tükendi.` : 'Paranız yetmiyor.');
    }
    case 'fulfillOrder': { const e = fulfillOrder(w, me, a.orderId); if (e) return no(e); const c = (me.cs ??= {}); c.quests = (c.quests ?? 0) + 1; itibar(w, me, 2, 'sipariş teslim etti'); return ok('Sipariş teslim edildi, ödülü aldınız.'); }
    case 'jobApply': { const j = (w.jobs ?? []).find((x) => x.id === a.jobId); if (!j) return no('Bu ilan artık yok.'); if (me.job && me.job.title === j.title) return no('Zaten bu işte çalışıyorsunuz.'); const e = hire(w, me, j); return e ? no(e) : ok(`İşe alındınız: ${j.title}. Çalışma saati ${hoursText(j)}; ${j.place === 'liman' ? 'Liman' : (w.buildings.find((b) => b.id === j.place)?.name ?? j.place)}’da olun.`); }
    case 'jobQuit': return ok(quitJob(w, me));
    case 'jobPost': { const wg = num(a.wage, 1, 50), f = num(a.from, 0, 23), t2 = num(a.to, 0, 23); if (wg === null || f === null || t2 === null || f === t2) return no('Geçersiz ilan.'); const e = postJob(w, me, filterProfanity(String(a.title ?? 'Yardımcı')), wg, Math.floor(f), Math.floor(t2)); return e ? no(e) : ok('İlanınız İş İlanı Tahtası’na asıldı.'); }
    case 'askJob': { const t = findPerson(w, a.personId); if (!t || t.id === me.id) return no('Kişi yok.'); return askJob(w, me, t); }
    case 'kisla': {
      if (a.op === 'kayit') { const e = enlist(w, me); return e ? no(e) : ok('Kayıt subayı sizi yazdı: Acemi er. 2 gün talim (06–14) yapın.'); }
      if (a.op === 'terhis') { const e = discharge(w, me); return e ? no(e) : ok('Terhis oldunuz; ana yola döndünüz.'); }
      if (a.op === 'talim') { const e = talim(w, me); return e ? no(e) : ok(`Talim yaptınız (1 saat): savaş becerisi +%${me.cs?.skill ?? 0}, enerji −12. Talim günleri: ${(me.cs?.talimDays ?? []).length}/2.`); }
      const e = setShift(w, me, a.shift ?? 'gunduz'); return e ? no(e) : ok(`Nöbet saatiniz: ${hoursText(me.job!)}. Gelmezseniz rütbeniz düşer.`);
    }
    case 'seferberlik': { if (!isKayzer(w, me)) return no('Seferberliği Kayzer ilan eder.'); return ok(seferberlik(w, a.on)); }
    case 'recommend': { if (me.prof !== 'asker' || (me.askerRank ?? 0) < 5) return no('Tavsiyeyi komutan yazar.'); const t = findPerson(w, a.personId); if (!t || t.prof !== 'asker') return no('Asker değil.'); (t.cs ??= {}).rec = true; return ok(`${t.name} için tavsiye yazdınız.`); }
    case 'sadaka': { const v = num(a.amount, 1, 1000); if (v === null) return no('1–1000 D.'); const r = sadaka(w, me, v); return { ok: !r.startsWith('Kesenizde'), msg: r }; }
    case 'asevi': { const e = asevi(w, me); return e ? no(e) : ok('Aşevinden sıcak bir çorba içtiniz (tokluk +30, ücretsiz).'); }
    case 'sifa': { const e = sifa(w, me); return e ? no(e) : ok(`Şifa duası okundu; biraz iyileştiniz (sağlık ${Math.round(me.health)}).`); }
    case 'talebe': { const e = becomeTalebe(w, me); return e ? no(e) : ok('Artık talebesiniz: okulda ücretsiz ders, Cuma’ya katılım ve dindarlık sizi hocalığa taşır.'); }
    case 'oku': { const e = readLesson(w, me); return e ? no(e) : ok(`Ders aldınız (${me.cs?.read ?? 0}. ders${me.cs?.literate ? ', okuma-yazma biliyorsunuz' : ''}).`); }
    case 'dersVer': { const e = teach(w, me); return e ? no(e) : ok(`Ders verdiniz (toplam ${me.cs?.taught ?? 0}).`); }
    case 'imports': {
      if (!isKayzer(w, me)) return no('İthalatı devlet yönetir.'); w.imports = !!a.on;
      if (!a.on) { w.listings = w.listings.filter((l) => !(l.wholesale && l.sellerId === 'dis')); for (const p of w.people) if (['ciftci', 'degirmenci', 'dokumaci', 'demirci', 'marangoz'].includes(p.prof)) p.mood = clamp(p.mood + 3); }
      log(w, a.on ? 'Ferman: ithalat serbest. Liman toptancısı ve kervanlar yine geliyor; fiyatlar düşer, yerli üretici biraz zorlanır.' : 'Ferman: ithalat yasak! Liman toptancısı ve kervanlar gelmeyecek; yerli üretici memnun ama fiyatlar artabilir.');
      return ok(a.on ? 'İthalat serbest.' : 'İthalat yasaklandı.');
    }
    case 'sell': {
      const q = num(a.qty, 1, 500); const pr = num(a.price, 0.1, 1000);
      if (q === null || pr === null || !GOODS.includes(a.good) || me.inv[a.good] < q) return no('Elinizde o kadar mal yok.');
      if (me.inv[a.good] - (me.bought?.[a.good] ?? 0) < q) return no('Bugün aldığınız malı aynı gün yeniden satamazsınız (karaborsa önlemi).');
      me.inv[a.good] -= Math.floor(q); addListing(w, me, a.good, Math.floor(q), pr, a.market === 'liman' ? 'liman' : 'pazar'); return ok(`Tezgâha koydunuz (${a.market === 'liman' ? 'Liman' : 'Çarşı'}).`);
    }
    case 'eat': {
      if (me.hunger < 15) return no('Karnınız tok (Tokluk çubuğu dolu).');
      { const bag = (['ekmek', 'et', 'balik', 'yumurta', 'sut'] as const).find((g) => (me.inv[g] ?? 0) > 0); // v2.0.1: the Çanta first, free
        if (bag) { me.inv[bag] -= 1; me.meals += 1; ate(w, me); me.hunger = clamp(me.hunger - 35); me.mood = clamp(me.mood + 0.5); me.thought = ''; return ok(`Çantadan ${GOOD_LABEL[bag]} yediniz (ücretsiz). Tokluk ${Math.round(100 - me.hunger)}/100.`); } }
      { const m0 = me.money; if (!eatMeal(w, me)) return no('Çantanızda yiyecek yok; satın alacak paranız ya da pazarda yemek yok.'); me.thought = ''; const paid = Math.round((m0 - me.money) * 100) / 100;
        return ok(`Yemek yediniz${paid > 0 ? ` – ödenen: ${paid} D` : ''}. Tokluk ${Math.round(100 - me.hunger)}/100.`); }
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
      if (pet && (me.cs ??= {}).noted?.['dilekce'] !== w.day) { (me.cs.noted ??= {})['dilekce'] = w.day; itibar(w, me, 1, 'Meclis/saray dilekçesi'); }
      return pet ? ok('Dilekçeniz saraya ulaştı.') : no('Zaten bekleyen bir dilekçeniz var.');
    }
    case 'answer': {
      if (!isKayzer(w, me)) return no(`Sadece ${headTitle(w)} cevaplayabilir.`);
      const pet = w.petitions.find((x) => x.id === a.petitionId); if (!pet) return no('Dilekçe yok.');
      return answerPetition(w, pet, a.accept, 'kayzer', now) ? ok('Ferman yazıldı.') : no('Bu dilekçe uygulanamadı (hazine yetmiyor olabilir).');
    }
    case 'setTax': { if (!isKayzer(w, me)) return no('Yetkiniz yok.'); const r = num(a.rate, 0, 40); if (r === null) return no('0–40 arası.'); if (w.regime === 'imparatorluk' && members(w).length >= 5 && Math.round(r) !== w.taxRate) { const b = kayzerBill(w, me, 'vergi', Math.round(r), ''); return typeof b === 'string' ? no(b) : ok(`Vergi değişikliği Meclis’e sevk edildi (%${Math.round(r)}). Meclis kabul ederse yürürlüğe girer.`); } w.taxRate = Math.round(r); log(w, `Ferman: satış vergisi %${w.taxRate}.`); return ok('Vergi değişti.'); }
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
      openCase(w, t.id, 'hirsizlik', null, 0, recent ? 70 : 15); log(w, `${me.name}, ${ek(t.name, 'ı')} tutukladı.`, t.id); return ok(recent ? 'Tutuklandı, deliller güçlü.' : 'Tutuklandı ama delil zayıf.');
    }
    case 'steal': {
      const t = findPerson(w, a.personId); if (!t || t.id === me.id || t.prof === 'naip' || t.id === w.kayzerId) return no('Geçersiz.');
      if (atHomeSafe(w, t, now)) return no(`${t.name} evinde; kapı kilitli.`);
      me.honesty = clamp(me.honesty - 10); din(w, me, -10, 'hırsızlık'); const got = steal(w, me, t); return got ? ok(`${got} Dinar çaldınız…`) : no('Kesesi boş çıktı.');
    }
    case 'bribe': {
      const t = findPerson(w, a.personId); const amt = num(a.amount, 1, 10000); if (!t || amt === null || t.id === me.id) return no('Geçersiz.');
      if (isKayzer(w, me) || me.soylu) return no('Hükümdarın rüşvete ihtiyacı yoktur; ferman yazın.');
      if (!STATE_PROFS.includes(t.prof) && !t.meclis) return no('Rüşvet sadece memur, asker, bekçi, kadı ya da Meclis üyesine, bir şey karşılığında verilir.');
      if (!transfer(w, me.id, t.id, amt, 'rüşvet')) return no('Paranız yetmiyor.');
      if (t.meclis) w.meclis.bribes.push({ from: me.id, to: t.id, amount: amt, day: w.day, exposed: false });
      t.loyalty = clamp(t.loyalty - amt / 5); t.relations[me.id] = clamp((t.relations[me.id] ?? 0) + amt / 2, -100, 100);
      if (t.prof === 'asker' && amt >= 40 && chance(w, (100 - t.loyalty) / 100 + 0.1)) t.sidedWith = me.id;
      if (lawOn(w, 'rusvet') && chance(w, bekciPower(w) * 0.35)) { openCase(w, me.id, 'rusvet', null, amt, 60); log(w, `${me.name}, ${ek(t.name, 'a')} rüşvet verirken yakalandı!`, me.id); return ok('Rüşveti verdiniz… ama bekçi gördü!'); }
      return ok(t.sidedWith === me.id ? `${t.name} artık sizin yanınızda.` : 'Rüşveti aldı; ne düşündüğü belli değil.');
    }
    case 'give': {
      const t = findPerson(w, a.personId); const amt = num(a.amount, 1, 100000); if (!t || amt === null) return no('Geçersiz.');
      const from = isKayzer(w, me) && a.personId !== me.id ? 'saray' : me.id;
      if (from === 'saray' && !spend(w, amt)) return no(`Meclis bütçesi yetmiyor (kalan ${Math.round(budgetLeft(w))} Dinar).`);
      if (!transfer(w, from, t.id, amt, from === 'saray' ? 'saray bağışı' : 'bağış')) return no('Para yetmiyor.');
      t.loyalty = clamp(t.loyalty + Math.min(15, amt / 4)); t.mood = clamp(t.mood + 5); t.relations[me.id] = clamp((t.relations[me.id] ?? 0) + 10, -100, 100); return ok(`${ek(t.name, 'a')} ${amt} Dinar verildi.`);
    }
    case 'propose': {
      const law = a.law ? { ...a.law, name: a.law.name ? filterProfanity(String(a.law.name)).slice(0, 50) : undefined } : undefined;
      const r = propose(w, me, a.kind, num(a.value, 0, 50000) ?? 0, String(a.target ?? ''), a.title ? filterProfanity(a.title) : undefined, law, false, { borc: !!a.borc });
      return typeof r === 'string' ? no(r) : ok(a.kind === 'cumhuriyet' ? 'Cumhuriyet İlanı gündemde: 2 gün görüşme, 1 gün oylama; 14 evet gerekir.' : 'Teklifiniz Meclis gündeminde. 1 gün görüşme, 1 gün oylama.');
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
    case 'joinFaction': case 'joinParty': { const e = joinParty(w, me, a.factionId); return e ? no(e) : ok(`${w.meclis.factions.find((f) => f.id === a.factionId)!.name} üyesisiniz. Günlük aidat 1 D parti kasasına gider.`); }
    // v2.0.2 campaign + party (player side of the S/U packages; NPCs already used them)
    case 'vaat': { const e = setVaat(w, me, Array.isArray(a.kinds) ? a.kinds.map(String) : []); return e ? no(e) : ok('Vaatleriniz ilan edildi. Seçmenler ihtiyaçlarına göre tartar; seçilip önermezseniz itibar ve oy kaybedersiniz.'); }
    case 'canvass': { const v = findPerson(w, a.personId); if (!v || v.id === me.id) return no('Kişi yok.'); const r = canvass(w, me, v); return r.ok ? ok(r.msg) : no(r.msg); }
    case 'miting': { const q = placeOf(w, me.id, now); if (rules.reach && q && Math.hypot(q.x - MEYDAN.x, q.y - MEYDAN.y) > MITING_R) return no('Miting Meydan’da yapılır – önce Meydan’a yürüyün.'); const r = miting(w, me, now, filterProfanity(String(a.text ?? '')).slice(0, 160)); return r.ok ? ok(r.msg) : no(r.msg); }
    case 'ikram': { const v = findPerson(w, a.personId); if (!v || v.id === me.id) return no('Kişi yok.'); const k = a.kind === 'para' || a.kind === 'serbet' ? a.kind : 'pilav'; const r = ikram(w, me, v, k, num(a.amount, 1, 100) ?? 5); return r.ok ? ok(r.msg) : no(r.msg); }
    case 'partyPoster': { const e = partyPoster(w, me); return e ? no(e) : ok('Parti afişi asıldı (bütün parti adaylarına yarar).'); }
    case 'endorse': { const v = findPerson(w, a.personId); if (!v) return no('Kişi yok.'); const e = endorse(w, me, v); return e ? no(e) : ok(`${v.name} adaylığını açıkça desteklediniz.`); }
    case 'smear': { const v = findPerson(w, a.personId); if (!v || v.id === me.id) return no('Kişi yok.'); const r = smear(w, me, v); return r.ok ? ok(r.msg) : no(r.msg); }
    case 'resignParty': { const e = resignParty(w, me); return e ? no(e) : ok('Partinizden istifa ettiniz.'); }
    case 'foundParty': { const id = (['saltanatci', 'cumhuriyetci', 'esnaf', 'halkci'] as const).includes(a.ideology) ? a.ideology : 'halkci'; const e = foundParty(w, me, filterProfanity(String(a.name ?? '')), id); return e ? no(e) : ok('Partiniz kuruldu; genel başkan sizsiniz.'); }
    case 'donate': { const e = donate(w, me, num(a.amount, 1, 10000) ?? 0); return e ? no(e) : ok('Bağışınız parti kasasına geçti.'); }
    case 'ocak': { const e = meeting(w, me); return e ? no(e) : ok('Ocak toplantısına katıldınız (+parti itibarı, +1 itibar).'); }
    case 'runForBaskan': {
      if (w.regime !== 'cumhuriyet') return no('Başkanlık seçimi sadece cumhuriyette yapılır.');
      if (!w.election.baskanCandidates.includes(me.id)) w.election.baskanCandidates.push(me.id);
      return ok(`Başkan adayısınız. Seçim ${w.election.baskanNextDay}. gün.`);
    }
    case 'voteBaskan': { if (w.regime !== 'cumhuriyet' || !findPerson(w, a.candidateId)) return no('Geçersiz.'); w.election.baskanVotes[me.id] = a.candidateId; return ok('Oyunuz sandıkta.'); }
    case 'runForMeclis': { if (me.id === w.kayzerId && w.regime === 'imparatorluk') return no('Kayzer aday olamaz.'); if (me.prof === 'asker' || me.prof === 'bekci') return no('Askerler ve bekçiler Meclis’e aday olamaz.'); if (electionPhase(w).phase !== 'aday') return no(`Adaylık dönemi değil. ${electionPhase(w).label}.`); if (!w.election.candidates.includes(me.id)) w.election.candidates.push(me.id); return ok(`Adaysınız. Seçim ${w.election.nextDay}. gün.`); }
    case 'vote': { // v2.0.1 gerçek sandık: only on election day, at the Meclis; secret ballot
      if (!w.election.candidates.includes(a.candidateId)) return no('Bu kişi aday değil.');
      if (electionPhase(w).phase !== 'oylama') return no(`Sandık seçim günü açılır. ${electionPhase(w).label}.`);
      if (yearsOf(w, me) < 16 || me.jailedDays > 0) return no('Oy vermek için 16 yaşında olmalı ve zindanda olmamalısınız.');
      if (w.election.votes[me.id]) return no('Oyunuzu zaten kullandınız (gizli oy, değiştirilemez).');
      castBallot(w, me.id, a.candidateId); const t = turnout(w);
      return ok(`🗳 Oyunuz kaydedildi (gizli oy). Şu ana kadar katılım: ${t.voted}/${t.electorate} (%${t.pct}).`); }
    case 'dilekceAc': { const r = openDilekce(w, me, a.kind, num(a.value, 0, 50000) ?? 0, String(a.target ?? ''), a.title ? filterProfanity(a.title) : ''); return typeof r === 'string' ? no(r) : ok(`Dilekçe açıldı: “${r.title}”. ${DILEKCE_IMZA} imza toplanınca Meclis gündemine girer (${DILEKCE_DAYS} gün).`); }
    case 'dilekceImza': { const e = signDilekce(w, me, a.id); if (e) return no(e); const d = (w.meclis.dilekceler ?? []).find((x) => x.id === a.id); return ok(`İmzaladınız (${d?.signers.length ?? '?'}/${DILEKCE_IMZA}).`); }
    case 'dilekceIste': { const t = findPerson(w, a.personId); if (!t) return no('Kimse yok.'); if (t.playerId && !t.npc) return no('Oyunculardan imzayı kendileri atar (Meclis’teki dilekçe masası).'); const r = askSign(w, me, t, a.id); return r.ok ? ok(r.msg) : no(r.msg); }
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
      const st = stage(w, c); if (a.on && st !== 'genc') return no('Okul 7–15 yaş gençler içindir.');
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
    case 'setGoal': return ok(setGoal(me, a.goal));
    case 'buyHome': case 'rentHome': { const r = moveIn(w, me, a.houseId, a.t === 'buyHome' ? 'satin' : 'kira'); return /satın aldınız|taşındınız/.test(r) ? ok(r) : no(r); }
    case 'goHome': { const r = goInside(w, me, !!a.sleep, now, hourMs(w)); return r.startsWith('Eviniz yok') ? no(r) : ok(r); }
    case 'leaveHome': leaveHome(me); return ok('Dışarı çıktınız.');
    case 'foundFaction': { const r = foundFaction(w, me, String(a.name ?? '')); return r.includes('kuruldu') ? ok(r) : no(r); }
    case 'drinkMilk': { const r = drinkMilk(me); return r.startsWith('Süt içtiniz') ? ok(r) : no(r); }
    case 'eatEgg': { const r = eatEgg(me); return r.startsWith('Yumurta') ? ok(r) : no(r); }
    case 'buildBarn': { const r = buildBarn(w, me, a.kind); return r.includes('yapıldı') ? ok(r) : no(r); }
    case 'feedAnimals': { const r = feedAnimals(w, me); return r.includes('beslendi') ? ok(r) : no(r); }
    case 'collectFarm': { const r = collectFarm(me); return r.startsWith('Toplandı') ? ok(r) : no(r); }
    case 'ride': { if (a.on && !hasHorse(me)) return no('Atınız yok. Hayvan Pazarı’ndan alın.'); me.riding = !!a.on; return ok(a.on ? 'Atınıza bindiniz: iki kat hızlısınız.' : 'Attan indiniz.'); }
    case 'buyFarm': { const r = buyFarm(w, me); return r.includes('arsanız hazır') ? ok(r) : no(r); }
    case 'buyAnimal': { const r = buyAnimal(w, me, a.animal, Math.max(1, Math.min(10, Math.round(a.n ?? 1)))); return / aldınız/.test(r) ? ok(r) : no(r); }
    case 'slaughter': { const r = slaughter(w, me, a.animal); return r.includes('kesildi') ? ok(r) : no(r); }
    case 'grantTitle': { const t = findPerson(w, a.personId); if (!t) return no('Kişi yok.'); const r = grantTitle(w, me, t, a.rank, a.fief); return r.startsWith('👑') ? ok(r) : no(r); }
    case 'stripTitle': { const t = findPerson(w, a.personId); if (!t) return no('Kişi yok.'); const r = stripTitle(w, me, t); return r.startsWith('⚔') ? ok(r) : no(r); }
    case 'orgFound': { const r = orgFound(w, me, a.kind, String(a.name ?? '')); return r.includes('kuruldu') ? ok(r) : no(r); }
    case 'orgJoin': { const r = orgJoin(w, me, a.orgId); return r.includes('katıldınız') ? ok(r) : no(r); }
    case 'orgLeave': { const r = orgLeave(w, me); return r.startsWith('Örgütte değil') ? no(r) : ok(r); }
    case 'orgRole': { const r = orgRole(w, me, a.personId, a.role); return r.includes('artık') ? ok(r) : no(r); }
    case 'orgAct': { const r = orgAct(w, me, a.deed); return /asıldı|soyuldu|yapıldı|başarılı|BAŞLADI/.test(r) ? ok(r) : no(r); }
    case 'orgMeet': { const r = orgMeet(w, me); return r.startsWith('Bu gece') ? ok(r) : no(r); }
    case 'assignSpy': { const s = findPerson(w, a.spyId), t = findPerson(w, a.targetId); if (!s || !t) return no('Kişi yok.'); const r = assignSpy(w, me, s, t); return r.includes('izleyecek') ? ok(r) : no(r); }
    case 'warrant': { const t = findPerson(w, a.personId); if (!t) return no('Kişi yok.'); const r = issueWarrant(w, me, t); return r.includes('çıkarıldı') ? ok(r) : no(r); }
    case 'searchHouse': { const t = findPerson(w, a.personId); if (!t) return no('Kişi yok.'); const r = searchHouse(w, me, t); return r.includes('arandı') || r.includes('bulundu') ? ok(r) : no(r); }
    case 'raidOrg': { const r = raidOrg(w, me, a.orgId); return r.startsWith('⚔') ? ok(r) : no(r); }
    case 'informantPay': { if (me.id !== w.kayzerId) return no('Sadece Kayzer.'); w.informantPay = Math.max(0, Math.min(200, Math.round(a.amount))); return ok(w.informantPay ? `Muhbirlere ${w.informantPay} Dinar ödül ilan edildi.` : 'Muhbir ödülü kaldırıldı.'); }
    case 'missionCreate': { const r = missionCreate(w, me, String(a.text ?? ''), Number(a.reward) || 0, a.to ?? null); return r === 'Görev ilan edildi.' ? ok(r) : no(r); }
    case 'missionClaim': return ok(missionClaim(w, me, a.id));
    case 'missionPay': return ok(missionPay(w, me, a.id, !!a.pay));
    case 'setSpeed': {
      if (w.kayzerId !== me.id) return no('Oyun hızını sadece hükümdar değiştirir.');
      if (![0.5, 1, 2].includes(a.speed)) return no('0.5x, 1x ya da 2x.');
      if (w.combat) { w.speedBefore = a.speed; log(w, `Ferman: saldırı bitince zaman ${a.speed}x akacak.`); return ok(`Saldırı sürerken oyun 0.25x; bitince ${a.speed}x olacak.`); }
      const f = Math.min(0.999, Math.max(0, (now - w.lastTickAt) / hourMs(w)));
      w.speed = a.speed; w.lastTickAt = now - f * hourMs(w); // keep the clock continuous
      log(w, `Ferman: zaman ${a.speed}x hızla akıyor.`); return ok(`Hız ${a.speed}x.`);
    }
    case 'drinkWater': { if (me.thirst < 15) return no('Susamadınız (Su çubuğu dolu).'); const fromBag = (me.inv.su ?? 0) > 0; const m0 = me.money;
      if (!drinkWater(w, me)) return no('Çantanızda su yok; alacak paranız ya da kuyuda su yok.'); me.thought = ''; const paid = Math.round((m0 - me.money) * 100) / 100;
      return ok(`${fromBag ? 'Çantadan su içtiniz (ücretsiz)' : `Su içtiniz${paid > 0 ? ` – ödenen: ${paid} D, çantada ${me.inv.su} su kaldı` : ''}`}. Su ${Math.round(100 - me.thirst)}/100.`); }
    case 'buyBag': { const g = a.good; if (g !== 'ekmek' && g !== 'su') return no('Geçersiz.'); const q = Math.max(1, Math.min(10, Math.floor(a.qty || 1))); const m0 = me.money; const got = buy(w, me.id, g, q);
      return got ? ok(`${got} ${GOOD_LABEL[g]} çantaya kondu – ödenen: ${Math.round((m0 - me.money) * 100) / 100} D.`) : no('Satın alınamadı (para ya da stok yok).'); }
    case 'holdNpc': { const t = findPerson(w, a.personId); if (!t || t.id === me.id) return no(''); if (!a.on) { if (t.hold?.by === me.id) t.hold = undefined; return ok(''); }
      const q = placeOf(w, t.id, now); if (!q) return no(''); t.hold = { by: me.id, x: q.x, y: q.y, until: now + 90_000 }; return ok(''); }
    case 'pray': return ok(namaz(w, me, now));
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
    case 'kill': { const t = findPerson(w, a.personId); if (!t || t.id === me.id || t.prof === 'naip' || t.id === w.kayzerId) return no('Geçersiz.'); me.honesty = clamp(me.honesty - 40); din(w, me, -10, 'cinayet'); return ok(murder(w, me, t)); }
    case 'offerBribe': {
      const ar = w.arrests.find((x) => x.id === a.arrestId && x.criminalId === me.id && x.status === 'bekliyor'); const amt = num(a.amount, 1, 1000);
      if (!ar || amt === null) return no('Bekleyen bir tutuklamanız yok.'); if (me.money < amt) return no('Paranız yetmiyor.');
      ar.offer = amt; const ca = findPerson(w, ar.catcherId);
      if (ca && fullAI(ca)) { const r = decideBribe(w, ar, chance(w, Math.min(0.97, bribeAcceptChance(ca, amt) * bribeMul(me)))); return { ok: r.includes('saldı'), msg: r }; }
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
      if (a.op === 'dagit') { const n = granaryDistribute(w, q); return n ? ok(`Ambardan ${n} buğday değirmenlere dağıtıldı.`) : no('Ambar boş ya da değirmenci yok.'); }
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
    case 'customize': {
      const L = cleanLook(a.look); if (!L) return no('Geçersiz görünüm.');
      const cur = me.look ?? lookFromSeeds(me);
      if (!me.lookSet || a.where === 'ilk') {
        const firstGender = !me.genderSet && me.playerId && !me.npc; // v2.0.1: every player picks Erkek/Kadın once (new and existing characters)
        if (me.lookSet && !firstGender) return no('İlk görünüm zaten seçildi; Terzi ya da Berber’e gidin.');
        const needProfile = !me.profile?.set && me.playerId && !me.npc && me.prof !== 'kayzer' && me.id !== w.kayzerId;
        if (needProfile && !a.profile) return no('Lütfen soyadı, yaş grubu, köken ve mizaç seçin.');
        if (firstGender && typeof a.female !== 'boolean') return no('Lütfen cinsiyet seçin (Erkek / Kadın).');
        if (firstGender && me.spouse && a.female !== me.female) return no('Evli olduğunuz için cinsiyetiniz eşinizinkinin karşıtı kalmalı (evlilik yalnız erkek ile kadın arasında).');
        if (needProfile) { const e = applyProfile(w, me, a.profile!, !!me.profile?.fresh); if (e) return no(e); if (me.profile) delete me.profile.fresh; }
        else if (a.profile && !me.profile?.set && me.playerId) { const e = applyProfile(w, me, a.profile, false); if (e) return no(e); } // the ruler may add a surname/traits, never a new meslek
        if (firstGender) {
          if (me.spouse && a.female !== me.female) return no('Evli olduğunuz için cinsiyetiniz eşinizinkinin karşıtı kalmalı (evlilik yalnız erkek ile kadın arasında).');
          me.female = !!a.female; me.genderSet = true;
          w.proposals = w.proposals.filter((x) => x.kind !== 'evlilik' || (x.from !== me.id && x.to !== me.id) || findPerson(w, x.from === me.id ? x.to : x.from)?.female !== me.female);
        }
        if (me.female) L.beard = 0;
        me.look = L; me.lookSet = true; return ok('Karakteriniz kaydedildi.'); }
      if (me.female) L.beard = 0;
      if (a.where === 'terzi') {
        const nl = { ...cur, cloth: L.cloth, outfit: L.outfit, head: L.head, scarf: L.scarf, belt: L.belt, jewel: L.jewel };
        const tailor = w.people.find((p) => p.prof === 'dokumaci' && p.jailedDays === 0 && p.id !== me.id);
        if (!transfer(w, me.id, tailor?.id ?? 'saray', TERZI_PRICE, 'terzi (yeni kıyafet)')) return no(`Terzi ${TERZI_PRICE} Dinar ister.`);
        if (tailor) tailor.incomeToday += TERZI_PRICE; me.look = nl; return ok(`Yeni kıyafetiniz hazır (${TERZI_PRICE} D).`);
      }
      const nl = { ...cur, hair: L.hair, hairColor: L.hairColor, beard: L.beard };
      if (!transfer(w, me.id, 'saray', BERBER_PRICE, 'berber')) return no(`Berber ${BERBER_PRICE} Dinar ister.`);
      me.look = nl; return ok(`Berber işini bitirdi (${BERBER_PRICE} D).`);
    }
    case 'buyArm': { const e = buyArm(w, me, a.item, a.qty ?? 1); return e ? no(e) : ok(`${ARM_LABEL[a.item]} alındı ve kaydınıza işlendi (${armsLine(me)}).`); }
    case 'kislaKit': { const e = kislaKit(w, me); return e ? no(e) : ok(`Kışla teçhizatı envanterinize kondu: ${armsLine(me)}.`); }
    case 'drawWeapon': { const e = draw(me, a.kind); return e ? no(e) : ok(a.kind ? `${ARM_LABEL[a.kind]} çekildi. Dikkat: sivilseniz bekçi görürse el koyar ve ceza keser.` : 'Silah kınına kondu.'); }
    case 'stash': { const e = stash(w, me, a.item as never, a.qty, a.toChest); return e ? no(e) : ok(a.toChest ? 'Sandığa kondu.' : 'Sandıktan alındı.'); }
    case 'useItem': {
      if (a.good === 'su') { if (me.inv.su <= 0) return no('Envanterde su yok.'); me.inv.su -= 1; me.drinks += 1; me.thirst = clamp(me.thirst - 35); return ok(`Su içtiniz (susuzluk ${Math.round(me.thirst)}).`); }
      if (!['ekmek', 'et', 'balik', 'yumurta', 'sut'].includes(a.good)) return no('Bu yenmez.');
      if ((me.inv[a.good] ?? 0) <= 0) return no('Envanterde yok.'); if (me.hunger < 10) return no('Karnınız tok.');
      me.inv[a.good] -= 1; me.meals += 1; me.hunger = clamp(me.hunger - 35); me.mood = clamp(me.mood + 0.5); return ok(`${GOOD_LABEL[a.good]} yediniz (açlık ${Math.round(me.hunger)}).`);
    }
    case 'searchPerson': { if (me.prof !== 'bekci') return no('Sadece bekçi arama yapar.'); const t = findPerson(w, a.personId); if (!t || t.id === me.id) return no('Geçersiz.'); return ok(searchPerson(w, me, t, now)); }
    case 'foreignAnswer': { if (!isKayzer(w, me)) return no('Kararı Kayzer verir.'); return ok(answerForeign(w, a.choice)); }
    case 'recruit': { if (!isKayzer(w, me)) return no('Asker toplamayı Kayzer emreder.'); const n = num(Math.min(Number(a.n) || 0, RECRUIT_MAX), 1, RECRUIT_MAX); if (n === null) return no('Geçersiz.'); return ok(recruit(w, n)); }
    case 'ransom': { if (!isKayzer(w, me)) return no('Fidyeyi Kayzer öder.'); return ok(ransom(w, a.personId)); }
    case 'attack': { const r = attackFoe(w, me, a.foeId, now, Number.isFinite(a.aimX) && Number.isFinite(a.aimY) ? { x: a.aimX!, y: a.aimY! } : null); return r.ok ? ok(r.msg) : no(r.msg); }
    case 'onboardDone': { if ((me.onboardUntil ?? 0) > now) me.onboardUntil = now; return ok(''); }
    case 'onboardPause': { // v2.0.1: while the one-time controls/creation screens are open the player's needs stand still (once per character)
      const pl = w.players[playerId]; if (!pl || pl.qf?.ctlPause) return ok(''); (pl.qf ??= {}).ctlPause = true; me.onboardUntil = Math.max(me.onboardUntil ?? 0, now + 5 * 60_000); return ok(''); }
    case 'seenNews': { (w.whatsNew ??= {})[playerId] = String(a.v).slice(0, 10); return ok(''); }
    case 'rebuild': return ((r) => /yeniden yapıldı/.test(r) ? ok(r) : no(r))(rebuild(w, me, a.buildingId));
    case 'nameEmpire': { if (!isKayzer(w, me) && !pl.founder) return no('Devlete adı Kayzer koyar.'); const e = nameEmpire(w, me, String(a.name ?? '')); return e ? no(e) : ok(`Devletin adı: ${w.empireName}`); }
    case 'callWitness': { const c = w.cases.find((x) => x.id === a.caseId); if (!c) return no('Dava yok.'); const e = callWitness(w, c, me, String(a.personId), now); return e ? no(e) : ok('Tanık çağrıldı.'); }
    case 'witness': {
      const c = w.cases.find((x) => x.id === a.caseId && x.stage !== 'kapandi'); if (!c || c.accusedId === me.id) return no('Dava yok.');
      c.witnesses = c.witnesses ?? []; if (c.witnesses.some((x) => x.id === me.id)) return no('Zaten tanıksınız.');
      c.witnesses.push({ id: me.id, against: a.against }); if (!c.trial) c.evidence = clamp(c.evidence + (a.against ? 15 : -10)); const acc = findPerson(w, c.accusedId);
      if (c.trial && !c.trial.done) c.trial.msgs.push({ who: me.id === c.trial.blamedId ? 'suclanan' : 'tanik', name: me.name, text: (String(a.text ?? '').trim() || (a.against ? 'Aleyhte tanıklık ediyorum.' : 'Lehte tanıklık ediyorum.')).slice(0, 300), at: now });
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
  if (w.exKayzerId === me.id) return no('Zindana girdiğiniz için tahtı kaybettiniz. Geri almanın yolu: Cemiyet → Ayaklanma ile bir isyana önderlik edip kazanmak, ya da cumhuriyette Başkan seçilmek.');
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

import { ek } from './tr';
import { nearestOwnAnimal, ANIMAL_REACH } from './herdpos';
/**
 * v1.6: real-time things that happen between game hours – corpses & the murder investigation,
 * trials with a defence in chat, bekçi escorts – plus movement actions, the v4 migration, and
 * the prompt builders the server uses for the LLM (NPC DMs, NPC talks, Meydan gossip, the judge).
 */
import type { CourtCase, Corpse, Person, World } from './types';
import { PROF_LABEL, GOOD_LABEL } from './constants';
import { findPerson } from './world';
import { log, personal } from './log';
import { chance, clamp, nextId, pick, rand } from './rng';
import { placeOf, placePeople, ESCORT_MS } from './place';
import { arrest, decideBribe, bribeAcceptChance, WITNESS_R, processReports } from './life';
import { verdict } from './tick';
import { CRIME_LABEL, fullAI, openCase } from './ai';
import { addressOf, opinion } from './chat';
import { marketPrice } from './economy';
import { findPath, WALK_SPEED, walkPos, type Pt } from './move';
import { playerWalking } from './place';
import { runTasks } from './orders';

export const CORPSE_MS = 5 * 60_000; // a body lies on the street for 5 real minutes
export const TRIAL_MS = 150_000;
export const CUSTODY_MS = 60_000; // a caught player waits 1 real minute in custody (bribe window) before the savcı acts

/** A murder: the victim falls where he stood; who was close enough saw it. */
export function makeCorpse(w: World, v: Person, killer: Person | null, now: number): Corpse {
  const q = placeOf(w, v.id, now); const x = q?.x ?? 32, y = q?.y ?? 28;
  const witnesses = placePeople(w, now).filter((o) => o.visible && o.p.id !== v.id && o.p.id !== killer?.id && Math.hypot(o.x - x, o.y - y) <= WITNESS_R).map((o) => o.p.id).slice(0, 6);
  const co: Corpse = { id: nextId(w, 'C'), personId: v.id, name: v.name, look: { hairColor: v.hairColor, skin: v.skin, shirt: v.shirt, female: v.female, prof: v.prof }, x, y, at: now, killerId: killer?.id ?? null, witnesses, stage: 'yerde' };
  w.corpses = [...(w.corpses ?? []), co].slice(-12);
  return co;
}

export function reportCorpse(w: World, co: Corpse, by: Person, now: number): string {
  if (co.stage !== 'yerde') return 'Bu ceset zaten ihbar edildi; bekçi yolda.';
  const placed = placePeople(w, now);
  const bekcis = placed.filter((q) => q.p.prof === 'bekci' && q.p.jailedDays === 0 && !playerWalking(w, q.p, now) && q.p.id !== co.killerId);
  const bq = bekcis.sort((a, b) => Math.hypot(a.x - co.x, a.y - co.y) - Math.hypot(b.x - co.x, b.y - co.y))[0];
  co.reportedBy = by.id; co.reportedAt = now; co.stage = 'ihbar';
  if (bq) { co.bekciId = bq.p.id; co.bekciFrom = { x: bq.x, y: bq.y }; }
  log(w, `☎ ${by.name}, ${ek(co.name, 'ın')} cesedini ihbar etti. ${bq ? `Bekçi ${bq.p.name.replace(/^Bekçi /, '')} olay yerine koşuyor.` : 'Ama görevde bekçi yok!'}`, by.id, now);
  return bq ? `İhbar ettiniz. ${bq.p.name} olay yerine geliyor.` : 'İhbar ettiniz ama şu an görevde bekçi yok.';
}

function investigate(w: World, co: Corpse, now: number): void {
  co.stage = 'inceleme';
  const bekci = findPerson(w, co.bekciId); const savci = w.people.find((p) => p.prof === 'savci' && p.jailedDays === 0);
  const killer = findPerson(w, co.killerId);
  const p = killer ? clamp(0.45 + 0.15 * co.witnesses.length, 0, 0.95) : 0;
  if (killer && rand(w) < p) {
    const e = co.witnesses.length; arrest(w, killer, 'cinayet', co.personId, 0, bekci ?? undefined, { evidence: Math.min(92, 35 + e * 15), eyewitnesses: e, eyeIds: co.witnesses, complainantId: co.reportedBy ?? null, basis: e ? `ceset incelemesi + ${e} görgü tanığı (2 m içinde)` : 'ceset incelemesi, görgü tanığı yok (dolaylı delil)' });
    co.note = `${bekci?.name ?? 'Bekçi'} olay yerini inceledi${co.witnesses.length ? `, ${co.witnesses.length} tanık dinledi` : ''} ve ${savci?.name ?? 'savcıya'} bildirdi. Şüpheli: ${killer.name}.`;
  } else co.note = `${bekci?.name ?? 'Bekçi'} olay yerini inceledi, ${savci?.name ?? 'savcıya'} bildirdi; katil şimdilik bulunamadı.`;
  log(w, `🔎 ${co.note}`, co.killerId ?? undefined, now);
}

/** Called on every heartbeat/action with the real time. Idempotent. */
export function realtime(w: World, now: number): void {
  runTasks(w, now); processReports(w, now);
  // v1.7: a caught PLAYER goes arrest → custody (1 min bribe window) → savcı → live hearing; never straight to the zindan
  for (const a of w.arrests) {
    if (a.status !== 'bekliyor') continue; const cr = findPerson(w, a.criminalId); if (!cr?.playerId || cr.npc) continue;
    if (now - (a.at ?? now) < CUSTODY_MS) continue;
    const ca = findPerson(w, a.catcherId);
    decideBribe(w, a, !!ca && a.offer > 0 && fullAI(ca) && rand(w) < bribeAcceptChance(ca, a.offer));
  }
  for (const c of w.cases) {
    if (c.stage === 'kapandi' || c.trial) continue; const acc = findPerson(w, c.accusedId); if (!acc?.playerId || acc.npc) continue;
    const hakim = w.people.find((p) => p.prof === 'hakim' && p.jailedDays === 0);
    if (hakim?.playerId && !hakim.npc) continue; // a player judge rules himself
    if (c.stage === 'savci') { if (c.evidence < 35) { c.stage = 'kapandi'; c.verdict = 'dusuruldu'; acc.jailedDays = 0; log(w, `Delil yetersiz: ${acc.name} serbest bırakıldı.`, acc.id, now); continue; } c.stage = 'hakim'; }
    if (c.stage === 'hakim') startTrial(w, c, now);
  }
  for (const co of w.corpses ?? []) {
    if (co.stage === 'yerde') {
      const delay = 20_000 + (parseInt(co.id.replace(/\D/g, ''), 10) % 5) * 6000;
      if (now - co.at > delay) {
        const reporter = findPerson(w, co.witnesses.find((id) => { const p = findPerson(w, id); return p && fullAI(p); })) ?? pick(w, w.people.filter((p) => fullAI(p) && p.jailedDays === 0 && p.prof !== 'naip'));
        if (reporter) reportCorpse(w, co, reporter, now);
      }
    } else if (co.stage === 'ihbar' && co.reportedAt) {
      const d = co.bekciFrom ? Math.hypot(co.x - co.bekciFrom.x, co.y - co.bekciFrom.y) : 0;
      if (now >= co.reportedAt + Math.max(4000, d / 3 * 1000) + 3000) investigate(w, co, now);
    }
  }
  w.corpses = (w.corpses ?? []).filter((c) => now - c.at < CORPSE_MS);
  w.escorts = (w.escorts ?? []).filter((e) => now - e.at < ESCORT_MS * 2);
  for (const c of w.cases) if (c.trial && !c.trial.done && (now > c.trial.until || (c.trial.msgs.filter((m) => m.who === 'sanik').length >= 5 && !c.trial.pending))) finishTrial(w, c, now);
}

// ---------------- trials ----------------
export function startTrial(w: World, c: CourtCase, now: number): void {
  const a = findPerson(w, c.accusedId); if (!a) return;
  const judge = w.people.find((p) => p.prof === 'hakim' && p.jailedDays === 0) ?? null;
  const pros = w.people.find((p) => p.prof === 'savci' && p.jailedDays === 0) ?? null;
  const victim = findPerson(w, c.victimId)?.name ?? w.corpses?.find((x) => x.personId === c.victimId)?.name;
  c.trial = { at: now, until: now + TRIAL_MS, judgeId: judge?.id ?? null, prosecutorId: pros?.id ?? null, persuasion: 0, done: false, msgs: [
    { who: 'savci', name: pros?.name ?? 'Savcı', text: `Sayın Kadı, sanık ${a.name} ${CRIME_LABEL[c.crime].toLocaleLowerCase('tr')} ile itham ediliyor${victim ? `; mağdur ${victim}` : ''}. Deliller ${c.evidence >= 70 ? 'güçlü' : c.evidence >= 45 ? 'yeterli' : 'zayıf'}${c.witnesses?.length ? `, ${c.witnesses.length} tanık var` : ''}. Cezalandırılmasını talep ediyorum.`, at: now },
    { who: 'hakim', name: judge?.name ?? 'Kadı', text: openingStatement(w, c, a), at: now + 500 },
    ...eyeTestimony(w, c, a, now + 700),
    { who: 'hakim', name: judge?.name ?? 'Kadı', text: `Sanık ${a.name}, söz sizde. Başkasını suçluyorsanız adını söyleyin; mahkemeye çağrılır. Kendinizi savunun; ${Math.round(TRIAL_MS / 60000 * 10) / 10} dakikanız var.`, at: now + 1000 },
  ] };
  c.deadline = w.day + 2;
  log(w, `⚖ ${ek(a.name, 'ın')} ${CRIME_LABEL[c.crime].toLocaleLowerCase('tr')} davası görülüyor. Kadı: ${judge?.name ?? '—'}, Savcı: ${pros?.name ?? '—'}.`, a.id, now);
}

/** v1.9.6: the judge tells the defendant the charge, the evidence and who complained. */
function openingStatement(w: World, c: CourtCase, a: Person): string {
  const victim = findPerson(w, c.victimId)?.name ?? w.corpses?.find((x) => x.personId === c.victimId)?.name;
  const comp = findPerson(w, c.complainantId)?.name;
  const eyes = (c.eyeIds ?? []).map((id) => findPerson(w, id)?.name).filter(Boolean);
  return `${a.name}, ${CRIME_LABEL[c.crime].toLocaleLowerCase('tr')} ile yargılanıyorsunuz${victim ? ` (mağdur: ${victim})` : ''}. Deliller: ${c.basis ?? 'savcılık iddiası'}; delil gücü ${Math.round(c.evidence)}/100${eyes.length ? `; olayı 2 m içinden görenler: ${eyes.join(', ')}` : '; görgü tanığı yok'}. Şikâyet eden: ${comp ?? 'savcılık (resen)'}.`;
}
/** NPC eyewitnesses (within 2 m) testify; their word moves the scale. */
function eyeTestimony(w: World, c: CourtCase, a: Person, at: number): { who: 'tanik'; name: string; text: string; at: number }[] {
  const out: { who: 'tanik'; name: string; text: string; at: number }[] = [];
  for (const id of (c.eyeIds ?? []).slice(0, 3)) {
    const p = findPerson(w, id); if (!p || p.id === a.id || !fullAI(p) || p.jailedDays > 0) continue;
    const against = (p.relations[a.id] ?? 0) < 40 || p.honesty > 60;
    (c.witnesses ??= []).push({ id: p.id, against });
    out.push({ who: 'tanik', name: p.name, text: against ? `Kendi gözümle gördüm, ${a.name} yaptı. Yemin ederim.` : `Oradaydım ama tam göremedim; ${a.name} iyi bir insandır.`, at: at + out.length * 100 });
  }
  return out;
}

/** Rule-based judge: how convincing a defence line is (−4..+3) and an answer. */
export function judgeRule(w: World, c: CourtCase, text: string): { reply: string; score: number } {
  const t = text.toLocaleLowerCase('tr'); let s = 0;
  if (/\*{3,}|aptal|salak|şerefsiz|defol/.test(t)) s -= 4;
  if (/masum|suçsuz|yapmadım|ben değil|iftira|alakam yok/.test(t)) s += 1;
  if (/tanık|şahit|kanıt|delil|yoktum|evdeydim|oradaydım|gördü|ispat/.test(t)) s += 2;
  if (/özür|pişman|affet|merhamet|bir daha/.test(t)) s += 1;
  if (/rüşvet|para vereyim|hallederiz/.test(t)) s -= 3;
  if (/nefsi müdafaa|kendimi savun|saldırdı bana|tehdit/.test(t)) s += 2;
  if (text.length > 80) s += 1; if (text.length < 8) s -= 1;
  s = Math.max(-4, Math.min(3, s));
  const reply = s <= -3 ? pick(w, ['Mahkemede edebinizi takının! Bu söz aleyhinize kaydedildi.', 'Kadıya rüşvet mi teklif ediyorsunuz? Tutanağa geçti.'])
    : s <= 0 ? pick(w, ['Bu bir savunma değil. Delilleri çürütecek bir şey söyleyin.', 'İnandırıcı bulmadım. Başka bir diyeceğiniz var mı?'])
    : s === 1 ? pick(w, ['Not ettim. Ama sözle olmaz; tanığınız, deliliniz var mı?', 'Peki. Savcı ne diyor bu konuda?'])
    : pick(w, ['Bu önemli bir nokta, dikkate alıyorum.', 'Hmm… Bu, delilleri zayıflatıyor. Devam edin.']);
  void c; return { reply, score: s };
}
export function addDefense(_w: World, c: CourtCase, me: Person, text: string, now: number): string | null {
  const tr = c.trial; if (!tr || tr.done) return 'Şu an görülen bir davanız yok.';
  if (c.accusedId !== me.id) return 'Sadece sanık savunma yapar.';
  if (tr.pending) return 'Kadı bir önceki sözünüzü düşünüyor…';
  tr.msgs.push({ who: 'sanik', name: me.name, text: text.slice(0, 300), at: now }); tr.pending = true;
  if (!tr.blamedId) summonBlamed(_w, c, me, text, now);
  return null;
}
/** v1.9.6: “X yaptı” → X is summoned and answers; if X was at the scene, the blame can stick. */
function summonBlamed(w: World, c: CourtCase, me: Person, text: string, now: number): void {
  const tr = c.trial!; const t = text.toLocaleLowerCase('tr');
  if (!/yaptı|öldürdü|suçlu|o vurdu|katil|çaldı|saldırdı|o idi|oydu/.test(t)) return;
  const skip = new Set([me.id, tr.judgeId, tr.prosecutorId, c.victimId]);
  const hit = w.people.filter((p) => !skip.has(p.id) && p.prof !== 'naip').find((p) => { const n = p.name.toLocaleLowerCase('tr'); const last = n.split(' ').slice(-1)[0]!; return t.includes(n) || (last.length >= 4 && new RegExp(`(^|[^a-zçğıöşü])${last}`).test(t)); });
  if (!hit) return;
  tr.blamedId = hit.id; const atScene = (c.eyeIds ?? []).includes(hit.id);
  tr.msgs.push({ who: 'hakim', name: findPerson(w, tr.judgeId)?.name ?? 'Kadı', text: `${hit.name} mahkemeye çağrılsın! Suçlama ciddi.`, at: now + 1 });
  if (hit.playerId && !hit.npc) personal(w, hit.playerId, `⚖ ${me.name} davasında sizi suçladı; mahkemeye çağrıldınız (duruşma ekranından cevap verin).`, now);
  else tr.msgs.push({ who: 'suclanan', name: hit.name, text: atScene ? (hit.honesty < 40 ? 'Oradaydım… ama elim kimseye kalkmadı, yemin ederim!' : 'Oradaydım, her şeyi gördüm; ben yapmadım.') : 'Ben o sırada başka yerdeydim, bu bir iftira!', at: now + 2 });
}
export function judgeAnswer(w: World, c: CourtCase, reply: string, score: number, now: number, reason?: string): void {
  const tr = c.trial; if (!tr || tr.done) return; if (reason) tr.lastReason = reason.slice(0, 200);
  tr.pending = false; tr.persuasion = clamp(tr.persuasion + score, -12, 12);
  tr.msgs.push({ who: 'hakim', name: findPerson(w, tr.judgeId)?.name ?? 'Kadı', text: reply.slice(0, 300), at: now });
  if (tr.msgs.filter((m) => m.who === 'sanik').length >= 5) finishTrial(w, c, now);
}
export function finishTrial(w: World, c: CourtCase, now: number): void {
  const tr = c.trial; if (!tr || tr.done) return; tr.done = true; tr.doneAt = now; tr.pending = false;
  // v1.9 dedupe: the same deed must not produce a second trial
  for (const o of w.cases) if (o !== c && o.accusedId === c.accusedId && o.stage !== 'kapandi' && (o.crime === c.crime || (o.victimId && o.victimId === c.victimId))) { o.stage = 'kapandi'; o.verdict = 'dusuruldu'; o.sentence = 'Aynı olay için görülen davayla birleştirildi.'; if (o.trial) { o.trial.done = true; o.trial.doneAt = now; } }
  const a = findPerson(w, c.accusedId); if (!a) return;
  const judge = findPerson(w, tr.judgeId);
  // v1.9.6: the defence really matters. Evidence comes from what actually happened (suçüstü / şikâyet / ceset);
  // only eyewitnesses within 2 m (≥2) keep guilt likely whatever is said.
  const eyes = c.eyewitnesses ?? 0; const courtAgainst = (c.witnesses ?? []).filter((x) => x.against).length;
  const courtFor = (c.witnesses ?? []).filter((x) => !x.against).length;
  const pGuilty = (c.evidence * ((judge?.honesty ?? 70) / 75) + Math.min(24, eyes * 8) + courtAgainst * 6 - courtFor * 6 - tr.persuasion * 7) / 100;
  const floor = eyes >= 2 ? Math.max(0.2, 0.7 - Math.max(0, tr.persuasion - 4) * 0.07) : 0.03;
  const p = clamp(Math.max(pGuilty, floor), 0.03, 0.97);
  const blamed = findPerson(w, tr.blamedId); const blameSticks = !!blamed && (c.eyeIds ?? []).includes(blamed.id) && tr.persuasion >= 4 && blamed.honesty < 60;
  const roll = rand(w); const guilty = !blameSticks && roll < p;
  const strength = tr.persuasion >= 6 ? 'güçlü' : tr.persuasion >= 2 ? 'kısmen ikna edici' : tr.persuasion >= 0 ? 'zayıf' : 'aleyhine';
  tr.reasoning = `Gerekçe: ${c.basis ?? 'savcılık iddiası'}; delil gücü ${Math.round(c.evidence)}/100${eyes ? `, ${eyes} görgü tanığı` : ', görgü tanığı yok'}${courtAgainst ? `, ${courtAgainst} aleyhte tanık` : ''}; savunma ${strength} (ikna ${tr.persuasion}). Suçluluk ihtimali %${Math.round(p * 100)}.${blamed ? (blameSticks ? ` Suç ${ek(blamed.name, 'a')} yöneldi: olay yerindeydi ve savunma ikna edici.` : ` ${blamed.name} suçlandı ama aleyhine delil bulunmadı.`) : ''}${tr.lastReason ? ` Kadının notu: ${tr.lastReason}` : ''}`;
  const fromQ = placeOf(w, a.id, now);
  verdict(w, c.id, guilty, now);
  if (guilty && tr.persuasion >= 4 && c.crime !== 'cinayet' && c.crime !== 'isyan') { a.jailedDays = 0; c.sentence = `${c.sentence?.replace(/^\d+ gün zindan, /, '') ?? ''} (zindan yerine para cezası – savunma ikna edici bulundu)`; }
  tr.verdictText = `${guilty ? `SUÇLU. Hüküm: ${c.sentence}.` : 'BERAAT. Sanık serbest.'} ${tr.reasoning}`;
  tr.msgs.push({ who: 'hakim', name: judge?.name ?? 'Kadı', text: `Karar: ${tr.verdictText}${guilty && a.jailedDays > 0 ? ' Bekçi, mahkûmu zindana götür!' : ''}`, at: now });
  if (guilty && a.jailedDays > 0) {
    const bekci = w.people.find((p) => p.prof === 'bekci' && p.jailedDays === 0 && p.id !== a.id);
    const m = w.buildings.find((b) => b.id === 'mahkeme');
    if (bekci) w.escorts = [...(w.escorts ?? []), { personId: a.id, bekciId: bekci.id, from: m ? { x: m.door.x + 0.5, y: m.door.y + 0.6 } : { x: fromQ?.x ?? 20, y: fromQ?.y ?? 12 }, at: now }];
  }
  if (blameSticks && blamed) { openCase(w, blamed.id, c.crime, c.victimId, c.amount, 60); const nc = w.cases.at(-1); if (nc && nc.accusedId === blamed.id && nc.stage !== 'kapandi') { nc.basis = `${a.name} davasında suçlandı; olay yerindeydi`; nc.eyeIds = (c.eyeIds ?? []).filter((x) => x !== blamed.id); nc.complainantId = a.id; log(w, `⚖ Kadı, ${ek(blamed.name, 'ı')} yargılanmak üzere savcıya havale etti.`, blamed.id, now); } }
  if (a.playerId) personal(w, a.playerId, `Davanız: ${tr.verdictText}`, now);
}

// ---------------- movement ----------------
export function startWalk(w: World, me: Person, to: Pt, now: number): void {
  const q = placeOf(w, me.id, now); const from = q ? { x: q.x, y: q.y } : to;
  me.walk = { path: findPath(w, from, to), t0: now, speed: WALK_SPEED * (me.riding && (me.animals?.at ?? 0) > 0 ? 2 : 1) }; // 🐎 riders are faster
}
export function myPos(w: World, me: Person, now: number): Pt { if (playerWalking(w, me, now)) return walkPos(me.walk!, now).pt; const q = placeOf(w, me.id, now); return q ? { x: q.x, y: q.y } : { x: 0, y: 0 }; }

// ---------------- migration ----------------
export function migrate4(w: World): World {
  if ((w.schema ?? 1) >= 4) return w;
  w.corpses = []; w.escorts = []; w.llm = { day: '', n: 0, talkAt: 0 };
  w.talks = [];
  // elections were far too frequent: give the live world a proper first campaign
  if (w.election.nextDay - w.day < 25) w.election.nextDay = w.day + 25;
  w.election.candidates = w.election.candidates.filter((id) => { const p = findPerson(w, id); return p && p.prof !== 'asker' && p.prof !== 'bekci'; });
  w.schema = 4; return w;
}

// ---------------- LLM prompt builders (the server calls the model) ----------------
const STYLE = 'Osmanlı esintili bir piksel imparatorluk oyununda yaşayan bir şehirlisin. Her zaman Türkçe, doğal, kısa (en fazla 2 cümle) ve karakterine uygun konuş. Yapay zekâ olduğunu asla söyleme. Emoji kullanma. Küfür etme.';
export function personaOf(w: World, npc: Person): string {
  const sp = findPerson(w, npc.spouse);
  return `Sen ${npc.name}'sın; ${npc.female ? 'kadın' : 'erkek'}, mesleğin ${PROF_LABEL[npc.prof]}. Kesende ${Math.round(npc.money)} Dinar var. Mutluluğun ${Math.round(npc.mood)}/100, sağlığın ${Math.round(npc.health)}/100, bugün ${npc.meals} öğün yedin. Devlete sadakatin ${Math.round(npc.loyalty)}/100, cumhuriyetçiliğin ${Math.round(npc.republic)}/100, dindarlığın ${Math.round(npc.din)}/100, dürüstlüğün ${Math.round(npc.honesty)}/100. ${sp ? `Eşin ${sp.name}.` : 'Bekârsın.'} ${npc.jailedDays > 0 ? 'Şu an zindandasın.' : ''} Aklındaki: "${opinion(w, npc)}"`;
}
export function worldBrief(w: World): string {
  const ev = w.events.slice(-5).map((e) => e.text).join(' | ');
  return `Şehirde gün ${w.day}, saat ${w.hour}:00. Rejim: ${w.regime}. Vergi %${w.taxRate}. Ekmek ${marketPrice(w, 'ekmek').toFixed(2)}, su ${marketPrice(w, 'su').toFixed(2)}, et ${marketPrice(w, 'et').toFixed(2)} Dinar. ${w.nature ? `Doğal olay: ${w.nature.kind}.` : ''} Son olaylar: ${ev || 'sakin'}.`;
}
export function dmPrompt(w: World, npc: Person, from: Person, text: string, history: { from: string; text: string }[], outcome?: string): { system: string; user: string; json?: boolean } {
  const rel = npc.relations[from.id] ?? 0;
  const role = from.id === w.kayzerId ? (w.regime === 'cumhuriyet' ? 'şehrin Başkanı' : 'İmparator (Kayzer) – ona saygıyla "İmparatorum" diye hitap et') : `${PROF_LABEL[from.prof]} ${from.soylu ? '(soylu)' : ''}`;
  return {
    system: `${STYLE}\n${personaOf(w, npc)}\n${worldBrief(w)}`,
    user: `Sana yazan: ${from.name}, ${role}. Ona hitabın: "${addressOf(w, from)}". Onunla ilişkin: ${rel > 30 ? 'dost' : rel < -30 ? 'düşman, soğuk davran' : 'tanıdık'}.\n${history.length ? `Önceki konuşma:\n${history.map((h) => `${h.from}: ${h.text}`).join('\n')}\n` : ''}${from.name}: ${text}\n${outcome ? `Bu bir istek/emir. Oyun kuralları karar verdi: ${outcome}. Cevabın bu sonuca KESİNLİKLE uygun olsun (reddettiysen karakterine uygun reddet, kabul ettiysen kabul et). Sadece kendi cevabını yaz.` : `Eğer mesaj senden bir şey yapmanı istiyorsa (bir yere git, takip et, saldır, öldür, tutukla, çal, ver, sat, satın al, çalış, oy ver, dedikodu yay, rüşvet götür, koru, git/ayrıl, gizli cemiyete katıl) bunu action olarak çıkar. Kabul edip etmemene OYUN karar verir; o yüzden iki cevap yaz. SADECE JSON döndür: {"action": null veya {"type": "go|follow|attack|kill|arrest|steal|give|sell|buy|work|vote|gossip|bribe|guard|leave|join", "target": "kişi adı veya 'ben'", "place": "yer adı", "item": "mal", "amount": 1, "text": "dedikodu metni"}, "reply": "istek yoksa cevabın", "reply_yes": "kabul edersen cevabın", "reply_no": "reddedersen cevabın"}`}`, json: !outcome,
  };
}
export function talksPrompt(w: World, pairs: { a: Person; b: Person }[]): { system: string; user: string } {
  return {
    system: `${STYLE}\n${worldBrief(w)}`,
    user: `Aşağıdaki şehirliler sokakta karşılaşıp kısa sohbet ediyor. Her çift için iki satır yaz: önce A konuşur, sonra B cevap verir. Her satır en fazla 70 karakter, karakterlerin durumuna uygun.\n${pairs.map((p, i) => `${i + 1}. A: ${p.a.name} (${PROF_LABEL[p.a.prof]}, mutluluk ${Math.round(p.a.mood)}, sadakat ${Math.round(p.a.loyalty)}, cumhuriyetçilik ${Math.round(p.a.republic)}, aklındaki: "${opinion(w, p.a)}") — B: ${p.b.name} (${PROF_LABEL[p.b.prof]}, mutluluk ${Math.round(p.b.mood)}, dindarlık ${Math.round(p.b.din)})`).join('\n')}\nAyrıca meydanda herkese bağıracak bir dedikodu cümlesi yaz (son olaylardan). JSON döndür: {"talks":[["A satırı","B satırı"],...],"gossip":"..."}`,
  };
}
export function judgePrompt(w: World, c: CourtCase): { system: string; user: string } {
  const tr = c.trial!; const judge = findPerson(w, tr.judgeId); const a = findPerson(w, c.accusedId);
  return {
    system: `${STYLE}\nSen ${judge?.name ?? 'şehrin kadısı'}sın, adil ama sert bir kadı (hâkim). Dürüstlüğün ${Math.round(judge?.honesty ?? 70)}/100. Sanığın savunmasını dinleyip kısa cevap verirsin ve ne kadar ikna olduğunu puanlarsın.`,
    user: `Dava: ${CRIME_LABEL[c.crime]}. Sanık: ${a?.name}. Delil gücü ${Math.round(c.evidence)}/100. Delilin kaynağı: ${c.basis ?? 'savcılık iddiası'}. Olayı 2 m içinden gören görgü tanığı: ${c.eyewitnesses ?? 0}. Mahkemeye gelen tanık: ${c.witnesses?.length ?? 0}.\nDuruşma:\n${tr.msgs.map((m) => `${m.name} (${m.who}): ${m.text}`).join('\n')}\nSanığın son sözüne kadı olarak cevap ver. Adil ol: görgü tanığı yoksa ve delil dolaylıysa, tutarlı bir mazeret (nerede/kiminle olduğu), delillerle çelişmeyen makul bir açıklama ya da nefsi müdafaa sanığı aklayabilir → yüksek puan ver. Savunma delillerle ya da tanıklarla çelişiyorsa, kendi içinde tutarsızsa, hakaret ya da rüşvet içeriyorsa düşük puan ver. JSON döndür: {"cevap":"kadının kısa cevabı","ikna":-4..4 arası tam sayı,"gerekce":"tek cümle: neden bu puan"}`,
  };
}
void GOOD_LABEL; void chance;

// ---------------- where to walk for an action (client) / is the actor there (server) ----------------
import { actionNeed, distToBuilding, doorSpot, PERSON_REACH, REACH } from './move';
import type { Action } from './types';
export function needTarget(w: World, me: Person, a: Action, now: number): { ok: boolean; to?: Pt; label?: string } {
  const need = actionNeed(w, me, a); if (!need) return { ok: true };
  const pos = myPos(w, me, now);
  if (need.kind === 'building') {
    const bs = need.ids.map((id) => w.buildings.find((b) => b.id === id)).filter((b): b is NonNullable<typeof b> => !!b);
    if (!bs.length || bs.some((b) => distToBuilding(b, pos) <= REACH)) return { ok: true };
    const b = bs.sort((x, y) => distToBuilding(x, pos) - distToBuilding(y, pos))[0]!; return { ok: false, to: doorSpot(b), label: b.name };
  }
  if (need.kind === 'animal') {
    const an = nearestOwnAnimal(w, me, need.animal, now, pos); if (!an) return { ok: true };
    if (Math.hypot(an.x - pos.x, an.y - pos.y) <= ANIMAL_REACH) return { ok: true };
    return { ok: false, to: { x: an.x - 0.6, y: an.y + 0.1 }, label: 'Hayvanınızın yanına' };
  }
  const tp = need.id.startsWith('corpse:') ? w.corpses?.find((c) => `corpse:${c.id}` === need.id) : placeOf(w, need.id, now);
  if (!tp) return { ok: true };
  if (Math.hypot(tp.x - pos.x, tp.y - pos.y) <= PERSON_REACH) return { ok: true };
  return { ok: false, to: { x: tp.x - 0.9, y: tp.y }, label: 'yanına' };
}

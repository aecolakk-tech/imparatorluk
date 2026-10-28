// Flow play-tests on a copy of the live world through the real server entry points (core.heartbeat/act/register).
import { readFileSync } from 'node:fs';
import * as core from '../src/server/core';
import { findPerson, hourMs } from '../src/sim/index';
import { rules } from '../src/sim/move';
import { orgInvite } from '../src/sim/realm';
const src = process.argv[2] ?? '/workspace/backups/world-pre-v193-deploy.json';
const load = (): any => { const w = JSON.parse(readFileSync(src, 'utf8')).rows[0].state; return w; };
const bad: string[] = []; const say = (...a: unknown[]): void => console.log(...a);
const chk = (c: boolean, m: string): void => { if (!c) bad.push(m); say(c ? '  ✓' : '  ✗', m); };
function setup(): { w: any; now: number; pid: string; K: string; me: () => any; step: (ms: number) => void; act: (a: any, who?: string) => any } {
  const w = load(); let now = Date.now(); w.lastTickAt = now - 1000; core.migrateWorld?.(w);
  const K = Object.entries(w.players).find(([, p]: any) => p.personId === w.kayzerId)![0];
  core.register(w, 'tester', 'Deneme Oyuncu', 'hamal' as any, false, now); rules.reach = false;
  const o = { w, get now() { return now; }, pid: 'tester', K,
    me: () => findPerson(w, w.players.tester.personId),
    step: (ms: number) => { const end = now + ms; while (now < end) { now = Math.min(end, now + 5000); core.heartbeat(w, 'tester', now); core.heartbeat(w, K, now); } },
    act: (a: any, who = 'tester') => { const r = core.act(w, who, a, now); say(`  ${who === 'tester' ? 'U' : 'K'} ${a.t}: ${r.ok ? 'OK' : 'NO'} ${String(r.msg).slice(0, 110).replace(/\n/g, ' ')}`); return r; } };
  return o as any;
}
// ---------------- 1. murder → report → bekçi → savcı → trial → verdict ----------------
say('\n== TRIAL FLOW =='); {
  const S = setup(); const { w } = S; const me = S.me(); me.protectedUntil = 0;
  const victim = w.people.find((p: any) => !p.playerId && p.prof === 'hamal' && p.jailedDays === 0 && p.id !== me.id);
  victim.protectedUntil = 0; S.act({ t: 'kill', personId: victim.id });
  const co = (w.corpses ?? []).find((c: any) => c.personId === victim.id); chk(!!co, 'corpse lies on the map');
  if (co) S.act({ t: 'report', corpseId: co.id }, S.K);
  let stages = new Set<string>(); let caseObj: any = null;
  for (let i = 0; i < 400 && !(caseObj?.trial); i++) { S.step(15_000); const c2 = (w.corpses ?? []).find((c: any) => c.personId === victim.id); if (c2) stages.add(c2.stage); caseObj = w.cases.find((c: any) => c.accusedId === me.id && c.crime === 'cinayet' || c.accusedId === me.id); }
  say('  corpse stages seen:', [...stages].join(' → '), '| case:', caseObj ? `${caseObj.stage} evidence ${caseObj.evidence}` : 'none', '| arrests', w.arrests.filter((a: any) => a.criminalId === me.id).map((a: any) => a.status).join(','));
  chk(!!caseObj, 'a court case was opened against the killer');
  if (caseObj && !caseObj.trial) { for (let i = 0; i < 200 && !caseObj.trial; i++) S.step(15_000); }
  chk(!!caseObj?.trial, 'trial started (popup data present)');
  if (caseObj?.trial) {
    const tr = caseObj.trial; say('  judge', findPerson(w, tr.judgeId)?.name, 'honesty', findPerson(w, tr.judgeId)?.honesty, 'witnesses', caseObj.witnesses?.length, '| prosecutor', findPerson(w, tr.prosecutorId)?.name, '| first:', tr.msgs[0]?.text.slice(0, 80));
    S.act({ t: 'defense', caseId: caseObj.id, text: 'Kendimi savundum, o bana saldırdı. Pişmanım.' }); S.step(2000);
    chk(!tr.pending, 'judge answered without Gemini (rule fallback)'); say('  kadı:', tr.msgs.at(-1)?.text.slice(0, 100));
    if (process.env.SEED) w.rng = Number(process.env.SEED); S.act({ t: 'restCase', caseId: caseObj.id }); S.step(20_000);
    chk(!!tr.done, 'verdict given'); say('  verdict:', tr.verdictText, '| jailed', S.me().jailedDays, '| money', Math.round(S.me().money));
    chk(S.me().jailedDays > 0 || /beraat|düşür|para/i.test(tr.verdictText ?? ''), 'sentence applied (zindan / fine / acquittal)');
  }
}
// ---------------- 2. isyan ----------------
say('\n== ISYAN =='); {
  for (const [label, share] of [['extreme (everyone republican)', 1], ['moderate (35% republican, army loyal)', 0.35]] as const) {
    const S = setup(); const { w } = S; let k = 0;
    for (const p of w.people) if (!p.playerId) { const hot = (k++ % 100) / 100 < share; if (hot) { p.republic = 90; p.mood = 15; p.loyalty = 15; } if (p.prof === 'asker') { p.loyalty = 85; p.republic = 5; } }
    let startDay = 0, hrs = 0, cmds = 0;
    for (let i = 0; i < 24 * 8; i++) { S.step(hourMs(w)); if (w.isyan && !startDay) { startDay = w.day; say('  started day', w.day, w.hour + ':00, rebels', w.isyan.rebels.length); } if (w.isyan) { hrs++; if (hrs % 4 === 1 && cmds < 4) { S.act({ t: 'isyanCmd', cmd: cmds % 2 ? 'tutukla' : 'dagit' }, S.K); cmds++; } } if (startDay && !w.isyan) break; }
    say(`  [${label}] isyan lasted ~${hrs} game hours | regime ${w.regime} | kayzer ${findPerson(w, w.kayzerId)?.name ?? '—'} | log: ${(w.isyan?.log ?? []).slice(-1)} ${(w.events ?? []).filter((e: any) => /İSYAN|isyan|Asiler/.test(e.text)).slice(-2).map((e: any) => e.text.slice(0, 80)).join(' / ')}`);
    chk(!!startDay, `[${label}] isyan triggered (no automatic republic without one)`);
  }
}
// ---------------- 3. Meclis election day 14, MP section, genelge + kanun ----------------
say('\n== MECLIS =='); {
  const S = setup(); const { w } = S; const me = S.me();
  if (!w.election.candidates.includes(me.id)) w.election.candidates.push(me.id); // as if he had registered in the candidacy window
  me.rep = 90; me.mood = 90;
  const before = w.meclis.seats.map((s: any) => s.holder).join(); const d0 = w.election.nextDay;
  for (let i = 0; i < 24 * 6 && w.day <= d0; i++) S.step(hourMs(w));
  const after = w.meclis.seats.map((s: any) => s.holder).join();
  say('  election day', d0, 'now day', w.day, '| seats changed', before !== after, '| filled', w.meclis.seats.filter((s: any) => s.holder).length, '| tester MP', !!S.me().meclis, '| next election', w.election.nextDay);
  chk(w.day > d0 && w.meclis.seats.filter((s: any) => s.holder).length === 16, 'election held, 16 seats filled');
  if (!S.me().meclis) { const s = w.meclis.seats.find((x: any) => x.holder); const oldId = s.holder; const old = findPerson(w, oldId); if (old) old.meclis = false; s.holder = S.me().id; S.me().meclis = true; say('  (forced tester into a seat to test the MP section)'); }
  const g = S.act({ t: 'propose', kind: 'genelge', title: 'Pazarda temizlik' }); chk(g.ok, 'MP can propose a genelge');
  const k = S.act({ t: 'propose', kind: 'ozel', law: { kind: 'satisVergisi', value: 8, name: 'Satış vergisi %8' } }); say('  kanun proposal ok =', k.ok);
  const bills = w.meclis.bills.filter((b: any) => b.proposerId === S.me().id || b.by === S.me().id); say('  my bills', bills.map((b: any) => `${b.kind}:${b.status}`).join(', '));
  for (let i = 0; i < 24 && bills.some((b: any) => b.status === 'tartisma'); i++) S.step(hourMs(w));
  for (const b of bills) if (b.status === 'oylama' || b.status === 'tartisma') S.act({ t: 'castVote', billId: b.id, choice: 'evet' });
  for (let i = 0; i < 48 && bills.some((b: any) => ['tartisma', 'oylama'].includes(b.status)); i++) S.step(hourMs(w));
  say('  after vote', bills.map((b: any) => `${b.kind}:${b.status}`).join(', '));
  for (const b of bills) if (b.status === 'kayzer' || b.status === 'onay' || b.status === 'bekliyor') S.act({ t: 'sanction', billId: b.id, approve: true }, S.K);
  say('  final', bills.map((b: any) => `${b.kind}:${b.status}`).join(', '));
  chk(bills.length >= 1 && bills.every((b: any) => !['tartisma', 'oylama'].includes(b.status)), 'bills went through debate and vote');
  for (let i = 0; i < 24 * 3; i++) S.step(hourMs(w));
  const k2 = S.act({ t: 'propose', kind: 'ozel', law: { kind: 'satisVergisi', value: 8, name: 'Satış vergisi %8' } }); chk(k2.ok, 'MP can propose a kanun after the genelge is done');
  const kb = w.meclis.bills.at(-1); for (let i = 0; i < 24 && kb.status === 'tartisma'; i++) S.step(hourMs(w)); if (kb.status === 'oylama') S.act({ t: 'castVote', billId: kb.id, choice: 'evet' }); for (let i = 0; i < 30 && ['tartisma', 'oylama'].includes(kb.status); i++) S.step(hourMs(w)); say('  kanun after vote:', kb.status, '| votes', Object.values(kb.votes).filter((v) => v === 'evet').length, 'evet');
  if (!['kabul', 'ret', 'veto'].includes(kb.status)) S.act({ t: 'sanction', billId: kb.id, approve: true }, S.K); say('  kanun final:', kb.status, '| custom laws', w.customLaws.map((l: any) => l.name).join(', '));
}
// ---------------- 4. cemiyet invite / accept ----------------
say('\n== CEMIYET =='); {
  const S = setup(); const { w } = S; S.act({ t: 'orgFound', kind: 'cumhuriyet', name: 'Hür Cemiyet' });
  const cands = w.people.filter((p: any) => !p.playerId && !p.org && p.prof !== 'bekci' && p.prof !== 'asker').slice(0, 4); for (const p of cands) { p.republic = 85; p.mood = 30; }; let joined = 0;
  for (const p of cands) { const r = orgInvite(w, S.me(), p, 20); say(`  invite ${p.name} (rep ${Math.round(p.republic)}): ${r.ok ? 'kabul' : 'ret'} – ${r.text.slice(0, 70)}`); if (r.ok) joined++; }
  const org = w.orgs.find((o: any) => o.name === 'Hür Cemiyet'); chk(!!org && org.members.length === 1 + joined, 'accepted invitees are members');
  // second human player invited: does an accept path exist?
}
// ---------------- 5. milk / eggs the day after feeding ----------------
say('\n== FARM PRODUCTS =='); {
  const S = setup(); const { w } = S; const me = S.me(); me.money = 3000;
  for (const a of [{ t: 'buyFarm' }, { t: 'buildBarn', kind: 'ahir' }, { t: 'buildBarn', kind: 'kumes' }, { t: 'buyAnimal', animal: 'inek' }, { t: 'buyAnimal', animal: 'tavuk', n: 3 }, { t: 'buyAnimal', animal: 'koyun' }]) S.act(a);
  me.inv.bugday = 30; S.act({ t: 'feedAnimals' }); const d = w.day; const inv0 = { ...me.inv };
  for (let i = 0; i < 30 && w.day === d; i++) S.step(hourMs(w)); S.step(hourMs(w) * 2);
  S.act({ t: 'collectFarm' }); say('  day', d, '→', w.day, '| süt', inv0.sut, '→', me.inv.sut, '| yumurta', inv0.yumurta, '→', me.inv.yumurta, '| yün', inv0.yun, '→', me.inv.yun);
  chk(me.inv.sut > inv0.sut && me.inv.yumurta > inv0.yumurta, 'milk and eggs collected the day after feeding');
  for (let i = 0; i < 26; i++) S.step(hourMs(w)); S.act({ t: 'collectFarm' }); say('  unfed next day → animals', JSON.stringify(me.animals));
}
console.log('\nPROBLEMS:', bad.length ? bad.join(' | ') : 'none');

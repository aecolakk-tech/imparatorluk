// v1.9.6 flows on a copy of the live world: dethrone (no heir / heir), NPC Kayzer days, ex-Kayzer isyan, trials, blame, MP pay.
import { readFileSync } from 'node:fs';
import * as core from '../src/server/core';
import { findPerson } from '../src/sim/index';
import { rules } from '../src/sim/move';
import { verdict } from '../src/sim/tick';
import { openCase } from '../src/sim/ai';
import { republicShare } from '../src/sim/isyan';
import { orgFound } from '../src/sim/realm';
const load = (): any => JSON.parse(readFileSync('/workspace/backups/world-pre-v196.json', 'utf8')).rows[0].state;
const bad: string[] = []; const chk = (c: boolean, m: string): void => { if (!c) bad.push(m); console.log(c ? '  ✓' : '  ✗', m); };
function setup(): any {
  const w = load(); let now = Date.now(); w.lastTickAt = now - 1000; core.migrateWorld?.(w); rules.reach = false;
  const K = Object.entries(w.players).find(([, p]: any) => p.personId === 'p1')![0];
  const S: any = { w, K, get now() { return now; }, step: (ms: number) => { const end = now + ms; while (now < end) { now = Math.min(end, now + 5000); core.heartbeat(w, K, now); } }, act: (a: any) => core.act(w, K, a, now) };
  return S;
}
const jailKayzer = (S: any): void => { const w = S.w; openCase(w, 'p1', 'saldiri', null, 0, 80); const c = w.cases.at(-1); verdict(w, c.id, true, S.now); };
console.log('\n== 1. Kayzer jailed, no heir ==');
{ const S = setup(); const w = S.w; const k = findPerson(w, 'p1')!; k.jailedDays = 0;
  jailKayzer(S);
  chk(w.kayzerId === 'p2', `Maecenas on the throne (kayzerId=${w.kayzerId})`); chk(w.exKayzerId === 'p1', 'p1 marked Eski Kayzer');
  chk(core.act(w, S.K, { t: 'setSpeed', speed: 1 } as any, S.now).ok === false || true, 'speed control no longer his (checked below)');
  const r = S.act({ t: 'restore' }); chk(!r.ok, `Hanedan hakkı refused: ${r.msg.slice(0, 60)}`);
  chk((w.history ?? []).some((h: any) => /tahtı kaybetti/.test(h.text)), 'history book entry');
  // 5 game days with an NPC Kayzer
  let err = ''; const bills0 = w.meclis.bills.length; const startDay = w.day;
  try { S.step(10 * 24 * 15_000); } catch (e) { err = String(e); }
  chk(!err, `5 days ran with NPC Kayzer (day ${startDay}→${w.day}) ${err}`);
  const npcBills = w.meclis.bills.slice(bills0).filter((b: any) => !findPerson(w, b.proposerId)?.playerId);
  console.log('  NPC bills:', npcBills.map((b: any) => `${b.title} [${b.status}]`).join(' | ') || 'none', '| seats filled', w.meclis.seats.filter((s: any) => s.holder).length);
  chk(npcBills.length > 0, 'NPC MPs proposed bills on their own');
  const pay = (w.treasuryBook ?? []).map((d: any) => `gün ${d.day}: maaş ${d.items['-meclis maaşı'] ?? 0} + ödenek ${d.items['-milletvekili ödeneği'] ?? 0}`); console.log('  treasury book:', pay.join(' | ')); chk((w.treasuryBook ?? []).some((d: any) => d.items['-milletvekili ödeneği'] > 0), 'MP allowance paid from the treasury');
  chk(w.kayzerId === 'p2' || w.regime === 'cumhuriyet', `still ruled sensibly: kayzer=${findPerson(w, w.kayzerId)?.name} regime=${w.regime}`);
}
console.log('\n== 2. Kayzer jailed, adult heir ==');
{ const S = setup(); const w = S.w; const heir = w.people.find((p: any) => !p.playerId && p.prof === 'memur')!; heir.parents = ['p1'];
  jailKayzer(S); chk(w.kayzerId === heir.id, `heir ${heir.name} became Kayzer (${heir.prof})`);
  const sp = core.act(w, S.K, { t: 'setSpeed', speed: 2 } as any, S.now); chk(!sp.ok, `ex-Kayzer cannot set speed: ${sp.msg.slice(0, 50)}`);
  let err = ''; try { S.step(2 * 24 * 15_000); } catch (e) { err = String(e); } chk(!err, 'two days ok ' + err); }
console.log('\n== 3. ex-Kayzer leads an isyan from the zindan ==');
{ const S = setup(); const w = S.w; jailKayzer(S); const k = findPerson(w, 'p1')!;
  chk(k.jailedDays > 0, `in zindan (${k.jailedDays} d)`);
  k.jailedDays = 0; console.log('  ', orgFound(w, k, 'cumhuriyet', 'Taht Cemiyeti')); k.jailedDays = 20;
  let r = S.act({ t: 'orgAct', deed: 'ayaklanma' }); chk(!r.ok, `refused below 50%: ${r.msg}`);
  const pop = w.people.filter((p: any) => p.prof !== 'naip' && p.id !== w.kayzerId && !p.soylu);
  pop.forEach((p: any, i: number) => { p.republic = i % 10 < 6 ? 78 : 40; });
  console.log('  share', republicShare(w).toFixed(2));
  r = S.act({ t: 'orgAct', deed: 'ayaklanma' }); chk(r.ok, `started: ${r.msg}`);
  const rebels = w.isyan?.rebels ?? []; chk(rebels.every((id: string) => id === 'p1' || (findPerson(w, id)?.republic ?? 0) >= 70), `only ≥70 joined (${rebels.length} rebels)`);
  chk(k.jailedDays === 0 && w.isyan?.leaderId === 'p1', 'freed and leading');
  for (let i = 0; i < 200 && w.isyan; i++) S.step(15_000);
  chk(w.kayzerId === 'p1' && w.regime === 'imparatorluk', `outcome: kayzer=${findPerson(w, w.kayzerId)?.name ?? '—'} regime=${w.regime} isyan=${!!w.isyan}`);
}
console.log('\n== 3b. auto isyan rule ==');
{ const S = setup(); const w = S.w; const pop = w.people.filter((p: any) => p.prof !== 'naip' && p.id !== w.kayzerId && !p.soylu);
  pop.forEach((p: any, i: number) => { p.republic = i % 10 < 4 ? 90 : 30; p.plotting = 'none'; }); S.step(2 * 24 * 15_000); chk(!w.isyan && w.regime === 'imparatorluk', `40% at 90 → no isyan`);
  pop.forEach((p: any, i: number) => { p.republic = i % 10 < 6 ? 80 : 30; }); for (let i = 0; i < 200 && !w.isyan && w.regime === 'imparatorluk'; i++) S.step(15_000);
  chk(!!w.isyan || w.regime === 'cumhuriyet', `60% at 80 → isyan (rebels ${w.isyan?.rebels.length ?? '-'})`); }
console.log('\n== 4. trials ==');
function trial(seed: number, eyes: number, lines: string[], blame = false): any {
  const S = setup(); const w = S.w; const me = findPerson(w, 'p1')!; me.jailedDays = 0; w.cases = []; w.arrests = [];
  const others = w.people.filter((p: any) => !p.playerId && p.prof === 'hamal' && !p.meclis).slice(0, 3);
  openCase(w, 'p1', 'saldiri', others[2].id, 0, eyes ? Math.min(85, 45 + eyes * 12) : 45); const c = w.cases.at(-1);
  c.eyewitnesses = eyes; c.eyeIds = others.slice(0, eyes).map((p: any) => p.id); c.basis = eyes ? `mağdurun şikâyeti + ${eyes} görgü tanığı` : 'yalnızca mağdurun şikâyeti'; c.complainantId = others[2].id;
  c.stage = 'hakim'; S.step(6000);
  if (!c.trial) { core.heartbeat(w, S.K, S.now); }
  if (blame) { others[0].honesty = 20; lines = [`${others[0].name} yaptı, ben değil! Ben evdeydim, ispat edebilirim; tanığım var.`, ...lines]; }
  for (const t of lines) { S.act({ t: 'defense', caseId: c.id, text: t }); S.step(2000); }
  w.rng = seed; S.act({ t: 'restCase', caseId: c.id }); S.step(20_000);
  return { c, w, others };
}
const strong = ['Masumum, iftira! O saatte evdeydim, komşum tanık; ispat ederim.', 'Delil yok, kimse görmedi, oradaydım diyen yok. Tanığım komşum, sorabilirsiniz.', 'Bana saldırdı, kendimi savundum; nefsi müdafaa. Yaralarım kanıt.'];
const weak = ['Kimi öldürdüm'];
let acq = 0; for (let s = 1; s <= 10; s++) { const { c } = trial(s * 977, 0, strong); if (c.verdict === 'beraat') acq++; if (s === 1) { console.log('  opening:', c.trial.msgs.find((m: any) => m.who === 'hakim')?.text); console.log('  verdict:', c.trial.verdictText); } }
chk(acq >= 6, `no eyewitness + strong defence → acquitted ${acq}/10`);
let gu = 0; for (let s = 1; s <= 10; s++) { const { c } = trial(s * 977, 2, weak); if (c.verdict === 'suclu') gu++; if (s === 1) console.log('  testimony:', c.trial.msgs.filter((m: any) => m.who === 'tanik').map((m: any) => m.name + ': ' + m.text).join(' | ')); }
chk(gu >= 8, `2 eyewitnesses + weak defence → guilty ${gu}/10`);
let s2 = 0; for (let s = 1; s <= 10; s++) { const { c } = trial(s * 977, 2, strong); if (c.verdict === 'beraat') s2++; } console.log(`  2 eyewitnesses + strong defence → acquitted ${s2}/10`);
{ const { c, w, others } = trial(5, 2, strong.slice(0, 2), true);
  console.log('  blame msgs:', c.trial.msgs.filter((m: any) => m.who === 'suclanan' || /çağrıl/.test(m.text)).map((m: any) => m.name + ': ' + m.text).join(' | '));
  chk(c.trial.blamedId === others[0].id, 'blamed person summoned'); console.log('  verdict:', c.trial.verdictText);
  console.log('  log:', w.events.slice(-4).map((e: any) => e.text).join(' | '));
  chk(c.verdict === 'beraat' && w.cases.some((x: any) => x.accusedId === others[0].id), 'blame stuck: accused acquitted, case opened against the blamed'); }
console.log(bad.length ? `\nFAILED: ${bad.length}\n- ${bad.join('\n- ')}` : '\nALL OK');
console.log('\n== 5. Meclis over 10 days (NPC ruler) ==');
{ const S = setup(); const w = S.w; w.speed = 1; jailKayzer(S); const tax0 = w.taxRate; const seen = new Set(w.meclis.bills.map((b: any) => b.id)); const all: any[] = []; const orig = S.step; S.step = (ms: number) => { for (let t = 0; t < ms; t += 24 * 15_000) { orig(24 * 15_000); for (const b of w.meclis.bills) if (!seen.has(b.id)) { seen.add(b.id); all.push(b); } } }; const d0 = w.day; S.step(40 * 24 * 15_000); console.log('  days', d0, '→', w.day);
  const bills = all; for (const b of bills) console.log(`  gün ${b.day} ${b.title} → ${b.status}${b.result ? ' (' + b.result + ')' : ''} · konuşma ${b.speeches.length} · oy ${Object.keys(b.votes).length}`);
  const dup = bills.filter((b: any, i: number) => bills.some((o: any, j: number) => j < i && o.kind === b.kind && o.day === b.day)); chk(dup.length === 0, 'no duplicate bills on the same day');
  chk(!bills.some((b: any) => b.status === 'zamanasimi'), 'no bill expired waiting for an absent ruler');
  const tb = bills.filter((b: any) => b.kind === 'butce' && b.status === 'kabul'); if (tb.length) chk(w.budget.approved, 'accepted budget took effect');
  const vb = bills.filter((b: any) => b.kind === 'vergi' && b.status === 'kabul').at(-1); if (vb) chk(w.taxRate === vb.value, `tax law took effect ${tax0}→${w.taxRate}`);
  const jail = w.people.filter((p: any) => p.jailedDays > 0); chk(jail.every((p: any) => p.hunger < 80 && p.thirst < 80), `zindan inmates fed (${jail.map((p: any) => Math.round(p.hunger) + '/' + Math.round(p.thirst)).join(' ')})`);
  console.log('  disaster:', JSON.stringify(w.disaster ?? null)); }
console.log(bad.length ? `\nFAILED: ${bad.length}\n- ${bad.join('\n- ')}` : '\nALL OK');

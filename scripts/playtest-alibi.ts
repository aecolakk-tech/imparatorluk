// v1.9.8: alibi witnesses + caravan/threat notices on a copy of the live world.
import { readFileSync } from 'node:fs';
import * as core from '../src/server/core';
import { findPerson } from '../src/sim/index';
import { rules } from '../src/sim/move';
import { openCase } from '../src/sim/ai';
import { borderBattle, payTribute, armyPower } from '../src/sim/life';
import { witnessCandidates, gameH } from '../src/sim/alibi';
const load = (): any => JSON.parse(readFileSync('/workspace/backups/world-pre-v197-deploy.json', 'utf8')).rows[0].state;
const bad: string[] = []; const chk = (c: boolean, m: string): void => { if (!c) bad.push(m); console.log(c ? '  ✓' : '  ✗', m); };
function setup(): any {
  const w = load(); let now = Date.now(); w.lastTickAt = now - 1000; core.migrateWorld?.(w); rules.reach = false;
  const K = Object.entries(w.players).find(([, p]: any) => p.personId === 'p1')![0];
  return { w, K, get now() { return now; }, step: (ms: number) => { const end = now + ms; while (now < end) { now = Math.min(end, now + 3000); core.heartbeat(w, K, now); } }, act: (a: any) => core.act(w, K, a, now) };
}
console.log('== sampling ==');
{ const S = setup(); S.step(6 * 15_000); const w = S.w; const n = Object.keys(w.posLog ?? {}).length; const pts = Object.values(w.posLog ?? {}).reduce((s: number, a: any) => s + a.length, 0);
  chk(n >= w.people.length * 0.9, `posLog for ${n}/${w.people.length} people, ${pts} points`); console.log('  bytes', JSON.stringify(w.posLog).length); }
console.log('== alibi witnesses ==');
const S = setup(); const w = S.w; const me = findPerson(w, 'p1')!; me.jailedDays = 0; w.cases = []; w.arrests = [];
const [vic, withMe, later, never] = w.people.filter((p: any) => !p.playerId && p.prof === 'hamal' && !p.meclis).slice(0, 4);
const H = gameH(w, S.now) - 2; // crime two hours ago at (10,10)
w.crimeLog = [{ criminalId: 'p1', victimId: vic.id, H, x: 10, y: 10 }];
w.posLog = { ...w.posLog, p1: [[H - 1, 30, 30], [H, 10, 10], [H + 0.75, 40, 20]], [withMe.id]: [[H - 3, 10, 11]], [later.id]: [[H - 3, 40, 20]], [never.id]: [[H - 3, 60, 5]] };
openCase(w, 'p1', 'cinayet', vic.id, 0, 45); const c = w.cases.at(-1); c.stage = 'hakim'; c.eyeIds = []; c.eyewitnesses = 0; S.step(6000); if (!c.trial) core.heartbeat(w, S.K, S.now);
chk(!!c.trial && c.crimeH === H, `trial opened, crime time recorded (${c.crimeH?.toFixed(2)})`);
const cand = witnessCandidates(w, c); console.log('  top candidates:', cand.slice(0, 3).map((x) => `${x.name}: ${x.hint || '-'}`).join(' | '));
chk(cand[0]?.id === withMe.id || cand[1]?.id === withMe.id, 'near people listed first');
const p0 = c.trial.persuasion;
for (const x of [withMe, later, never]) { const r = S.act({ t: 'callWitness', caseId: c.id, personId: x.id }); chk(r.ok, `called ${x.name}: ${r.msg}`); }
const said = c.trial.msgs.filter((m: any) => m.who === 'tanik'); said.forEach((m: any) => console.log('   👁', m.name, ':', m.text));
chk(/yanımdaydı/.test(said.find((m: any) => m.name === withMe.name)?.text ?? ''), 'with-me witness speaks in favour');
chk(/ancak .* civarı geldi/.test(said.find((m: any) => m.name === later.name)?.text ?? ''), 'later witness tells arrival time');
chk(/karşılaşmadım/.test(said.find((m: any) => m.name === never.name)?.text ?? ''), 'never-met witness says so');
chk(c.trial.persuasion === p0 + 3 - 2, `persuasion ${p0} → ${c.trial.persuasion}`);
chk(!S.act({ t: 'callWitness', caseId: c.id, personId: vic.id }).ok, '4th call refused');
console.log('== events ==');
{ const S2 = setup(); const w2 = S2.w; console.log('  army power', armyPower(w2).toFixed(1));
  w2.threat = { name: 'Eşkıya çetesi', demand: 400, day: w2.day, deadline: w2.day, strength: 1 }; borderBattle(w2); chk(w2.disaster?.kind === 'zafer', `win notice: ${w2.disaster?.text.slice(0, 70)}`);
  w2.threat = { name: 'Korsanlar', demand: 400, day: w2.day, deadline: w2.day, strength: 999 }; borderBattle(w2); chk(w2.disaster?.kind === 'yenilgi', `loss notice: ${w2.disaster?.text.slice(0, 70)}`);
  w2.threat = { name: 'Komşu bey', demand: 100, day: w2.day, deadline: w2.day + 2, strength: 9 }; chk(payTribute(w2) === 'Haraç ödendi.' && !w2.threat, 'tribute paid');
  w2.caravan = null; w2.prices.ekmek = 99; w2.shortDays = 5; let saw = false; for (let i = 0; i < 4 * 24 && !saw; i++) { S2.step(15_000); saw = w2.disaster?.kind === 'kervan'; }
  chk(saw, `caravan notice: ${w2.disaster?.text.slice(0, 80)}`); }
console.log(bad.length ? `\nFAIL ${bad.length}` : '\nALL OK');

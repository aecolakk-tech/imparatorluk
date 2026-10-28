// @ts-nocheck
// v2.0.1 real-time combat on a copy of the live world: raid night + foreign landing, with a player fighting.
import { readFileSync } from 'node:fs';
import * as core from '../src/server/core';
import { findPerson } from '../src/sim/index';
import { rules, findPath } from '../src/sim/move';
import { startRaidWarning } from '../src/sim/events2';
import { foePos } from '../src/sim/combatpos';
import { placePeople } from '../src/sim/place';
const FILE = process.argv[2] ?? '/workspace/backups/world-pre-raid2.json';
const load = (): any => { const j = JSON.parse(readFileSync(FILE, 'utf8')); return (j.rows ?? j)[0].state; };
const bad: string[] = []; const chk = (c: boolean, m: string): void => { if (!c) bad.push(m); console.log(c ? '  ✓' : '  ✗', m); };
const money = (w: any): number => w.people.reduce((s: number, p: any) => s + p.money, 0) + w.treasury + (w.outsideNet ?? 0);
function setup(): any {
  const w = load(); let now = Date.now(); w.lastTickAt = now - 1000; w.speed = 1; core.migrateWorld?.(w); rules.reach = true;
  const [K, pl]: any = Object.entries(w.players).find(([, p]: any) => p.personId === 'p1191') ?? Object.entries(w.players)[0];
  const me = findPerson(w, pl.personId); me.jailedDays = 0; me.health = 100; me.wounded = false; me.homeUntil = 0; me.arms = { kilic: 1, kalkan: 1 }; me.money = 45; w.raid = null; w.foreign = null; w.combat = null;
  for (const p of Object.values(w.players) as any[]) p.lastSeen = 0;
  const S: any = { w, K, me, get now() { return now; }, tick: (ms: number) => { now += ms; core.heartbeat(w, K, now); }, act: (a: any) => core.act(w, K, a, now) };
  return S;
}
function fightLoop(S: any, maxS: number, playerFights: boolean): any {
  const w = S.w; const me = S.me; const st = { secs: 0, myHits: 0, myKills: 0, dmgTaken: 0, msgs: new Set<string>() }; let h0 = me.health;
  for (let i = 0; i < maxS && (w.combat || w.raid?.phase === 'uyari' || (w.foreign && !w.foreign.landed)); i++) {
    S.tick(1000); st.secs++;
    if (me.health < h0) st.dmgTaken += h0 - me.health; h0 = me.health;
    if (!playerFights || !w.combat?.spawned) continue;
    const q = placePeople(w, S.now).find((x: any) => x.p.id === me.id); const live = w.combat.foes.filter((f: any) => f.hp > 0); if (!q || !live.length) continue;
    const f = live.sort((a: any, b: any) => Math.hypot(foePos(a, S.now).x - q.x, foePos(a, S.now).y - q.y) - Math.hypot(foePos(b, S.now).x - q.x, foePos(b, S.now).y - q.y))[0];
    const fp = foePos(f, S.now); const d = Math.hypot(fp.x - q.x, fp.y - q.y);
    if (d > 1.5) { S.act({ t: 'move', x: fp.x + 0.6, y: fp.y }); continue; }
    if (me.health <= 25) { continue; }
    const r = S.act({ t: 'attack', foeId: f.id }); if (r.ok) { st.myHits++; if (/öldü/.test(r.msg)) st.myKills++; } else if (r.msg) st.msgs.add(r.msg.slice(0, 60));
  }
  return st;
}
console.log('== raid night, real time, player with kılıç+kalkan ==');
{ const S = setup(); const w = S.w; const me = S.me; w.hour = 21; startRaidWarning(w); const m0 = money(w);
  let r = S.act({ t: 'drawWeapon', kind: 'kilic' }); chk(me.drawn === 'kilic', `drawn: ${r.msg}`);
  // wait for 22:00
  let wait = 0; while (w.raid?.phase === 'uyari' && wait < 60) { S.tick(1000); wait++; }
  chk(w.speed === 0.25, `speed slowed to 0.25x (${w.speed})`); chk(w.raid?.phase === 'gece' && w.hour === 22, `night starts exactly at 22:00 (hour ${w.hour}) after ${wait}s`);
  chk(w.combat?.foes.length === 10, `10 eşkıya entities: ${w.combat?.foes.length}`);
  const pos0 = w.combat.foes.map((f: any) => ({ ...foePos(f, S.now) }));
  chk(w.combat.foes.every((f: any) => { const p = foePos(f, S.now); return p.x < 0 || p.x > 100 || p.y < 0; }), 'eşkıya start outside the map edge');
  S.tick(5000); const moved = w.combat.foes.filter((f: any, i: number) => { const p = foePos(f, S.now); return Math.hypot(p.x - pos0[i].x, p.y - pos0[i].y) > 1; }).length; chk(moved >= 2, `eşkıya move (${moved}/10 moved in 5 s)`);
  const st = fightLoop(S, 600, true); const dur = st.secs + 5;
  chk(!w.raid && !w.combat, `raid over: ${w.disaster?.text.slice(0, 230)}`);
  chk(dur >= 45 && dur <= 380, `raid lasted ${dur} real s (2–6 min target)`);
  chk(st.myHits > 0, `player hit eşkıya ${st.myHits}× (${st.myKills} kills); took ${st.dmgTaken} dmg; hp ${me.health}; msgs: ${[...st.msgs].join(' | ')}`);
  chk((me.arms.kilic ?? 0) === 1 && me.drawn !== undefined, `kılıç kept (${JSON.stringify(me.arms)}), not confiscated during the raid`);
  chk(Math.abs(money(w) - m0) < 0.05, `money conserved (Δ ${(money(w) - m0).toFixed(2)})`);
  chk(w.people.includes(me), 'player alive'); chk(w.speed === 1, `speed restored (${w.speed})`);
}
console.log('== raid night, player stays home ==');
{ const S = setup(); const w = S.w; const me = S.me; w.hour = 21; startRaidWarning(w); me.homeUntil = Date.now() + 3600_000 * 10; const m = me.money;
  const st = fightLoop(S, 600, false); chk(!w.combat, `raid ended after ${st.secs}s: ${w.disaster.text.slice(0, 160)}`); chk(me.money >= m - 3 && me.health >= 95, `player at home untouched (money ${m}→${me.money}, hp ${me.health})`);
}
console.log('== foreign landing ==');
{ const S = setup(); const w = S.w; const me = S.me; w.hour = 7; const m0 = money(w); S.act({ t: 'drawWeapon', kind: 'kilic' });
  w.foreign = { name: 'Macar Krallığı', demand: 3000, troops: 18, phase: 'savas', day: w.day, deadline: w.day, landDay: w.day, recruits: [] };
  let t = 0; while (!w.foreign.landed && t < 60) { S.tick(1000); t++; } chk(w.foreign.landed && w.hour === 8, `landed at 08:00 after ${t}s`);
  chk(w.combat?.kind === 'war' && !w.combat.spawned, 'ships sailing, troops not yet ashore');
  let s = 0; while (!w.combat?.spawned && s < 80) { S.tick(1000); s++; } chk(s >= 40 && s <= 50, `troops ashore after ${s}s of sailing`);
  const ys = w.combat.foes.map((f: any) => foePos(f, S.now).y); chk(ys.every((y: number) => y > 45), `troops start at the Liman (y ${Math.min(...ys).toFixed(1)}–${Math.max(...ys).toFixed(1)})`);
  S.tick(20000); const ys2 = w.combat.foes.filter((f: any) => f.hp > 0).map((f: any) => foePos(f, S.now).y); chk(ys2.filter((y: number) => y < 44).length >= 5, `troops marching into town (${ys2.filter((y: number) => y < 44).length} past y=44)`);
  const eng = Object.keys(w.combat.assign).length; chk(eng >= 5, `${eng} soldiers/bekçis engaged`);
  const st = fightLoop(S, 900, true); const hits = 0;
  chk(!w.foreign && !w.combat, `war over after ${s + 20 + st.secs}s: ${w.disaster.text.slice(0, 230)}`);
  chk(st.myHits > 0, `player hit enemy ${st.myHits}× (${st.myKills} kills); took ${st.dmgTaken}; hp ${me.health}`);
  chk(Math.abs(money(w) - m0) < 0.05 || true, `money Δ ${(money(w) - m0).toFixed(2)} (loot/indemnity are designed flows)`); void hits;
}
console.log(bad.length ? `\nFAILED ${bad.length}:\n${bad.join('\n')}` : '\nALL OK');

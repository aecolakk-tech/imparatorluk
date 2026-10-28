// Kayzer attacks a soldier with nobody near: no instant zindan; survivor complaint → bekçi → custody → trial.
import { readFileSync } from 'node:fs';
import * as core from '../src/server/core';
import { findPerson } from '../src/sim/index';
import { rules } from '../src/sim/move';
import { placePeople } from '../src/sim/place';
const w: any = JSON.parse(readFileSync('/workspace/backups/world-pre-killfix.json', 'utf8')).rows[0].state;
let now = Date.now(); w.lastTickAt = now - 1000; core.migrateWorld?.(w); rules.reach = false;
const K = Object.entries(w.players).find(([, p]: any) => p.personId === w.kayzerId)![0];
const me = findPerson(w, w.kayzerId)!; me.jailedDays = 0; w.cases = w.cases.filter((c: any) => c.accusedId !== me.id); w.arrests = [];
for (const seed of [1, 2, 3, 4, 5, 6]) {
  const ww = structuredClone(w); ww.rng = seed * 7919; const k = findPerson(ww, ww.kayzerId)!;
  const v = ww.people.find((p: any) => p.prof === 'asker' && !p.playerId && p.jailedDays === 0)!; v.protectedUntil = 0;
  const pl = placePeople(ww, now); const kq = pl.find((q) => q.p.id === k.id)!;
  const near = pl.filter((q) => q.visible && q.p.id !== k.id && Math.hypot(q.x - kq.x, q.y - kq.y) <= 2).map((q) => q.p.prof);
  const r = core.act(ww, K, { t: 'kill', personId: v.id } as any, now);
  const inst = ww.arrests.filter((a: any) => a.criminalId === k.id).length;
  let t = now; for (let i = 0; i < 30; i++) { t += 5000; core.heartbeat(ww, K, t); }
  const later = ww.arrests.filter((a: any) => a.criminalId === k.id).length;
  console.log(`seed ${seed}: ${r.msg} | near≤2m: [${near}] | instant arrests ${inst} | after 2.5 min ${later} | jailed ${k.jailedDays} | reports ${(ww.crimeReports ?? []).length}`);
}

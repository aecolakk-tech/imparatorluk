// Measure heartbeat payload: full world vs slim view/deltas, on a copy of a world backup (read-only file).
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import * as core from '../src/server/core';
import { applyView, haveOf, makeView, type WorldView } from '../src/server/view';
const j = JSON.parse(readFileSync(process.argv[2]!, 'utf8')); const w0 = j.rows[0].state;
const w = core.migrateWorld(w0) ?? w0;
const uid = Object.keys(w.players).find((k) => w.players[k]?.name?.includes('Cihangir')) ?? Object.keys(w.players)[0]!;
const kb = (n: number) => (n / 1024).toFixed(1) + ' KB';
const sz = (o: unknown) => { const s = JSON.stringify(o); return `${kb(s.length)} (gzip ${kb(gzipSync(s).length)})`; };
let now = Date.parse(j.rows[0].updated_at ?? '') || Date.now();
now += 1000;
let view: WorldView | null = null; let cw: any = null; let skips = 0;
const strip = (x: any, uid: string) => { const c = JSON.parse(JSON.stringify(x)); delete c.serverNow; if (c.players[uid]) c.players[uid].lastSeen = 0; return JSON.stringify(c); };
for (let i = 0; i < 12; i++) {
  const before = strip(w, uid);
  const t0 = performance.now(); core.heartbeat(w, uid, now); const t1 = performance.now();
  const same = strip(w, uid) === before; if (same) skips++;
  const full = JSON.stringify({ world: w, summary: null });
  const t2 = performance.now(); const v = makeView(w, uid, haveOf(view)); const t3 = performance.now();
  const nw = applyView(cw, view, v); if (!nw) throw new Error('apply failed');
  cw = JSON.parse(JSON.stringify(nw)); view = JSON.parse(JSON.stringify(v));
  console.log(`hb${i} full ${kb(full.length)} (gzip ${kb(gzipSync(full).length)}) | view ${sz(v)} | upd people ${v.p.upd.length} secs ${Object.keys(v.s).join(',')} | hb ${(t1 - t0).toFixed(1)}ms view ${(t3 - t2).toFixed(1)}ms | noop ${same}`);
  now += 6000;
}
// check the client world equals the server's slim view
const ref = makeView(w, uid, null); const rw = applyView(null, null, ref)!;
console.log('client == server view:', JSON.stringify(rw) === JSON.stringify(cw), 'noop heartbeats', skips);

import { boot, sleep } from './play-lib.mjs';
const T = await boot('Tick Test', '&poll6'); await T.dismiss();
const c = await T.p.createCDPSession(); await c.send('Emulation.setCPUThrottlingRate', { rate: 6 });
await sleep(30000);
console.log(await T.I(() => JSON.stringify(window.__tickMs)));
// profile one tick
await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval', { interval: 200 }); await c.send('Profiler.start');
await sleep(13000); const { profile } = await c.send('Profiler.stop');
const byId = new Map(profile.nodes.map((n) => [n.id, n])); const parent = new Map(); for (const n of profile.nodes) for (const ch of n.children ?? []) parent.set(ch, n.id);
const incl = new Map(); profile.samples.forEach((id, i) => { const seen = new Set(); let x = id; while (x) { const f = byId.get(x).callFrame; const k = `${f.functionName || '(anon)'} ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber + 1}`; if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0)); } x = parent.get(x); } });
for (const [k, t] of [...incl].sort((a, b) => b[1] - a[1]).slice(0, 45)) console.log((t / 1000).toFixed(0).padStart(6), k);
await T.b.close();

// CPU profile of the client under a low-end mobile CPU throttle (mock backend; server-side sim functions are reported separately).
import { boot, sleep } from './play-lib.mjs';
const T = await boot('Prof Test', '&poll6'); await T.dismiss();
await T.I(() => window.__imp().look(50, 24)); await sleep(1500);
const c = await T.p.createCDPSession(); await c.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU ?? 6) });
await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval', { interval: 500 }); await c.send('Profiler.start');
await sleep(Number(process.env.SECS ?? 20) * 1000);
const { profile } = await c.send('Profiler.stop');
const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n])); const dt = profile.timeDeltas; const cnt = new Map();
profile.samples.forEach((id, i) => cnt.set(id, (cnt.get(id) ?? 0) + (dt[i] ?? 0)));
const total = [...cnt.values()].reduce((a, b) => a + b, 0);
for (const [id, t] of cnt) { const n = byId.get(id); const f = n.callFrame; const k = `${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/')}:${f.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + t); }
console.log('total sampled ms', (total / 1000).toFixed(0));
for (const [k, t] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log((t / 1000).toFixed(0).padStart(7), 'ms', k);
console.log(JSON.stringify(await T.I(() => window.__imp().profile())), T.errors.slice(0, 5));
await T.b.close();

import puppeteer from 'puppeteer-core';
const TAG = process.env.TAG ?? 'x'; const SECS = Number(process.env.SECS ?? 40);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const I = (f, ...a) => p.evaluate(f, ...a);
await p.goto('http://localhost:' + (process.env.PORT ?? 5173) + '/?live&poll6', { waitUntil: 'networkidle0' });
await I(async () => { localStorage.clear(); const st = await (await fetch('__live.json')).json(); localStorage.setItem('imparatorluk-mock-v1', JSON.stringify(st)); localStorage.setItem('imp-guide-done', '1'); });
await p.reload({ waitUntil: 'networkidle0' });
await I(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Davetle kayıt')).click()); await sleep(300);
const ins = await p.$$('.login input'); await ins[0].type('imparator'); await ins[1].type('Perf Test'); await ins[2].type('perf@x.com'); await ins[3].type('gizli123');
await I(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Hesap aç')).click()); await sleep(3000);
for (let i = 0; i < 12; i++) { await I(() => [...document.querySelectorAll('.modal button, .a2hs button')].find((x) => /Tamam|Kapat|Atla|Geç|✕/.test(x.textContent))?.click()); await sleep(200); }
await I(() => window.__imp().look(50, 24)); await sleep(1500);
if (process.env.CPU) { const c = await p.createCDPSession(); await c.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU) }); }
const r = await I(async (secs) => {
  const ft = []; const tracks = new Map(); let last = performance.now(); const t0 = last;
  await new Promise((res) => { const f = () => { const n = performance.now(); ft.push(n - last); last = n;
    for (const [id, x, y, v] of window.__imp().placed) { if (!v) continue; let t = tracks.get(id); if (!t) tracks.set(id, t = []); t.push([n, x, y]); }
    if (n - t0 < secs * 1000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  ft.sort((a, c) => a - c); const q = (k) => ft[Math.floor(ft.length * k)];
  let jumps = 0, stalls = 0, samples = 0; let maxJump = 0;
  for (const [id, t] of tracks) { let stillSince = null, wasMoving = false;
    for (let i = 1; i < t.length; i++) { const dt = (t[i][0] - t[i - 1][0]) / 1000; const d = Math.hypot(t[i][1] - t[i - 1][1], t[i][2] - t[i - 1][2]); const sp = d / Math.max(dt, 0.001); samples++;
      if (sp > 8 && d < 8) { jumps++; maxJump = Math.max(maxJump, d); (window.__jt ??= []).push(Math.round(t[i][0])); (window.__jid ??= {})[id] = ((window.__jid ??= {})[id] ?? 0) + 1; }
      if (sp < 0.02) { if (wasMoving && stillSince === null) stillSince = t[i][0]; } else { if (stillSince !== null && t[i][0] - stillSince > 400 && t[i][0] - stillSince < 8000 && sp > 0.8) stalls++; stillSince = null; wasMoving = sp > 0.5; } } }
  const hb = window.__hb ?? []; const W = window.__imp().world; const jid = Object.entries(window.__jid ?? {}).sort((a, c) => c[1] - a[1]).slice(0, 6).map(([id, n]) => { const pp = W.people.find((q) => q.id === id); return `${n}:${pp?.prof}:${pp?.playerId ? 'P' : ''}${pp?.walk ? 'W' : ''}${pp?.task ? 'T' : ''}`; }); return { jid, hour: W.hour, hbTimes: hb.slice(0, 8), jumpTimes: [...new Set((window.__jt ?? []).map((x) => Math.round(x / 100) * 100))].slice(0, 25), frames: ft.length, fps: Math.round(ft.length / secs), p50: q(0.5).toFixed(1), p95: q(0.95).toFixed(1), p99: q(0.99).toFixed(1), max: ft[ft.length - 1].toFixed(1), people: tracks.size, jumpsPer1kSamples: (jumps / samples * 1000).toFixed(2), maxJump: maxJump.toFixed(2), stallThenLurch: stalls };
}, SECS);
// render-cost profile
const cost = await I(() => { const S = window.__imp(); return S.profile ? S.profile() : null; });
console.log(TAG, JSON.stringify(r), cost ? JSON.stringify(cost) : '');
if (process.env.SHOTS) for (let i = 0; i < 12; i++) { await p.screenshot({ path: `perf/${TAG}-${String(i).padStart(2, "0")}.png`, clip: { x: 250, y: 100, width: 340, height: 200 } }); await sleep(100); }
await b.close();

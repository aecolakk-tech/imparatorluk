// v2.0.1: newcomer onboarding on a landscape phone with real touch taps.
import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = +(process.argv[2] ?? 844), H = +(process.argv[3] ?? 390);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage(); await p.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.goto('http://localhost:5173/?live', { waitUntil: 'networkidle0' });
await p.evaluate(async () => { localStorage.clear(); const st = await (await fetch('__live.json')).json(); const fid = Object.values(st.world.players).find((x) => x.founder)?.playerId ?? 'p1'; st.users = { 'k@x.com': { pw: 'x', playerId: fid, founder: true } }; localStorage.setItem('imparatorluk-mock-v1', JSON.stringify(st)); });
await p.reload({ waitUntil: 'networkidle0' });
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Davetle kayıt'))?.click()); await sleep(400);
const ins = await p.$$('.login input'); await ins[0].type('imparator'); await ins[1].type('Yeni Oyuncu'); await ins[2].type('tb@x.com'); await ins[3].type('gizli123');
await p.evaluate(() => { const bt = [...document.querySelectorAll('.login button')].find((x) => x.textContent.includes('Hesap aç')); bt.click(); }); await sleep(3500);
const state = () => p.evaluate(() => ({ modals: [...document.querySelectorAll('.modal')].map((m) => (m.className + ':' + (m.querySelector('h2,b')?.textContent ?? '')).slice(0, 50)), alert: !!document.querySelector('.alert-pop') }));
const tapText = async (t) => { const r = await p.evaluate((t) => { const x = [...document.querySelectorAll('.modal button')].reverse().find((b) => b.textContent.includes(t) && b.offsetParent); if (!x) return null; x.scrollIntoView({ block: 'center' }); const q = x.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, t); if (!r) return false; await sleep(150); await p.touchscreen.tap(r[0], r[1]); await sleep(900); return true; };
console.log('after register', JSON.stringify(await state()));
// creator: scroll box down, tap a ›, check scrollTop survives a tick; tap Kaydet once
const sc0 = await p.evaluate(() => { const bx = document.querySelector('.look-modal .box'); bx.scrollTop = 9999; return bx.scrollTop; });
await tapText('›'); await sleep(3000);
const sc1 = await p.evaluate(() => document.querySelector('.look-modal .box')?.scrollTop);
console.log('creator scroll kept', sc0, '→', sc1);
let taps = 0; while (await p.evaluate(() => !!document.querySelector('.look-modal')) && taps < 5) { taps++; await tapText('Kaydet'); await sleep(1200); }
console.log('Kaydet taps', taps, JSON.stringify(await state()));
await p.screenshot({ path: '/workspace/raid/v201/onboard-1.png' });
for (let i = 0; i < 20; i++) { const st = await state(); if (!st.modals.length) break; console.log(' step', i, JSON.stringify(st)); const ok = (await tapText('Harika')) || (await tapText('İleri')) || (await tapText('Tamam')) || (await tapText('Sonra')) || (await tapText('Anladım')); if (!ok) break; }
await sleep(1500);
const me = await p.evaluate(() => { const S = window.__imp(); const w = S.world; const pid = Object.values(w.players).find((x) => x.name === 'Yeni Oyuncu')?.personId; const m = w.people.find((q) => q.id === pid); const pl = Object.values(w.players).find((x) => x.name === 'Yeni Oyuncu'); return { hunger: m.hunger, thirst: m.thirst, energy: m.energy, health: m.health, mood: m.mood, inv: { ekmek: m.inv.ekmek, su: m.inv.su }, quest: pl.quest ?? 0, onboard: m.onboardUntil > Date.now() }; });
console.log('me', JSON.stringify(me));
console.log('hud', await p.evaluate(() => document.querySelector('.hud')?.innerText.replace(/\n/g, ' | ')));
await p.screenshot({ path: '/workspace/raid/v201/onboard-2.png' });
console.log('errors', JSON.stringify(errors));
await b.close();

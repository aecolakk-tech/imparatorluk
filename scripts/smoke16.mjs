import puppeteer from 'puppeteer-core';
const url = process.env.URL ?? 'http://localhost:5173/';
const OUT = '/workspace/imparatorluk/shots16';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p = await browser.newPage(); await p.setViewport({ width: 1280, height: 800 });
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await p.goto(url, { waitUntil: 'networkidle0' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle0' });
const click = async (t, pg = p) => { const ok = await pg.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes(t)); b?.click(); return !!b; }, t); await sleep(350); return ok; };
const dismiss = async (pg = p) => { for (let i = 0; i < 10; i++) { if (!(await pg.$('.modal'))) break; if (!(await click('Tamam', pg))) await click('✕', pg); } };
await click('Davetle kayıt'); const ins = await p.$$('.login input');
await ins[0].type('imparator'); await ins[1].type('Ahmet Enes'); await ins[2].type('kurucu@imparatorluk.local'); await ins[3].type('gizli123');
await click('Hesap aç'); await sleep(1500); await dismiss();
await p.screenshot({ path: `${OUT}/1-map.png` });
console.log('hud:', await p.evaluate(() => document.querySelector('.hud')?.textContent?.slice(0, 160)));
// walk: tap the ground near the kuyu
const st = await p.evaluate(() => { const w = window.__imp().world; const k = w.buildings.find((b) => b.id === 'kuyu'); return { k, me: Object.values(w.players)[0].personId }; });
await p.mouse.click(250, 505); await sleep(300);
const walk = await p.evaluate((id) => window.__imp().world.people.find((q) => q.id === id).walk, st.me);
console.log('walk path pts:', walk?.path?.length);
await sleep(1500); await p.screenshot({ path: `${OUT}/2-walking.png` });
// menu
await click('Menü'); await sleep(300); await p.screenshot({ path: `${OUT}/3-menu.png` });
console.log('menu sections:', await p.evaluate(() => [...document.querySelectorAll('.modal button, .sheet button')].map((b) => b.textContent).slice(0, 14).join(' | ')));
await click('✕');
// DM an NPC: tap a visible NPC, then 💬 Konuş
const vis = await p.evaluate(() => { const I = window.__imp(); const q = I.placed.filter((x) => x[3]).map((x) => ({ id: x[0], s: I.toScreen(x[1], x[2] - 0.5) })).find((x) => x.s[0] > 50 && x.s[0] < 1200 && x.s[1] > 80 && x.s[1] < 700 && !I.world.people.find((pp) => pp.id === x.id).playerId); return q; });
console.log('tap npc', vis?.id); await p.mouse.click(vis.s[0], vis.s[1]); await sleep(500); await p.screenshot({ path: `${OUT}/3b-person.png` });
console.log('konus:', await click('Konuş')); await sleep(400);
await p.type('.sheet input, .modal input', 'merhaba dayı nabıyon'); await click('Gönder'); await sleep(3000);
console.log('dm thread:', await p.evaluate(() => document.querySelector('.msgs')?.textContent?.slice(-250)));
await p.screenshot({ path: `${OUT}/4-dm.png` }); await click('✕'); await dismiss();
// sound toggle
console.log('mute btn:', await click('🔊'));
// murder flow on mock: kill an NPC next to me by teleport-free path: use move then kill via window? use the corpse view after server-side kill
await p.screenshot({ path: `${OUT}/5-final.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();

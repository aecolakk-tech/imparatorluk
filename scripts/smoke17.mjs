import puppeteer from 'puppeteer-core';
const url = process.env.URL ?? 'http://localhost:5173/';
const OUT = '/workspace/imparatorluk/shots17';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const errors = []; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p = await browser.newPage(); await p.setViewport({ width: 1280, height: 800 });
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); p.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); p.on('dialog', (d) => void d.accept(d.type() === 'prompt' ? 'SIFIRLA' : undefined));
const click = async (t) => { const ok = await p.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes(t)); b?.click(); return !!b; }, t); await sleep(350); return ok; };
const dismiss = async () => { for (let i = 0; i < 12; i++) { if (!(await p.$('.modal:not(.trialm)'))) break; if (!(await click('Tamam'))) break; } };
const I = (f, ...a) => p.evaluate(f, ...a);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
await p.goto(url, { waitUntil: 'networkidle0' }); await I(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle0' });
// ---- Kayzer ----
await click('Davetle kayıt'); let ins = await p.$$('.login input');
await ins[0].type('imparator'); await ins[1].type('Ahmet Enes'); await ins[2].type('kurucu@imparatorluk.local'); await ins[3].type('gizli123');
await click('Hesap aç'); await sleep(1500); await dismiss();
log('hud speed buttons:', await I(() => [...document.querySelectorAll('.hud .speed button')].map((b) => b.textContent).join(',')), '| music btn:', await I(() => !!document.querySelector('.hud button[title*="Müzi"]')));
await click('2x'); await sleep(2800); log('speed now', await I(() => window.__imp().world.speed)); await click('1x');
await p.screenshot({ path: `${OUT}/k1-hud.png` });
// walk to a soldier (tap → walk → card opens only when ~1 tile away)
const tapPerson = async (prof) => {
  for (let tries = 0; tries < 3; tries++) {
    const t = await I((prof) => { const S = window.__imp(); const me = S.world.players[Object.keys(S.world.players)[0]].personId; const mq = S.placed.find((x) => x[0] === me); const cs = S.placed.filter((x) => x[3] && x[0] !== me && S.world.people.find((q) => q.id === x[0] && q.prof === prof && !q.playerId)); cs.sort((a, b) => Math.hypot(a[1] - mq[1], a[2] - mq[2]) - Math.hypot(b[1] - mq[1], b[2] - mq[2])); const c = cs[0]; return c ? { id: c[0], s: S.toScreen(c[1], c[2] - 0.5), d: Math.hypot(c[1] - mq[1], c[2] - mq[2]) } : null; }, prof);
    if (!t) return null; log('tap', prof, t.id, 'dist', t.d.toFixed(1));
    await p.mouse.click(t.s[0], t.s[1]);
    for (let i = 0; i < 40; i++) { await sleep(500); if (await I(() => !!document.querySelector('.sheet'))) { const open = await I(() => document.querySelector('.sheet')?.textContent?.slice(0, 60)); if (open) return { id: t.id, open }; } }
  }
  return null;
};
const s1 = await tapPerson('asker'); log('soldier card:', s1?.open);
await p.screenshot({ path: `${OUT}/k2-soldier-card.png` });
if (s1) {
  await click('Konuş'); await sleep(400); await p.type('.sheet input', 'git başka askeri öldür'); await click('Gönder'); await sleep(2500);
  log('order reply:', await I(() => document.querySelector('.msgs')?.textContent?.slice(-160)));
  const task = await I((id) => window.__imp().world.people.find((q) => q.id === id)?.task, s1.id); log('soldier task:', task?.label, task?.status);
  await p.screenshot({ path: `${OUT}/k3-order.png` }); await click('✕');
  for (let i = 0; i < 40; i++) { await sleep(1500); const t = await I((id) => window.__imp().world.people.find((q) => q.id === id)?.task?.status, s1.id); if (t && t !== 'yolda') { log('task finished:', t, await I((id) => window.__imp().world.people.find((q) => q.id === id)?.task?.note, s1.id)); break; } }
  await p.screenshot({ path: `${OUT}/k4-after-order.png` });
}
// walk to the Saray and open the citizen register
const sd = await I(() => { const S = window.__imp(); const b = S.world.buildings.find((x) => x.id === 'saray'); return S.toScreen(b.door.x + 0.5, b.door.y + 0.4); });
await p.mouse.click(sd[0], sd[1]); await sleep(9000);
await I(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('Menü')); b?.click(); }); await sleep(300); await click('🏰 Saray'); await sleep(300);
const reg = await click('Vatandaş defteri'); await sleep(500); log('register opened:', reg, await I(() => document.querySelectorAll('table.citizens tr').length));
await click('🗽'); await sleep(300); await p.screenshot({ path: `${OUT}/k5-register.png` }); await click('✕');
// ---- a real non-Kayzer citizen ----
await I(() => { for (const k of Object.keys(localStorage)) if (k.includes('session')) localStorage.removeItem(k); }); await p.reload({ waitUntil: 'networkidle0' });
await click('Davetle kayıt'); ins = await p.$$('.login input');
await ins[0].type('imparator'); await ins[1].type('Berat Vatandaş'); await ins[2].type('berat@x.com'); await ins[3].type('gizli123');
await click('Hesap aç'); await sleep(2000); await dismiss();
log('citizen:', await I(() => window.__imp().me), '| speed ctrl visible:', await I(() => !!document.querySelector('.hud .speed')));
let caught = false;
for (let round = 0; round < 4 && !caught; round++) {
  const v = await tapPerson(['hamal', 'ciftci', 'tuccar', 'hamal'][round]); log('victim card:', v?.open?.slice(0, 30));
  if (!v) continue;
  await click('Öldür'); await sleep(1500); await p.screenshot({ path: `${OUT}/c1-kill-${round}.png` }); await click('✕');
  for (let i = 0; i < 70 && !caught; i++) { await sleep(2000); caught = await I(() => { const S = window.__imp(); const me = S.world.players[Object.keys(S.world.players).find((k) => S.world.players[k].name.startsWith('Berat'))].personId; return S.world.arrests.some((a) => a.criminalId === me && a.status === 'bekliyor') || S.world.cases.some((c) => c.accusedId === me && c.stage !== 'kapandi'); }); }
  log('round', round, 'caught', caught);
}
if (caught) {
  await sleep(1500); await p.screenshot({ path: `${OUT}/c2-custody.png` });
  log('custody at mahkeme, jailed:', await I(() => { const S = window.__imp(); const m = S.world.people.find((q) => q.name === 'Berat Vatandaş'); return m.jailedDays; }));
  let popup = false; for (let i = 0; i < 60 && !popup; i++) { await sleep(2000); popup = await I(() => !!document.querySelector('.box.trial')); }
  log('trial popup:', popup);
  if (popup) {
    await p.screenshot({ path: `${OUT}/c3-trial.png` });
    await p.type('.box.trial input', 'Kadı efendi, masumum; o gece evdeydim, komşum Hasan tanığımdır. Pişmanım ki orada bulundum.'); await click('Savun'); await sleep(2500);
    log('judge said:', await I(() => [...document.querySelectorAll('.box.trial .msg.hakim')].pop()?.textContent));
    await click('Savunmam bitti'); await sleep(2500);
    log('verdict:', await I(() => document.querySelector('.box.trial .verdict')?.textContent));
    await p.screenshot({ path: `${OUT}/c4-verdict.png` });
    await click('Tamam'); await sleep(6000); await p.screenshot({ path: `${OUT}/c5-after.png` });
    log('after verdict jailedDays/escort:', await I(() => { const S = window.__imp(); const m = S.world.people.find((q) => q.name === 'Berat Vatandaş'); return [m.jailedDays, (S.world.escorts ?? []).length]; }));
  }
}
// goals tab
await I(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('Menü')); b?.click(); }); await sleep(300); await click('🎯 Hedef'); await click('Zengin tüccar'); await sleep(500);
await p.screenshot({ path: `${OUT}/c6-goals.png` });
log('hud meters/season:', await I(() => document.querySelector('.hud')?.textContent?.match(/(İlkbahar|Yaz|Sonbahar|Kış)[^ ]*/)?.[0] ?? 'no season', ), await I(() => document.querySelectorAll('.hud .meter, .hud [title*="Tokluk"]').length));
const n0 = await I(() => (window.__sfxN ?? 0)); await click('🕯 Cemiyet'); await sleep(400); await p.screenshot({ path: `${OUT}/c7-cemiyet.png` });
await click('📖 Tarih'); await sleep(400); await p.screenshot({ path: `${OUT}/c8-tarih.png` });
log('sfx after tab clicks:', await I(() => JSON.stringify((window.__sfx ?? []).slice(-4))), 'count delta', (await I(() => (window.__sfxN ?? 0))) - n0);
await I(() => window.__imp().mute(true)); const n1 = await I(() => (window.__sfxN ?? 0)); await click('🕯 Cemiyet'); await click('📖 Tarih');
log('muted: sfx played =', (await I(() => (window.__sfxN ?? 0))) - n1); await I(() => window.__imp().mute(false));
log('sw/manifest:', await I(() => !!document.querySelector('link[rel=manifest]')));
log('errors:', errors.length ? errors : 'none');
await browser.close();

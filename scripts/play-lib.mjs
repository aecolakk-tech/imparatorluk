import puppeteer from 'puppeteer-core';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function boot(name = 'Oyuncu Test', extra = '') {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; p.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('dialog', (d) => void d.accept(d.type() === 'prompt' ? 'SIFIRLA' : undefined));
  const I = (f, ...a) => p.evaluate(f, ...a);
  await p.goto('http://localhost:' + (process.env.PORT ?? 5173) + '/?live' + extra, { waitUntil: 'networkidle0' });
  await I(async () => { localStorage.clear(); const st = await (await fetch('__live.json')).json(); localStorage.setItem('imparatorluk-mock-v1', JSON.stringify(st)); localStorage.setItem('imp-guide-done', '1'); localStorage.setItem('imp-music', '0'); });
  await p.reload({ waitUntil: 'networkidle0' });
  await I(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Davetle kayıt')).click()); await sleep(300);
  const ins = await p.$$('.login input'); await ins[0].type('imparator'); await ins[1].type(name); await ins[2].type(name.replace(/\s/g, '') + '@x.com'); await ins[3].type('gizli123');
  await I(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Hesap aç')).click()); await sleep(3000);
  const T = {
    p, b, I, errors,
    dismiss: async () => { for (let i = 0; i < 12; i++) { const ok = await I(() => { const x = [...document.querySelectorAll('.modal:not(.trial-modal) button, .a2hs button')].find((x) => /Tamam|Kapat|Atla|Geç|Harika|Sonra|Anladım|✕/.test(x.textContent)); x?.click(); return !!x; }); if (!ok) break; await sleep(200); } },
    W: (code, arg) => I((code, arg) => { const k = 'imparatorluk-mock-v1'; const st = JSON.parse(localStorage.getItem(k)); const r = new Function('w', 'arg', code)(st.world, arg); localStorage.setItem(k, JSON.stringify(st)); return r; }, code, arg),
    me: () => I((nm) => { const S = window.__imp(); const w = S.world; const pid = Object.values(w.players).find((x) => x.name === nm || x.name?.endsWith(' ' + nm))?.personId ?? Object.values(w.players).find((x) => S.me && x.name === S.me)?.personId; return w.people.find((q) => q.id === pid); }, name),
    act: async (a, wait = 1200) => { await I((a) => window.__imp().act(a), a); await sleep(wait); },
    sheet: () => I(() => document.querySelector('.sheet')?.innerText ?? ''),
    toasts: () => I(() => [...document.querySelectorAll('.toast')].map((x) => x.innerText).join(' | ')),
    click: async (t, sel = 'button') => { const ok = await I((t, sel) => { const b = [...document.querySelectorAll(sel)].reverse().find((x) => x.textContent?.includes(t) && x.offsetParent); b?.click(); return !!b; }, t, sel); await sleep(500); return ok; },
    tapWorld: async (x, y) => { const [sx, sy] = await I((x, y) => window.__imp().toScreen(x, y), x, y); await p.touchscreen.tap(sx, sy); await sleep(600); },
    tick: async (ms) => sleep(ms),
  };
  await sleep(800); await I(() => [...document.querySelectorAll('.look-modal button')].find((x) => x.textContent.includes('Kaydet'))?.click()); await sleep(1500);
  await T.dismiss(); return T;
}

// Login form must survive the soft keyboard (viewport shrinks while typing).
import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage(); await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto('http://localhost:5173/?live', { waitUntil: 'networkidle0' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle0' });
const st = () => p.evaluate(() => { const i = document.querySelectorAll('.login input'); const r = i[0]?.getBoundingClientRect(); const top = r ? document.elementFromPoint(r.left + 5, r.top + 5) : null; return { n: i.length, v0: i[0]?.value, v1: i[1]?.value?.length, focus: document.activeElement?.tagName, rot: getComputedStyle(document.querySelector('.rotate-ov')).display, inputOnTop: top === i[0], y: Math.round(r?.top ?? -1), vh: innerHeight }; });
const ins = await p.$$('.login input'); await ins[0].tap(); await ins[0].type('ali@x.com');
for (const [w, h] of [[844, 200], [844, 140], [390, 844], [390, 420], [844, 390]]) { await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await sleep(600); console.log(w + 'x' + h, JSON.stringify(await st())); }
await (await p.$$('.login input'))[1].type('abc'); console.log('end', JSON.stringify(await st()));
await b.close();

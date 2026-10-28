import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.setViewport({ width: 1280, height: 800 });
await p.goto('https://aecolakk-tech.github.io/imparatorluk/?v=' + Date.now(), { waitUntil: 'networkidle0' }); await new Promise((r) => setTimeout(r, 2000));
await p.screenshot({ path: '/workspace/imparatorluk/shots16/live.png' });
console.log('title', await p.title(), 'errors', errs, 'text', (await p.evaluate(() => document.body.innerText)).slice(0, 150));
await b.close();

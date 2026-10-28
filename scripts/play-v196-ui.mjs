import { boot, sleep } from './play-lib.mjs';
const T = await boot('Ui Test');
// HUD tap explanation
await T.I(() => document.querySelector('.stat.meter[data-k="energy"]')?.click()); await sleep(300); console.log('energy tap:', await T.toasts());
await T.I(() => document.querySelector('.stat.meter[data-k="hunger"]')?.click()); await sleep(300); console.log('hunger tap:', await T.toasts());
// disaster popup + vibrate
await T.I(() => { window.__vib = []; navigator.vibrate = (p) => { window.__vib.push(p); return true; }; });
await T.W("w.disaster = { id: 99, kind: 'salgin', text: 'SALGIN! Hastalık yayılıyor; hekimler çok çalışacak.', day: w.day }; return 1");
await sleep(8000);
console.log('disaster modal:', await T.I(() => document.querySelector('.modal.disaster')?.innerText ?? 'NONE'), '| vibrate:', JSON.stringify(await T.I(() => window.__vib)));
await T.I(() => document.querySelector('.modal.disaster button')?.click());
console.log('errors:', T.errors.join(' | ') || 'none'); await T.b.close();

// v2.0.3: render 30 s of each music mood offline (dawn/day/night) and compare loudness; also dump the dawn track to a WAV.
import puppeteer from 'puppeteer-core'; import { writeFileSync } from 'node:fs';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage(); await p.goto('http://localhost:5173/?live', { waitUntil: 'networkidle0' });
const r = await p.evaluate(async () => {
  const mod = await import('/src/ui/sound.ts'); const out = {};
  for (const m of ['sabah', 'gun', 'gece']) { const oc = new OfflineAudioContext(1, 44100 * 30, 44100); out[m] = await mod.renderNightForTest(oc, m); }
  return out;
});
console.log(JSON.stringify(r)); await b.close();

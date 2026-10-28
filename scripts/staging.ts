/**
 * v2.0.2 ST1 – Staging (copy) world for Test Botu's idle test.
 * Works ONLY on a local file (staging/world.json). It never reads credentials and never talks to Supabase,
 * so the live world (world_state id=1) cannot be touched from here.
 *
 *   npx tsx scripts/staging.ts init [backup.json]   copy a backup (or a fresh world) into staging/world.json
 *   npx tsx scripts/staging.ts run [days=1]         Test Botu plays idle: heartbeats + eat/drink/work on a virtual clock
 *   npx tsx scripts/staging.ts status               day, population, hazine, Test Botu's needs
 *   npx tsx scripts/staging.ts mock                 write staging/mock-store.json for the browser mock (see docs/STAGING.md)
 *   npx tsx scripts/staging.ts reset                delete the staging world (init again to start over)
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { act, heartbeat, migrateWorld, register, createWorld } from '../src/server/core';
import { findPerson } from '../src/sim/world';
import type { World } from '../src/sim/types';
import { hourMs } from '../src/sim/tick';

const DIR = 'staging'; const FILE = `${DIR}/world.json`; const META = `${DIR}/meta.json`;
let BOT = 'testbot';
/** Reuse the copied world's own Test Botu account if it has one, else add one. */
const findBot = (w: World): string | undefined => Object.entries(w.players).find(([, v]) => /test bot/i.test(findPerson(w, v.personId)?.name ?? ''))?.[0];
const load = (): { w: World; now: number } => { if (!existsSync(FILE)) throw new Error('Staging world yok: önce `init`.'); const w = JSON.parse(readFileSync(FILE, 'utf8')) as World; const m = JSON.parse(readFileSync(META, 'utf8')) as { now: number }; BOT = findBot(w) ?? BOT; return { w, now: m.now }; };
const save = (w: World, now: number): void => { mkdirSync(DIR, { recursive: true }); writeFileSync(FILE, JSON.stringify(w)); writeFileSync(META, JSON.stringify({ now, savedAt: new Date().toISOString() })); };

const [cmd = 'status', arg] = process.argv.slice(2);
if (cmd === 'init') {
  let w: World; let now = Date.now();
  if (arg) { const raw = JSON.parse(readFileSync(arg, 'utf8')); w = (raw.rows?.[0]?.state ?? raw.state ?? raw) as World; now = Math.max(now, w.lastTickAt ?? 0); }
  else w = createWorld(42, now);
  migrateWorld(w); if (w.foreign) w.foreign.landReal = undefined; // never re-run a scheduled landing from a copied live world
  BOT = findBot(w) ?? BOT; if (!w.players[BOT]) register(w, BOT, 'Test Botu', 'hamal', false, now);
  save(w, now); console.log(`Staging world hazır: ${FILE} (gün ${w.day}, ${w.people.length} kişi). Kaynak: ${arg ?? 'yeni dünya'}`);
} else if (cmd === 'run') {
  const { w } = load(); let { now } = load(); const days = Number(arg ?? 1); const end = w.day + days; let n = 0;
  const me = (): ReturnType<typeof findPerson> => findPerson(w, w.players[BOT]!.personId);
  while (w.day < end && n < 5000) {
    now += hourMs(w); heartbeat(w, BOT, now); const p = me(); n++;
    if (!p) break;
    if (p.hunger > 50) act(w, BOT, { t: 'eat' } as never, now);
    if (p.thirst > 50) act(w, BOT, { t: 'drinkWater' } as never, now);
    if ((p.energy ?? 100) > 25 && w.hour >= 8 && w.hour < 17 && n % 3 === 0) act(w, BOT, { t: 'work' } as never, now);
  }
  save(w, now); const p = me(); console.log(`Gün ${w.day} saat ${w.hour}: Test Botu ${p ? `açlık ${Math.round(p.hunger)} susuzluk ${Math.round(p.thirst)} sağlık ${Math.round(p.health)} kese ${p.money.toFixed(1)} D` : 'öldü'}.`);
} else if (cmd === 'status') {
  const { w } = load(); const p = findPerson(w, w.players[BOT]?.personId ?? '');
  console.log(JSON.stringify({ day: w.day, hour: w.hour, people: w.people.length, hazine: Math.round(w.treasury), regime: w.regime, testbot: p && { hunger: p.hunger, thirst: p.thirst, health: p.health, money: p.money } }, null, 1));
} else if (cmd === 'mock') {
  const { w } = load(); const store = { world: w, users: {}, access: 'imparator', msgs: [], snaps: [] };
  writeFileSync(`${DIR}/mock-store.json`, JSON.stringify(store)); console.log(`${DIR}/mock-store.json yazıldı (localStorage anahtarı: imparatorluk-mock-v1).`);
} else if (cmd === 'reset') { rmSync(DIR, { recursive: true, force: true }); console.log('Staging world silindi.'); }
else console.log('Komutlar: init [backup.json] | run [gün] | status | mock | reset');

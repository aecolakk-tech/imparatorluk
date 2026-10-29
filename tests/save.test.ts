import { describe, expect, it } from 'vitest';
import { SoloBackend, SOLO_PLAYER, PAUSE_GAP_MS } from '../src/backend/solo';
import { MemoryKV, SaveSlots, parseSave, gzip, fileText, exportName, shiftTimes, toB64, fromB64, SLOTS } from '../src/backend/save';
import { findPerson } from '../src/sim/world';
import { rules } from '../src/sim/move';
import type { World } from '../src/sim/types';
import { EMPIRE_NAMES, npcRulerStart } from '../src/sim/solostart';
import { naipPolicy } from '../src/sim/solo';
import { createWorld } from '../src/sim/world';
import { hourMs } from '../src/sim/tick';
import { heartbeat as coreHeartbeat } from '../src/server/core';


const T0 = 1_790_000_000_000;
function mk(kv = new MemoryKV(), t = { now: T0 }): { be: SoloBackend; kv: MemoryKV; t: { now: number } } { return { be: new SoloBackend(kv, () => t.now), kv, t }; }
const meOf = (be: SoloBackend) => { const w = be.st!.world; return findPerson(w, w.players[SOLO_PLAYER]!.personId)!; };

describe('v2.1.0 tek kişilik kayıt', () => {
  it('new game: the player is the only human, not the Kayzer, no founder rights; speed is allowed', async () => {
    const { be } = mk();
    expect(await be.newGame('Zeynel Testoğlu', 'hamal')).toBeNull();
    const w = be.st!.world; expect(Object.keys(w.players)).toEqual([SOLO_PLAYER]);
    expect(w.players[SOLO_PLAYER]!.founder).toBe(false); expect(w.kayzerId).not.toBe(meOf(be).id); expect(w.solo).toBe(true);
    const r = await be.act({ t: 'setSpeed', speed: 2 }); expect(r.ok, r.msg).toBe(true);
    const hb = await be.heartbeat(); expect(hb.world.speed).toBe(2);
  });
  it('an NPC namesake steps aside instead of blocking the new game', async () => {
    const { be } = mk(); await be.newGame('X Y', 'hamal', {}, 77); const npc = be.st!.world.people.find((p) => !p.playerId && p.prof !== 'kayzer' && p.prof !== 'naip')!;
    const { be: be2 } = mk(); const nm = npc.name;
    expect(await be2.newGame(nm, 'hamal', {}, 77)).toBeNull(); // same seed → the same NPC with that name exists
    expect(meOf(be2).name).toBe(nm); expect(be2.st!.world.people.find((p) => p.id === npc.id)!.name).toBe(`${nm} Efendi`);
  });
  it('save → continue restores the same state (money, inventory, position, day)', async () => {
    const { be, kv, t } = mk(); await be.newGame('Zeynel Testoğlu', 'hamal');
    for (let i = 0; i < 60 && be.st!.world.hour < 10; i++) { t.now += 10_000; await be.heartbeat(); } // the market opens at 08
    rules.reach = false; const r = await be.act({ t: 'buy', good: 'ekmek', qty: 1 }); rules.reach = true; expect(r.ok, r.msg).toBe(true);
    t.now += 2000; await be.heartbeat(); await be.saveNow();
    const m = meOf(be); const snap = { money: m.money, inv: JSON.stringify(m.inv), day: be.st!.world.day, hour: be.st!.world.hour, people: be.st!.world.people.length };
    t.now += 3 * 3600_000; // closed for 3 hours
    const { be: be2 } = mk(kv, t); expect((await be2.saveInfo())?.day).toBe(snap.day);
    expect(await be2.continueGame()).not.toBeNull();
    const m2 = meOf(be2); expect(m2.money).toBeCloseTo(snap.money, 6); expect(JSON.stringify(m2.inv)).toBe(snap.inv);
    expect(be2.st!.world.day).toBe(snap.day); expect(be2.st!.world.hour).toBe(snap.hour); expect(be2.st!.world.people.length).toBe(snap.people);
    // time was paused while closed: the world clock resumes at "now", nothing was simulated for the 3 hours
    expect(Math.abs(be2.st!.world.lastTickAt - t.now)).toBeLessThan(5 * 60_000);
    await be2.heartbeat(); expect(be2.st!.world.day).toBe(snap.day);
  });
  it('pauses while hidden/asleep: gaps are skipped, short waits are simulated', async () => {
    const { be, t } = mk(); await be.newGame('Zeynel Testoğlu', 'hamal'); await be.heartbeat();
    const d0 = be.st!.world.day; const h0 = be.st!.world.hour;
    await be.pause(); t.now += 6 * 3600_000; await be.heartbeat();
    expect(be.st!.world.day).toBe(d0); expect(be.st!.world.hour).toBe(h0);
    t.now += PAUSE_GAP_MS + 60 * 60_000; await be.heartbeat(); expect(be.st!.world.day).toBe(d0); // throttled timer / sleep without an event
    for (let i = 0; i < 200; i++) { t.now += 5000; await be.heartbeat(); } // 1000 s of play ≈ 17 game hours
    expect(be.st!.world.day * 24 + be.st!.world.hour).toBeGreaterThan(d0 * 24 + h0 + 10);
  });
  it('autosave every game day and every 60 s into 3 rotating slots; a corrupt slot is skipped', async () => {
    const kv = new MemoryKV(); const { be, t } = mk(kv); await be.newGame('Zeynel Testoğlu', 'hamal');
    const slots = new SaveSlots(kv);
    for (let i = 0; i < 40; i++) { t.now += 5000; await be.heartbeat(); await new Promise((r) => setTimeout(r, 0)); }
    const list = await slots.list(); expect(list.filter((x) => x.rec).length).toBe(SLOTS);
    const seqs = list.map((x) => x.rec!.seq).sort((a, b) => a - b); expect(seqs[2]! - seqs[0]!).toBe(2); // the three newest saves
    const newest = list.reduce((a, b) => (a.rec!.seq > b.rec!.seq ? a : b));
    await kv.set(`slot${newest.slot}`, { ...newest.rec!, data: newest.rec!.data.slice(0, 5000) }); // cut mid-write
    const lt = await slots.latest(t.now); expect(lt).not.toBeNull(); expect(lt!.rec.seq).toBe(newest.rec!.seq - 1);
    // a day change saves at once
    const before = (await slots.info())!.seq; be.st!.world.day += 1; t.now += 1000; await be.heartbeat(); await new Promise((r) => setTimeout(r, 0));
    expect((await slots.info())!.seq).toBe(before + 1);
  });
  it('export (gzip or plain) → import restores the game; garbage is rejected; import migrates old saves', async () => {
    const { be } = mk(); await be.newGame('Zeynel Testoğlu', 'hamal'); await be.heartbeat();
    const s = be.exportString()!; const money = meOf(be).money; const day = be.st!.world.day;
    expect(exportName(day, new Date(2026, 9, 29))).toBe(`imparatorluk-kayit-${day}-2026-10-29.json`);
    const gz = await gzip(s); expect(gz.length).toBeLessThan(s.length / 3);
    const { be: b2 } = mk(); expect(await b2.loadState(await fileText(gz))).toBeNull(); expect(meOf(b2).money).toBeCloseTo(money, 6);
    const { be: b3 } = mk(); expect(await b3.loadState(await fileText(new TextEncoder().encode(s)))).toBeNull(); expect(b3.st!.world.day).toBe(day);
    expect(fromB64(toB64(gz))).toEqual(gz);
    expect(await b3.loadState('{"hello":1}')).toMatch(/değil/);
    expect(await b3.loadState('not json')).toMatch(/okunamadı/);
    const f = JSON.parse(s); f.v = 99; expect(await b3.loadState(JSON.stringify(f))).toMatch(/daha yeni/);
    const g = JSON.parse(s); g.playerId = 'nobody'; expect(await b3.loadState(JSON.stringify(g))).toMatch(/karakter/);
    // an old save without newer fields is migrated
    const o = JSON.parse(s); delete o.world.careerV; delete o.world.solo; const pi = o.world.people.findIndex((p: { playerId: unknown; yol?: unknown }) => !p.playerId); delete o.world.people[pi].itibar;
    const st = parseSave(JSON.stringify(o), T0); expect(typeof st).not.toBe('string');
    const w = (st as { world: World }).world; expect(w.careerV).toBe(1); expect(typeof w.people[pi]!.itibar).toBe('number'); expect(w.solo).toBe(true);
    expect(b3.st!.world.day).toBe(day); // the failed imports left the running game alone
  });
  it('shiftTimes moves only timestamps', () => {
    const o = { a: T0, b: 5, c: [T0, 12.5, { d: T0 + 1 }], s: `${T0}`, m: 1e9 };
    shiftTimes(o, 1000); expect(o).toEqual({ a: T0 + 1000, b: 5, c: [T0 + 1000, 12.5, { d: T0 + 1001 }], s: `${T0}`, m: 1e9 });
  });
  it('chat in solo gets rule-based NPC replies (no server)', async () => {
    const { be, t } = mk(); await be.newGame('Zeynel Testoğlu', 'hamal'); await be.heartbeat();
    const npc = be.st!.world.people.find((p) => !p.playerId && p.prof === 'firinci') ?? be.st!.world.people.find((p) => !p.playerId)!;
    expect(await be.chat('Merhaba, nasılsın?', npc.id)).toBeNull(); t.now += 3000; await be.heartbeat();
    const ms = await be.messages(); expect(ms.some((m) => m.fromPersonId === npc.id)).toBe(true);
  });
});

describe('v2.1.0 tek kişilik başlangıçlar', () => {
  it("'Halktan biri': NPC Kayzer with a random name + temperament, random historical empire name; the player is a citizen", async () => {
    const { be } = mk(); expect(await be.newGame('Zeynel Testoğlu', 'hamal', { start: 'halk', empireName: 'Yok Sayılır' })).toBeNull();
    const w = be.st!.world; const k = findPerson(w, w.kayzerId)!;
    expect(k.playerId).toBeFalsy(); expect(k.name).toMatch(/^Kayzer \S/); expect(k.name).not.toBe('Kayzer');
    expect(['adil', 'zalim', 'cimri', 'comert', 'dindar']).toContain(w.rulerTrait);
    expect(EMPIRE_NAMES).toContain(w.empireName); expect(w.empireName).not.toBe('Yok Sayılır');
    expect(meOf(be).prof).not.toBe('kayzer'); expect(w.players[SOLO_PLAYER]!.founder).toBe(false);
  });
  it("'Kayzer olarak': the player is on the throne with the typed empire name; a bad name is refused; Kayzer tools work", async () => {
    const { be: bad } = mk(); expect(await bad.newGame('Zeynel Testoğlu', 'hamal', { start: 'kayzer', empireName: '<>' })).toMatch(/Devletin adı/);
    const { be } = mk(); expect(await be.newGame('Zeynel Testoğlu', 'hamal', { start: 'kayzer', empireName: 'Anadolu Kayzerliği' })).toBeNull();
    const w = be.st!.world; const me = meOf(be);
    expect(w.kayzerId).toBe(me.id); expect(me.name).toBe('Kayzer Zeynel Testoğlu'); expect(w.empireName).toBe('Anadolu Kayzerliği'); expect(w.rulerTrait).toBeUndefined();
    const r = await be.act({ t: 'setTax', rate: 12 } as never); expect(r.ok, r.msg).toBe(true); expect(be.st!.world.taxRate).toBe(12);
  });
  it('Kayzer start: NPCs can still depose the player through isyan', async () => {
    const { be, t } = mk(); await be.newGame('Zeynel Testoğlu', 'hamal', { start: 'kayzer', empireName: 'Anadolu Kayzerliği' }); await be.heartbeat();
    const w = be.st!.world; const me = meOf(be);
    // a miserable city: the rule-based uprising logic must be able to start (and win) without any human rebel
    w.taxRate = 40; let deposed = false; let started = false; const seen = new Set<string>();
    for (let i = 0; i < 24 * 40 && !deposed; i++) {
      for (const p of w.people) if (p.id !== me.id) { p.mood = Math.min(p.mood, 5); p.loyalty = 0; p.republic = Math.max(p.republic, 90); }
      // whole game hours at once through the core (the backend itself would treat a >15 s jump as a pause)
      t.now += hourMs(w) + 1; coreHeartbeat(w, SOLO_PLAYER, t.now); started ||= !!w.isyan; for (const e of w.events.slice(-30)) if (/İSYAN/.test(e.text)) seen.add(e.text); deposed = w.kayzerId !== me.id || w.regime === 'cumhuriyet';
    }
    const ev = [...seen].join('\n');
    expect(started || /İSYAN: .* ayaklandı/.test(ev), ev.split('\n').filter((x) => /umhuriyet|taht|İSYAN/.test(x)).slice(-5).join(' // ') + ' | regime=' + w.regime + ' kayzer=' + (findPerson(w, w.kayzerId)?.name ?? 'none') + ' me.jailed=' + me.jailedDays + ' day=' + w.day + ' last=' + ev.split('\n').slice(-6).join(' // ')).toBe(true);
    expect(ev).toMatch(/İSYAN: .*tahttan indirildi/);
    expect(w.regime === 'cumhuriyet' || w.kayzerId !== me.id).toBe(true);
    expect(deposed, `isyan=${JSON.stringify(w.isyan)?.slice(0, 200)} regime=${w.regime}`).toBe(true);
  });
  it('the NPC ruler temperament really changes the policy (tax band, sadaka, mood)', () => {
    const base = (trait: 'zalim' | 'comert'): World => { const w = createWorld(9, T0); w.solo = true; npcRulerStart(w, () => 0.5); w.rulerTrait = trait; return w; };
    const z = base('zalim'); const c = base('comert'); z.taxRate = 10; c.taxRate = 10;
    const m0z = z.people.reduce((a, p) => a + p.mood, 0); const m0c = c.people.reduce((a, p) => a + p.mood, 0);
    for (let d = 0; d < 8; d++) { naipPolicy(z); naipPolicy(c); }
    expect(z.taxRate).toBeGreaterThan(10); expect(c.taxRate).toBeLessThanOrEqual(10);
    expect(z.people.reduce((a, p) => a + p.mood, 0)).toBeLessThan(m0z); expect(c.people.reduce((a, p) => a + p.mood, 0)).toBeGreaterThan(m0c - 1);
    // the player on the throne is never steered by a temperament
    const { kayzer } = npcRulerStart(createWorld(9, T0)); expect(kayzer.name).toMatch(/^Kayzer /);
  });
});

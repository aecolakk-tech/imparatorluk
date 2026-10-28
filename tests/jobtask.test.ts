import { describe, expect, it, beforeEach } from 'vitest';
import { createWorld, joinWorld, touchPlayer, findPerson } from '../src/sim/index';
import type { World, Person } from '../src/sim/index';
import { rules, doorSpot } from '../src/sim/move';
import { act } from '../src/server/core';
import { startWalk } from '../src/sim/v16';
import { careerHour, refreshJobs, migrateCareer, enlist } from '../src/sim/career';
import { taskFor, TASK_MIN_MS, tasksToday } from '../src/sim/jobtask';
import { totalMoney } from '../src/sim/economy';

const T0 = 1_700_000_000_000;
function setup(): World { const w = createWorld(3, T0); joinWorld(w, 'f', 'Enes', 'kayzer', true, T0); joinWorld(w, 'u2', 'Testoğlu', 'hamal', false, T0); touchPlayer(w, 'u2', T0); migrateCareer(w); refreshJobs(w); return w; }
const me = (w: World): Person => findPerson(w, w.players.u2!.personId)!;
const goTo = (w: World, p: Person, id: string, now: number): void => { const b = w.buildings.find((x) => x.id === id)!; startWalk(w, p, doorSpot(b), now - 600_000); };
const hireAs = (w: World, id: string): Person => { const p = me(w); p.itibar = 40; p.job = undefined; rules.reach = false; const r = act(w, 'u2', { t: 'jobApply', jobId: id }, T0); rules.reach = true; expect(r.ok, r.msg).toBe(true); w.day += 1; return p; };
beforeEach(() => { rules.reach = true; });

describe('v2.0.3 İş görevi', () => {
  it('themed tasks per profession, generic fallback', () => {
    const w = setup(); const p = me(w);
    const job = (prof: string, place: string) => ({ id: 'x', title: 't', place, prof, wage: 5, from: 6, to: 14, employerId: 'dis', kind: 'gundelik' }) as never;
    expect(taskFor(job('barci', 'bar'), p).steps.join()).toMatch(/Sipariş.*İçki.*servis/);
    expect(taskFor(job('firinci', 'firin'), p).steps.join()).toMatch(/yoğur.*Fırına.*çıkar/);
    expect(taskFor(job('demirci', 'atolye'), p).steps.join()).toMatch(/ısıt.*döv.*soğut/);
    expect(taskFor(job('ciftci', 'ciftlik'), p).steps.join()).toMatch(/ek.*Sula.*Hasat/);
    expect(taskFor(job('hamal', 'pazar'), p).steps.join()).toMatch(/taşı/);
    expect(taskFor(job('balikci', 'liman'), p).steps.join()).toMatch(/Halat/);
    expect(taskFor(job('terzi', 'atolye'), p).steps.join()).toMatch(/kes.*Dik/);
    p.prof = 'kayzer'; expect(taskFor({ ...(job('kayzer', 'nowhere') as object), prof: undefined } as never, p).name).toBe('Günlük iş');
  });
  it('must be at the workplace; cannot finish faster than 15 s; expires; counts per day', () => {
    const w = setup(); const p = hireAs(w, 'J-hamal'); let now = T0 + 1000;
    goTo(w, p, 'cami', now); expect(act(w, 'u2', { t: 'jobTask', step: 'start' }, now).msg).toMatch(/iş yerinde/);
    goTo(w, p, p.job!.place, now);
    expect(act(w, 'u2', { t: 'jobTask', step: 'done' }, now).ok).toBe(false); // nothing started
    expect(act(w, 'u2', { t: 'jobTask', step: 'start' }, now).ok).toBe(true);
    expect(act(w, 'u2', { t: 'jobTask', step: 'done' }, now + TASK_MIN_MS - 500).msg).toMatch(/hızlı/);
    expect(act(w, 'u2', { t: 'jobTask', step: 'done' }, now + TASK_MIN_MS + 500).ok).toBe(true); expect(tasksToday(w, p.job)).toBe(1);
    now += 60_000; act(w, 'u2', { t: 'jobTask', step: 'start' }, now); expect(act(w, 'u2', { t: 'jobTask', step: 'done' }, now + 200_000).msg).toMatch(/zaman aşımı/);
    w.day += 1; expect(tasksToday(w, p.job)).toBe(0);
  });
  it('fast completion gives bahşiş; slow does not; 3rd task pays the wage once; money is conserved', () => {
    const w = setup(); const p = hireAs(w, 'J-hamal'); let now = T0 + 1000; goTo(w, p, p.job!.place, now);
    const total0 = totalMoney(w); const m0 = p.money; const wage = p.job!.wage;
    act(w, 'u2', { t: 'jobTask', step: 'start' }, now); const r1 = act(w, 'u2', { t: 'jobTask', step: 'done' }, now + 20_000); expect(r1.msg).toMatch(/bahşiş/);
    const afterTip = p.money; expect(afterTip).toBeGreaterThan(m0);
    now += 60_000; act(w, 'u2', { t: 'jobTask', step: 'start' }, now); expect(act(w, 'u2', { t: 'jobTask', step: 'done' }, now + 40_000).msg).not.toMatch(/bahşiş/); expect(p.money).toBe(afterTip);
    now += 60_000; act(w, 'u2', { t: 'jobTask', step: 'start' }, now); const r3 = act(w, 'u2', { t: 'jobTask', step: 'done' }, now + 40_000); expect(r3.msg).toMatch(/ücret/);
    expect(p.money).toBeCloseTo(afterTip + wage, 2); expect(p.cs?.jobDays).toBe(1);
    if (p.job!.employerId !== 'dis') expect(Math.abs(totalMoney(w) - total0)).toBeLessThan(0.01);
    // midnight: a paid day is not a miss
    w.day += 1; w.hour = 0; careerHour(w, now + 120_000); expect(p.job).toBeDefined(); expect(p.cs?.missStreak ?? 0).toBe(0);
  });
  it('offline days count toward offStreak (3 → job ends); the hire day is a grace day', () => {
    const w = setup(); const p = hireAs(w, 'J-hamal'); let now = T0 + 3_600_000; w.day -= 1; // back to the hire day; offline from now on
    w.day += 1; w.hour = 0; careerHour(w, now); expect(p.cs?.missStreak ?? 0).toBe(0); expect(p.cs?.offStreak ?? 0).toBe(0);
    for (let d = 0; d < 3; d++) { w.day += 1; for (let h = 0; h < 24; h++) { w.hour = h; now += 3_600_000; careerHour(w, now); } }
    expect(p.job).toBeUndefined();
  });
  it('soldiers keep the kışla attendance system and cannot do İş görevi', () => {
    const w = setup(); const p = me(w); p.itibar = 20; for (const k of Object.keys(p)) void k; expect(enlist(w, p)).toBeNull();
    expect(act(w, 'u2', { t: 'jobTask', step: 'start' }, T0).msg).toMatch(/Asker/);
    let now = T0; const m0 = p.money; p.job!.wage = 2; w.day += 1;
    for (let h = 6; h <= 14; h++) { w.hour = h; now += 60_000; touchPlayer(w, 'u2', now); goTo(w, p, 'kisla', now); careerHour(w, now); }
    expect(p.money).toBeGreaterThan(m0);
  });
});
describe('v2.0.3 hiring resets old misses', () => {
  it('a player fired for 2 misses starts the next job with missStreak 0 (one miss no longer fires him)', () => {
    const w = setup(); const p = me(w); p.itibar = 40; p.job = undefined; (p.cs ??= {}).missStreak = 2; rules.reach = false;
    expect(act(w, 'u2', { t: 'jobApply', jobId: 'J-hamal' }, T0).ok).toBe(true); rules.reach = true;
    expect(p.cs!.missStreak).toBe(0); expect(p.job!.hiredDay).toBe(w.day);
  });
});

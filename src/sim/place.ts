/**
 * Where everybody is on the map at a given real time. Shared by the client (drawing) and the server
 * (checking that an interaction happens near the building / person). NPCs follow a deterministic daily
 * schedule; player characters follow the path they walked; talks, escorts and investigations override.
 */
import type { Person, World } from './types';
import { ROADS_X, ROADS_Y } from './world';
import { hourMs } from './tick';
import { walkPos, type Pt } from './move';
import { bekciShift } from './life';

export const TALK_MS = 45_000; // a map conversation lasts 45 real seconds
export const ESCORT_MS = 18_000;
export const PLAYER_POS_MS = 15 * 60_000; // a player's own position is kept for 15 min after the last heartbeat

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function nearestRoad(y: number): number { return ROADS_Y.reduce((a, r) => (Math.abs(r - y) < Math.abs(a - y) ? r : a), ROADS_Y[0]!); }
function route(a: Pt, b: Pt): Pt[] {
  const ry = nearestRoad(a.y); const ry2 = nearestRoad(b.y);
  const rx = ROADS_X.reduce((acc, r) => (Math.abs(r - b.x) < Math.abs(acc - b.x) ? r : acc), ROADS_X[0]!);
  if (ry === ry2) return [a, { x: a.x, y: ry + 0.5 }, { x: b.x, y: ry + 0.5 }, b];
  return [a, { x: a.x, y: ry + 0.5 }, { x: rx + 0.5, y: ry + 0.5 }, { x: rx + 0.5, y: ry2 + 0.5 }, { x: b.x, y: ry2 + 0.5 }, b];
}
export function along(path: Pt[], f: number): Pt {
  let total = 0; const seg: number[] = [];
  for (let i = 1; i < path.length; i += 1) { const d = Math.abs(path[i]!.x - path[i - 1]!.x) + Math.abs(path[i]!.y - path[i - 1]!.y); seg.push(d); total += d; }
  let t = f * total;
  for (let i = 1; i < path.length; i += 1) {
    const d = seg[i - 1]!; if (t <= d || i === path.length - 1) { const k = d ? Math.min(1, t / d) : 1; const p0 = path[i - 1]!, p1 = path[i]!; return { x: p0.x + (p1.x - p0.x) * k, y: p0.y + (p1.y - p0.y) * k }; }
    t -= d;
  }
  return path[path.length - 1]!;
}

const MARKETS = ['pazar', 'gida', 'zanaat', 'yeni', 'kahve'];
const dayPlan = new Map<string, { pious: boolean; eve: string }>();
export const NPC_SPEED = 2.4; // tiles per real second (players walk 3.6)
export interface Placed { p: Person; x: number; y: number; moving: boolean; visible: boolean; dir: number; talking?: boolean }

export function playerWalking(w: World, p: Person, now: number): boolean {
  if (!p.walk) return false;
  if (p.task) return true; // v1.7: an NPC on an errand follows its own path
  if (!p.playerId) return false;
  const pl = w.players[p.playerId]; return !!pl && now - pl.lastSeen < PLAYER_POS_MS;
}

/** Schedule position (no overrides) of one person. */
function scheduled(w: World, p: Person, now: number, ctx: Ctx): Placed {
  const { t, night, B, door, site, festOpen } = ctx;
  const h = hash(p.id);
  const market = p.prof === 'memur' || p.prof === 'tahsildar' ? 'kahve' : MARKETS[h % 4]!;
  let work = p.work;
  if (p.prof === 'insaatci' && site) work = site;
  if (festOpen && t >= 12 && t < 20 && h % 3 === 0) work = 'festival';
  const home = p.home;
  const off = (h % 60) / 60;
  const s1 = 5.5 + off, s3 = 17 + off, s5 = 20.5 + off, s6 = 22 + off;
  let pos: Pt; let moving = false; let visible = true;
  const wanderX = Math.sin(now / 2300 + h) * 0.9 + Math.sin(now / 5100 + h * 3) * 0.6;
  const wanderY = Math.cos(now / 3100 + h * 2) * 0.35;
  const walking = Math.abs(Math.cos(now / 2300 + h)) > 0.35;
  if (p.prof === 'asker') { const at = h % 3 === 0 ? 'saray' : 'kisla'; pos = door(B.has(at) ? at : 'saray', p, 2.4); pos.x += wanderX * 0.3; moving = false; visible = at === 'saray' || !night || h % 2 === 0; } // soldiers: kışla or Saray guard, no patrols
  else if (p.prof === 'bekci' && (bekciShift(p) === 'gece') === night) { const k = (now / 50000 + (h % 10) / 10) % 1; const route2 = night ? [{ x: 6, y: 29.5 }, { x: 80, y: 29.5 }, { x: 80, y: 35.5 }, { x: 6, y: 35.5 }, { x: 6, y: 29.5 }] : [{ x: 30, y: 20.5 }, { x: 80, y: 20.5 }, { x: 80, y: 29.5 }, { x: 30, y: 29.5 }, { x: 30, y: 20.5 }]; pos = along(route2, k); moving = true; }
  else if (p.prof === 'bekci' && false) { const k = (now / 50000 + (h % 10) / 10) % 1; pos = along([{ x: 6, y: 29.5 }, { x: 80, y: 29.5 }, { x: 80, y: 35.5 }, { x: 6, y: 35.5 }, { x: 6, y: 29.5 }], k); moving = true; }
  else if (p.nightOut && night) { const k = (now / 60000 + (h % 10) / 10) % 1; const bb = B.get('bar')!; pos = along([{ x: bb.door.x, y: bb.door.y + 0.5 }, { x: bb.door.x, y: 20.5 }, { x: 44, y: 20.5 }, { x: 44, y: 29.5 }, { x: bb.door.x, y: 29.5 }, { x: bb.door.x, y: bb.door.y + 0.5 }], k); moving = true; }
  else {
    // v1.9 human routine: home → work → lunch (kahve / pazar / kuyu / cami) → work → evening (pazar, cami, meyhane or a friend's house) → home
    const dh = hash(p.id + ':' + w.day);
    // v1.9.3: the day's plan is fixed at the first look each day: din/relations drift every heartbeat and used to
    // flip the lunch/evening destination mid-walk (a visible jump every 6 s).
    const fk = `${w.seed}:${p.id}:${w.day}`; let plan0 = dayPlan.get(fk);
    if (!plan0) { const friend = Object.entries(p.relations).filter(([id, r]) => r > 25 && id !== p.id).sort((a, b) => b[1] - a[1])[dh % 3]?.[0]; const fHome = (friend ? w.people.find((x) => x.id === friend)?.home : undefined) ?? '';
      plan0 = { pious: p.din > 68 && dh % 3 === 0, eve: p.din > 70 && dh % 2 === 0 ? 'cami' : p.din < 35 && dh % 3 === 0 && B.has('bar') ? 'bar' : fHome && fHome !== home && dh % 4 === 1 ? fHome : market };
      if (dayPlan.size > 4000) dayPlan.clear(); dayPlan.set(fk, plan0); }
    const eve = plan0.eve; const lunch = plan0.pious ? 'cami' : market;
    // v1.9.3: legs are walked at a real, constant pace (NPC_SPEED tiles/s) instead of "cover the leg in N game hours"
    // (a 7.5 s lunch leg across town meant sprinting, then crawling). Each leg starts where the previous one really ended.
    const workP = door(work, p); const lunchCands = (plan0.pious ? ['cami'] : ['kahve', market, 'kuyu', 'gida', 'pazar']).filter((id) => B.has(id));
    const lunchP = lunchCands.map((id) => door(id, p, 2.2)).sort((x, y) => Math.abs(x.x - workP.x) + Math.abs(x.y - workP.y) - Math.abs(y.x - workP.x) - Math.abs(y.y - workP.y))[dh % 2 && lunchCands.length > 1 ? 1 : 0] ?? door(lunch, p, 2.2);
    const L1 = 11.8 + off * 0.6, L3 = L1 + 1.3;
    const plan: [number, Pt, number][] = [[s1, workP, 1.2], [L1, lunchP, 0.9], [L3, workP, 1.2], [s3, door(eve, p, 2.2), eve === market ? 1.8 : 0.8], [s5, door(home, p), 0]];
    const hs = hourMs(w) / 1000; let cur: Pt = door(home, p); let free = 0; let rad = 0; let arrived = true; visible = t >= s1 && t < s6;
    const idle = (at: Pt, r: number): void => { const st = stroll(p, now, r); pos = { x: at.x + st.dx, y: at.y + st.dy }; moving = st.moving; };
    pos = cur;
    for (const [start, dest, r] of plan) {
      if (t < start) break;
      const t0 = Math.max(start, free); if (t < t0) { break; }
      let from = cur; if (rad > 0) { const st = stroll(p, now - (t - t0) * hs * 1000, rad); from = { x: cur.x + st.dx, y: cur.y + st.dy }; } // leave from where you were strolling
      const path = route(from, dest); let len = 0; for (let i = 1; i < path.length; i += 1) len += Math.abs(path[i]!.x - path[i - 1]!.x) + Math.abs(path[i]!.y - path[i - 1]!.y);
      const walked = (t - t0) * hs * NPC_SPEED;
      if (walked < len) { pos = along(path, walked / len); moving = true; arrived = false; rad = -1; break; }
      cur = dest; free = t0 + len / NPC_SPEED / hs; rad = r; arrived = true;
    }
    if (rad >= 0) { if (rad > 0) idle(cur, rad); else pos = cur; }
    if (!arrived) visible = true; // still on the way home after 22:00 – walk in, don't vanish
    void lunch;
    void wanderY; void walking;
  }
  if (p.id === w.kayzerId || p.prof === 'naip' || (p.soylu && p.home === 'saray')) { pos = door('saray', p, 2); pos.x += wanderX * 0.7; moving = walking; visible = !night || !!p.nightOut; }
  return { p, x: pos.x, y: pos.y, moving, visible, dir: 1 };
}

/** Idle behaviour: stroll to a nearby spot, stop, look around, repeat (deterministic from time, no snapping). */
function stroll(p: Person, now: number, r: number): { dx: number; dy: number; moving: boolean } {
  const h = hash(p.id); const P = 14000 + (h % 9000); const ph = now / P + (h % 1000) / 1000; const k = Math.floor(ph); const f = ph - k;
  const spot = (i: number): Pt => { const a = hash(p.id + '#' + i); return { x: ((a % 1000) / 1000 - 0.5) * 2 * r, y: (((a >> 10) % 1000) / 1000 - 0.5) * r * 0.9 }; };
  const a = spot(k), b = spot(k + 1); const walkF = 0.3 + (h % 20) / 100; // walk part of the cycle, then stand
  if (f < walkF) { const e = f / walkF; const s = e * e * (3 - 2 * e); return { dx: a.x + (b.x - a.x) * s, dy: a.y + (b.y - a.y) * s, moving: true }; }
  return { dx: b.x, dy: b.y, moving: false };
}
/** Personal space: standing people never stack (cheap grid pass). */
function separate(list: Placed[]): void {
  const grid = new Map<string, Placed[]>(); const MIN = 0.62;
  list = list.filter((q) => !q.moving); // v1.9.3: walkers pass through; only people standing around keep their distance
  for (const q of list) { if (!q.visible) continue; const key = `${Math.floor(q.x)},${Math.floor(q.y)}`; const g = grid.get(key); if (g) g.push(q); else grid.set(key, [q]); }
  for (const q of list) {
    if (!q.visible || q.talking) continue; const cx = Math.floor(q.x), cy = Math.floor(q.y);
    for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) for (const o of grid.get(`${gx},${gy}`) ?? []) {
      if (o === q || o.p.id < q.p.id) continue; const dx = o.x - q.x, dy = o.y - q.y; const d = Math.hypot(dx, dy);
      if (d >= MIN) continue; const push = (MIN - d) / 2; const ux = d > 0.001 ? dx / d : ((hash(q.p.id) % 2) ? 1 : -1), uy = d > 0.001 ? dy / d : 0.3;
      if (!o.talking) { o.x += ux * push; o.y += uy * push * 0.6; } q.x -= ux * push; q.y -= uy * push * 0.6;
    }
  }
}
interface Ctx { t: number; night: boolean; B: Map<string, World['buildings'][number]>; door: (id: string, p: Person, spread?: number) => Pt; site?: string; festOpen: boolean }
function mkCtx(w: World, now: number): Ctx {
  // v1.9.3: the clock keeps running between snapshots. It used to stop at hour+0.999 until the next
  // heartbeat delivered the new hour (1 game hour = 15 s, polls every 6 s), so everyone froze, then lurched.
  const frac = w.frozen ? 0 : Math.max(0, Math.min(3, (now - w.lastTickAt) / hourMs(w)));
  const t = (w.hour + frac) % 24;
  const B = new Map(w.buildings.map((b) => [b.id, b]));
  const door = (id: string, p: Person, spread = 1.6): Pt => {
    const b = B.get(id) ?? B.get('pazar')!; const h = hash(p.id + id);
    const isBig = ['pazar', 'kahve', 'santiye', 'kisla', 'liman', 'ciftlik', 'festival', 'arsa', 'yapi'].includes(b.kind);
    if (b.kind === 'ciftlik' || b.kind === 'arsa' || b.kind === 'festival') return { x: b.x + 0.8 + (h % 100) / 100 * (b.w - 1.6), y: b.y + 1 + ((h >> 8) % 100) / 100 * (b.h - 1.2) };
    if (isBig) return { x: b.x + 0.5 + (h % 100) / 100 * (b.w - 1), y: b.y + b.h + 0.3 + ((h >> 8) % 100) / 100 * spread };
    return { x: b.door.x + 0.5 + ((h % 100) / 100 - 0.5) * spread * 2, y: b.door.y + 0.5 + ((h >> 8) % 100) / 100 * spread * 0.6 };
  };
  return { t, night: t < 6 || t >= 21.5, B, door, site: w.projects.find((x) => !x.done && x.plot && x.paid >= 6)?.plot, festOpen: (w.festivalUntil ?? 0) >= w.day };
}

export function schedulePos(w: World, p: Person, now: number): Pt { const q = scheduled(w, p, now, mkCtx(w, now)); return { x: q.x, y: q.y }; }
export function placePeople(w: World, now: number): Placed[] {
  const c = mkCtx(w, now);
  const zindan = c.B.get('zindan');
  const jailed = w.people.filter((p) => p.jailedDays > 0);
  const out = new Map<string, Placed>();
  for (const p of w.people) {
    let q: Placed;
    if (p.jailedDays > 0 && inCustody(w, p) && c.B.get('mahkeme')) { const m = c.B.get('mahkeme')!; q = { p, x: m.door.x + 1.6 + (hash(p.id) % 3) * 0.5, y: m.door.y + 1.1, moving: false, visible: true, dir: -1 }; }
    else if (p.jailedDays > 0 && zindan) { const i = jailed.indexOf(p); const cols = Math.max(1, zindan.w - 1); q = { p, x: zindan.x + 0.8 + (i % cols), y: zindan.y + zindan.h - 0.6 - Math.floor(i / cols) * 0.5, moving: false, visible: true, dir: 1 }; }
    else if (p.playerId && (p.homeUntil ?? 0) > now && c.B.get(p.home)) { const hb = c.B.get(p.home)!; q = { p, x: hb.door.x + 0.5, y: hb.door.y + 0.4, moving: false, visible: false, dir: 1 }; }
    else if (playerWalking(w, p, now)) { const r = walkPos(p.walk!, now); q = { p, x: r.pt.x, y: r.pt.y, moving: r.moving, visible: true, dir: r.dir }; }
    else q = scheduled(w, p, now, c);
    if (p.exiledDays > 0) q.visible = false;
    if ((w.raid?.phase === 'gece' || w.foreign?.landed) && (!p.playerId || p.npc) && p.prof !== 'asker' && p.prof !== 'bekci' && p.jailedDays === 0) { const hb = c.B.get(p.home); if (hb) { q.x = hb.door.x + 0.5; q.y = hb.door.y + 0.4; } q.visible = false; q.moving = false; } // v1.9.9: NPCs hide at home
    if (w.isyan && !playerWalking(w, p, now)) {
      if (w.isyan.rebels.includes(p.id)) { const at = w.isyan.occupied[w.isyan.occupied.length - 1] ?? 'pazar'; const d = c.door(at, p, 3); q.x = d.x + Math.sin(now / 2300 + hash(p.id)) * 2; q.y = d.y; q.visible = true; q.moving = true; }
      else if (p.prof === 'asker') { const d = c.door('saray', p, 3); q.x = d.x; q.y = d.y + 1; q.visible = true; q.moving = false; }
    }
    out.set(p.id, q);
  }
  // map conversations: b walks up to a, both stand and talk
  for (const tk of w.talks ?? []) {
    if (!tk.at || now - tk.at > TALK_MS || now < tk.at) continue;
    if (w.raid?.phase === 'gece' || w.foreign?.landed) continue; // v1.9.9: nobody chats on the street during a raid/war
    const a = out.get(tk.a), b = out.get(tk.b); if (!a || !b || a.p.jailedDays || b.p.jailedDays) continue;
    if (playerWalking(w, a.p, now) || playerWalking(w, b.p, now)) continue;
    const k = Math.min(1, (now - tk.at) / 6000);
    const tx = a.x + 0.95, ty = a.y;
    b.x = b.x + (tx - b.x) * k; b.y = b.y + (ty - b.y) * k; b.moving = k < 1; b.visible = true; b.dir = -1;
    a.moving = false; a.visible = true; a.talking = true; b.talking = k >= 1;
  }
  // bekçi walks to a reported corpse and stays for the investigation
  for (const co of w.corpses ?? []) {
    if (!co.bekciId || !co.reportedAt || !co.bekciFrom || (co.stage !== 'ihbar' && co.stage !== 'inceleme')) continue;
    const q = out.get(co.bekciId); if (!q || playerWalking(w, q.p, now)) continue;
    const d = Math.hypot(co.x - co.bekciFrom.x, co.y - co.bekciFrom.y); const dur = Math.max(4000, d / 3 * 1000);
    const k = Math.min(1, (now - co.reportedAt) / dur);
    q.x = co.bekciFrom.x + (co.x + 0.8 - co.bekciFrom.x) * k; q.y = co.bekciFrom.y + (co.y - co.bekciFrom.y) * k; q.moving = k < 1; q.visible = true;
  }
  // escorts: the bekçi walks the convict to the zindan
  for (const e of w.escorts ?? []) {
    if (now - e.at > ESCORT_MS || !zindan) continue;
    const k = Math.min(1, (now - e.at) / ESCORT_MS); const to = { x: zindan.door.x + 0.5, y: zindan.door.y + 0.6 };
    const x = e.from.x + (to.x - e.from.x) * k, y = e.from.y + (to.y - e.from.y) * k;
    const c1 = out.get(e.personId), b1 = out.get(e.bekciId);
    if (c1) { c1.x = x; c1.y = y; c1.moving = k < 1; c1.visible = true; }
    if (b1) { b1.x = x + 0.8; b1.y = y; b1.moving = k < 1; b1.visible = true; }
  }
  // a hearing: the accused, the kadı and the savcı stand at the courthouse
  const mh = c.B.get('mahkeme');
  if (mh) for (const cs of w.cases) {
    if (!cs.trial || cs.trial.done) continue;
    const put = (id: string | null, dx: number): void => { const q = id ? out.get(id) : undefined; if (q && !playerWalking(w, q.p, now)) { q.x = mh.door.x + 0.5 + dx; q.y = mh.door.y + 0.8; q.visible = true; q.moving = false; } };
    put(cs.accusedId, 0); put(cs.trial.judgeId, -1.2); put(cs.trial.prosecutorId, 1.2);
  }
  const all = [...out.values()]; separate(all.filter((q) => !q.p.playerId && !playerWalking(w, q.p, now))); return all;
}

/** Arrested but not yet sentenced: held at the courthouse (nezarethane), not in the zindan. */
export function inCustody(w: World, p: Person): boolean { return w.arrests.some((a) => a.criminalId === p.id && a.status === 'bekliyor') || w.cases.some((c) => c.accusedId === p.id && c.stage !== 'kapandi'); }
export function placeOf(w: World, id: string, now: number): Placed | undefined { return placePeople(w, now).find((q) => q.p.id === id); }

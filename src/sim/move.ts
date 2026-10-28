/**
 * Real movement (v1.6): a walkable tile grid, A* pathfinding, and where actions may be done.
 * Player characters walk along a path stored on the server (deterministic in real time),
 * so the server can check that a building interaction happens at the building.
 */
import type { Action, Building, Person, World } from './types';
import { MAP_H, MAP_W } from './constants';

export interface Pt { x: number; y: number }
export interface Walk { path: Pt[]; t0: number; speed: number }
export const WALK_SPEED = 3.6; // tiles per real second
export const REACH = 2.2; // tiles from a building's outline that count as "at the building"
export const PERSON_REACH = 1.3; // v1.7: you must stand right next to someone (~1 tile)
/** Tests and the long simulation may switch distance checks off. */
export const rules = { reach: true };

const OPEN = new Set(['pazar', 'kahve', 'festival', 'ciftlik', 'arsa', 'santiye', 'liman', 'yapi']);
let gridKey = ''; let grid: Uint8Array = new Uint8Array(0);
export function walkGrid(w: World): Uint8Array {
  const key = `${w.buildings.length}:${w.buildings.map((b) => b.kind[0]).join('')}`;
  if (key === gridKey) return grid;
  const g = new Uint8Array(MAP_W * MAP_H).fill(1);
  for (let y = 48; y < MAP_H; y += 1) for (let x = 0; x < MAP_W; x += 1) g[y * MAP_W + x] = 0; // sea
  for (const b of w.buildings) {
    if (OPEN.has(b.kind)) { if (b.kind === 'liman') for (let y = b.y; y < Math.min(MAP_H, b.y + b.h + 3); y += 1) for (let x = b.x; x < b.x + b.w; x += 1) g[y * MAP_W + x] = 1; continue; }
    for (let y = b.y; y < b.y + b.h; y += 1) for (let x = b.x; x < b.x + b.w; x += 1) if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) g[y * MAP_W + x] = 0;
  }
  gridKey = key; grid = g; return g;
}
const ok = (g: Uint8Array, x: number, y: number): boolean => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && g[y * MAP_W + x] === 1;

function nearestFree(g: Uint8Array, x: number, y: number): Pt {
  const cx = Math.max(0, Math.min(MAP_W - 1, Math.floor(x))), cy = Math.max(0, Math.min(MAP_H - 1, Math.floor(y)));
  if (ok(g, cx, cy)) return { x: cx, y: cy };
  for (let r = 1; r < 20; r += 1) for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; if (ok(g, cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
  }
  return { x: cx, y: cy };
}

/** A* on the tile grid (8-way, no corner cutting). Returns tile-centre points, smoothed. */
export function findPath(w: World, from: Pt, to: Pt): Pt[] {
  const g = walkGrid(w);
  const s = nearestFree(g, from.x, from.y), t = nearestFree(g, to.x, to.y);
  const N = MAP_W * MAP_H; const idx = (x: number, y: number): number => y * MAP_W + x;
  const gs = new Float32Array(N).fill(Infinity); const came = new Int32Array(N).fill(-1); const closed = new Uint8Array(N);
  const open: number[] = []; const f = new Float32Array(N).fill(Infinity);
  const hh = (i: number): number => { const x = i % MAP_W, y = (i / MAP_W) | 0; const dx = Math.abs(x - t.x), dy = Math.abs(y - t.y); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  const si = idx(s.x, s.y), ti = idx(t.x, t.y); gs[si] = 0; f[si] = hh(si); open.push(si);
  let iter = 0;
  while (open.length && iter++ < 20000) {
    let bi = 0; for (let k = 1; k < open.length; k += 1) if (f[open[k]!]! < f[open[bi]!]!) bi = k;
    const cur = open[bi]!; open[bi] = open[open.length - 1]!; open.pop();
    if (cur === ti) break; if (closed[cur]) continue; closed[cur] = 1;
    const cx = cur % MAP_W, cy = (cur / MAP_W) | 0;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (!ok(g, nx, ny)) continue;
      if (dx && dy && (!ok(g, cx + dx, cy) || !ok(g, cx, cy + dy))) continue;
      const ni = idx(nx, ny); if (closed[ni]) continue; const ng = gs[cur]! + (dx && dy ? 1.414 : 1);
      if (ng < gs[ni]!) { gs[ni] = ng; came[ni] = cur; f[ni] = ng + hh(ni); open.push(ni); }
    }
  }
  if (came[ti] === -1 && ti !== si) return [from, to];
  const raw: Pt[] = []; for (let i = ti; i !== -1; i = came[i]!) { raw.push({ x: (i % MAP_W) + 0.5, y: ((i / MAP_W) | 0) + 0.5 }); if (i === si) break; }
  raw.reverse();
  // string-pulling: keep a point only if the straight line to the next kept one is blocked
  const clear = (a: Pt, b: Pt): boolean => { const d = Math.hypot(b.x - a.x, b.y - a.y); const n = Math.ceil(d * 3); for (let k = 0; k <= n; k += 1) { const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n; if (!ok(g, Math.floor(x), Math.floor(y)) || !ok(g, Math.floor(x + 0.3), Math.floor(y)) || !ok(g, Math.floor(x - 0.3), Math.floor(y))) return false; } return true; };
  const out: Pt[] = [{ x: from.x, y: from.y }]; let anchor: Pt = out[0]!;
  for (let i = 1; i < raw.length; i += 1) { if (!clear(anchor, raw[i]!)) { out.push(raw[i - 1]!); anchor = raw[i - 1]!; } }
  const end = ok(g, Math.floor(to.x), Math.floor(to.y)) ? to : raw[raw.length - 1] ?? to; out.push(end);
  return out;
}

export function pathLength(p: Pt[]): number { let d = 0; for (let i = 1; i < p.length; i += 1) d += Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.y - p[i - 1]!.y); return d; }
export function walkPos(wk: Walk, now: number): { pt: Pt; moving: boolean; dir: number } {
  let t = Math.max(0, (now - wk.t0) / 1000) * wk.speed;
  for (let i = 1; i < wk.path.length; i += 1) {
    const a = wk.path[i - 1]!, b = wk.path[i]!; const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (t <= d) { const k = d ? t / d : 1; return { pt: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, moving: true, dir: b.x < a.x ? -1 : 1 }; }
    t -= d;
  }
  return { pt: wk.path[wk.path.length - 1]!, moving: false, dir: 1 };
}
export function walkEnd(wk: Walk): number { return wk.t0 + (pathLength(wk.path) / wk.speed) * 1000; }

export function distToBuilding(b: Building, p: Pt): number {
  const ext = b.kind === 'liman' ? 3 : 0;
  const dx = Math.max(b.x - p.x, 0, p.x - (b.x + b.w)); const dy = Math.max(b.y - p.y, 0, p.y - (b.y + b.h + ext));
  return Math.hypot(dx, dy);
}
/** The spot in front of a building's door where a walker stops. */
export function doorSpot(b: Building): Pt { return OPEN.has(b.kind) && b.kind !== 'liman' ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : { x: b.door.x + 0.5, y: b.door.y + 0.6 }; }

export type Need = { kind: 'building'; ids: string[]; label: string } | { kind: 'person'; id: string } | { kind: 'animal'; animal: import('./realm').Animal } | null;
const MARKET_IDS = (w: World): string[] => w.buildings.filter((b) => b.market).map((b) => b.id);
const RULER: Action['t'][] = ['answer', 'setTax', 'setHeadTax', 'setSalary', 'toggleLaw', 'startProject', 'appoint', 'pardon', 'enactLaw', 'repealLaw', 'sanction', 'directive', 'granary', 'priceCap', 'tribute', 'festivalOpen', 'festival', 'buildAt', 'veliaht', 'abdicate', 'petition'];
/** Where an action has to be done. null = anywhere (messages, answers, settings). */
export function actionNeed(w: World, me: Person, a: Action): Need {
  const B = (ids: string[], label: string): Need => ({ kind: 'building', ids: ids.filter((id) => w.buildings.some((b) => b.id === id)), label });
  switch (a.t) {
    case 'buy': case 'sell': return B(MARKET_IDS(w), 'bir pazara');
    case 'caravanBuy': return B([...MARKET_IDS(w), 'liman'], 'pazara ya da limana');
    case 'eat': return B([...MARKET_IDS(w), 'firin', 'kasaphane', 'bar', me.home], 'evinize, fırına ya da bir pazara');
    case 'askida': return B(['firin'], 'Fırın’a');
    case 'buyHome': case 'rentHome': return B([a.houseId], 'eve');
    case 'goHome': return me.home ? B([me.home], 'evinize') : null;
    case 'buyFarm': case 'buyAnimal': return B(['hayvan'], 'Hayvan Pazarı’na');
    case 'slaughter': return { kind: 'animal', animal: a.animal };
    case 'ride': return a.on ? { kind: 'animal', animal: 'at' } : null;
    case 'buildBarn': case 'feedAnimals': case 'collectFarm': return B(['ciftlik'], 'çiftliğinize (Buğday Tarlaları)');
    case 'grantTitle': case 'stripTitle': case 'assignSpy': case 'warrant': case 'raidOrg': case 'informantPay': return B(['saray'], 'Saray’a');
    case 'searchHouse': { const t = w.people.find((p) => p.id === a.personId); return t ? B([t.home], 'şüphelinin evine') : null; }
    case 'drinkWater': return B(['kuyu', 'gida', 'pazar', me.home], 'kuyuya, evinize ya da pazara');
    case 'pray': case 'sermon': return B(['cami'], 'Cami’ye');
    case 'drink': return B(['bar'], 'Meyhane’ye');
    case 'doctor': case 'cure': return B(['hekimhane'], 'Hekimhane’ye');
    case 'school': return B(['okul'], 'Okul’a');
    case 'work': return B([me.work, 'santiye'], 'iş yerinize');
    case 'witness': { const c = w.cases.find((x) => x.id === a.caseId); if (c?.trial && !c.trial.done && ((c.eyeIds ?? []).includes(me.id) || c.trial.blamedId === me.id)) return null; return B(['mahkeme'], 'Mahkeme’ye'); } // summoned / eyewitness speak from the popup
    case 'caseDecision': case 'defend': return B(['mahkeme'], 'Mahkeme’ye');
    case 'customize': return a.where === 'terzi' ? B(['dokuma'], 'Terzi’ye (Dokuma Tezgâhı)') : a.where === 'berber' ? B(['atolye'], 'Berber’e (Zanaat Atölyesi)') : null;
    case 'runForMeclis': case 'castVote': case 'speak': case 'propose': case 'joinFaction': case 'vote': case 'runForBaskan': case 'voteBaskan': return B(['meclis', 'pazar'], 'Meclis’e ya da Meydan’daki sandığa');
    case 'poster': case 'campaign': return B(['pazar'], 'Meydan’a (Pazar)');
    case 'plot': case 'fundPlot': return B(['kisla', 'bar'], 'Kışla’ya ya da Meyhane’ye');
    case 'seize': return B(['saray'], 'Saray’a');
    case 'borrow': case 'repay': return B(['pazar', 'kahve'], 'Pazar’daki sarrafa');
    case 'steal': case 'assault': case 'kill': case 'insult': case 'give': case 'bribe': case 'arrest': case 'inspect': case 'marry':
      if (a.t === 'give' && a.personId === me.id) return null;
      return { kind: 'person', id: a.personId };
    case 'report': return { kind: 'person', id: `corpse:${a.corpseId}` };
    default: break;
  }
  if (RULER.includes(a.t)) return B(['saray'], 'Saray’a');
  return null;
}

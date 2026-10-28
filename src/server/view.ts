/**
 * v2.0.5 slim world view (lag fix). The full world (~300 KB) used to go to every client on every 6 s heartbeat.
 * Now the server sends only what the client does not already have:
 *  - server-only data (alibi position log, LLM budget…) is never sent; the ledger is cut to the player's own rows;
 *  - every top-level section carries a short content hash; the client echoes the hashes back and unchanged sections are skipped;
 *  - people are hashed one by one, so only people who changed are re-sent (the player's own person is always sent).
 * Stateless: the client's echoed hashes are the only "memory", so any edge instance can answer and a client
 * without hashes (first load, reload, version change) simply gets everything.
 */
import type { Person, World } from '../sim/types';

export const VIEW_V = 1;
/** never needed by the client (used only by server-side simulation) */
const SERVER_ONLY = new Set(['posLog', 'posAt', 'crimeLog', 'llm', 'chatOut']);

export interface Have { v?: number; s?: Record<string, string>; p?: Record<string, string>; l?: Record<string, string> }
export interface WorldView {
  v: number;
  /** changed (or new) sections */
  s: Record<string, unknown>;
  /** hash of every section the client should hold (sections missing here are deleted) */
  h: Record<string, string>;
  /** people: order of ids, changed persons, and every person's hash */
  p: { ids: string[]; upd: (Person | PersonPatch)[]; h: Record<string, string> };
  /** players record, per player (lastSeen changes on every heartbeat) */
  pl?: { upd: Record<string, unknown>; h: Record<string, string> };
}
/** only the changed fields of a person, relative to the version the client holds (hash b) */
export interface PersonPatch { id: string; b: string; f: Record<string, unknown>; x?: string[] }
const isPatch = (u: Person | PersonPatch): u is PersonPatch => typeof (u as PersonPatch).b === 'string' && typeof (u as PersonPatch).f === 'object';

/**
 * Per-instance memory of recently sent persons (hash → field JSON), used to send only changed fields.
 * Purely an optimisation: on a miss (cold edge instance) the whole person is sent.
 */
const sent = new Map<string, Record<string, string>>();
const SENT_MAX = 4000;
function remember(hash: string, p: Person): Record<string, string> {
  let f = sent.get(hash);
  if (!f) { f = {}; for (const [k, v] of Object.entries(p)) if (v !== undefined) f[k] = JSON.stringify(v); sent.set(hash, f); if (sent.size > SENT_MAX) sent.delete(sent.keys().next().value!); }
  return f;
}
function patchOf(p: Person, base: Record<string, string>, b: string): PersonPatch | null {
  const f: Record<string, unknown> = {}; const x: string[] = []; let n = 0;
  for (const [k, v] of Object.entries(p)) { if (v === undefined) continue; const j = JSON.stringify(v); if (base[k] !== j) { f[k] = v; n++; } }
  for (const k of Object.keys(base)) if ((p as unknown as Record<string, unknown>)[k] === undefined) x.push(k);
  return n || x.length ? { id: p.id, b, f, ...(x.length ? { x } : {}) } : null;
}

/** FNV-1a 32-bit → base36 (short, fast; collisions are irrelevant at this scale and only cost one stale section until it changes again) */
export function hashStr(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/** The world as one client is allowed/needs to see it (no copying of big parts: only filtered fields are new objects). */
function sections(w: World, myPersonId: string | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(w)) {
    if (k === 'people' || k === 'players' || SERVER_ONLY.has(k) || v === undefined) continue;
    out[k] = v;
  }
  out.ledger = (w.ledger ?? []).filter((l) => l.from === myPersonId || l.to === myPersonId);
  return out;
}

export function makeView(w: World, playerId: string | null, have?: Have | null): WorldView {
  const myPersonId = playerId ? w.players[playerId]?.personId ?? null : null;
  const ok = !!have && have.v === VIEW_V;
  const hs = ok ? have!.s ?? {} : {}; const hp = ok ? have!.p ?? {} : {};
  const s: Record<string, unknown> = {}; const h: Record<string, string> = {};
  for (const [k, v] of Object.entries(sections(w, myPersonId))) {
    const json = JSON.stringify(v); if (json === undefined) continue;
    const x = hashStr(json); h[k] = x;
    if (hs[k] !== x) s[k] = v;
  }
  const ids: string[] = []; const upd: (Person | PersonPatch)[] = []; const ph: Record<string, string> = {};
  for (const p of w.people) {
    const x = hashStr(JSON.stringify(p)); ids.push(p.id); ph[p.id] = x;
    const had = hp[p.id];
    if (had === x && p.id !== myPersonId) { remember(x, p); continue; }
    const base = had ? sent.get(had) : undefined;
    // own person: always sent whole (the client predicts its own walk locally and must be corrected)
    const pt = base && p.id !== myPersonId ? patchOf(p, base, had!) : null;
    upd.push(pt ?? p); remember(x, p);
  }
  const pls = w.players ?? {}; const plu: Record<string, unknown> = {}; const plh: Record<string, string> = {}; const hpl = ok ? have!.l ?? {} : {};
  for (const [id, pl] of Object.entries(pls)) { const x = hashStr(JSON.stringify(pl)); plh[id] = x; if (hpl[id] !== x) plu[id] = pl; }
  return { v: VIEW_V, s, h, p: { ids, upd, h: ph }, pl: { upd: plu, h: plh } };
}

/** What the client sends back with its next request. */
export function haveOf(view: WorldView | null): Have | null { return view ? { v: view.v, s: view.h, p: view.p.h, l: view.pl?.h ?? {} } : null; }

/**
 * Client side: build the new world from the previous one plus a view.
 * Unchanged sections/persons keep the previous objects (no re-parse, no re-allocation).
 * Returns null if the view references something the client does not have (then the client asks for a full view).
 */
export function applyView(prev: World | null, prevView: WorldView | null, v: WorldView): World | null {
  const w: Record<string, unknown> = {};
  const old = (prev ?? {}) as unknown as Record<string, unknown>;
  // a section may be reused only if what the client holds is exactly what the server hashed
  // (two requests in flight can answer against the same base; a mismatch → ask for a full view)
  for (const k of Object.keys(v.h)) {
    if (k in v.s) w[k] = v.s[k];
    else if (k in old && prevView?.h[k] === v.h[k]) w[k] = old[k];
    else return null;
  }
  const byId = new Map<string, Person>(); for (const p of prev?.people ?? []) byId.set(p.id, p);
  const fresh = new Set<string>();
  for (const u of v.p.upd) {
    if (isPatch(u)) {
      const o = byId.get(u.id); if (!o || prevView?.p.h[u.id] !== u.b) return null; // patch against a version we do not hold
      const n = { ...o, ...u.f } as Person; for (const k of u.x ?? []) delete (n as unknown as Record<string, unknown>)[k];
      byId.set(u.id, n);
    } else byId.set(u.id, u);
    fresh.add(u.id);
  }
  const people: Person[] = [];
  for (const id of v.p.ids) {
    const p = byId.get(id); if (!p) return null;
    if (!fresh.has(id) && prevView?.p.h[id] !== v.p.h[id]) return null;
    people.push(p);
  }
  w.people = people;
  if (v.pl) {
    const op = (prev?.players ?? {}) as Record<string, unknown>; const np: Record<string, unknown> = {};
    for (const [id, x] of Object.entries(v.pl.h)) {
      if (id in v.pl.upd) np[id] = v.pl.upd[id]; else if (id in op && prevView?.pl?.h[id] === x) np[id] = op[id]; else return null;
    }
    w.players = np;
  }
  return w as unknown as World;
}

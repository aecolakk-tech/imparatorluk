/**
 * v2.1.0 tek kişilik kayıt sistemi: save format, validation, time shifting (the world pauses while the game is closed),
 * 3 rotating autosave slots on a small key-value store (IndexedDB in the browser, memory in tests), gzip helpers.
 */
import type { World } from '../sim/types';
import type { ChatMsg } from '../server/core';
import { migrateWorld } from '../server/core';

export const SAVE_FORMAT = 'imparatorluk-kayit';
export const SAVE_V = 1;
export const SLOTS = 3;

export interface SoloState { playerId: string; world: World; msgs: ChatMsg[] }
export interface SaveFile { format: typeof SAVE_FORMAT; v: number; game: string; savedAt: number; day: number; name: string; playerId: string; world: World; msgs: ChatMsg[] }
export interface SlotRec { savedAt: number; day: number; name: string; data: string; seq: number }

/** Epoch-ms timestamps (2017…2286) — no other game number is that large (money, ids, seeds stay far below). */
const isStamp = (v: number): boolean => v > 1.5e12 && v < 1e13;
/** Shift every timestamp in the state by `delta` ms (in place). Time that passed while the game was closed simply never happened. */
export function shiftTimes(o: unknown, delta: number): void {
  if (!delta || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { const v = o[i]; if (typeof v === 'number') { if (isStamp(v)) o[i] = v + delta; } else if (v && typeof v === 'object') shiftTimes(v, delta); } return; }
  const r = o as Record<string, unknown>;
  for (const k in r) { const v = r[k]; if (typeof v === 'number') { if (isStamp(v)) r[k] = v + delta; } else if (v && typeof v === 'object') shiftTimes(v, delta); }
}

export function toSaveFile(st: SoloState, game: string, now: number): SaveFile {
  const p = st.world.players[st.playerId]; return { format: SAVE_FORMAT, v: SAVE_V, game, savedAt: now, day: st.world.day, name: p?.name ?? '', playerId: st.playerId, world: st.world, msgs: st.msgs.slice(-300) };
}
export function serialize(st: SoloState, game: string, now: number): string { return JSON.stringify(toSaveFile(st, game, now)); }

/** Parse + validate a save (string or object). Returns an error message (Turkish) or the state, already migrated and shifted to `now`. */
export function parseSave(raw: string | unknown, now: number): SoloState | string {
  let f: Partial<SaveFile>;
  try { f = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<SaveFile>; } catch { return 'Kayıt dosyası okunamadı (bozuk ya da yanlış dosya).'; }
  if (!f || typeof f !== 'object' || f.format !== SAVE_FORMAT) return 'Bu bir İmparatorluk kayıt dosyası değil.';
  if (typeof f.v !== 'number' || f.v > SAVE_V) return 'Bu kayıt oyunun daha yeni bir sürümüyle yapılmış; önce oyunu güncelleyin.';
  const w = f.world as World | undefined; const pid = f.playerId;
  if (!w || typeof w !== 'object' || !Array.isArray(w.people) || !w.players || typeof w.day !== 'number' || typeof pid !== 'string') return 'Kayıt dosyası eksik ya da bozuk.';
  const pl = w.players[pid]; if (!pl || !w.people.some((p) => p.id === pl.personId)) return 'Kayıttaki karakter bulunamadı.';
  try { migrateWorld(w); } catch (e) { return `Kayıt bu sürüme uyarlanamadı: ${(e as Error).message}`; }
  w.solo = true;
  const st: SoloState = { playerId: pid, world: w, msgs: Array.isArray(f.msgs) ? f.msgs : [] };
  const ref = typeof f.savedAt === 'number' && isStamp(f.savedAt) ? f.savedAt : w.lastTickAt;
  if (typeof ref === 'number' && isStamp(ref)) shiftTimes(st, now - ref);
  return st;
}

export function exportName(day: number, d = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `imparatorluk-kayit-${day}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

// ---------- gzip (CompressionStream; available in modern browsers, Android WebView and Node 18+) ----------
export async function gzip(s: string): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip'); const out = new Blob([s]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
export async function gunzip(b: Uint8Array): Promise<string> {
  const ds = new DecompressionStream('gzip'); const out = new Blob([b as BlobPart]).stream().pipeThrough(ds);
  return new Response(out).text();
}
/** File bytes → JSON text: accepts plain JSON or gzip (magic 1f 8b). */
export async function fileText(b: Uint8Array): Promise<string> { return b[0] === 0x1f && b[1] === 0x8b ? gunzip(b) : new TextDecoder().decode(b); }
export function toB64(b: Uint8Array): string { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); }
export function fromB64(s: string): Uint8Array { const bin = atob(s); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; }

// ---------- key-value stores ----------
export interface KV { get(k: string): Promise<unknown>; set(k: string, v: unknown): Promise<void>; del(k: string): Promise<void> }
export class MemoryKV implements KV {
  m = new Map<string, unknown>();
  async get(k: string): Promise<unknown> { const v = this.m.get(k); return v === undefined ? undefined : structuredClone(v); }
  async set(k: string, v: unknown): Promise<void> { this.m.set(k, structuredClone(v)); }
  async del(k: string): Promise<void> { this.m.delete(k); }
}
export class IdbKV implements KV {
  private db: Promise<IDBDatabase> | null = null;
  constructor(private name = 'imparatorluk-solo', private store = 'kv') {}
  private open(): Promise<IDBDatabase> {
    return (this.db ??= new Promise((res, rej) => { const r = indexedDB.open(this.name, 1); r.onupgradeneeded = () => r.result.createObjectStore(this.store); r.onsuccess = () => res(r.result); r.onerror = () => { this.db = null; rej(r.error); }; }));
  }
  private async run<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.open();
    return new Promise((res, rej) => { const tx = db.transaction(this.store, mode); const rq = f(tx.objectStore(this.store)); tx.oncomplete = () => res(rq.result as T); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
  }
  get(k: string): Promise<unknown> { return this.run('readonly', (s) => s.get(k)); }
  async set(k: string, v: unknown): Promise<void> { await this.run('readwrite', (s) => s.put(v, k)); }
  async del(k: string): Promise<void> { await this.run('readwrite', (s) => s.delete(k)); }
}

/** 3 rotating autosave slots: each save goes to the oldest slot, so a save that breaks mid-write never touches the other two. */
export class SaveSlots {
  constructor(private kv: KV) {}
  async write(data: string, savedAt: number, day: number, name: string): Promise<number> {
    const recs = await this.list(); const seq = Math.max(0, ...recs.map((r) => r.rec?.seq ?? 0)) + 1;
    // the slot after the newest one (round robin); empty slots first
    const empty = recs.find((r) => !r.rec); const slot = empty ? empty.slot : recs.reduce((a, b) => ((a.rec!.seq <= b.rec!.seq) ? a : b)).slot;
    await this.kv.set(`slot${slot}`, { savedAt, day, name, data, seq } satisfies SlotRec);
    return slot;
  }
  async list(): Promise<{ slot: number; rec: SlotRec | null }[]> {
    const out: { slot: number; rec: SlotRec | null }[] = [];
    for (let i = 0; i < SLOTS; i++) { let r: unknown; try { r = await this.kv.get(`slot${i}`); } catch { r = undefined; } const ok = !!r && typeof (r as SlotRec).data === 'string' && typeof (r as SlotRec).seq === 'number'; out.push({ slot: i, rec: ok ? (r as SlotRec) : null }); }
    return out;
  }
  /** newest save that parses and validates; corrupt slots are skipped */
  async latest(now: number): Promise<{ st: SoloState; rec: SlotRec; slot: number } | null> {
    const recs = (await this.list()).filter((r) => r.rec).sort((a, b) => b.rec!.seq - a.rec!.seq);
    for (const r of recs) { const st = parseSave(r.rec!.data, now); if (typeof st !== 'string') return { st, rec: r.rec!, slot: r.slot }; }
    return null;
  }
  async info(): Promise<SlotRec | null> { const recs = (await this.list()).filter((r) => r.rec).sort((a, b) => b.rec!.seq - a.rec!.seq); return recs[0]?.rec ?? null; }
  async clear(): Promise<void> { for (let i = 0; i < SLOTS; i++) await this.kv.del(`slot${i}`); }
}

/**
 * v2.1.0 tek kişilik backend: the whole simulation (src/server/core.ts) runs on the device, in memory.
 * No server, no account. The world only advances while the game is open (gaps are shifted away),
 * autosaves to 3 rotating IndexedDB slots (every game day, every 60 s, and when the app is hidden/closed).
 */
import type { Action, ActionResult, Profession, World } from '../sim/types';
import { act, admin, createWorld, drainChat, heartbeat, makeChat, migrateWorld, register, resetWorld, type Candidate, type ChatMsg } from '../server/core';
import type { AdminRequest, Backend, Session, Snapshot } from './api';
import { makeView } from '../server/view';
import { ViewCache } from './viewcache';
import { npcRulerStart, cleanEmpireName } from '../sim/solostart';
import { IdbKV, SaveSlots, parseSave, serialize, shiftTimes, type KV, type SlotRec, type SoloState } from './save';

export const SOLO_PLAYER = 'solo';
/** a gap longer than this between two updates means the game was hidden/asleep: that time is skipped, not simulated */
export const PAUSE_GAP_MS = 15_000;
export const AUTOSAVE_MS = 60_000;

export class SoloBackend implements Backend {
  readonly mode = 'solo' as const;
  st: SoloState | null = null;
  private s: Session | null = null;
  private chatTimes: number[] = [];
  private vc = new ViewCache(); private ver = 0;
  private lastTx = 0; private lastSaveAt = 0; private lastSaveDay = -1; private saving: Promise<void> | null = null; private dirty = false;
  readonly slots: SaveSlots;
  /** game version written into saves */
  game = 'v2.1.0';
  onSaveError: ((e: unknown) => void) | null = null;
  constructor(kv: KV = new IdbKV(), private clock: () => number = () => Date.now()) { this.slots = new SaveSlots(kv); }

  // ---------- game lifecycle ----------
  /** info about the newest autosave (for the 'Devam Et' button) */
  saveInfo(): Promise<SlotRec | null> { return this.slots.info(); }
  /** load the newest valid autosave; null if there is none */
  async continueGame(): Promise<Session | null> {
    const r = await this.slots.latest(this.clock()); if (!r) return null;
    this.use(r.st); return this.s;
  }
  /** a brand-new world with the player as its only human */
  /** start 'halk' (default): NPC Kayzer with a random temperament + random empire name; 'kayzer': the player takes the throne and names the empire */
  async newGame(name: string, prof: Profession, opts: { start?: 'halk' | 'kayzer'; empireName?: string } = {}, seed = Math.floor(Math.random() * 1e9)): Promise<string | null> {
    const now = this.clock(); const nm = name.replace(/[<>]/g, '').trim(); const asKayzer = opts.start === 'kayzer';
    if (nm.length < 2) return 'Adınızı yazın (en az 2 harf).';
    const en = asKayzer ? cleanEmpireName(opts.empireName ?? '') : null;
    if (asKayzer && !en) return 'Devletin adını yazın (3–40 harf; harf, rakam, boşluk, kesme, tire).';
    const w = createWorld(seed, now); w.solo = true;
    const lc = (x: string): string => x.toLocaleLowerCase('tr');
    for (const q of w.people) if (!q.playerId && lc(q.name) === lc(nm.slice(0, 24))) q.name = `${q.name} Efendi`; // an NPC namesake steps aside
    try {
      if (asKayzer) { register(w, SOLO_PLAYER, nm, 'kayzer', true, now); w.empireName = en!; w.empireNamedBy = w.kayzerId ?? undefined; }
      else { npcRulerStart(w); register(w, SOLO_PLAYER, nm, prof, false, now); }
    } catch (e) { return (e as Error).message; }
    this.use({ playerId: SOLO_PLAYER, world: w, msgs: [] });
    await this.saveNow();
    return null;
  }
  /** replace the running game with an imported/downloaded state (validated + migrated + time-shifted by parseSave) */
  async loadState(raw: string | unknown): Promise<string | null> {
    const st = parseSave(raw, this.clock()); if (typeof st === 'string') return st;
    this.use(st); await this.saveNow(); return null;
  }
  private use(st: SoloState): void {
    st.world.solo = true; this.st = st; this.vc = new ViewCache(); this.lastTx = this.clock(); this.pausedAt = null; this.lastSaveDay = st.world.day; this.lastSaveAt = this.clock();
    this.s = { playerId: st.playerId, founder: false };
  }
  /** current save as a JSON string (export / cloud) */
  exportString(): string | null { return this.st ? serialize(this.st, this.game, this.clock()) : null; }
  day(): number { return this.st?.world.day ?? 0; }

  // ---------- saving ----------
  /** write the current state to the next rotating slot (never two writes at once) */
  async saveNow(): Promise<void> {
    if (!this.st) return;
    if (this.saving) { this.dirty = true; return this.saving; }
    const st = this.st; const now = this.clock();
    const data = serialize(st, this.game, now); const day = st.world.day; const name = st.world.players[st.playerId]?.name ?? '';
    this.lastSaveAt = now; this.lastSaveDay = day; this.dirty = false;
    this.saving = this.slots.write(data, now, day, name).then(() => undefined, (e) => { this.onSaveError?.(e); }).finally(() => { this.saving = null; if (this.dirty) void this.saveNow(); });
    return this.saving;
  }
  private maybeAutosave(): void {
    if (!this.st) return;
    if (this.st.world.day !== this.lastSaveDay || this.clock() - this.lastSaveAt >= AUTOSAVE_MS) void this.saveNow();
  }

  // ---------- the simulation step shared by every call ----------
  private tx<T>(f: (w: World) => T): T {
    const st = this.st; if (!st) throw new Error('oyun yüklenmedi');
    const now = this.clock();
    const gap = this.pausedAt !== null ? now - this.pausedAt : this.lastTx && now - this.lastTx > PAUSE_GAP_MS ? now - this.lastTx : 0;
    if (gap > 0) { shiftTimes(st, gap); this.skipped += gap; } // paused (hidden, asleep, closed): that time never happened
    this.pausedAt = null; this.lastTx = now;
    migrateWorld(st.world);
    const r = f(st.world);
    for (const m of drainChat(st.world)) st.msgs.push({ id: `${m.at}-${Math.round(Math.random() * 1e6)}`, ...m });
    if (st.msgs.length > 300) st.msgs.splice(0, st.msgs.length - 300);
    this.maybeAutosave();
    return r;
  }
  /** called by the UI when the page is hidden: mark the pause start so the next update skips the gap, and save */
  pause(): Promise<void> { if (this.st && this.pausedAt === null) this.pausedAt = this.clock(); return this.saveNow(); }
  /** ms of real time skipped by pauses (diagnostics/tests) */
  skipped = 0;
  private pausedAt: number | null = null;

  // ---------- Backend interface ----------
  session(): Session | null { return this.s; }
  async restore(): Promise<Session | null> { return this.s; }
  async register(_access: string, _email: string, _password: string, name: string, prof: Profession): Promise<string | null> { return this.newGame(name, prof); }
  async candidates(): Promise<Candidate[] | string> { return []; }
  async login(): Promise<string | null> { return this.continueGame().then((s) => (s ? null : 'Kayıt yok.')); }
  async logout(): Promise<void> { await this.saveNow(); this.vc = new ViewCache(); this.s = null; }
  async heartbeat(): Promise<{ world: World; summary: string | null }> {
    const me = this.s; if (!me) throw new Error('oyun yok');
    for (let i = 0; i < 2; i++) {
      const have = this.vc.have();
      const r = this.tx((w) => { heartbeat(w, me.playerId, this.clock()); return { view: { ...makeView(w, me.playerId, have), ver: ++this.ver } }; });
      // the view shares objects with the live world: a JSON copy keeps the UI from ever mutating the simulation (views are small)
      const w = this.vc.take(JSON.parse(JSON.stringify(r.view))); if (w) return { world: w, summary: null };
    }
    throw new Error('dünya görünümü alınamadı');
  }
  takeFresh(): World | null { return this.vc.takeFresh(); }
  async act(a: Action): Promise<ActionResult> {
    const me = this.s; if (!me) return { ok: false, msg: 'Oyun yok.' };
    const have = this.vc.have();
    const r = this.tx((w) => { const x = act(w, me.playerId, a, this.clock()); return JSON.parse(JSON.stringify({ ...x, view: { ...makeView(w, me.playerId, have), ver: ++this.ver } })); });
    this.vc.take(r.view, true); delete r.view;
    if (r.ok && a.t !== 'move') this.dirty = true;
    return r;
  }
  async chat(text: string, to: string | null): Promise<string | null> {
    const me = this.s; if (!me) return 'Oyun yok.';
    return this.tx((w) => { const m = makeChat(w, me.playerId, text, to, this.chatTimes, this.clock()); if (typeof m === 'string') return m; this.st!.msgs.push(m); return null; });
  }
  async messages(): Promise<ChatMsg[]> {
    const st = this.st; if (!st) return [];
    const me = st.world.players[st.playerId]?.personId;
    return st.msgs.filter((m) => m.toPersonId === null || m.toPersonId === me || m.fromPersonId === me);
  }
  async admin(r: AdminRequest): Promise<string> {
    if (!this.st) return 'Oyun yok.';
    if (r.t === 'resetWorld') { if (r.confirm !== 'SIFIRLA') return 'Onay metni yanlış.'; return this.tx((w) => { resetWorld(w, this.clock()); w.solo = true; void this.saveNow(); return 'Yeni dünya kuruldu.'; }); }
    if (r.t === 'setPassword' || r.t === 'snapshot' || r.t === 'restoreSnapshot') return 'Tek kişilik oyunda yok.';
    return this.tx((w) => admin(w, r));
  }
  async snapshots(): Promise<Snapshot[]> { return []; }
}

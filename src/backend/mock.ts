/**
 * Local dev backend: runs the exact server logic in the browser, persisted in localStorage.
 * Several tabs share the same world (crude multiplayer for testing).
 */
import type { Action, ActionResult, Profession, World } from '../sim/types';
import { resetWorld, act, admin, candidates, createWorld, drainChat, heartbeat, makeChat, migrateWorld, register, type Candidate, type ChatMsg } from '../server/core';
import type { AdminRequest, Backend, Session, Snapshot } from './api';
import { SNAPSHOTS_KEPT } from '../sim/constants';

interface Store { world: World; users: Record<string, { pw: string; playerId: string; founder: boolean }>; access: string; msgs: ChatMsg[]; snaps: (Snapshot & { state: string })[]; }
const KEY = 'imparatorluk-mock-v1';
export const MOCK_FOUNDER_EMAIL = 'kurucu@imparatorluk.local';

async function hash(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class MockBackend implements Backend {
  readonly mode = 'mock' as const;
  private s: Session | null = null;
  private chatTimes: number[] = [];
  constructor(private storage: Pick<globalThis.Storage, 'getItem' | 'setItem'> = localStorage, private clock: () => number = () => Date.now()) {}

  private load(): Store {
    const raw = this.storage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
    return { world: createWorld(Math.floor(Math.random() * 1e9), this.clock()), users: {}, access: 'imparator', msgs: [], snaps: [] };
  }
  private save(st: Store): void { this.storage.setItem(KEY, JSON.stringify(st)); }
  private tx<T>(f: (st: Store) => T): T {
    const st = this.load(); migrateWorld(st.world); const r = f(st);
    for (const m of drainChat(st.world)) st.msgs.push({ id: `${m.at}-${Math.round(Math.random() * 1e6)}`, ...m });
    if (st.msgs.length > 300) st.msgs.splice(0, st.msgs.length - 300);
    this.save(st); return r;
  }

  session(): Session | null { return this.s; }
  async restore(): Promise<Session | null> {
    const id = this.storage.getItem(`${KEY}-session`);
    if (!id) return null;
    const st = this.load(); const u = Object.values(st.users).find((x) => x.playerId === id);
    this.s = u ? { playerId: u.playerId, founder: u.founder } : null; return this.s;
  }
  async candidates(access: string): Promise<Candidate[] | string> {
    const st = this.load(); if (access !== st.access) return 'Giriş şifresi yanlış.'; return candidates(st.world);
  }
  async register(access: string, email: string, password: string, name: string, prof: Profession, takeOverId?: string | null): Promise<string | null> {
    const ph = await hash(password);
    return this.tx((st) => {
      if (access !== st.access) return 'Giriş şifresi yanlış. Davet eden kişiden şifreyi isteyin.';
      const e = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(e) || password.length < 6) return 'Geçerli e-posta ve en az 6 haneli şifre girin.';
      if (st.users[e]) return 'Bu e-posta zaten kayıtlı.';
      const founder = e === MOCK_FOUNDER_EMAIL || Object.keys(st.users).length === 0;
      const playerId = `u${Object.keys(st.users).length + 1}-${Math.round(Math.random() * 1e6)}`;
      try { register(st.world, playerId, name, prof, founder, this.clock(), takeOverId); } catch (err) { return (err as Error).message; }
      st.users[e] = { pw: ph, playerId, founder };
      this.s = { playerId, founder }; this.storage.setItem(`${KEY}-session`, playerId);
      return null;
    });
  }
  async login(email: string, password: string): Promise<string | null> {
    const st = this.load(); const u = st.users[email.trim().toLowerCase()];
    if (!u || u.pw !== (await hash(password))) return 'E-posta ya da şifre yanlış.';
    if (st.world.players[u.playerId]?.banned) return 'Bu hesap sürgün edildi.';
    this.s = { playerId: u.playerId, founder: u.founder }; this.storage.setItem(`${KEY}-session`, u.playerId); return null;
  }
  async logout(): Promise<void> { this.s = null; this.storage.setItem(`${KEY}-session`, ''); }
  async heartbeat(): Promise<{ world: World; summary: string | null }> {
    const me = this.s; if (!me) throw new Error('oturum yok');
    return this.tx((st) => {
      const r = heartbeat(st.world, me.playerId, this.clock());
      if (r.snapshotDue) this.snapshotInto(st);
      return { world: st.world, summary: r.summary };
    });
  }
  async act(a: Action): Promise<ActionResult> {
    const me = this.s; if (!me) return { ok: false, msg: 'Oturum yok.' };
    return this.tx((st) => act(st.world, me.playerId, a, this.clock()));
  }
  async chat(text: string, to: string | null): Promise<string | null> {
    const me = this.s; if (!me) return 'Oturum yok.';
    return this.tx((st) => { const m = makeChat(st.world, me.playerId, text, to, this.chatTimes, this.clock()); if (typeof m === 'string') return m; st.msgs.push(m); if (st.msgs.length > 300) st.msgs.shift(); return null; });
  }
  async messages(): Promise<ChatMsg[]> {
    const st = this.load(); const me = this.s ? st.world.players[this.s.playerId]?.personId : undefined;
    return st.msgs.filter((m) => m.toPersonId === null || m.toPersonId === me || m.fromPersonId === me);
  }
  private snapshotInto(st: Store): void {
    st.snaps.push({ id: `s${this.clock()}`, at: this.clock(), day: st.world.day, state: JSON.stringify(st.world) });
    while (st.snaps.length > SNAPSHOTS_KEPT) st.snaps.shift();
  }
  async admin(r: AdminRequest): Promise<string> {
    if (!this.s?.founder) return 'Yetkiniz yok.';
    return this.tx((st) => {
      if (r.t === 'setPassword') { if (r.password.length < 4) return 'En az 4 karakter.'; st.access = r.password; return 'Giriş şifresi değişti.'; }
      if (r.t === 'snapshot') { this.snapshotInto(st); return 'Yedek alındı.'; }
      if (r.t === 'resetWorld') { if (r.confirm !== 'SIFIRLA') return 'Onay metni yanlış.'; this.snapshotInto(st); resetWorld(st.world, this.clock()); return 'Dünya sıfırlandı (önce yedek alındı).'; }
      if (r.t === 'restoreSnapshot') { const s = st.snaps.find((x) => x.id === r.id); if (!s) return 'Yedek yok.'; const old = st.world; st.world = JSON.parse(s.state) as World; st.world.players = { ...st.world.players, ...old.players }; st.world.lastTickAt = this.clock(); return `Gün ${s.day} yedeği geri yüklendi.`; }
      return admin(st.world, r);
    });
  }
  async snapshots(): Promise<Snapshot[]> { return this.load().snaps.map(({ id, at, day }) => ({ id, at, day })); }
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Action, ActionResult, Profession, World } from '../sim/types';
import type { Candidate, ChatMsg } from '../server/core';
import type { AdminRequest, Backend, Session, Snapshot } from './api';

/** Production backend: Supabase Auth + Edge Function `game` (authoritative) + messages table. */
export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const;
  private sb: SupabaseClient;
  private s: Session | null = null;
  constructor(url: string, anonKey: string) { this.sb = createClient(url, anonKey); }

  private async call<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.functions.invoke('game', { body });
    if (error) throw new Error(error.message);
    return data as T;
  }
  session(): Session | null { return this.s; }
  async restore(): Promise<Session | null> {
    const { data } = await this.sb.auth.getSession();
    if (!data.session) return null;
    const me = await this.call<{ playerId: string; founder: boolean } | null>({ op: 'me' });
    this.s = me; return me;
  }
  async candidates(access: string): Promise<Candidate[] | string> {
    const r = await this.call<Candidate[] | { error: string }>({ op: 'candidates', access });
    return Array.isArray(r) ? r : r.error;
  }
  async register(access: string, email: string, password: string, name: string, prof: Profession, takeOverId?: string | null): Promise<string | null> {
    const r = await this.call<{ error?: string }>({ op: 'register', access, email, password, name, prof, takeOverId: takeOverId ?? null });
    if (r.error) return r.error;
    return this.login(email, password);
  }
  async login(email: string, password: string): Promise<string | null> {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) return 'E-posta ya da şifre yanlış.';
    const me = await this.restore(); return me ? null : 'Hesap oyunda bulunamadı.';
  }
  async logout(): Promise<void> { await this.sb.auth.signOut(); this.s = null; }
  async heartbeat(): Promise<{ world: World; summary: string | null }> { return this.call({ op: 'heartbeat' }); }
  async act(a: Action): Promise<ActionResult> { return this.call({ op: 'act', action: a }); }
  async chat(text: string, to: string | null): Promise<string | null> { const r = await this.call<{ error?: string }>({ op: 'chat', text, to }); return r.error ?? null; }
  async messages(): Promise<ChatMsg[]> {
    // RLS returns only public messages and my DMs
    const { data } = await this.sb.from('messages').select('*').order('id', { ascending: false }).limit(150);
    return (data ?? []).reverse().map((m: { id: number; from_person: string; from_name: string; to_person: string | null; text: string; created_at: string }) => ({ id: String(m.id), fromPersonId: m.from_person, fromName: m.from_name, toPersonId: m.to_person, text: m.text, at: Date.parse(m.created_at) }));
  }
  async admin(r: AdminRequest): Promise<string> { const x = await this.call<{ msg: string }>({ op: 'admin', req: r }); return x.msg; }
  async snapshots(): Promise<Snapshot[]> { return this.call({ op: 'snapshots' }); }
}

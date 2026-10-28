import type { Action, ActionResult, Profession, World } from '../sim/types';
import type { AdminOp, Candidate, ChatMsg } from '../server/core';

export type AdminRequest = AdminOp | { t: 'setPassword'; password: string } | { t: 'snapshot' } | { t: 'restoreSnapshot'; id: string } | { t: 'resetWorld'; confirm: string };
export interface Snapshot { id: string; at: number; day: number; }
export interface Session { playerId: string; founder: boolean; }

export interface Backend {
  readonly mode: 'mock' | 'supabase';
  session(): Session | null;
  restore(): Promise<Session | null>;
  register(access: string, email: string, password: string, name: string, prof: Profession, takeOverId?: string | null): Promise<string | null>;
  /** NPCs available for take-over; requires the access password. Returns an error string on failure. */
  candidates(access: string): Promise<Candidate[] | string>;
  login(email: string, password: string): Promise<string | null>;
  logout(): Promise<void>;
  heartbeat(): Promise<{ world: World; summary: string | null }>;
  act(a: Action): Promise<ActionResult>;
  chat(text: string, toPersonId: string | null): Promise<string | null>;
  messages(): Promise<ChatMsg[]>;
  admin(r: AdminRequest): Promise<string>;
  snapshots(): Promise<Snapshot[]>;
}

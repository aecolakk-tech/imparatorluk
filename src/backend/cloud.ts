/**
 * v2.1.0 optional cloud backup for the single-player save: Supabase Auth (e-posta + şifre) + table cloud_saves (RLS: own row only).
 * Only on explicit button presses. Uploads are gzip + base64.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { gzip, gunzip, toB64, fromB64 } from './save';

export interface CloudInfo { day: number; name: string; game: string; size: number; updated_at: string }

export class CloudSave {
  private sb: SupabaseClient;
  constructor(url: string, key: string, storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }) {
    this.sb = createClient(url, key, { auth: { storageKey: 'imp-cloud-auth', persistSession: true, autoRefreshToken: true, ...(storage ? { storage } : {}) } });
  }
  async user(): Promise<string | null> { const { data } = await this.sb.auth.getSession(); return data.session?.user.email ?? null; }
  async signIn(email: string, password: string): Promise<string | null> {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    return error ? (/invalid/i.test(error.message) ? 'E-posta ya da şifre yanlış.' : /confirm/i.test(error.message) ? 'E-posta adresi henüz onaylanmamış (gelen kutunuza bakın).' : `Giriş olmadı: ${error.message}`) : null;
  }
  async signUp(email: string, password: string, redirect?: string): Promise<string | null> {
    if (password.length < 6) return 'Şifre en az 6 karakter olmalı.';
    const { data, error } = await this.sb.auth.signUp({ email: email.trim().toLowerCase(), password, options: redirect ? { emailRedirectTo: redirect } : undefined });
    if (error) return `Hesap açılamadı: ${error.message}`;
    return data.session ? null : 'Hesap açıldı. E-postanıza gelen onay bağlantısına tıklayın, sonra buradan giriş yapın.';
  }
  async signOut(): Promise<void> { await this.sb.auth.signOut(); }
  async info(): Promise<CloudInfo | null | string> {
    const uid = await this.uid(); if (!uid) return 'Önce giriş yapın.';
    const { data, error } = await this.sb.from('cloud_saves').select('day,name,game,size,updated_at').eq('user_id', uid).maybeSingle();
    return error ? `Bulut okunamadı: ${error.message}` : (data as CloudInfo | null);
  }
  async upload(json: string, day: number, name: string, game: string): Promise<string | null> {
    const uid = await this.uid(); if (!uid) return 'Önce giriş yapın.';
    const data = toB64(await gzip(json));
    const { error } = await this.sb.from('cloud_saves').upsert({ user_id: uid, data, day, name, game, size: json.length, updated_at: new Date().toISOString() });
    return error ? `Yedeklenemedi: ${error.message}` : null;
  }
  /** the saved JSON text, or an error string */
  async download(): Promise<{ json: string } | string> {
    const uid = await this.uid(); if (!uid) return 'Önce giriş yapın.';
    const { data, error } = await this.sb.from('cloud_saves').select('data').eq('user_id', uid).maybeSingle();
    if (error) return `Bulut okunamadı: ${error.message}`;
    if (!data) return 'Bulutta yedek yok.';
    try { return { json: await gunzip(fromB64((data as { data: string }).data)) }; } catch { return 'Buluttaki yedek bozuk.'; }
  }
  private async uid(): Promise<string | null> { const { data } = await this.sb.auth.getSession(); return data.session?.user.id ?? null; }
}

export function makeCloud(): CloudSave | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined; const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && key ? new CloudSave(url, key) : null;
}

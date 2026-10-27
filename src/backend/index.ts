import type { Backend } from './api';
import { MockBackend } from './mock';
import { SupabaseBackend } from './supabase';

export function makeBackend(): Backend {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && key && import.meta.env.VITE_BACKEND !== 'mock') return new SupabaseBackend(url, key);
  return new MockBackend();
}
